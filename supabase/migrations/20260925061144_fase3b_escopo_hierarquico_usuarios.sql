-- FASE 3B — escopo hierárquico de acesso por usuário
-- Objetivo:
-- 1) separar unidade principal de escopo de consulta;
-- 2) permitir escopos explícitos adicionais;
-- 3) permitir que um escopo inclua descendentes da hierarquia (ex.: CPC ou BOPE);
-- 4) manter o comportamento atual do 2º BPM nesta etapa;
-- 5) NÃO altera ainda as políticas RLS de ocorrências nem as RPCs operacionais.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '2min';

lock table public.perfis_usuarios in share row exclusive mode;
lock table public.unidades in share mode;

do $$
begin
  if not exists (
    select 1
    from public.unidades
    where id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
      and sigla = '2BPM'
      and ativo = true
  ) then
    raise exception
      'Fase 3B cancelada: o 2º BPM oficial e ativo não foi encontrado.';
  end if;

  if exists (
    select 1
    from public.perfis_usuarios
    where ativo = true
      and unidade_id is null
  ) then
    raise exception
      'Fase 3B cancelada: existe perfil ativo sem unidade principal.';
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'usuarios_unidades_escopo'
  ) then
    raise exception
      'Fase 3B cancelada: public.usuarios_unidades_escopo já existe.';
  end if;
end
$$;

create table public.usuarios_unidades_escopo (
  user_id uuid not null,
  unidade_id uuid not null,
  origem text not null,
  incluir_descendentes boolean not null default false,
  criado_em timestamptz not null default now(),

  constraint usuarios_unidades_escopo_pkey
    primary key (user_id, unidade_id, origem),

  constraint usuarios_unidades_escopo_user_id_fkey
    foreign key (user_id)
    references public.perfis_usuarios(user_id)
    on update cascade
    on delete cascade,

  constraint usuarios_unidades_escopo_unidade_id_fkey
    foreign key (unidade_id)
    references public.unidades(id)
    on update restrict
    on delete restrict,

  constraint usuarios_unidades_escopo_origem_chk
    check (origem in ('PRINCIPAL', 'EXPLICITO'))
);

create index usuarios_unidades_escopo_unidade_idx
  on public.usuarios_unidades_escopo (unidade_id);

insert into public.usuarios_unidades_escopo (
  user_id,
  unidade_id,
  origem,
  incluir_descendentes
)
select
  p.user_id,
  p.unidade_id,
  'PRINCIPAL',
  false
from public.perfis_usuarios p
where p.unidade_id is not null;

create or replace function private.sincronizar_escopo_principal_usuario()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
begin
  if tg_op = 'UPDATE'
     and old.unidade_id is distinct from new.unidade_id then
    delete from public.usuarios_unidades_escopo
    where user_id = new.user_id
      and origem = 'PRINCIPAL';
  end if;

  if new.unidade_id is not null then
    insert into public.usuarios_unidades_escopo (
      user_id,
      unidade_id,
      origem,
      incluir_descendentes
    )
    values (
      new.user_id,
      new.unidade_id,
      'PRINCIPAL',
      false
    )
    on conflict (user_id, unidade_id, origem)
    do update set incluir_descendentes = false;
  end if;

  return new;
end
$function$;

drop trigger if exists trg_sincronizar_escopo_principal_usuario
  on public.perfis_usuarios;

create trigger trg_sincronizar_escopo_principal_usuario
after insert or update of unidade_id
on public.perfis_usuarios
for each row
execute function private.sincronizar_escopo_principal_usuario();

create or replace function private.unidades_acessiveis_atual()
returns uuid[]
language sql
stable
security definer
set search_path to 'public', 'auth', 'private'
as $function$
  with recursive sementes as (
    select
      e.unidade_id,
      e.incluir_descendentes,
      array[e.unidade_id]::uuid[] as caminho
    from public.usuarios_unidades_escopo e
    join public.perfis_usuarios p
      on p.user_id = e.user_id
    where e.user_id = auth.uid()
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
  select coalesce(
    array_agg(distinct unidade_id),
    array[]::uuid[]
  )
  from expandidas
$function$;

create or replace function private.pode_acessar_unidade(
  p_unidade_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth', 'private'
as $function$
  select
    p_unidade_id is not null
    and p_unidade_id = any(private.unidades_acessiveis_atual())
$function$;

revoke all on function private.unidades_acessiveis_atual()
  from public, anon;

revoke all on function private.pode_acessar_unidade(uuid)
  from public, anon;

grant execute on function private.unidades_acessiveis_atual()
  to authenticated;

grant execute on function private.pode_acessar_unidade(uuid)
  to authenticated;

alter table public.usuarios_unidades_escopo
  enable row level security;

revoke all on table public.usuarios_unidades_escopo
  from anon, authenticated;

grant select on table public.usuarios_unidades_escopo
  to authenticated;

create policy auth_escopo_proprio_select
on public.usuarios_unidades_escopo
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.usuario_ativo())
);

do $$
declare
  v_perfis_com_unidade bigint;
  v_escopos_principais bigint;
begin
  select count(*)
    into v_perfis_com_unidade
  from public.perfis_usuarios
  where unidade_id is not null;

  select count(*)
    into v_escopos_principais
  from public.usuarios_unidades_escopo
  where origem = 'PRINCIPAL';

  if v_perfis_com_unidade <> v_escopos_principais then
    raise exception
      'Fase 3B cancelada: quantidade de escopos principais (%) diverge dos perfis com unidade (%).',
      v_escopos_principais,
      v_perfis_com_unidade;
  end if;

  if exists (
    select 1
    from public.perfis_usuarios p
    where p.unidade_id is not null
      and not exists (
        select 1
        from public.usuarios_unidades_escopo e
        where e.user_id = p.user_id
          and e.unidade_id = p.unidade_id
          and e.origem = 'PRINCIPAL'
          and e.incluir_descendentes = false
      )
  ) then
    raise exception
      'Fase 3B cancelada: existe perfil sem escopo PRINCIPAL correspondente.';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.perfis_usuarios'::regclass
      and tgname = 'trg_sincronizar_escopo_principal_usuario'
      and tgenabled = 'O'
  ) then
    raise exception
      'Fase 3B cancelada: trigger de sincronização do escopo principal não ficou habilitado.';
  end if;
end
$$;

commit;