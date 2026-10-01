create table public.unidades_atalhos_locais (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  local_id bigint not null references public.locais_apresentacao(id) on delete restrict,
  ordem smallint not null check (ordem between 1 and 6),
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  constraint unidades_atalhos_locais_unidade_local_key unique (unidade_id, local_id),
  constraint unidades_atalhos_locais_unidade_ordem_key unique (unidade_id, ordem)
);

create index unidades_atalhos_locais_unidade_idx
  on public.unidades_atalhos_locais (unidade_id, ordem);

alter table public.unidades_atalhos_locais enable row level security;

grant select, insert, update, delete
  on public.unidades_atalhos_locais
  to authenticated;

create policy "atalhos_locais_select_unidade_atual"
  on public.unidades_atalhos_locais
  for select
  to authenticated
  using (
    unidade_id = (select private.unidade_atual())
  );

create policy "atalhos_locais_insert_unidade_atual"
  on public.unidades_atalhos_locais
  for insert
  to authenticated
  with check (
    private.pode_escrever_operacional()
    and unidade_id = (select private.unidade_atual())
  );

create policy "atalhos_locais_update_unidade_atual"
  on public.unidades_atalhos_locais
  for update
  to authenticated
  using (
    private.pode_escrever_operacional()
    and unidade_id = (select private.unidade_atual())
  )
  with check (
    private.pode_escrever_operacional()
    and unidade_id = (select private.unidade_atual())
  );

create policy "atalhos_locais_delete_unidade_atual"
  on public.unidades_atalhos_locais
  for delete
  to authenticated
  using (
    private.pode_escrever_operacional()
    and unidade_id = (select private.unidade_atual())
  );

create or replace function public.obter_atalhos_locais_unidade()
returns table (
  id uuid,
  local_id bigint,
  nome text,
  ordem smallint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.id, a.local_id, l.nome, a.ordem
  from public.unidades_atalhos_locais a
  join public.locais_apresentacao l
    on l.id = a.local_id
   and l.ativo = true
  where a.unidade_id = private.unidade_atual()
  order by a.ordem, l.nome
$$;

revoke all on function public.obter_atalhos_locais_unidade() from public;
revoke all on function public.obter_atalhos_locais_unidade() from anon;
grant execute on function public.obter_atalhos_locais_unidade() to authenticated;

create or replace function public.salvar_atalhos_locais_unidade(p_locais bigint[])
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_unidade uuid := private.unidade_atual();
  v_total integer := cardinality(coalesce(p_locais, array[]::bigint[]));
  v_distintos integer;
  v_validos integer;
begin
  if not private.pode_escrever_operacional() or v_unidade is null then
    raise exception 'Usuário sem permissão para alterar atalhos desta unidade.'
      using errcode = '42501';
  end if;

  if v_total > 6 then
    raise exception 'É permitido configurar no máximo 6 atalhos rápidos.'
      using errcode = '23514';
  end if;

  select count(distinct x)
    into v_distintos
  from unnest(coalesce(p_locais, array[]::bigint[])) as t(x);

  if v_distintos <> v_total then
    raise exception 'O mesmo local não pode ser usado em mais de um atalho.'
      using errcode = '23514';
  end if;

  select count(*)
    into v_validos
  from public.locais_apresentacao l
  where l.ativo = true
    and l.id = any(coalesce(p_locais, array[]::bigint[]));

  if v_validos <> v_total then
    raise exception 'Um ou mais locais selecionados não existem ou estão inativos.'
      using errcode = '23503';
  end if;

  delete from public.unidades_atalhos_locais
  where unidade_id = v_unidade;

  insert into public.unidades_atalhos_locais (unidade_id, local_id, ordem, criado_por)
  select
    v_unidade,
    x.local_id,
    x.ordem::smallint,
    auth.uid()
  from unnest(coalesce(p_locais, array[]::bigint[])) with ordinality
    as x(local_id, ordem);

  return true;
end
$$;

revoke all on function public.salvar_atalhos_locais_unidade(bigint[]) from public;
revoke all on function public.salvar_atalhos_locais_unidade(bigint[]) from anon;
grant execute on function public.salvar_atalhos_locais_unidade(bigint[]) to authenticated;

insert into public.unidades_atalhos_locais (unidade_id, local_id, ordem, criado_por)
select
  u.id,
  l.id,
  v.ordem::smallint,
  null
from public.unidades u
cross join (
  values
    (1, 'PC II'),
    (2, '4 DP'),
    (3, 'PC I'),
    (4, 'DEAM'),
    (5, '5 DP'),
    (6, 'DGH')
) as v(ordem, nome)
join public.locais_apresentacao l
  on l.nome = v.nome
 and l.ativo = true
where u.ativo = true
  and u.tipo <> 'COMANDO'
on conflict do nothing;
