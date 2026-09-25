-- FASE 3A — unidade principal autoritativa no cadastro de ocorrências
-- Objetivo:
-- 1) toda conta ativa precisa ter unidade principal;
-- 2) em INSERT autenticado, unidade_id é derivada do perfil ativo do usuário;
-- 3) usuário autenticado não pode trocar a unidade de uma ocorrência por UPDATE;
-- 4) service_role/postgres continuam compatíveis com importações administrativas;
-- 5) NÃO remove o default/check temporários do 2º BPM e NÃO ativa outra unidade.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '2min';

lock table public.perfis_usuarios in share row exclusive mode;
lock table public.ocorrencias in share row exclusive mode;

-- =========================================================
-- 1. PRÉ-CONDIÇÕES
-- =========================================================

do $$
declare
  v_ativas bigint;
begin
  if not exists (
    select 1
    from public.unidades
    where id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
      and sigla = '2BPM'
      and ativo = true
  ) then
    raise exception
      'Fase 3A cancelada: o 2º BPM oficial e ativo não foi encontrado.';
  end if;

  select count(*) into v_ativas
  from public.unidades
  where ativo = true;

  if v_ativas <> 1 then
    raise exception
      'Fase 3A cancelada: esperada exatamente 1 unidade ativa, encontradas %.',
      v_ativas;
  end if;

  if exists (
    select 1
    from public.perfis_usuarios
    where ativo = true
      and unidade_id is null
  ) then
    raise exception
      'Fase 3A cancelada: existe perfil ativo sem unidade principal.';
  end if;

  if exists (
    select 1
    from public.perfis_usuarios p
    left join public.unidades u on u.id = p.unidade_id
    where p.ativo = true
      and (u.id is null or u.ativo is distinct from true)
  ) then
    raise exception
      'Fase 3A cancelada: existe perfil ativo vinculado a unidade inexistente ou inativa.';
  end if;

  if exists (
    select 1
    from public.ocorrencias
    where unidade_id is distinct from
      'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
  ) then
    raise exception
      'Fase 3A cancelada: existe ocorrência fora do 2º BPM antes da abertura multiunidade.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ocorrencias'::regclass
      and conname = 'ocorrencias_unidade_fase2_2bpm_chk'
      and convalidated = true
  ) then
    raise exception
      'Fase 3A cancelada: a proteção temporária da Fase 2 não está validada.';
  end if;
end
$$;

-- =========================================================
-- 2. PERFIL ATIVO DEVE POSSUIR UNIDADE PRINCIPAL
-- =========================================================

alter table public.perfis_usuarios
  add constraint perfis_usuarios_ativo_exige_unidade_chk
  check (ativo = false or unidade_id is not null)
  not valid;

alter table public.perfis_usuarios
  validate constraint perfis_usuarios_ativo_exige_unidade_chk;

create index if not exists perfis_usuarios_unidade_id_idx
  on public.perfis_usuarios (unidade_id);

-- =========================================================
-- 3. FUNÇÃO AUTORITATIVA DA UNIDADE DO USUÁRIO
-- =========================================================

create or replace function private.unidade_atual()
returns uuid
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  select p.unidade_id
  from public.perfis_usuarios p
  join public.unidades u
    on u.id = p.unidade_id
  where p.user_id = auth.uid()
    and p.ativo = true
    and u.ativo = true
  limit 1
$function$;

-- =========================================================
-- 4. TRIGGER DE PROPRIEDADE ORGANIZACIONAL
-- =========================================================

create or replace function private.definir_unidade_ocorrencia()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth', 'private'
as $function$
declare
  v_uid uuid := auth.uid();
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_claims text := nullif(current_setting('request.jwt.claims', true), '');
  v_unidade uuid;
begin
  if v_role = '' and v_claims is not null then
    v_role := coalesce((v_claims::jsonb)->>'role', '');
  end if;

  -- Integrações administrativas confiáveis continuam compatíveis.
  -- A FK e, nesta etapa, o CHECK temporário do 2º BPM continuam protegendo o valor.
  if v_role = 'service_role' or (v_role = '' and current_user = 'postgres') then
    return new;
  end if;

  if v_uid is null then
    raise exception
      'Não foi possível determinar o usuário autenticado para definir a unidade da ocorrência.'
      using errcode = '42501';
  end if;

  v_unidade := private.unidade_atual();

  if v_unidade is null then
    raise exception
      'Usuário sem unidade operacional ativa vinculada ao perfil.'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    -- O cliente não é autoridade sobre unidade_id.
    -- Mesmo que envie outro UUID, o banco usa a unidade principal do perfil.
    new.unidade_id := v_unidade;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.unidade_id is distinct from old.unidade_id then
      raise exception
        'A unidade responsável pela ocorrência não pode ser alterada por este fluxo.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  return new;
end
$function$;

drop trigger if exists trg_definir_unidade_ocorrencia
  on public.ocorrencias;

create trigger trg_definir_unidade_ocorrencia
before insert or update of unidade_id
on public.ocorrencias
for each row
execute function private.definir_unidade_ocorrencia();

-- =========================================================
-- 5. VALIDAÇÕES FINAIS
-- =========================================================

do $$
declare
  v_total bigint;
  v_2bpm bigint;
begin
  select count(*) into v_total
  from public.ocorrencias;

  select count(*) into v_2bpm
  from public.ocorrencias
  where unidade_id =
    'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid;

  if v_total <> v_2bpm then
    raise exception
      'Fase 3A cancelada: a distribuição atual das ocorrências foi alterada.';
  end if;

  if exists (
    select 1
    from public.perfis_usuarios
    where ativo = true
      and unidade_id is null
  ) then
    raise exception
      'Fase 3A cancelada: existe perfil ativo sem unidade após a migration.';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.ocorrencias'::regclass
      and tgname = 'trg_definir_unidade_ocorrencia'
      and tgenabled = 'O'
  ) then
    raise exception
      'Fase 3A cancelada: trigger de unidade não ficou habilitado.';
  end if;
end
$$;

commit;