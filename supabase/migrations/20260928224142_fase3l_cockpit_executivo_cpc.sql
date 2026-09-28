-- FASE 3L — cockpit executivo do CPC
-- Home consolidada, mapa filtrável por unidade/área e Painel Geral CPC com filtros avançados.

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
  select o.id,o.data_ocorrencia,o.numero_bo,o.ocorrencia,o.crime,o.bairro,o.sisc,o.companhia,o.turno,
         o.status_atendimento,
         public.conducoes_estatisticas(o.numero_conduzidos,o.numero_prisoes) as conducoes_operacionais,
         coalesce(o.veiculos_recuperados,0) as veiculos_recuperados,
         o.unidade_id,d.sigla as unidade_sigla,d.nome as unidade_nome
  from public.ocorrencias o join descendentes d on d.id=o.unidade_id
  where (data_inicio is null or o.data_ocorrencia>=data_inicio)
    and (data_fim is null or o.data_ocorrencia<=data_fim)
),
tcos_base as (
  select t.id,t.data_tco,t.numero_tco,o.unidade_id,d.sigla as unidade_sigla,d.nome as unidade_nome
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
        'id',b.id,'data_ocorrencia',b.data_ocorrencia,'numero_bo',b.numero_bo,'ocorrencia',b.ocorrencia,'crime',b.crime,
        'bairro',b.bairro,'sisc',b.sisc,'companhia',b.companhia,'turno',b.turno,'status_atendimento',b.status_atendimento,
        'conducoes_operacionais',b.conducoes_operacionais,'veiculos_recuperados',b.veiculos_recuperados,
        'unidade_id',b.unidade_id,'unidade_sigla',b.unidade_sigla,'unidade_nome',b.unidade_nome
      ) order by b.data_ocorrencia desc)
      from ocorrencias_base b
    ),'[]'::jsonb),
    'tcos',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',t.id,'data_tco',t.data_tco,'numero_tco',t.numero_tco,'unidade_id',t.unidade_id,
        'unidade_sigla',t.unidade_sigla,'unidade_nome',t.unidade_nome
      ) order by t.data_tco desc)
      from tcos_base t
    ),'[]'::jsonb)
  )
end
from (select 1) x
$function$

