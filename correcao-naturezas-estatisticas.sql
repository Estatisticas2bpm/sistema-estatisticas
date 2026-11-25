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

commit;
