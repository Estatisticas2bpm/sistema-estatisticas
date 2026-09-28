-- FASE 3K — modo administrador multiunidade
-- Mantém a unidade principal do perfil e permite ao ADMIN selecionar uma unidade de trabalho.
-- Unidades do tipo COMANDO ficam em modo operacional somente leitura.

create table if not exists private.admin_contextos_unidade (
  user_id uuid primary key references auth.users(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on update restrict on delete restrict,
  atualizado_em timestamptz not null default now()
);

revoke all on table private.admin_contextos_unidade from public, anon, authenticated;

create index if not exists admin_contextos_unidade_unidade_idx
  on private.admin_contextos_unidade (unidade_id);

create or replace function private.unidade_atual()
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select
    case
      when p.perfil = 'ADMIN' then coalesce(cu.id, p.unidade_id)
      else p.unidade_id
    end
  from public.perfis_usuarios p
  join public.unidades up
    on up.id = p.unidade_id
   and up.ativo = true
  left join private.admin_contextos_unidade c
    on c.user_id = p.user_id
  left join public.unidades cu
    on cu.id = c.unidade_id
   and cu.ativo = true
  where p.user_id = (select auth.uid())
    and p.ativo = true
  limit 1
$function$;

create or replace function private.unidades_acessiveis_atual()
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_perfil text := private.perfil_atual();
  v_raiz uuid := private.unidade_atual();
  v_result uuid[];
begin
  if v_perfil = 'ADMIN' then
    if v_raiz is null then
      return array[]::uuid[];
    end if;

    with recursive arvore as (
      select u.id, array[u.id]::uuid[] as caminho
      from public.unidades u
      where u.id = v_raiz
        and u.ativo = true

      union all

      select u.id, a.caminho || u.id
      from arvore a
      join public.unidades u
        on u.parent_id = a.id
      where u.ativo = true
        and not u.id = any(a.caminho)
    )
    select coalesce(array_agg(distinct id), array[]::uuid[])
      into v_result
    from arvore;

    return coalesce(v_result, array[]::uuid[]);
  end if;

  with recursive sementes as (
    select
      e.unidade_id,
      e.incluir_descendentes,
      array[e.unidade_id]::uuid[] as caminho
    from public.usuarios_unidades_escopo e
    join public.perfis_usuarios p
      on p.user_id = e.user_id
    where e.user_id = (select auth.uid())
      and p.ativo = true
  ),
  expandidas as (
    select
      s.unidade_id,
      s.incluir_descendentes,
      s.caminho
    from sementes s

    union all

    select
      u.id,
      e.incluir_descendentes,
      e.caminho || u.id
    from expandidas e
    join public.unidades u
      on u.parent_id = e.unidade_id
    where e.incluir_descendentes = true
      and not u.id = any(e.caminho)
  )
  select coalesce(array_agg(distinct unidade_id), array[]::uuid[])
    into v_result
  from expandidas;

  return coalesce(v_result, array[]::uuid[]);
end
$function$;

create or replace function private.pode_escrever_operacional()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    private.perfil_atual() in ('ADMIN','ESTATISTICA','OPERADOR')
    and exists (
      select 1
      from public.unidades u
      where u.id = private.unidade_atual()
        and u.ativo = true
        and u.tipo <> 'COMANDO'
    )
$function$;

create or replace function private.pode_administrar_dados()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    private.perfil_atual() in ('ADMIN','ESTATISTICA')
    and exists (
      select 1
      from public.unidades u
      where u.id = private.unidade_atual()
        and u.ativo = true
        and u.tipo <> 'COMANDO'
    )
$function$;

create or replace function public.obter_contexto_unidade_usuario()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'perfil', p.perfil,
    'unidade_principal_id', p.unidade_id,
    'unidade_principal_sigla', up.sigla,
    'unidade_principal_nome', up.nome,
    'unidade_id', uc.id,
    'sigla', uc.sigla,
    'nome', uc.nome,
    'tipo', uc.tipo,
    'pode_alternar', (p.perfil = 'ADMIN'),
    'somente_leitura_operacional', (uc.tipo = 'COMANDO')
  )
  from public.perfis_usuarios p
  join public.unidades up
    on up.id = p.unidade_id
   and up.ativo = true
  join public.unidades uc
    on uc.id = private.unidade_atual()
   and uc.ativo = true
  where p.user_id = (select auth.uid())
    and p.ativo = true
  limit 1
$function$;

revoke execute on function public.obter_contexto_unidade_usuario() from public, anon;
grant execute on function public.obter_contexto_unidade_usuario() to authenticated;

