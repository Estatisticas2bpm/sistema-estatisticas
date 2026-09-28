-- Fase 3J — infraestrutura do Painel Geral do CPC
-- Prepara módulo e RPC consolidada, sem ativar a unidade CPC e sem criar usuários.

do $$
begin
  if not exists (
    select 1 from public.unidades
    where sigla='CPC' and tipo='COMANDO'
  ) then
    raise exception 'FASE 3J abortada: unidade CPC/COMANDO não encontrada';
  end if;
end $$;

insert into public.modulos_sistema (id,codigo,nome,descricao,ativo,ordem)
values (
  gen_random_uuid(),
  'PAINEL_CPC',
  'Painel Geral do CPC',
  'Visão consolidada e comparativa das unidades subordinadas ao Comando de Policiamento da Capital.',
  true,
  5
)
on conflict (codigo) do update
set nome=excluded.nome,
    descricao=excluded.descricao,
    ativo=excluded.ativo,
    ordem=excluded.ordem;

insert into public.unidades_modulos (unidade_id,modulo_id,ativo)
select u.id,m.id,true
from public.unidades u
join public.modulos_sistema m on m.codigo='PAINEL_CPC'
where u.sigla='CPC'
on conflict (unidade_id,modulo_id) do update set ativo=excluded.ativo;

