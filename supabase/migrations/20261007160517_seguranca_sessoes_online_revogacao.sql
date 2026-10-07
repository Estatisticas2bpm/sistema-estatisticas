create table public.sessoes_presenca (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  primeiro_acesso timestamptz not null default now(),
  ultimo_sinal timestamptz not null default now(),
  user_agent text,
  pagina text,
  atualizado_em timestamptz not null default now()
);

create table public.sessoes_revogadas (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  revogado_por uuid references auth.users(id) on delete set null,
  motivo text,
  revogado_em timestamptz not null default now()
);

alter table public.sessoes_presenca enable row level security;
alter table public.sessoes_revogadas enable row level security;

revoke all on table public.sessoes_presenca from anon, authenticated;
grant select, insert, update on table public.sessoes_presenca to authenticated;
revoke all on table public.sessoes_revogadas from anon, authenticated;

create policy sessoes_presenca_select_self
on public.sessoes_presenca for select to authenticated
using (
  user_id = (select auth.uid())
  and session_id = nullif((select auth.jwt()->>'session_id'),'')::uuid
  and private.usuario_ativo()
);

create policy sessoes_presenca_insert_self
on public.sessoes_presenca for insert to authenticated
with check (
  user_id = (select auth.uid())
  and session_id = nullif((select auth.jwt()->>'session_id'),'')::uuid
  and private.usuario_ativo()
);

create policy sessoes_presenca_update_self
on public.sessoes_presenca for update to authenticated
using (
  user_id = (select auth.uid())
  and session_id = nullif((select auth.jwt()->>'session_id'),'')::uuid
  and private.usuario_ativo()
)
with check (
  user_id = (select auth.uid())
  and session_id = nullif((select auth.jwt()->>'session_id'),'')::uuid
  and private.usuario_ativo()
);

create or replace function private.usuario_ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.perfis_usuarios p
      where p.user_id = (select auth.uid())
        and p.ativo = true
    )
    and exists (
      select 1
      from auth.sessions s
      where s.id = nullif((select auth.jwt()->>'session_id'),'')::uuid
        and s.user_id = (select auth.uid())
        and (s.not_after is null or s.not_after > now())
    )
    and not exists (
      select 1
      from public.sessoes_revogadas r
      where r.session_id = nullif((select auth.jwt()->>'session_id'),'')::uuid
        and r.user_id = (select auth.uid())
    )
$$;

create or replace function public.admin_validar_sessao(p_user_id uuid, p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id is not null
    and p_session_id is not null
    and exists (
      select 1 from auth.sessions s
      where s.id = p_session_id
        and s.user_id = p_user_id
        and (s.not_after is null or s.not_after > now())
    )
    and not exists (
      select 1 from public.sessoes_revogadas r
      where r.session_id = p_session_id
        and r.user_id = p_user_id
    )
$$;

revoke all on function public.admin_validar_sessao(uuid,uuid) from public, anon, authenticated;
grant execute on function public.admin_validar_sessao(uuid,uuid) to service_role;

create or replace function public.admin_sessoes_snapshot()
returns table (
  session_id uuid,
  user_id uuid,
  nome text,
  nome_guerra text,
  posto_graduacao text,
  perfil text,
  unidade_sigla text,
  criado_em timestamptz,
  auth_atualizado_em timestamptz,
  auth_refrescado_em timestamp,
  user_agent text,
  ip text,
  aal text,
  ultimo_sinal timestamptz,
  pagina text,
  revogada boolean,
  online boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.user_id,
    p.nome,
    p.nome_guerra,
    p.posto_graduacao,
    p.perfil,
    u.sigla,
    s.created_at,
    s.updated_at,
    s.refreshed_at,
    s.user_agent,
    s.ip::text,
    s.aal::text,
    pr.ultimo_sinal,
    pr.pagina,
    (rv.session_id is not null) as revogada,
    (rv.session_id is null and pr.ultimo_sinal >= now() - interval '90 seconds') as online
  from auth.sessions s
  join public.perfis_usuarios p on p.user_id = s.user_id
  left join public.unidades u on u.id = p.unidade_id
  left join public.sessoes_presenca pr on pr.session_id = s.id
  left join public.sessoes_revogadas rv on rv.session_id = s.id
  where p.ativo = true
    and (s.not_after is null or s.not_after > now())
  order by online desc, coalesce(pr.ultimo_sinal,s.updated_at) desc, p.nome;
$$;

revoke all on function public.admin_sessoes_snapshot() from public, anon, authenticated;
grant execute on function public.admin_sessoes_snapshot() to service_role;
