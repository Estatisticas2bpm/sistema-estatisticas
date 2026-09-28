-- fase3m_b_rpcs_territoriais
-- Estrutura territorial oficial do CPC baseada no Decreto nº 22.414-E/2017.


create or replace function public.obter_dados_dashboard_territorial(
  data_inicio date default null,
  data_fim date default null
)
returns jsonb
language sql
stable
security invoker
set search_path='public','private'
as $function$
with base as (
  select value as item
  from jsonb_array_elements(public.obter_dados_dashboard(data_inicio,data_fim))
),
enriquecido as (
  select b.item || jsonb_build_object(
    'aisc',t.info->>'aisc',
    'sisc',coalesce(nullif(b.item->>'sisc',''),t.info->>'sisc'),
    'setor',t.info->>'setor',
    'territorio_bairro',t.info->>'bairro',
    'unidade_territorial_id',t.info->>'unidade_id',
    'unidade_territorial_sigla',t.info->>'unidade_sigla',
    'unidade_id',o.unidade_id,
    'unidade_sigla',u.sigla,
    'unidade_nome',u.nome
  ) item
  from base b
  join public.ocorrencias o on o.id=(b.item->>'id')::uuid
  join public.unidades u on u.id=o.unidade_id
  left join lateral (select public.territorio_por_bairro(b.item->>'bairro') info) t on true
)
select coalesce(jsonb_agg(item order by item->>'data_ocorrencia' desc),'[]'::jsonb)
from enriquecido
$function$;

create or replace function public.obter_tcos_dashboard_territorial(
  data_inicio date default null,
  data_fim date default null
)
returns jsonb
language sql
stable
security invoker
set search_path='public','private'
as $function$
with base as (
  select value as item
  from jsonb_array_elements(public.obter_tcos_dashboard(data_inicio,data_fim))
),
enriquecido as (
  select b.item || jsonb_build_object(
    'aisc',t.info->>'aisc',
    'sisc',coalesce(nullif(b.item->>'sisc',''),t.info->>'sisc'),
    'setor',t.info->>'setor',
    'territorio_bairro',t.info->>'bairro',
    'unidade_territorial_id',t.info->>'unidade_id',
    'unidade_territorial_sigla',t.info->>'unidade_sigla',
    'unidade_id',o.unidade_id,
    'unidade_sigla',u.sigla,
    'unidade_nome',u.nome
  ) item
  from base b
  join public.ocorrencias o on o.id=(b.item->>'ocorrencia_id')::uuid
  join public.unidades u on u.id=o.unidade_id
  left join lateral (select public.territorio_por_bairro(b.item->>'bairro') info) t on true
)
select coalesce(jsonb_agg(item order by item->>'data_tco' desc),'[]'::jsonb)
from enriquecido
$function$;

create or replace function public.obter_home_cpc_territorial(
  data_inicio date default null,
  data_fim date default null
)
returns jsonb
language sql
stable
security invoker
set search_path='public','private'
as $function$
with raiz as (
  select public.obter_home_cpc(data_inicio,data_fim) j
),
oc as (
  select x || jsonb_build_object(
    'aisc',t.info->>'aisc',
    'sisc',coalesce(nullif(x->>'sisc',''),t.info->>'sisc'),
    'setor',t.info->>'setor',
    'territorio_bairro',t.info->>'bairro',
    'unidade_territorial_id',t.info->>'unidade_id',
    'unidade_territorial_sigla',t.info->>'unidade_sigla'
  ) item
  from raiz r
  cross join lateral jsonb_array_elements(coalesce(r.j->'ocorrencias','[]'::jsonb)) x
  left join lateral (select public.territorio_por_bairro(x->>'bairro') info) t on true
)
select case
  when coalesce((j->>'autorizado')::boolean,false)=false then j
  else j || jsonb_build_object(
    'ocorrencias',coalesce((select jsonb_agg(item order by item->>'data_ocorrencia' desc) from oc),'[]'::jsonb),
    'territorio',public.obter_catalogo_territorial_cpc()
  )
end
from raiz
$function$;

create or replace function public.obter_mapa_cpc_territorial(
  data_inicio date,
  data_fim date,
  p_unidade_id uuid default null,
  p_tipo_filtro text default null,
  p_aisc text default null,
  p_sisc text default null,
  p_setor text default null,
  p_bairro text default null
)
returns table(
  id uuid,data_ocorrencia date,numero_bo text,ocorrencia text,crime text,bairro text,endereco text,
  latitude double precision,longitude double precision,aisc text,sisc text,setor text,companhia text,turno text,
  unidade_id uuid,unidade_sigla text,unidade_nome text,unidade_territorial_id uuid,unidade_territorial_sigla text
)
language sql
stable
security invoker
set search_path='public','auth','private'
as $function$
with recursive
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
)
select
  o.id,o.data_ocorrencia,o.numero_bo,o.ocorrencia,o.crime,o.bairro,coalesce(o.endereco_formatado,o.endereco),
  o.latitude,o.longitude,t.info->>'aisc',coalesce(nullif(o.sisc,''),t.info->>'sisc'),t.info->>'setor',
  o.companhia,o.turno,o.unidade_id,d.sigla,d.nome,nullif(t.info->>'unidade_id','')::uuid,t.info->>'unidade_sigla'
from public.ocorrencias o
join descendentes d on d.id=o.unidade_id
left join lateral (select public.territorio_por_bairro(o.bairro) info) t on true
where o.data_ocorrencia between data_inicio and data_fim
  and o.latitude is not null and o.longitude is not null
  and (p_unidade_id is null or o.unidade_id=p_unidade_id)
  and (p_tipo_filtro is null or btrim(p_tipo_filtro)='' or upper(btrim(coalesce(nullif(o.ocorrencia,''),o.crime,'')))=upper(btrim(p_tipo_filtro)))
  and (p_aisc is null or btrim(p_aisc)='' or upper(coalesce(t.info->>'aisc',''))=upper(btrim(p_aisc)))
  and (p_sisc is null or btrim(p_sisc)='' or upper(coalesce(nullif(o.sisc,''),t.info->>'sisc',''))=upper(btrim(p_sisc)))
  and (p_setor is null or btrim(p_setor)='' or upper(coalesce(t.info->>'setor',''))=upper(btrim(p_setor)))
  and (p_bairro is null or btrim(p_bairro)='' or public.normalizar_bairro_sisc(o.bairro)=public.normalizar_bairro_sisc(p_bairro))
order by o.data_ocorrencia desc,o.hora_inicial desc nulls last
$function$;

revoke execute on function public.obter_dados_dashboard_territorial(date,date),public.obter_tcos_dashboard_territorial(date,date),public.obter_home_cpc_territorial(date,date),public.obter_mapa_cpc_territorial(date,date,uuid,text,text,text,text,text) from public,anon;
grant execute on function public.obter_dados_dashboard_territorial(date,date),public.obter_tcos_dashboard_territorial(date,date),public.obter_home_cpc_territorial(date,date),public.obter_mapa_cpc_territorial(date,date,uuid,text,text,text,text,text) to authenticated;