create or replace function public.obter_painel_cpc(
  data_inicio date default null,
  data_fim date default null
)
returns jsonb
language sql
stable
security invoker
set search_path = 'public','auth'
as $function$
with recursive
ctx as (
  select
    p.unidade_id as comando_id,
    exists (
      select 1
      from public.unidades u
      where u.id=p.unidade_id
        and u.ativo=true
        and u.tipo='COMANDO'
    ) as autorizado
  from public.perfis_usuarios p
  where p.user_id=(select auth.uid())
    and p.ativo=true
  limit 1
),
descendentes as (
  select u.id,u.sigla,u.nome,u.tipo,u.parent_id
  from public.unidades u
  join ctx c on u.parent_id=c.comando_id
  where c.autorizado=true
    and u.ativo=true

  union all

  select u.id,u.sigla,u.nome,u.tipo,u.parent_id
  from public.unidades u
  join descendentes d on u.parent_id=d.id
  where u.ativo=true
),
base as (
  select
    o.*,
    d.sigla as unidade_sigla,
    d.nome as unidade_nome
  from public.ocorrencias o
  join descendentes d on d.id=o.unidade_id
  where (data_inicio is null or o.data_ocorrencia>=data_inicio)
    and (data_fim is null or o.data_ocorrencia<=data_fim)
),
tcos_base as (
  select
    o.unidade_id,
    count(*)::bigint as total_tcos
  from public.tcos t
  join public.ocorrencias o on o.id=t.ocorrencia_id
  join descendentes d on d.id=o.unidade_id
  where (data_inicio is null or t.data_tco>=data_inicio)
    and (data_fim is null or t.data_tco<=data_fim)
  group by o.unidade_id
),
metricas as (
  select
    d.id as unidade_id,
    d.sigla,
    d.nome,
    count(b.id)::bigint as total_ocorrencias,
    coalesce(sum(public.conducoes_estatisticas(b.numero_conduzidos,b.numero_prisoes)),0)::bigint as conducoes,
    coalesce(sum(coalesce(b.numero_prisoes,0)),0)::bigint as prisoes,
    coalesce(sum(coalesce(b.veiculos_recuperados,0)),0)::bigint as veiculos_recuperados,
    count(b.id) filter (
      where coalesce(b.quantidade_armas,0)>0
         or (jsonb_typeof(b.armas_itens)='array' and jsonb_array_length(b.armas_itens)>0)
    )::bigint as ocorrencias_armas,
    count(b.id) filter (
      where b.entorpecentes='SIM'
         or (jsonb_typeof(b.entorpecentes_itens)='array' and jsonb_array_length(b.entorpecentes_itens)>0)
         or coalesce(b.maconha,0)>0
         or coalesce(b.cocaina,0)>0
         or coalesce(b.pasta_base,0)>0
         or coalesce(b.crack,0)>0
         or coalesce(b.skank,0)>0
    )::bigint as ocorrencias_drogas,
    coalesce(t.total_tcos,0)::bigint as tcos
  from descendentes d
  left join base b on b.unidade_id=d.id
  left join tcos_base t on t.unidade_id=d.id
  group by d.id,d.sigla,d.nome,t.total_tcos
),
naturezas_contagem as (
  select
    b.unidade_id,
    b.unidade_sigla,
    coalesce(
      nullif(btrim(b.ocorrencia),''),
      nullif(btrim(b.crime),''),
      'NÃO INFORMADO'
    ) as natureza,
    count(*)::bigint as total
  from base b
  group by
    b.unidade_id,
    b.unidade_sigla,
    coalesce(
      nullif(btrim(b.ocorrencia),''),
      nullif(btrim(b.crime),''),
      'NÃO INFORMADO'
    )
),
naturezas_rank as (
  select *,
         row_number() over(partition by unidade_id order by total desc,natureza) as pos
  from naturezas_contagem
),
naturezas_por_unidade as (
  select
    unidade_id,
    unidade_sigla,
    jsonb_agg(
      jsonb_build_object('natureza',natureza,'total',total)
      order by pos
    ) as itens
  from naturezas_rank
  where pos<=5
  group by unidade_id,unidade_sigla
),
serie as (
  select
    b.data_ocorrencia as data,
    b.unidade_id,
    b.unidade_sigla,
    count(*)::bigint as total
  from base b
  group by b.data_ocorrencia,b.unidade_id,b.unidade_sigla
)
select
  case
    when not coalesce((select autorizado from ctx),false) then
      jsonb_build_object(
        'autorizado',false,
        'erro','Acesso restrito a usuário vinculado a unidade do tipo COMANDO.'
      )
    else
      jsonb_build_object(
        'autorizado',true,
        'periodo',jsonb_build_object('inicio',data_inicio,'fim',data_fim),
        'resumo',jsonb_build_object(
          'total_ocorrencias',(select count(*) from base),
          'conducoes',(select coalesce(sum(public.conducoes_estatisticas(numero_conduzidos,numero_prisoes)),0) from base),
          'prisoes',(select coalesce(sum(coalesce(numero_prisoes,0)),0) from base),
          'tcos',(select coalesce(sum(total_tcos),0) from tcos_base),
          'veiculos_recuperados',(select coalesce(sum(coalesce(veiculos_recuperados,0)),0) from base),
          'ocorrencias_armas',(select count(*) from base where coalesce(quantidade_armas,0)>0 or (jsonb_typeof(armas_itens)='array' and jsonb_array_length(armas_itens)>0)),
          'ocorrencias_drogas',(select count(*) from base where entorpecentes='SIM' or (jsonb_typeof(entorpecentes_itens)='array' and jsonb_array_length(entorpecentes_itens)>0) or coalesce(maconha,0)>0 or coalesce(cocaina,0)>0 or coalesce(pasta_base,0)>0 or coalesce(crack,0)>0 or coalesce(skank,0)>0)
        ),
        'unidades',coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'unidade_id',unidade_id,
              'sigla',sigla,
              'nome',nome,
              'total_ocorrencias',total_ocorrencias,
              'conducoes',conducoes,
              'prisoes',prisoes,
              'tcos',tcos,
              'veiculos_recuperados',veiculos_recuperados,
              'ocorrencias_armas',ocorrencias_armas,
              'ocorrencias_drogas',ocorrencias_drogas
            )
            order by sigla
          )
          from metricas
        ),'[]'::jsonb),
        'top_naturezas',coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'unidade_id',d.id,
              'sigla',d.sigla,
              'nome',d.nome,
              'itens',coalesce(n.itens,'[]'::jsonb)
            )
            order by d.sigla
          )
          from descendentes d
          left join naturezas_por_unidade n on n.unidade_id=d.id
        ),'[]'::jsonb),
        'serie_diaria',coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'data',data,
              'unidade_id',unidade_id,
              'sigla',unidade_sigla,
              'total',total
            )
            order by data,unidade_sigla
          )
          from serie
        ),'[]'::jsonb)
      )
  end
from (select 1) x;
$function$;

revoke execute on function public.obter_painel_cpc(date,date) from public, anon;
grant execute on function public.obter_painel_cpc(date,date) to authenticated;
