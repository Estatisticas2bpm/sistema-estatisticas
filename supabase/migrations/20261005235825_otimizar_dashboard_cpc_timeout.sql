-- Otimiza o dashboard completo no contexto CPC após a carga histórica do 1º BPM.
-- Evita recalcular o escopo hierárquico e a matriz territorial para cada linha.

set local lock_timeout = '10s';
set local statement_timeout = '2min';

alter policy auth_ocorrencias_select on public.ocorrencias
using (
  (select private.usuario_ativo())
  and unidade_id = any(
    coalesce((select private.unidades_acessiveis_atual()), array[]::uuid[])
  )
);

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
with
base as materialized (
  select value as item
  from jsonb_array_elements(public.obter_dados_dashboard(data_inicio,data_fim))
),
mapa as materialized (
  select
    al.alias_chave,
    jsonb_build_object(
      'bairro_id',b.id,
      'bairro',b.nome,
      'bairro_decreto',b.nome_decreto,
      'tipo_local',b.tipo_local,
      'setor',st.codigo,
      'sisc',si.codigo,
      'aisc',a.codigo,
      'unidade_id',a.unidade_id,
      'unidade_sigla',u.sigla,
      'unidade_nome',u.nome,
      'unidade_referencia_decreto',a.unidade_referencia_decreto,
      'base_legal',a.base_legal,
      'artigo_referencia',b.artigo_referencia
    ) info
  from public.territorio_cpc_bairro_aliases al
  join public.territorio_cpc_bairros b
    on b.id=al.bairro_id and b.ativo=true
  join public.territorio_cpc_setores st
    on st.id=b.setor_id and st.ativo=true
  join public.territorio_cpc_sisc si
    on si.id=st.sisc_id and si.ativo=true
  join public.territorio_cpc_aisc a
    on a.id=si.aisc_id and a.ativo=true
  join public.unidades u
    on u.id=a.unidade_id
),
enriquecido as (
  select b.item || jsonb_build_object(
    'aisc',m.info->>'aisc',
    'sisc',coalesce(nullif(b.item->>'sisc',''),m.info->>'sisc'),
    'setor',m.info->>'setor',
    'territorio_bairro',m.info->>'bairro',
    'unidade_territorial_id',m.info->>'unidade_id',
    'unidade_territorial_sigla',m.info->>'unidade_sigla',
    'unidade_id',o.unidade_id,
    'unidade_sigla',u.sigla,
    'unidade_nome',u.nome
  ) item
  from base b
  join public.ocorrencias o
    on o.id=(b.item->>'id')::uuid
  join public.unidades u
    on u.id=o.unidade_id
  left join mapa m
    on m.alias_chave=public.normalizar_bairro_sisc(b.item->>'bairro')
)
select coalesce(
  jsonb_agg(item order by item->>'data_ocorrencia' desc),
  '[]'::jsonb
)
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
with
base as materialized (
  select value as item
  from jsonb_array_elements(public.obter_tcos_dashboard(data_inicio,data_fim))
),
mapa as materialized (
  select
    al.alias_chave,
    jsonb_build_object(
      'bairro_id',b.id,
      'bairro',b.nome,
      'bairro_decreto',b.nome_decreto,
      'tipo_local',b.tipo_local,
      'setor',st.codigo,
      'sisc',si.codigo,
      'aisc',a.codigo,
      'unidade_id',a.unidade_id,
      'unidade_sigla',u.sigla,
      'unidade_nome',u.nome,
      'unidade_referencia_decreto',a.unidade_referencia_decreto,
      'base_legal',a.base_legal,
      'artigo_referencia',b.artigo_referencia
    ) info
  from public.territorio_cpc_bairro_aliases al
  join public.territorio_cpc_bairros b
    on b.id=al.bairro_id and b.ativo=true
  join public.territorio_cpc_setores st
    on st.id=b.setor_id and st.ativo=true
  join public.territorio_cpc_sisc si
    on si.id=st.sisc_id and si.ativo=true
  join public.territorio_cpc_aisc a
    on a.id=si.aisc_id and a.ativo=true
  join public.unidades u
    on u.id=a.unidade_id
),
enriquecido as (
  select b.item || jsonb_build_object(
    'aisc',m.info->>'aisc',
    'sisc',coalesce(nullif(b.item->>'sisc',''),m.info->>'sisc'),
    'setor',m.info->>'setor',
    'territorio_bairro',m.info->>'bairro',
    'unidade_territorial_id',m.info->>'unidade_id',
    'unidade_territorial_sigla',m.info->>'unidade_sigla',
    'unidade_id',o.unidade_id,
    'unidade_sigla',u.sigla,
    'unidade_nome',u.nome
  ) item
  from base b
  join public.ocorrencias o
    on o.id=(b.item->>'ocorrencia_id')::uuid
  join public.unidades u
    on u.id=o.unidade_id
  left join mapa m
    on m.alias_chave=public.normalizar_bairro_sisc(b.item->>'bairro')
)
select coalesce(
  jsonb_agg(item order by item->>'data_tco' desc),
  '[]'::jsonb
)
from enriquecido
$function$;

revoke execute on function public.obter_dados_dashboard_territorial(date,date) from public,anon;
grant execute on function public.obter_dados_dashboard_territorial(date,date) to authenticated;

revoke execute on function public.obter_tcos_dashboard_territorial(date,date) from public,anon;
grant execute on function public.obter_tcos_dashboard_territorial(date,date) to authenticated;
