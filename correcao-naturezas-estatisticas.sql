-- Aplicar somente após homologação. Mantém as permissões e os escopos existentes.
begin;
create or replace function public.chave_natureza_estatistica(p_nome text)
returns text language sql immutable security invoker set search_path=pg_catalog as $$
 select case
 when k ~ '^HOMICIDIO($| (SIMPLES|QUALIFICADO)( |$)| *\((ART\.))' and k !~ '(TENTATIVA|CULPOS[OA])' then 'HOMICIDIO'
 when k in ('ACHADO DE CADAVER','ENCONTRO DE CADAVER') then 'ENCONTRO DE CADAVER'
 when k ~ '(MARIA DA PENHA|VIOLENCIA DOMESTICA)' then 'MARIA DA PENHA / VIOLENCIA DOMESTICA'
 when k ~ '^(SINISTRO|ACIDENTE) DE TRANSITO( |$)' then 'SINISTRO DE TRANSITO'
 else k end
 from (select regexp_replace(regexp_replace(translate(upper(btrim(coalesce(p_nome,''))), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','AAAAAEEEEIIIIOOOOOUUUUC'), '[[:space:]]+', ' ', 'g'), '^[0-9]+[[:space:]]*[:—–-][[:space:]]*', '') k) q
$$;
create or replace function public.ocorrencia_contem_natureza(p_principal text,p_crime text,p_itens jsonb,p_filtro text)
returns boolean language sql immutable security invoker set search_path=pg_catalog,public as $$
 select nullif(btrim(p_filtro),'') is null or exists(
 select 1 from (
 select coalesce(nullif(p_principal,''),case when jsonb_array_length(case when jsonb_typeof(p_itens)='array' then p_itens else '[]'::jsonb end)=0 then p_crime end) nome
 union all
 select case when jsonb_typeof(j)='string' then j#>>'{}' else coalesce(j->>'nome',j->>'tipo') end
 from jsonb_array_elements(case when jsonb_typeof(p_itens)='array' then p_itens else '[]'::jsonb end) j
 ) n where public.chave_natureza_estatistica(n.nome)=public.chave_natureza_estatistica(p_filtro))
$$;

CREATE OR REPLACE FUNCTION public.obter_home_cpc(data_inicio date DEFAULT NULL::date, data_fim date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth', 'private'
AS $function$
with recursive
ctx as (
  select
    private.unidade_atual() as comando_id,
    exists (
      select 1 from public.unidades u
      where u.id=private.unidade_atual() and u.ativo=true and u.tipo='COMANDO'
    ) as autorizado
  where private.usuario_ativo()
),
descendentes as (
  select u.id,u.sigla,u.nome,u.tipo,u.parent_id
  from public.unidades u join ctx c on u.parent_id=c.comando_id
  where c.autorizado=true and u.ativo=true
  union all
  select u.id,u.sigla,u.nome,u.tipo,u.parent_id
  from public.unidades u join descendentes d on u.parent_id=d.id
  where u.ativo=true
),
ocorrencias_base as (
  select o.id,o.data_ocorrencia,o.numero_bo,o.ocorrencia,o.crime,coalesce(o.naturezas_itens,'[]'::jsonb) as naturezas_itens,o.cavalaria_classe_registro,o.cavalaria_tipo_atividade,o.cavalaria_pelotao,o.cavalaria_instituicao,o.escola_nome,o.bairro,o.sisc,o.companhia,o.turno,
         o.status_atendimento,
         public.conducoes_estatisticas(o.numero_conduzidos,o.numero_prisoes) as conducoes_operacionais,
         coalesce(o.veiculos_recuperados,0) as veiculos_recuperados,
         o.unidade_id,o.subunidade_operacional_id,d.sigla as unidade_sigla,d.nome as unidade_nome
  from public.ocorrencias o join descendentes d on d.id=o.unidade_id
  where (data_inicio is null or o.data_ocorrencia>=data_inicio)
    and (data_fim is null or o.data_ocorrencia<=data_fim)
),
tcos_base as (
  select t.id,t.data_tco,t.numero_tco,o.unidade_id,o.subunidade_operacional_id,d.sigla as unidade_sigla,d.nome as unidade_nome
  from public.tcos t
  join public.ocorrencias o on o.id=t.ocorrencia_id
  join descendentes d on d.id=o.unidade_id
  where (data_inicio is null or t.data_tco>=data_inicio)
    and (data_fim is null or t.data_tco<=data_fim)
)
select case
  when not coalesce((select autorizado from ctx),false) then
    jsonb_build_object('autorizado',false,'erro','Acesso restrito ao contexto de uma unidade do tipo COMANDO.')
  else jsonb_build_object(
    'autorizado',true,
    'periodo',jsonb_build_object('inicio',data_inicio,'fim',data_fim),
    'unidades',coalesce((
      select jsonb_agg(jsonb_build_object('id',d.id,'sigla',d.sigla,'nome',d.nome,'tipo',d.tipo,'parent_id',d.parent_id) order by d.sigla)
      from descendentes d
    ),'[]'::jsonb),
    'ocorrencias',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',b.id,'data_ocorrencia',b.data_ocorrencia,'numero_bo',b.numero_bo,'ocorrencia',b.ocorrencia,'crime',b.crime,'naturezas_itens',b.naturezas_itens,'cavalaria_classe_registro',b.cavalaria_classe_registro,'cavalaria_tipo_atividade',b.cavalaria_tipo_atividade,'cavalaria_pelotao',b.cavalaria_pelotao,'cavalaria_instituicao',b.cavalaria_instituicao,'escola_nome',b.escola_nome,
        'bairro',b.bairro,'sisc',b.sisc,'companhia',b.companhia,'turno',b.turno,'status_atendimento',b.status_atendimento,
        'conducoes_operacionais',b.conducoes_operacionais,'veiculos_recuperados',b.veiculos_recuperados,
        'unidade_id',b.unidade_id,'subunidade_operacional_id',b.subunidade_operacional_id,'unidade_sigla',b.unidade_sigla,'unidade_nome',b.unidade_nome
      ) order by b.data_ocorrencia desc)
      from ocorrencias_base b
    ),'[]'::jsonb),
    'tcos',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',t.id,'data_tco',t.data_tco,'numero_tco',t.numero_tco,'unidade_id',t.unidade_id,'subunidade_operacional_id',t.subunidade_operacional_id,
        'unidade_sigla',t.unidade_sigla,'unidade_nome',t.unidade_nome
      ) order by t.data_tco desc)
      from tcos_base t
    ),'[]'::jsonb)
  )