create or replace function public.listar_unidades_contexto_admin()
returns table(
  id uuid,
  sigla text,
  nome text,
  tipo text,
  parent_id uuid
)
language sql
stable
security definer
set search_path = ''
as $function$
  select u.id, u.sigla, u.nome, u.tipo, u.parent_id
  from public.unidades u
  where u.ativo = true
    and private.perfil_atual() = 'ADMIN'
  order by
    case when u.tipo = 'COMANDO' then 0 else 1 end,
    u.sigla
$function$;

revoke execute on function public.listar_unidades_contexto_admin() from public, anon;
grant execute on function public.listar_unidades_contexto_admin() to authenticated;

create or replace function public.definir_contexto_unidade_admin(p_unidade_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_perfil text := private.perfil_atual();
  v_anterior uuid := private.unidade_atual();
  v_unidade public.unidades%rowtype;
  v_principal uuid;
begin
  if v_uid is null or v_perfil is distinct from 'ADMIN' then
    raise exception 'Somente administradores podem alternar a unidade de trabalho.'
      using errcode = '42501';
  end if;

  select p.unidade_id
    into v_principal
  from public.perfis_usuarios p
  where p.user_id = v_uid
    and p.ativo = true
  limit 1;

  if v_principal is null then
    raise exception 'Administrador sem unidade principal ativa.'
      using errcode = '42501';
  end if;

  select *
    into v_unidade
  from public.unidades u
  where u.id = p_unidade_id
    and u.ativo = true;

  if not found then
    raise exception 'A unidade selecionada não existe ou está inativa.'
      using errcode = '23503';
  end if;

  insert into private.admin_contextos_unidade(user_id, unidade_id, atualizado_em)
  values (v_uid, v_unidade.id, now())
  on conflict (user_id)
  do update set
    unidade_id = excluded.unidade_id,
    atualizado_em = excluded.atualizado_em;

  if v_anterior is distinct from v_unidade.id then
    insert into public.logs_sistema(usuario_id, acao, entidade, entidade_id, detalhes)
    values (
      v_uid,
      'TROCA_CONTEXTO_UNIDADE',
      'unidades',
      v_unidade.id::text,
      jsonb_build_object(
        'unidade_anterior_id', v_anterior,
        'unidade_contexto_id', v_unidade.id,
        'unidade_contexto_sigla', v_unidade.sigla
      )
    );
  end if;

  return jsonb_build_object(
    'unidade_principal_id', v_principal,
    'unidade_id', v_unidade.id,
    'sigla', v_unidade.sigla,
    'nome', v_unidade.nome,
    'tipo', v_unidade.tipo,
    'pode_alternar', true,
    'somente_leitura_operacional', (v_unidade.tipo = 'COMANDO')
  );
end
$function$;

revoke execute on function public.definir_contexto_unidade_admin(uuid) from public, anon;
grant execute on function public.definir_contexto_unidade_admin(uuid) to authenticated;

create or replace function public.obter_modulos_usuario()
returns table(codigo text, nome text, descricao text, ordem integer)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    m.codigo,
    m.nome,
    m.descricao,
    m.ordem
  from public.unidades u
  join public.unidades_modulos um
    on um.unidade_id = u.id
   and um.ativo = true
  join public.modulos_sistema m
    on m.id = um.modulo_id
   and m.ativo = true
  where u.id = private.unidade_atual()
    and private.usuario_ativo()
  order by m.ordem, m.nome
$function$;

create or replace function public.obter_planilha_usuario()
returns table(
  unidade_id uuid,
  unidade_sigla text,
  google_sheet_id text,
  aba_principal text,
  google_sheet_url text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    u.id,
    u.sigla,
    i.google_sheet_id,
    i.aba_principal,
    'https://docs.google.com/spreadsheets/d/' || i.google_sheet_id || '/edit'
  from public.unidades u
  join public.unidades_integracoes i
    on i.unidade_id = u.id
   and i.tipo = 'GOOGLE_SHEETS_OCORRENCIAS'
   and i.ativo = true
  where u.id = private.unidade_atual()
    and u.ativo = true
    and private.usuario_ativo()
  limit 1
$function$;

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
    private.unidade_atual() as comando_id,
    exists (
      select 1
      from public.unidades u
      where u.id = private.unidade_atual()
        and u.ativo = true
        and u.tipo = 'COMANDO'
    ) as autorizado
  where private.usuario_ativo()
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
        'erro','Acesso restrito ao contexto de uma unidade do tipo COMANDO.'
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
from (select 1) x
$function$;

revoke execute on function public.obter_painel_cpc(date,date) from public, anon;
grant execute on function public.obter_painel_cpc(date,date) to authenticated;