CREATE OR REPLACE FUNCTION public.obter_mapa_cpc(data_inicio date, data_fim date, p_unidade_id uuid DEFAULT NULL::uuid, p_tipo_filtro text DEFAULT NULL::text, p_area_tipo text DEFAULT NULL::text, p_area_valor text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, data_ocorrencia date, numero_bo text, ocorrencia text, crime text, bairro text, endereco text, latitude double precision, longitude double precision, sisc text, companhia text, turno text, unidade_id uuid, unidade_sigla text, unidade_nome text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth', 'private'
AS $function$
with recursive
ctx as (
  select private.unidade_atual() as comando_id,
         exists(select 1 from public.unidades u where u.id=private.unidade_atual() and u.ativo=true and u.tipo='COMANDO') as autorizado
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
select o.id,o.data_ocorrencia,o.numero_bo,o.ocorrencia,o.crime,o.bairro,coalesce(o.endereco_formatado,o.endereco),
       o.latitude,o.longitude,o.sisc,o.companhia,o.turno,o.unidade_id,d.sigla,d.nome
from public.ocorrencias o
join descendentes d on d.id=o.unidade_id
where o.data_ocorrencia between data_inicio and data_fim
  and o.latitude is not null and o.longitude is not null
  and (p_unidade_id is null or o.unidade_id=p_unidade_id)
  and (p_tipo_filtro is null or btrim(p_tipo_filtro)='' or upper(btrim(coalesce(nullif(o.ocorrencia,''),o.crime,'')))=upper(btrim(p_tipo_filtro)))
  and (
    p_area_tipo is null or btrim(p_area_tipo)='' or p_area_valor is null or btrim(p_area_valor)=''
    or (upper(btrim(p_area_tipo))='SISC' and upper(btrim(coalesce(o.sisc,'')))=upper(btrim(p_area_valor)))
    or (upper(btrim(p_area_tipo))='COMPANHIA' and upper(btrim(coalesce(o.companhia,'')))=upper(btrim(p_area_valor)))
    or (upper(btrim(p_area_tipo))='BAIRRO' and upper(btrim(coalesce(o.bairro,'')))=upper(btrim(p_area_valor)))
  )
order by o.data_ocorrencia desc,o.hora_inicial desc nulls last
$function$

CREATE OR REPLACE FUNCTION public.obter_painel_cpc_filtrado(data_inicio date DEFAULT NULL::date, data_fim date DEFAULT NULL::date, p_unidade_id uuid DEFAULT NULL::uuid, p_ocorrencia text DEFAULT NULL::text, p_bairro text DEFAULT NULL::text, p_sisc text DEFAULT NULL::text, p_companhia text DEFAULT NULL::text, p_turno text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth', 'private'
AS $function$
with recursive
ctx as (
  select private.unidade_atual() as comando_id,
         exists(select 1 from public.unidades u where u.id=private.unidade_atual() and u.ativo=true and u.tipo='COMANDO') as autorizado
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
  select o.*,e.sigla as unidade_sigla,e.nome as unidade_nome
  from public.ocorrencias o join escopo e on e.id=o.unidade_id
  where (data_inicio is null or o.data_ocorrencia>=data_inicio)
    and (data_fim is null or o.data_ocorrencia<=data_fim)
    and (p_ocorrencia is null or btrim(p_ocorrencia)='' or upper(coalesce(o.ocorrencia,'')) like '%'||upper(btrim(p_ocorrencia))||'%' or upper(coalesce(o.crime,'')) like '%'||upper(btrim(p_ocorrencia))||'%')
    and (p_bairro is null or btrim(p_bairro)='' or upper(coalesce(o.bairro,'')) like '%'||upper(btrim(p_bairro))||'%')
    and (p_sisc is null or btrim(p_sisc)='' or upper(btrim(coalesce(o.sisc,'')))=upper(btrim(p_sisc)))
    and (p_companhia is null or btrim(p_companhia)='' or upper(btrim(coalesce(o.companhia,'')))=upper(btrim(p_companhia)))
    and (p_turno is null or btrim(p_turno)='' or upper(btrim(coalesce(o.turno,'')))=upper(btrim(p_turno)))
),
tcos_base as (
  select o.unidade_id,count(*)::bigint as total_tcos
  from public.tcos t
  join public.ocorrencias o on o.id=t.ocorrencia_id
  join escopo e on e.id=o.unidade_id
  where (data_inicio is null or t.data_tco>=data_inicio)
    and (data_fim is null or t.data_tco<=data_fim)
    and (p_ocorrencia is null or btrim(p_ocorrencia)='' or upper(coalesce(o.ocorrencia,'')) like '%'||upper(btrim(p_ocorrencia))||'%' or upper(coalesce(o.crime,'')) like '%'||upper(btrim(p_ocorrencia))||'%')
    and (p_bairro is null or btrim(p_bairro)='' or upper(coalesce(o.bairro,'')) like '%'||upper(btrim(p_bairro))||'%')
    and (p_sisc is null or btrim(p_sisc)='' or upper(btrim(coalesce(o.sisc,'')))=upper(btrim(p_sisc)))
    and (p_companhia is null or btrim(p_companhia)='' or upper(btrim(coalesce(o.companhia,'')))=upper(btrim(p_companhia)))
    and (p_turno is null or btrim(p_turno)='' or upper(btrim(coalesce(o.turno,'')))=upper(btrim(p_turno)))
  group by o.unidade_id
),
metricas as (
  select e.id as unidade_id,e.sigla,e.nome,count(b.id)::bigint as total_ocorrencias,
         coalesce(sum(public.conducoes_estatisticas(b.numero_conduzidos,b.numero_prisoes)),0)::bigint as conducoes,
         coalesce(sum(coalesce(b.numero_prisoes,0)),0)::bigint as prisoes,
         coalesce(sum(coalesce(b.veiculos_recuperados,0)),0)::bigint as veiculos_recuperados,
         count(b.id) filter(where coalesce(b.quantidade_armas,0)>0 or (jsonb_typeof(b.armas_itens)='array' and jsonb_array_length(b.armas_itens)>0))::bigint as ocorrencias_armas,
         count(b.id) filter(where b.entorpecentes='SIM' or (jsonb_typeof(b.entorpecentes_itens)='array' and jsonb_array_length(b.entorpecentes_itens)>0) or coalesce(b.maconha,0)>0 or coalesce(b.cocaina,0)>0 or coalesce(b.pasta_base,0)>0 or coalesce(b.crack,0)>0 or coalesce(b.skank,0)>0)::bigint as ocorrencias_drogas,
         coalesce(t.total_tcos,0)::bigint as tcos
  from escopo e
  left join base b on b.unidade_id=e.id
  left join tcos_base t on t.unidade_id=e.id
  group by e.id,e.sigla,e.nome,t.total_tcos
),
naturezas_contagem as (
  select b.unidade_id,b.unidade_sigla,coalesce(nullif(btrim(b.ocorrencia),''),nullif(btrim(b.crime),''),'NÃO INFORMADO') as natureza,count(*)::bigint as total
  from base b group by b.unidade_id,b.unidade_sigla,coalesce(nullif(btrim(b.ocorrencia),''),nullif(btrim(b.crime),''),'NÃO INFORMADO')
),
naturezas_rank as (
  select *,row_number() over(partition by unidade_id order by total desc,natureza) as pos from naturezas_contagem
),
naturezas_por_unidade as (
  select unidade_id,unidade_sigla,jsonb_agg(jsonb_build_object('natureza',natureza,'total',total) order by pos) as itens
  from naturezas_rank where pos<=5 group by unidade_id,unidade_sigla
),
naturezas_geral as (
  select coalesce(nullif(btrim(b.ocorrencia),''),nullif(btrim(b.crime),''),'NÃO INFORMADO') as natureza,count(*)::bigint as total
  from base b group by 1 order by total desc,natureza limit 10
),
bairros_geral as (
  select coalesce(nullif(btrim(b.bairro),''),'NÃO INFORMADO') as bairro,count(*)::bigint as total
  from base b group by 1 order by total desc,bairro limit 10
),
serie as (
  select b.data_ocorrencia as data,b.unidade_id,b.unidade_sigla,count(*)::bigint as total
  from base b group by b.data_ocorrencia,b.unidade_id,b.unidade_sigla
)
select case
  when not coalesce((select autorizado from ctx),false) then jsonb_build_object('autorizado',false,'erro','Acesso restrito ao contexto de uma unidade do tipo COMANDO.')
  else jsonb_build_object(
    'autorizado',true,
    'periodo',jsonb_build_object('inicio',data_inicio,'fim',data_fim),
    'filtros',jsonb_build_object('unidade_id',p_unidade_id,'ocorrencia',p_ocorrencia,'bairro',p_bairro,'sisc',p_sisc,'companhia',p_companhia,'turno',p_turno),
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
      'unidade_id',unidade_id,'sigla',sigla,'nome',nome,'total_ocorrencias',total_ocorrencias,'conducoes',conducoes,
      'prisoes',prisoes,'tcos',tcos,'veiculos_recuperados',veiculos_recuperados,'ocorrencias_armas',ocorrencias_armas,'ocorrencias_drogas',ocorrencias_drogas
    ) order by sigla) from metricas),'[]'::jsonb),
    'top_naturezas',coalesce((select jsonb_agg(jsonb_build_object('unidade_id',e.id,'sigla',e.sigla,'nome',e.nome,'itens',coalesce(n.itens,'[]'::jsonb)) order by e.sigla) from escopo e left join naturezas_por_unidade n on n.unidade_id=e.id),'[]'::jsonb),
    'top_naturezas_geral',coalesce((select jsonb_agg(jsonb_build_object('natureza',n.natureza,'total',n.total) order by n.total desc,n.natureza) from naturezas_geral n),'[]'::jsonb),
    'top_bairros',coalesce((select jsonb_agg(jsonb_build_object('bairro',b.bairro,'total',b.total) order by b.total desc,b.bairro) from bairros_geral b),'[]'::jsonb),
    'serie_diaria',coalesce((select jsonb_agg(jsonb_build_object('data',s.data,'unidade_id',s.unidade_id,'sigla',s.unidade_sigla,'total',s.total) order by s.data,s.unidade_sigla) from serie s),'[]'::jsonb)
  )
end
from (select 1) x
$function$

CREATE OR REPLACE FUNCTION public.obter_painel_cpc(data_inicio date DEFAULT NULL::date, data_fim date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select public.obter_painel_cpc_filtrado(data_inicio,data_fim,null::uuid,null::text,null::text,null::text,null::text,null::text)
$function$

revoke execute on function public.obter_home_cpc(date,date) from public, anon;
grant execute on function public.obter_home_cpc(date,date) to authenticated;

revoke execute on function public.obter_mapa_cpc(date,date,uuid,text,text,text) from public, anon;
grant execute on function public.obter_mapa_cpc(date,date,uuid,text,text,text) to authenticated;

revoke execute on function public.obter_painel_cpc_filtrado(date,date,uuid,text,text,text,text,text) from public, anon;
grant execute on function public.obter_painel_cpc_filtrado(date,date,uuid,text,text,text,text,text) to authenticated;

revoke execute on function public.obter_painel_cpc(date,date) from public, anon;
grant execute on function public.obter_painel_cpc(date,date) to authenticated;
