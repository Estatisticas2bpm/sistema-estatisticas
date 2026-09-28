-- fase3m_c_painel_cpc_territorial
-- Estrutura territorial oficial do CPC baseada no Decreto nº 22.414-E/2017.


create or replace function public.obter_painel_cpc_territorial(
  data_inicio date default null,
  data_fim date default null,
  p_unidade_id uuid default null,
  p_aisc text default null,
  p_sisc text default null,
  p_setor text default null,
  p_ocorrencia text default null,
  p_bairro text default null,
  p_companhia text default null,
  p_turno text default null
)
returns jsonb
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
),
escopo as (
  select d.* from descendentes d where p_unidade_id is null or d.id=p_unidade_id
),
base as (
  select
    o.*,
    e.sigla unidade_sigla,e.nome unidade_nome,
    t.info->>'aisc' territorio_aisc,
    coalesce(nullif(o.sisc,''),t.info->>'sisc') territorio_sisc,
    t.info->>'setor' territorio_setor
  from public.ocorrencias o
  join escopo e on e.id=o.unidade_id
  left join lateral (select public.territorio_por_bairro(o.bairro) info) t on true
  where (data_inicio is null or o.data_ocorrencia>=data_inicio)
    and (data_fim is null or o.data_ocorrencia<=data_fim)
    and (p_aisc is null or btrim(p_aisc)='' or upper(coalesce(t.info->>'aisc',''))=upper(btrim(p_aisc)))
    and (p_sisc is null or btrim(p_sisc)='' or upper(coalesce(nullif(o.sisc,''),t.info->>'sisc',''))=upper(btrim(p_sisc)))
    and (p_setor is null or btrim(p_setor)='' or upper(coalesce(t.info->>'setor',''))=upper(btrim(p_setor)))
    and (p_ocorrencia is null or btrim(p_ocorrencia)='' or upper(coalesce(o.ocorrencia,'')) like '%'||upper(btrim(p_ocorrencia))||'%' or upper(coalesce(o.crime,'')) like '%'||upper(btrim(p_ocorrencia))||'%')
    and (p_bairro is null or btrim(p_bairro)='' or upper(coalesce(o.bairro,'')) like '%'||upper(btrim(p_bairro))||'%')
    and (p_companhia is null or btrim(p_companhia)='' or upper(btrim(coalesce(o.companhia,'')))=upper(btrim(p_companhia)))
    and (p_turno is null or btrim(p_turno)='' or upper(btrim(coalesce(o.turno,'')))=upper(btrim(p_turno)))
),
tcos_base as (
  select o.unidade_id,count(*)::bigint total_tcos
  from public.tcos tc
  join public.ocorrencias o on o.id=tc.ocorrencia_id
  join escopo e on e.id=o.unidade_id
  left join lateral (select public.territorio_por_bairro(o.bairro) info) t on true
  where (data_inicio is null or tc.data_tco>=data_inicio)
    and (data_fim is null or tc.data_tco<=data_fim)
    and (p_aisc is null or btrim(p_aisc)='' or upper(coalesce(t.info->>'aisc',''))=upper(btrim(p_aisc)))
    and (p_sisc is null or btrim(p_sisc)='' or upper(coalesce(nullif(o.sisc,''),t.info->>'sisc',''))=upper(btrim(p_sisc)))
    and (p_setor is null or btrim(p_setor)='' or upper(coalesce(t.info->>'setor',''))=upper(btrim(p_setor)))
    and (p_ocorrencia is null or btrim(p_ocorrencia)='' or upper(coalesce(o.ocorrencia,'')) like '%'||upper(btrim(p_ocorrencia))||'%' or upper(coalesce(o.crime,'')) like '%'||upper(btrim(p_ocorrencia))||'%')
    and (p_bairro is null or btrim(p_bairro)='' or upper(coalesce(o.bairro,'')) like '%'||upper(btrim(p_bairro))||'%')
    and (p_companhia is null or btrim(p_companhia)='' or upper(btrim(coalesce(o.companhia,'')))=upper(btrim(p_companhia)))
    and (p_turno is null or btrim(p_turno)='' or upper(btrim(coalesce(o.turno,'')))=upper(btrim(p_turno)))
  group by o.unidade_id
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
  left join base b on b.unidade_id=e.id
  left join tcos_base t on t.unidade_id=e.id
  group by e.id,e.sigla,e.nome,t.total_tcos
),
naturezas_contagem as (
  select
    b.unidade_id,
    b.unidade_sigla,
    coalesce(nullif(btrim(b.ocorrencia),''),nullif(btrim(b.crime),''),'NÃO INFORMADO') natureza,
    count(*)::bigint total
  from base b
  group by
    b.unidade_id,
    b.unidade_sigla,
    coalesce(nullif(btrim(b.ocorrencia),''),nullif(btrim(b.crime),''),'NÃO INFORMADO')
),
naturezas_rank as (
  select *,row_number() over(partition by unidade_id order by total desc,natureza) pos from naturezas_contagem
),
naturezas_por_unidade as (
  select unidade_id,unidade_sigla,jsonb_agg(jsonb_build_object('natureza',natureza,'total',total) order by pos) itens
  from naturezas_rank where pos<=5 group by unidade_id,unidade_sigla
),
naturezas_geral as (
  select coalesce(nullif(btrim(b.ocorrencia),''),nullif(btrim(b.crime),''),'NÃO INFORMADO') natureza,count(*)::bigint total
  from base b
  group by coalesce(nullif(btrim(b.ocorrencia),''),nullif(btrim(b.crime),''),'NÃO INFORMADO')
  order by total desc,natureza limit 10
),
bairros_geral as (
  select coalesce(nullif(btrim(b.bairro),''),'NÃO INFORMADO') bairro,count(*)::bigint total
  from base b
  group by coalesce(nullif(btrim(b.bairro),''),'NÃO INFORMADO')
  order by total desc,bairro limit 10
),
serie as (
  select b.data_ocorrencia data,b.unidade_id,b.unidade_sigla,count(*)::bigint total
  from base b group by b.data_ocorrencia,b.unidade_id,b.unidade_sigla
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
      'tcos',(select coalesce(sum(total_tcos),0) from tcos_base),
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

revoke execute on function public.obter_painel_cpc_territorial(date,date,uuid,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.obter_painel_cpc_territorial(date,date,uuid,text,text,text,text,text,text,text) to authenticated;
