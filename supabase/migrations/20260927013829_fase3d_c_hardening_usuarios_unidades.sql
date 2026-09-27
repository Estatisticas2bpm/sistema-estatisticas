-- FASE 3D-C — hardening do gerenciamento de usuários e unidades
-- Objetivos:
-- 1) todo perfil ativo deve apontar para uma unidade existente e ativa;
-- 2) impedir a inativação de unidade que ainda possua perfis ativos;
-- 3) preservar a sincronização existente do escopo PRINCIPAL;
-- 4) não alterar ocorrências, módulos, RLS ou dados existentes.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '2min';

lock table public.unidades in share row exclusive mode;
lock table public.perfis_usuarios in share row exclusive mode;

do $$
declare
  v_unidades_ativas bigint;
begin
  if not exists (
    select 1
    from public.unidades
    where id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
      and sigla = '2BPM'
      and ativo = true
  ) then
    raise exception
      'Fase 3D-C cancelada: o 2º BPM oficial e ativo não foi encontrado.';
  end if;

  select count(*) into v_unidades_ativas
  from public.unidades
  where ativo = true;

  if v_unidades_ativas <> 1 then
    raise exception
      'Fase 3D-C cancelada: esperada somente a unidade 2BPM ativa, encontradas % unidades ativas.',
      v_unidades_ativas;
  end if;

  if exists (
    select 1
    from public.perfis_usuarios p
    left join public.unidades u on u.id = p.unidade_id
    where p.ativo = true
      and (
        p.unidade_id is null
        or u.id is null
        or u.ativo is distinct from true
      )
  ) then
    raise exception
      'Fase 3D-C cancelada: existe perfil ativo sem unidade principal existente e ativa.';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.perfis_usuarios'::regclass
      and tgname = 'trg_sincronizar_escopo_principal_usuario'
      and tgenabled = 'O'
  ) then
    raise exception
      'Fase 3D-C cancelada: o trigger de sincronização do escopo PRINCIPAL não está habilitado.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ocorrencias'::regclass
      and conname = 'ocorrencias_unidade_fase2_2bpm_chk'
      and convalidated = true
  ) then
    raise exception
      'Fase 3D-C cancelada: a trava temporária de ocorrências do 2º BPM não está validada.';
  end if;

  if exists (
    select 1
    from pg_trigger
    where (
      tgrelid = 'public.perfis_usuarios'::regclass
      and tgname = 'trg_validar_unidade_ativa_perfil'
    ) or (
      tgrelid = 'public.unidades'::regclass
      and tgname = 'trg_impedir_desativacao_unidade_com_perfis_ativos'
    )
  ) then
    raise exception
      'Fase 3D-C cancelada: um dos triggers desta fase já existe.';
  end if;
end
$$;

create function private.validar_unidade_ativa_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_unidade_ativa boolean;
begin
  if new.ativo is distinct from true then
    return new;
  end if;

  if new.unidade_id is null then
    raise exception
      'Um usuário ativo deve possuir unidade principal.'
      using errcode = '23514';
  end if;

  select u.ativo
    into v_unidade_ativa
  from public.unidades u
  where u.id = new.unidade_id
  for share;

  if not found then
    raise exception
      'A unidade principal informada não existe.'
      using errcode = '23503';
  end if;

  if v_unidade_ativa is distinct from true then
    raise exception
      'A unidade principal do usuário não está ativa.'
      using errcode = '23514';
  end if;

  return new;
end
$function$;

revoke all on function private.validar_unidade_ativa_perfil()
  from public, anon, authenticated, service_role;

create trigger trg_validar_unidade_ativa_perfil
before insert or update of unidade_id, ativo
on public.perfis_usuarios
for each row
execute function private.validar_unidade_ativa_perfil();

create function private.impedir_desativacao_unidade_com_perfis_ativos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.ativo = true
     and new.ativo = false
     and exists (
       select 1
       from public.perfis_usuarios p
       where p.unidade_id = new.id
         and p.ativo = true
     ) then
    raise exception
      'A unidade não pode ser inativada enquanto possuir usuários ativos.'
      using errcode = '23514';
  end if;

  return new;
end
$function$;

revoke all on function private.impedir_desativacao_unidade_com_perfis_ativos()
  from public, anon, authenticated, service_role;

create trigger trg_impedir_desativacao_unidade_com_perfis_ativos
before update of ativo
on public.unidades
for each row
execute function private.impedir_desativacao_unidade_com_perfis_ativos();

do $$
declare
  v_unidades_ativas bigint;
begin
  if exists (
    select 1
    from public.perfis_usuarios p
    left join public.unidades u on u.id = p.unidade_id
    where p.ativo = true
      and (
        p.unidade_id is null
        or u.id is null
        or u.ativo is distinct from true
      )
  ) then
    raise exception
      'Fase 3D-C cancelada: permaneceu perfil ativo sem unidade existente e ativa.';
  end if;

  select count(*) into v_unidades_ativas
  from public.unidades
  where ativo = true;

  if v_unidades_ativas <> 1
     or not exists (
       select 1
       from public.unidades
       where id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
         and sigla = '2BPM'
         and ativo = true
     ) then
    raise exception
      'Fase 3D-C cancelada: a situação das unidades ativas foi alterada.';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.perfis_usuarios'::regclass
      and tgname = 'trg_validar_unidade_ativa_perfil'
      and tgenabled = 'O'
  ) or not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.unidades'::regclass
      and tgname = 'trg_impedir_desativacao_unidade_com_perfis_ativos'
      and tgenabled = 'O'
  ) then
    raise exception
      'Fase 3D-C cancelada: os triggers de proteção não ficaram habilitados.';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.perfis_usuarios'::regclass
      and tgname = 'trg_sincronizar_escopo_principal_usuario'
      and tgenabled = 'O'
  ) then
    raise exception
      'Fase 3D-C cancelada: a sincronização do escopo PRINCIPAL foi afetada.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ocorrencias'::regclass
      and conname = 'ocorrencias_unidade_fase2_2bpm_chk'
      and convalidated = true
  ) then
    raise exception
      'Fase 3D-C cancelada: a trava temporária de ocorrências do 2º BPM foi afetada.';
  end if;
end
$$;

commit;