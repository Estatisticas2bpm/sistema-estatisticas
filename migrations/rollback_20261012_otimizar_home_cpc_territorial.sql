-- Reversão manual da otimização do escopo de indicadores CPC.
-- Executar apenas se necessário reverter a migração correspondente.
CREATE OR REPLACE FUNCTION public.obter_home_cpc_territorial(data_inicio date DEFAULT NULL::date, data_fim date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'private'
AS $function$
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
$function$
;
