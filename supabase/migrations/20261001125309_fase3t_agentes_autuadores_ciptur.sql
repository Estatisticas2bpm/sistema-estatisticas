create table if not exists public.ciptur_agentes_transito (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nome text not null,
  codigo_ambiguo boolean not null default false,
  ativo boolean not null default true,
  fonte text not null default 'Códigos de Agentes de Trânsito Geral PMRR (2).xlsx',
  fonte_linha integer,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint ciptur_agentes_transito_codigo_nome_key unique (codigo,nome)
);

create index if not exists ciptur_agentes_transito_codigo_idx
  on public.ciptur_agentes_transito (codigo);

create index if not exists ciptur_agentes_transito_nome_idx
  on public.ciptur_agentes_transito (nome);

alter table public.ciptur_agentes_transito enable row level security;

revoke all on public.ciptur_agentes_transito from anon;
grant select on public.ciptur_agentes_transito to authenticated;
grant all on public.ciptur_agentes_transito to service_role;

drop policy if exists auth_ciptur_agentes_select on public.ciptur_agentes_transito;
create policy auth_ciptur_agentes_select
on public.ciptur_agentes_transito
for select
to authenticated
using (
  (select private.usuario_ativo())
  and exists (
    select 1
    from public.unidades u
    where u.id = (select private.unidade_atual())
      and u.sigla = 'CIPTUR'
      and u.ativo = true
  )
);

create or replace function public.buscar_agentes_transito(p_busca text default '')
returns table (
  id uuid,
  codigo text,
  nome text,
  codigo_ambiguo boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select upper(trim(coalesce(p_busca,''))) as v
  )
  select a.id, a.codigo, a.nome, a.codigo_ambiguo
  from public.ciptur_agentes_transito a
  cross join q
  where a.ativo = true
    and (
      q.v = ''
      or upper(a.codigo) like '%' || q.v || '%'
      or upper(a.nome) like '%' || q.v || '%'
    )
  order by
    case
      when upper(a.codigo) = q.v then 0
      when upper(a.codigo) like q.v || '%' then 1
      when upper(a.nome) like q.v || '%' then 2
      else 3
    end,
    a.codigo,
    a.nome
  limit 20
$$;

revoke all on function public.buscar_agentes_transito(text) from public;
revoke all on function public.buscar_agentes_transito(text) from anon;
grant execute on function public.buscar_agentes_transito(text) to authenticated;

alter table public.ciptur_autos_infracao
  add column if not exists agente_autuador_id uuid references public.ciptur_agentes_transito(id),
  add column if not exists agente_codigo_snapshot text,
  add column if not exists agente_nome_snapshot text;

create index if not exists ciptur_autos_infracao_agente_idx
  on public.ciptur_autos_infracao (agente_autuador_id);

create or replace function private.preparar_ciptur_agente_autuador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agente public.ciptur_agentes_transito%rowtype;
begin
  if tg_op = 'INSERT' and new.agente_autuador_id is null then
    raise exception 'Informe o agente autuador do A.I.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
     and old.agente_autuador_id is not null
     and new.agente_autuador_id is null then
    raise exception 'O agente autuador não pode ser removido deste A.I.'
      using errcode = '23514';
  end if;

  if new.agente_autuador_id is not null then
    select *
      into v_agente
    from public.ciptur_agentes_transito a
    where a.id = new.agente_autuador_id
      and a.ativo = true;

    if not found then
      raise exception 'Agente autuador inválido ou inativo.'
        using errcode = '23503';
    end if;

    new.agente_codigo_snapshot := v_agente.codigo;
    new.agente_nome_snapshot := v_agente.nome;
  end if;

  return new;
end
$$;

drop trigger if exists trg_preparar_ciptur_agente_autuador
  on public.ciptur_autos_infracao;

create trigger trg_preparar_ciptur_agente_autuador
before insert or update
on public.ciptur_autos_infracao
for each row
execute function private.preparar_ciptur_agente_autuador();
