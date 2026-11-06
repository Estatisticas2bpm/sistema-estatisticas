-- SIE-CPC | origem retroativa e envolvimento institucional
-- Aplicado ao Supabase em 06/11/2026. Idempotente e sem UPDATE de envolvidos.
-- 698 BOs classificados mediante regras conservadoras de início de histórico
-- no intervalo 08/09/2026..06/11/2026; logs ficam apenas em private.
-- O backfill dos registros específicos foi executado com verificação por MD5,
-- e não reaplicado a partir desta migração de esquema.
create table if not exists private.auditoria_origem_retroativa_20261106 (
 ocorrencia_id uuid primary key,
 data_ocorrencia date not null,
 origem_anterior text,
 origem_atribuida text not null
   check(origem_atribuida in ('CICC','PATRULHAMENTO','ABORDAGEM','MISSAO','OPERACAO')),
 criterio text not null default 'inicio_historico_regra_conservadora_v1',
 historico_fingerprint_md5 text not null,
 classificada_em timestamptz not null default now()
);
revoke all on table private.auditoria_origem_retroativa_20261106 from public,anon,authenticated;

-- A consulta de origem continua disponível ao CPC. Os indicadores de
-- policiais e autoridades só retornam valores ao perfil COMANDANTE da unidade
-- CPC e usam criado_em >= 06/11/2026 00:00 -04 (não data_ocorrencia).
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
         o.ocorrencia,o.crime,o.origem_acionamento,o.observacao_final,o.criado_em
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
  select c.id,c.origem_acionamento,c.observacao_final,c.criado_em
  from candidatas c
  left join territorios t on t.bairro=c.bairro
  where (p_aisc is null or btrim(p_aisc)='' or upper(coalesce(t.info->>'aisc',''))=upper(btrim(p_aisc)))
    and (p_sisc is null or btrim(p_sisc)='' or upper(coalesce(nullif(c.sisc,''),t.info->>'sisc',''))=upper(btrim(p_sisc)))
    and (p_setor is null or btrim(p_setor)='' or upper(coalesce(t.info->>'setor',''))=upper(btrim(p_setor)))
    and (p_ocorrencia is null or btrim(p_ocorrencia)=''
      or upper(coalesce(c.ocorrencia,'')) like '%'||upper(btrim(p_ocorrencia))||'%'
      or upper(coalesce(c.crime,'')) like '%'||upper(btrim(p_ocorrencia))||'%')
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

revoke all on function public.obter_indicadores_origem_envolvimento_cpc(date,date,uuid,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.obter_indicadores_origem_envolvimento_cpc(date,date,uuid,text,text,text,text,text,text,text) to authenticated;
notify pgrst,'reload schema';