end
from (select 1) x
$function$;

CREATE OR REPLACE FUNCTION public.obter_mapa_cpc_territorial(data_inicio date, data_fim date, p_unidade_id uuid DEFAULT NULL::uuid, p_tipo_filtro text DEFAULT NULL::text, p_aisc text DEFAULT NULL::text, p_sisc text DEFAULT NULL::text, p_setor text DEFAULT NULL::text, p_bairro text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, data_ocorrencia date, numero_bo text, ocorrencia text, crime text, bairro text, endereco text, latitude double precision, longitude double precision, aisc text, sisc text, setor text, companhia text, turno text, unidade_id uuid, unidade_sigla text, unidade_nome text, unidade_territorial_id uuid, unidade_territorial_sigla text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth', 'private'
AS $function$
with recursive
ctx as (
  select private.unidade_atual() comando_id,
         exists(
           select 1 from public.unidades u
           where u.id=private.unidade_atual() and u.ativo=true and u.tipo='COMANDO'
         ) autorizado
  where private.usuario_ativo()
),
descendentes as (
  select u.id,u.sigla,u.nome,u.tipo,u.parent_id,u.agrega_descendentes,array[u.id]::uuid[] caminho
  from public.unidades u
  join ctx c on u.parent_id=c.comando_id
  where c.autorizado=true and u.ativo=true
  union all
  select u.id,u.sigla,u.nome,u.tipo,u.parent_id,u.agrega_descendentes,d.caminho||u.id
  from public.unidades u
  join descendentes d on u.parent_id=d.id
  where u.ativo=true and not u.id=any(d.caminho)
),
selecionada as (
  select d.id,d.agrega_descendentes
  from descendentes d
  where d.id=p_unidade_id
)
select
  o.id,o.data_ocorrencia,o.numero_bo,o.ocorrencia,o.crime,o.bairro,
  coalesce(o.endereco_formatado,o.endereco),
  o.latitude,o.longitude,t.info->>'aisc',
  coalesce(nullif(o.sisc,''),t.info->>'sisc'),t.info->>'setor',
  o.companhia,o.turno,o.unidade_id,d.sigla,d.nome,
  nullif(t.info->>'unidade_id','')::uuid,t.info->>'unidade_sigla'
from public.ocorrencias o
join descendentes d on d.id=o.unidade_id
left join lateral (select public.territorio_por_bairro(o.bairro) info) t on true
where o.data_ocorrencia between data_inicio and data_fim
  and o.latitude is not null and o.longitude is not null
  and (
    p_unidade_id is null
    or o.unidade_id=p_unidade_id
    or o.subunidade_operacional_id=p_unidade_id
    or (
      coalesce((select s.agrega_descendentes from selecionada s),false)
      and p_unidade_id=any(d.caminho)
    )
  )
  and public.ocorrencia_contem_natureza(o.ocorrencia,o.crime,o.naturezas_itens,p_tipo_filtro)
  and (p_aisc is null or btrim(p_aisc)='' or upper(coalesce(t.info->>'aisc',''))=upper(btrim(p_aisc)))
  and (p_sisc is null or btrim(p_sisc)='' or upper(coalesce(nullif(o.sisc,''),t.info->>'sisc',''))=upper(btrim(p_sisc)))
  and (p_setor is null or btrim(p_setor)='' or upper(coalesce(t.info->>'setor',''))=upper(btrim(p_setor)))
  and (p_bairro is null or btrim(p_bairro)=''
    or public.normalizar_bairro_sisc(o.bairro)=public.normalizar_bairro_sisc(p_bairro)
    or (
      t.info->>'bairro_id' is not null
      and t.info->>'bairro_id'=public.territorio_por_bairro(p_bairro)->>'bairro_id'
    )
  )
order by o.data_ocorrencia desc,o.hora_inicial desc nulls last
$function$;

CREATE OR REPLACE FUNCTION public.obter_ocorrencias_mapa(data_inicio date, data_fim date, tipo_filtro text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, data_ocorrencia date, ocorrencia text, bairro text, endereco text, latitude double precision, longitude double precision)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$ select o.id,o.data_ocorrencia,o.ocorrencia,o.bairro,coalesce(o.endereco_formatado,o.endereco),o.latitude,o.longitude from public.ocorrencias o where o.data_ocorrencia between data_inicio and data_fim and o.latitude is not null and o.longitude is not null and public.ocorrencia_contem_natureza(o.ocorrencia,o.crime,o.naturezas_itens,tipo_filtro) order by o.data_ocorrencia desc; $function$;


create or replace function public.ocorrencia_busca_natureza(p_principal text,p_crime text,p_itens jsonb,p_filtro text)
returns boolean language sql immutable security invoker set search_path=pg_catalog,public as $$
 select case when nullif(btrim(p_filtro),'') is null then true
 when public.chave_natureza_estatistica(p_filtro) in ('HOMICIDIO','ENCONTRO DE CADAVER') and translate(upper(btrim(p_filtro)), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','AAAAAEEEEIIIIOOOOOUUUUC') in ('HOMICIDIO','ENCONTRO DE CADAVER','ACHADO DE CADAVER') then public.ocorrencia_contem_natureza(p_principal,p_crime,p_itens,p_filtro)
 else exists(select 1 from (
 select coalesce(nullif(p_principal,''),case when jsonb_array_length(case when jsonb_typeof(p_itens)='array' then p_itens else '[]'::jsonb end)=0 then p_crime end) nome
 union all
 select case when jsonb_typeof(j)='string' then j#>>'{}' else coalesce(j->>'nome',j->>'tipo') end
 from jsonb_array_elements(case when jsonb_typeof(p_itens)='array' then p_itens else '[]'::jsonb end) j
 ) n where strpos(translate(upper(coalesce(n.nome,'')), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','AAAAAEEEEIIIIOOOOOUUUUC'),translate(upper(btrim(p_filtro)), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','AAAAAEEEEIIIIOOOOOUUUUC'))>0
 or strpos(public.chave_natureza_estatistica(n.nome),public.chave_natureza_estatistica(p_filtro))>0) end
$$;

CREATE OR REPLACE FUNCTION public.obter_indicadores_origem_envolvimento_cpc(data_inicio date DEFAULT NULL::date, data_fim date DEFAULT NULL::date, p_unidade_id uuid DEFAULT NULL::uuid, p_aisc text DEFAULT NULL::text, p_sisc text DEFAULT NULL::text, p_setor text DEFAULT NULL::text, p_ocorrencia text DEFAULT NULL::text, p_bairro text DEFAULT NULL::text, p_companhia text DEFAULT NULL::text, p_turno text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'private', 'auth'
AS $function$
with recursive
contexto as (
  select u.id comando_id,
    (
      public.obter_contexto_unidade_usuario()->>'perfil'='COMANDANTE'
      and public.obter_contexto_unidade_usuario()->>'unidade_principal_sigla'='CPC'
    ) comandante
  from public.unidades u
  where u.id=private.unidade_atual()
    and u.ativo=true and u.tipo='COMANDO' and private.usuario_ativo()
),
descendentes as (
  select u.id,u.tipo,u.parent_id,u.agrega_descendentes
  from public.unidades u join contexto c on c.comando_id=u.parent_id
  where u.ativo=true
  union all
  select u.id,u.tipo,u.parent_id,u.agrega_descendentes
  from public.unidades u join descendentes d on u.parent_id=d.id
  where u.ativo=true
),
arvore_selecionada as (
  select d.id,d.tipo,d.parent_id,d.agrega_descendentes
  from descendentes d
  where p_unidade_id is not null and d.id=p_unidade_id
  union all
  select d.id,d.tipo,d.parent_id,d.agrega_descendentes
  from descendentes d join arvore_selecionada a on a.id=d.parent_id
  where a.agrega_descendentes=true
),
escopo as (
  select d.id from descendentes d where p_unidade_id is null
  union
  select s.id from arvore_selecionada s
),
candidatas as materialized (
  select o.id,o.data_ocorrencia,o.bairro,o.sisc,o.companhia,o.turno,
         o.ocorrencia,o.crime,o.naturezas_itens,o.escola_id,o.escola_nome,o.origem_acionamento,o.observacao_final,o.criado_em
  from public.ocorrencias o
  where (data_inicio is null or o.data_ocorrencia>=data_inicio)
    and (data_fim is null or o.data_ocorrencia<=data_fim)
    and (
      exists(select 1 from escopo e where e.id=o.unidade_id)
      or (
        p_unidade_id is not null and exists(
          select 1 from arvore_selecionada a
          where a.tipo='SUBUNIDADE' and a.id=o.subunidade_operacional_id
        )
      )
    )
),
territorios as materialized (
  select b.bairro,public.territorio_por_bairro(b.bairro) info
  from (select distinct bairro from candidatas) b
),
filtradas as (
  select c.id,c.ocorrencia,c.crime,c.escola_id,c.escola_nome,c.origem_acionamento,c.observacao_final,c.criado_em
  from candidatas c
  left join territorios t on t.bairro=c.bairro
  where (p_aisc is null or btrim(p_aisc)='' or upper(coalesce(t.info->>'aisc',''))=upper(btrim(p_aisc)))
    and (p_sisc is null or btrim(p_sisc)='' or upper(coalesce(nullif(c.sisc,''),t.info->>'sisc',''))=upper(btrim(p_sisc)))
    and (p_setor is null or btrim(p_setor)='' or upper(coalesce(t.info->>'setor',''))=upper(btrim(p_setor)))
    and public.ocorrencia_busca_natureza(c.ocorrencia,c.crime,c.naturezas_itens,p_ocorrencia)
    and (
      p_bairro is null or btrim(p_bairro)=''
      or upper(coalesce(c.bairro,'')) like '%'||upper(btrim(p_bairro))||'%'
      or upper(coalesce(t.info->>'bairro','')) like '%'||upper(btrim(p_bairro))||'%'
      or (t.info->>'bairro_id' is not null
        and t.info->>'bairro_id'=public.territorio_por_bairro(p_bairro)->>'bairro_id')
    )
    and (p_companhia is null or btrim(p_companhia)='' or upper(btrim(coalesce(c.companhia,'')))=upper(btrim(p_companhia)))
    and (p_turno is null or btrim(p_turno)='' or upper(btrim(coalesce(c.turno,'')))=upper(btrim(p_turno)))
),
metadados as (
  select f.id,f.origem_acionamento,f.criado_em,
    case when f.criado_em >= timestamptz '2026-11-06 00:00:00-04:00' and f.observacao_final is not null
          and strpos(f.observacao_final,'[[PESSOAS_ENVOLVIDAS]]')>0
          and pg_input_is_valid(
            substring(f.observacao_final from strpos(f.observacao_final,'[[PESSOAS_ENVOLVIDAS]]')+char_length('[[PESSOAS_ENVOLVIDAS]]')),
            'jsonb')
      then substring(f.observacao_final from strpos(f.observacao_final,'[[PESSOAS_ENVOLVIDAS]]')+char_length('[[PESSOAS_ENVOLVIDAS]]'))::jsonb
      else '{}'::jsonb end as meta
  from filtradas f
),
pessoas as (
  select m.id,m.origem_acionamento,m.criado_em,
    exists(
      select 1 from (
        select m.meta #> '{institucionaisPrincipais,vitima}' perfil
        union all
        select v->'institucional' from jsonb_array_elements(
          case when jsonb_typeof(m.meta->'vitimas')='array' then m.meta->'vitimas' else '[]'::jsonb end
        ) v
      ) q
      where q.perfil->>'situacao'='SIM'
        and q.perfil->>'tipo' in (
          'POLICIAL_MILITAR','POLICIAL_CIVIL','POLICIAL_FEDERAL',
          'POLICIAL_RODOVIARIO_FEDERAL','POLICIAL_PENAL','DELEGADO_POLICIA','OUTRO_POLICIAL'
        )
    ) vitima_policial,
    exists(
      select 1 from (
        select m.meta #> '{institucionaisPrincipais,infrator}' perfil
        union all
        select a->'institucional' from jsonb_array_elements(
          case when jsonb_typeof(m.meta->'infratores')='array' then m.meta->'infratores' else '[]'::jsonb end
        ) a
      ) q
      where q.perfil->>'situacao'='SIM'
        and q.perfil->>'tipo' in (
          'POLICIAL_MILITAR','POLICIAL_CIVIL','POLICIAL_FEDERAL',
          'POLICIAL_RODOVIARIO_FEDERAL','POLICIAL_PENAL','DELEGADO_POLICIA','OUTRO_POLICIAL'
        )
    ) infrator_policial,
    exists(
      select 1 from (
        select m.meta #> '{institucionaisPrincipais,vitima}' perfil
        union all
        select m.meta #> '{institucionaisPrincipais,infrator}'
        union all
        select v->'institucional' from jsonb_array_elements(
          case when jsonb_typeof(m.meta->'vitimas')='array' then m.meta->'vitimas' else '[]'::jsonb end
        ) v
        union all
        select a->'institucional' from jsonb_array_elements(
          case when jsonb_typeof(m.meta->'infratores')='array' then m.meta->'infratores' else '[]'::jsonb end
        ) a
      ) q
      where q.perfil->>'situacao' in ('SIM','NAO')
    ) classificacao_preenchida,
    exists(
      select 1 from (
        select m.meta #> '{institucionaisPrincipais,vitima}' perfil
        union all
        select v->'institucional' from jsonb_array_elements(
          case when jsonb_typeof(m.meta->'vitimas')='array'
               then m.meta->'vitimas' else '[]'::jsonb end
        ) v
      ) q
      where q.perfil->>'situacao'='SIM'
        and q.perfil->>'tipo' in ('MAGISTRADO','MEMBRO_MINISTERIO_PUBLICO',
          'AUTORIDADE_POLITICA_ADMINISTRATIVA','OUTRA_AUTORIDADE')
    ) vitima_autoridade,
    exists(
      select 1 from (
        select m.meta #> '{institucionaisPrincipais,infrator}' perfil
        union all
        select v->'institucional' from jsonb_array_elements(
          case when jsonb_typeof(m.meta->'infratores')='array'
               then m.meta->'infratores' else '[]'::jsonb end
        ) v
      ) q
      where q.perfil->>'situacao'='SIM'
        and q.perfil->>'tipo' in ('MAGISTRADO','MEMBRO_MINISTERIO_PUBLICO',
          'AUTORIDADE_POLITICA_ADMINISTRATIVA','OUTRA_AUTORIDADE')
    ) infrator_autoridade
  from metadados m
),
resumo as (
  select count(*)::integer total_ocorrencias,
    count(*) filter(where criado_em >= timestamptz '2026-11-06 00:00:00-04:00')::integer novos_cadastros,
    count(*) filter(where origem_acionamento='CICC')::integer cicc,
    count(*) filter(where origem_acionamento='PATRULHAMENTO')::integer patrulhamento,
    count(*) filter(where origem_acionamento='ABORDAGEM')::integer abordagem,
    count(*) filter(where origem_acionamento='MISSAO')::integer missao,
    count(*) filter(where origem_acionamento='OPERACAO')::integer operacao,
    count(*) filter(where origem_acionamento='OUTRA')::integer outra,
    count(*) filter(where origem_acionamento is null
      or origem_acionamento not in ('CICC','PATRULHAMENTO','ABORDAGEM','MISSAO','OPERACAO','OUTRA'))::integer nao_informada,
    count(*) filter(where vitima_policial or infrator_policial)::integer policiais_total,
    count(*) filter(where vitima_policial)::integer policiais_vitimas,
    count(*) filter(where infrator_policial)::integer policiais_infratores,
    count(*) filter(where classificacao_preenchida)::integer classificados_funcionais,
    count(*) filter(where vitima_autoridade or infrator_autoridade)::integer autoridades_total,
    count(*) filter(where vitima_autoridade)::integer autoridades_vitimas,
    count(*) filter(where infrator_autoridade)::integer autoridades_infratores,
    count(*) filter(where vitima_policial or infrator_policial or vitima_autoridade or infrator_autoridade)::integer envolvidos_total
  from pessoas
)
select case when exists(select 1 from contexto) then
  jsonb_build_object(
    'autorizado',true,
    'total',r.total_ocorrencias,
    'origens',jsonb_build_object(
      'CICC',r.cicc,'PATRULHAMENTO',r.patrulhamento,'ABORDAGEM',r.abordagem,
      'MISSAO',r.missao,'OPERACAO',r.operacao,'OUTRA',r.outra,'NAO_INFORMADA',r.nao_informada),
    'origem_informada',r.total_ocorrencias-r.nao_informada,
    'escolas',jsonb_build_object(
      'total',(select count(*) from filtradas where escola_id is not null),
      'instituicoes',(select count(distinct escola_id) from filtradas where escola_id is not null),
      'ranking',coalesce((
        select jsonb_agg(jsonb_build_object(
          'nome',g.nome,'total',g.total,
          'naturezas',(
            select coalesce(jsonb_agg(jsonb_build_object('tipo',q.ocorrencia,'subtipo',q.crime,'quantidade',q.quantidade)) ,'[]'::jsonb)
            from (select f2.ocorrencia,f2.crime,count(*) quantidade
              from filtradas f2 where f2.escola_id=g.chave
              group by f2.ocorrencia,f2.crime order by count(*) desc) q
          )
        ) order by g.total desc)
        from (select f.escola_id chave,e.nome,count(*) total
          from filtradas f join public.escolas e on e.id=f.escola_id where f.escola_id is not null
          group by f.escola_id,e.nome order by count(*) desc limit 40) g
      ),'[]'::jsonb)
    ),
    'pode_ver_envolvimento',(select c.comandante from contexto c),
    'envolvidos_total',case when (select c.comandante from contexto c) then r.envolvidos_total else null end,
    'policiais',case when (select c.comandante from contexto c) then jsonb_build_object(
      'total',r.policiais_total,'vitimas',r.policiais_vitimas,
      'infratores',r.policiais_infratores,
      'classificados',r.classificados_funcionais,
      'novos_cadastros',r.novos_cadastros,
      'sem_classificacao',r.novos_cadastros-r.classificados_funcionais) else null end,
    'autoridades',case when (select c.comandante from contexto c) then jsonb_build_object(
      'total',r.autoridades_total,'vitimas',r.autoridades_vitimas,
      'infratores',r.autoridades_infratores) else null end
  ) else
  jsonb_build_object('autorizado',false,'erro','Apenas o comando ativo pode consultar este consolidado.')
end
from resumo r;
$function$;

create or replace function public.naturezas_estatisticas_bo(p_principal text,p_crime text,p_itens jsonb)
returns table(natureza text) language sql immutable security invoker set search_path=pg_catalog,public as $$
 with fonte as (
 select coalesce(nullif(btrim(p_principal),''),case when jsonb_array_length(case when jsonb_typeof(p_itens)='array' then p_itens else '[]'::jsonb end)=0 then p_crime end) nome
 union all
 select case when jsonb_typeof(j)='string' then j#>>'{}' else coalesce(j->>'nome',j->>'tipo') end
 from jsonb_array_elements(case when jsonb_typeof(p_itens)='array' then p_itens else '[]'::jsonb end) j
 ), classificadas as (
 select public.chave_natureza_estatistica(nome) k,btrim(nome) nome from fonte
 ), grupos as (
 select k,case k when 'HOMICIDIO' then 'HOMICÍDIO' when 'ENCONTRO DE CADAVER' then 'ENCONTRO DE CADÁVER'
 when 'MARIA DA PENHA / VIOLENCIA DOMESTICA' then 'MARIA DA PENHA / VIOLÊNCIA DOMÉSTICA'
 when 'SINISTRO DE TRANSITO' then 'SINISTRO DE TRÂNSITO'
 else min(nome) end natureza from classificadas where k not in ('','NI','N/I','N','NA','NAO INFORMADO') group by k
 )
 select natureza from grupos union all select 'NÃO INFORMADO' where not exists(select 1 from grupos)
$$;

CREATE OR REPLACE FUNCTION public.obter_painel_cpc_territorial(data_inicio date DEFAULT NULL::date, data_fim date DEFAULT NULL::date, p_unidade_id uuid DEFAULT NULL::uuid, p_aisc text DEFAULT NULL::text, p_sisc text DEFAULT NULL::text, p_setor text DEFAULT NULL::text, p_ocorrencia text DEFAULT NULL::text, p_bairro text DEFAULT NULL::text, p_companhia text DEFAULT NULL::text, p_turno text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth', 'private'
AS $function$
with recursive
-- Materializa a referência territorial UMA VEZ por bairro, em vez de chamar
-- territorio_por_bairro() para cada BO/TCO e para cada agregado.
-- A função mantém os filtros, o escopo autorizado e as medidas originais.
territorios as materialized (
  select b.bairro, public.territorio_por_bairro(b.bairro) info
  from (select distinct bairro from public.ocorrencias) b
),
ctx as (
  select private.unidade_atual() comando_id,
         exists(select 1 from public.unidades u where u.id=private.unidade_atual() and u.ativo=true and u.tipo='COMANDO') autorizado
  where private.usuario_ativo()
),
descendentes as (
  select u.id,u.sigla,u.nome,u.tipo,u.parent_id
  from public.unidades u join ctx c on u.parent_id=c.comando_id
  where c.autorizado=true and u.ativo=true
  union all
  select u.id,u.sigla,u.nome,u.tipo,u.parent_id
  from public.unidades u join descendentes d on u.parent_id=d.id
  where u.ativo=true
),
escopo as (
  select d.* from descendentes d where p_unidade_id is null or d.id=p_unidade_id
),
base as (
  select
    o.*,e.id unidade_agregacao_id,
    e.sigla unidade_sigla,e.nome unidade_nome,
    t.info->>'aisc' territorio_aisc,
    coalesce(nullif(o.sisc,''),t.info->>'sisc') territorio_sisc,
    t.info->>'setor' territorio_setor,
    t.info->>'bairro' territorio_bairro
  from public.ocorrencias o
  join escopo e on (e.id=o.unidade_id or (p_unidade_id is not null and e.tipo='SUBUNIDADE' and e.id=o.subunidade_operacional_id))
  left join territorios t on t.bairro=o.bairro
  where (data_inicio is null or o.data_ocorrencia>=data_inicio)
    and (data_fim is null or o.data_ocorrencia<=data_fim)
    and (p_aisc is null or btrim(p_aisc)='' or upper(coalesce(t.info->>'aisc',''))=upper(btrim(p_aisc)))
    and (p_sisc is null or btrim(p_sisc)='' or upper(coalesce(nullif(o.sisc,''),t.info->>'sisc',''))=upper(btrim(p_sisc)))
    and (p_setor is null or btrim(p_setor)='' or upper(coalesce(t.info->>'setor',''))=upper(btrim(p_setor)))
    and public.ocorrencia_busca_natureza(o.ocorrencia,o.crime,o.naturezas_itens,p_ocorrencia)
    and (
      p_bairro is null or btrim(p_bairro)=''
      or upper(coalesce(o.bairro,'')) like '%'||upper(btrim(p_bairro))||'%'
      or upper(coalesce(t.info->>'bairro','')) like '%'||upper(btrim(p_bairro))||'%'
      or (
        t.info->>'bairro_id' is not null
        and t.info->>'bairro_id'=public.territorio_por_bairro(p_bairro)->>'bairro_id'
      )
    )
    and (p_companhia is null or btrim(p_companhia)='' or upper(btrim(coalesce(o.companhia,'')))=upper(btrim(p_companhia)))
    and (p_turno is null or btrim(p_turno)='' or upper(btrim(coalesce(o.turno,'')))=upper(btrim(p_turno)))
),
tcos_base as (
  select e.id unidade_id,count(*)::bigint total_tcos,
         count(*) filter(where e.id=o.unidade_id)::bigint total_administrativo
  from public.tcos tc
  join public.ocorrencias o on o.id=tc.ocorrencia_id
  join escopo e on (e.id=o.unidade_id or (e.tipo='SUBUNIDADE' and e.id=o.subunidade_operacional_id))
  left join territorios t on t.bairro=o.bairro
  where (data_inicio is null or tc.data_tco>=data_inicio)
    and (data_fim is null or tc.data_tco<=data_fim)
    and (p_aisc is null or btrim(p_aisc)='' or upper(coalesce(t.info->>'aisc',''))=upper(btrim(p_aisc)))
    and (p_sisc is null or btrim(p_sisc)='' or upper(coalesce(nullif(o.sisc,''),t.info->>'sisc',''))=upper(btrim(p_sisc)))
    and (p_setor is null or btrim(p_setor)='' or upper(coalesce(t.info->>'setor',''))=upper(btrim(p_setor)))
    and public.ocorrencia_busca_natureza(o.ocorrencia,o.crime,o.naturezas_itens,p_ocorrencia)
    and (
      p_bairro is null or btrim(p_bairro)=''
      or upper(coalesce(o.bairro,'')) like '%'||upper(btrim(p_bairro))||'%'
      or upper(coalesce(t.info->>'bairro','')) like '%'||upper(btrim(p_bairro))||'%'
      or (
        t.info->>'bairro_id' is not null
        and t.info->>'bairro_id'=public.territorio_por_bairro(p_bairro)->>'bairro_id'
      )
    )
    and (p_companhia is null or btrim(p_companhia)='' or upper(btrim(coalesce(o.companhia,'')))=upper(btrim(p_companhia)))
    and (p_turno is null or btrim(p_turno)='' or upper(btrim(coalesce(o.turno,'')))=upper(btrim(p_turno)))
  group by e.id
),
metricas as (
  select e.id unidade_id,e.sigla,e.nome,count(b.id)::bigint total_ocorrencias,
         coalesce(sum(public.conducoes_estatisticas(b.numero_conduzidos,b.numero_prisoes)),0)::bigint conducoes,
         coalesce(sum(coalesce(b.numero_prisoes,0)),0)::bigint prisoes,
         coalesce(sum(coalesce(b.veiculos_recuperados,0)),0)::bigint veiculos_recuperados,
         count(b.id) filter(where coalesce(b.quantidade_armas,0)>0 or (jsonb_typeof(b.armas_itens)='array' and jsonb_array_length(b.armas_itens)>0))::bigint ocorrencias_armas,
         count(b.id) filter(where b.entorpecentes='SIM' or (jsonb_typeof(b.entorpecentes_itens)='array' and jsonb_array_length(b.entorpecentes_itens)>0) or coalesce(b.maconha,0)>0 or coalesce(b.cocaina,0)>0 or coalesce(b.pasta_base,0)>0 or coalesce(b.crack,0)>0 or coalesce(b.skank,0)>0)::bigint ocorrencias_drogas,
         coalesce(t.total_tcos,0)::bigint tcos
  from escopo e
  left join base b on (b.unidade_agregacao_id=e.id or (p_unidade_id is null and e.tipo='SUBUNIDADE' and b.subunidade_operacional_id=e.id))
  left join tcos_base t on t.unidade_id=e.id
  group by e.id,e.sigla,e.nome,t.total_tcos
),
naturezas_contagem as (
 select e.id unidade_id,e.sigla unidade_sigla,nn.natureza,count(distinct b.id)::bigint total
 from base b
 join escopo e on (e.id=b.unidade_agregacao_id or (p_unidade_id is null and e.tipo='SUBUNIDADE' and e.id=b.subunidade_operacional_id))
 cross join lateral public.naturezas_estatisticas_bo(b.ocorrencia,b.crime,b.naturezas_itens) nn
 group by e.id,e.sigla,nn.natureza
),
naturezas_rank as (
  select *,row_number() over(partition by unidade_id order by total desc,natureza) pos from naturezas_contagem
),
naturezas_por_unidade as (
  select unidade_id,unidade_sigla,jsonb_agg(jsonb_build_object('natureza',natureza,'total',total) order by pos) itens
  from naturezas_rank where pos<=5 group by unidade_id,unidade_sigla
),
naturezas_geral as (
 select nn.natureza,count(distinct b.id)::bigint total
 from base b cross join lateral public.naturezas_estatisticas_bo(b.ocorrencia,b.crime,b.naturezas_itens) nn
 group by nn.natureza order by total desc,nn.natureza limit 10
),
bairros_geral as (
  select coalesce(nullif(btrim(b.territorio_bairro),''),nullif(btrim(b.bairro),''),'NÃO INFORMADO') bairro,count(*)::bigint total
  from base b
  group by coalesce(nullif(btrim(b.territorio_bairro),''),nullif(btrim(b.bairro),''),'NÃO INFORMADO')
  order by total desc,bairro limit 10
),
serie as (
  select b.data_ocorrencia data,b.unidade_agregacao_id unidade_id,b.unidade_sigla,count(*)::bigint total
  from base b group by b.data_ocorrencia,b.unidade_agregacao_id,b.unidade_sigla
),
aisc_resumo as (
  select territorio_aisc codigo,count(*)::bigint total from base where territorio_aisc is not null group by territorio_aisc
),
sisc_resumo as (
  select territorio_sisc codigo,count(*)::bigint total from base where territorio_sisc is not null group by territorio_sisc
),
setor_resumo as (
  select territorio_setor codigo,count(*)::bigint total from base where territorio_setor is not null group by territorio_setor
)
select case
  when not coalesce((select autorizado from ctx),false) then jsonb_build_object('autorizado',false,'erro','Acesso restrito ao contexto de uma unidade do tipo COMANDO.')
  else jsonb_build_object(
    'autorizado',true,
    'periodo',jsonb_build_object('inicio',data_inicio,'fim',data_fim),
    'filtros',jsonb_build_object('unidade_id',p_unidade_id,'aisc',p_aisc,'sisc',p_sisc,'setor',p_setor,'ocorrencia',p_ocorrencia,'bairro',p_bairro,'companhia',p_companhia,'turno',p_turno),
    'unidades_disponiveis',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'sigla',d.sigla,'nome',d.nome,'tipo',d.tipo) order by d.sigla) from descendentes d),'[]'::jsonb),
    'resumo',jsonb_build_object(
      'total_ocorrencias',(select count(*) from base),
      'conducoes',(select coalesce(sum(public.conducoes_estatisticas(numero_conduzidos,numero_prisoes)),0) from base),
      'prisoes',(select coalesce(sum(coalesce(numero_prisoes,0)),0) from base),
      'tcos',(select coalesce(sum(case when p_unidade_id is null then total_administrativo else total_tcos end),0) from tcos_base),
      'veiculos_recuperados',(select coalesce(sum(coalesce(veiculos_recuperados,0)),0) from base),
      'ocorrencias_armas',(select count(*) from base where coalesce(quantidade_armas,0)>0 or (jsonb_typeof(armas_itens)='array' and jsonb_array_length(armas_itens)>0)),
      'ocorrencias_drogas',(select count(*) from base where entorpecentes='SIM' or (jsonb_typeof(entorpecentes_itens)='array' and jsonb_array_length(entorpecentes_itens)>0) or coalesce(maconha,0)>0 or coalesce(cocaina,0)>0 or coalesce(pasta_base,0)>0 or coalesce(crack,0)>0 or coalesce(skank,0)>0)
    ),
    'unidades',coalesce((select jsonb_agg(jsonb_build_object(
      'unidade_id',unidade_id,'sigla',sigla,'nome',nome,'total_ocorrencias',total_ocorrencias,'conducoes',conducoes,'prisoes',prisoes,'tcos',tcos,
      'veiculos_recuperados',veiculos_recuperados,'ocorrencias_armas',ocorrencias_armas,'ocorrencias_drogas',ocorrencias_drogas
    ) order by sigla) from metricas),'[]'::jsonb),
    'top_naturezas',coalesce((select jsonb_agg(jsonb_build_object('unidade_id',e.id,'sigla',e.sigla,'nome',e.nome,'itens',coalesce(n.itens,'[]'::jsonb)) order by e.sigla) from escopo e left join naturezas_por_unidade n on n.unidade_id=e.id),'[]'::jsonb),
    'top_naturezas_geral',coalesce((select jsonb_agg(jsonb_build_object('natureza',n.natureza,'total',n.total) order by n.total desc,n.natureza) from naturezas_geral n),'[]'::jsonb),
    'top_bairros',coalesce((select jsonb_agg(jsonb_build_object('bairro',b.bairro,'total',b.total) order by b.total desc,b.bairro) from bairros_geral b),'[]'::jsonb),
    'serie_diaria',coalesce((select jsonb_agg(jsonb_build_object('data',s.data,'unidade_id',s.unidade_id,'sigla',s.unidade_sigla,'total',s.total) order by s.data,s.unidade_sigla) from serie s),'[]'::jsonb),
    'territorio',jsonb_build_object(
      'aisc',coalesce((select jsonb_agg(jsonb_build_object('codigo',codigo,'total',total) order by codigo) from aisc_resumo),'[]'::jsonb),
      'sisc',coalesce((select jsonb_agg(jsonb_build_object('codigo',codigo,'total',total) order by codigo) from sisc_resumo),'[]'::jsonb),
      'setores',coalesce((select jsonb_agg(jsonb_build_object('codigo',codigo,'total',total) order by string_to_array(codigo,'.')::int[]) from setor_resumo),'[]'::jsonb)
    )
  )
end
from (select 1) x
$function$;
commit;
