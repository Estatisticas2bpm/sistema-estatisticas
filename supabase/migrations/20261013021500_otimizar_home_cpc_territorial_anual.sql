-- SIE-CPC: otimização do escopo dos indicadores por unidade no período anual.
-- A função anterior executava territorio_por_bairro() para cada ocorrência (3.598 em 2026).
-- A nova versão materializa a resposta autorizada e mapeia cada bairro distinto apenas uma vez.
-- Equivalência conferida em leitura: 3.598 BOs, 0 divergências territoriais.
-- Plano isolado EXPLAIN ANALYZE: 609 ms -> 26 ms (sujeito a variações de cache).
-- Preserva SECURITY INVOKER, permissões, RLS, assinatura e JSON de saída.
-- Reversão: ver migrations/rollback_20261012_otimizar_home_cpc_territorial.sql.

CREATE OR REPLACE FUNCTION public.obter_home_cpc_territorial(data_inicio date DEFAULT NULL::date, data_fim date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'private'
AS $function$
with raiz as materialized (
  select public.obter_home_cpc(data_inicio,data_fim) j
),
-- Reutiliza o conjunto de BOs autorizado e calcula território uma vez por bairro.
base as materialized (
  select x as item
  from raiz r
  cross join lateral jsonb_array_elements(coalesce(r.j->'ocorrencias','[]'::jsonb)) x
),
mapa as materialized (
  select bairros.bairro, public.territorio_por_bairro(bairros.bairro) info
  from (select distinct item->>'bairro' bairro from base) bairros
),
oc as (
  select x.item || jsonb_build_object(
    'aisc',t.info->>'aisc',
    'sisc',coalesce(nullif(x.item->>'sisc',''),t.info->>'sisc'),
    'setor',t.info->>'setor',
    'territorio_bairro',t.info->>'bairro',
    'unidade_territorial_id',t.info->>'unidade_id',
    'unidade_territorial_sigla',t.info->>'unidade_sigla'
  ) item
  from base x
  left join mapa t on t.bairro=x.item->>'bairro'
)
select case
  when coalesce((j->>'autorizado')::boolean,false)=false then j
  else j || jsonb_build_object(
    'ocorrencias',coalesce((select jsonb_agg(item order by item->>'data_ocorrencia' desc) from oc),'[]'::jsonb),
    'territorio',public.obter_catalogo_territorial_cpc()
  )
end
from raiz
$function$
;
