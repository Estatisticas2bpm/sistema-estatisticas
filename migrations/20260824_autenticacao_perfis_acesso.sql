begin;

create schema if not exists private;

-- ============================================================
-- ESTRUTURA DE USUÁRIOS, UNIDADES E LOGS
-- ============================================================
create table if not exists public.unidades (
  id uuid primary key default gen_random_uuid(),
  sigla text not null unique,
  nome text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

insert into public.unidades (sigla,nome,ativo)
values ('2BPM','2º Batalhão de Polícia Militar',true)
on conflict (sigla) do update set nome=excluded.nome, ativo=true;

create table if not exists public.perfis_usuarios (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  nome_guerra text,
  matricula text,
  email text not null,
  perfil text not null check (perfil in ('ADMIN','ESTATISTICA','OPERADOR','GESTOR','CONSULTA')),
  unidade_id uuid references public.unidades(id),
  ativo boolean not null default true,
  senha_temporaria boolean not null default true,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists perfis_usuarios_email_lower_uidx on public.perfis_usuarios (lower(email));
create index if not exists perfis_usuarios_perfil_idx on public.perfis_usuarios (perfil);
create index if not exists perfis_usuarios_unidade_idx on public.perfis_usuarios (unidade_id);

create table if not exists public.logs_sistema (
  id bigint generated always as identity primary key,
  usuario_id uuid references auth.users(id) on delete set null,
  acao text not null,
  entidade text,
  entidade_id text,
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists logs_sistema_usuario_idx on public.logs_sistema (usuario_id,criado_em desc);
create index if not exists logs_sistema_acao_idx on public.logs_sistema (acao,criado_em desc);

-- ============================================================
-- HELPERS PRIVADOS DE AUTORIZAÇÃO
-- ============================================================
create or replace function private.perfil_atual()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.perfil
  from public.perfis_usuarios p
  where p.user_id = auth.uid() and p.ativo = true
  limit 1;
$$;

create or replace function private.usuario_ativo()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists(
    select 1
    from public.perfis_usuarios p
    where p.user_id = auth.uid() and p.ativo = true
  );
$$;

create or replace function private.pode_escrever_operacional()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select private.perfil_atual() in ('ADMIN','ESTATISTICA','OPERADOR');
$$;

create or replace function private.pode_administrar_dados()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select private.perfil_atual() in ('ADMIN','ESTATISTICA');
$$;

revoke all on schema private from public;
revoke all on all functions in schema private from public;
grant usage on schema private to anon, authenticated, service_role;
grant execute on function private.perfil_atual() to authenticated, service_role;
grant execute on function private.usuario_ativo() to authenticated, service_role;
grant execute on function private.pode_escrever_operacional() to authenticated, service_role;
grant execute on function private.pode_administrar_dados() to authenticated, service_role;

-- Bloqueio central do Data API/PostgREST.
-- Contas sem perfil ativo não conseguem usar tabelas nem RPCs do sistema.
create or replace function private.verificar_acesso_api()
returns void
language plpgsql
security definer
set search_path = public, auth, private
as $$
declare
  v_role text := coalesce(current_setting('request.jwt.claim.role', true),'');
begin
  if current_user in ('postgres','service_role') or v_role = 'service_role' then
    return;
  end if;

  if v_role = 'authenticated' and private.usuario_ativo() then
    return;
  end if;

  raise insufficient_privilege using message = 'Acesso ao sistema não autorizado.';
end;
$$;
revoke all on function private.verificar_acesso_api() from public;
grant execute on function private.verificar_acesso_api() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'private.verificar_acesso_api';

-- ============================================================
-- PRIMEIRO ADMINISTRADOR
-- Se ainda não houver perfis, aproveita a conta Auth mais antiga existente.
-- ============================================================
insert into public.perfis_usuarios (
  user_id,nome,nome_guerra,email,perfil,unidade_id,ativo,senha_temporaria,criado_por
)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data->>'nome',''),nullif(u.raw_user_meta_data->>'full_name',''),u.email,'ADMINISTRADOR'),
  coalesce(nullif(u.raw_user_meta_data->>'nome_guerra',''),'ADMIN'),
  coalesce(u.email,''),
  'ADMIN',
  un.id,
  true,
  false,
  u.id
from auth.users u
cross join lateral (
  select id from public.unidades where sigla='2BPM' limit 1
) un
where not exists (select 1 from public.perfis_usuarios)
order by u.created_at asc
limit 1
on conflict (user_id) do nothing;

-- ============================================================
-- RLS DAS TABELAS ADMINISTRATIVAS
-- ============================================================
alter table public.unidades enable row level security;
alter table public.perfis_usuarios enable row level security;
alter table public.logs_sistema enable row level security;

drop policy if exists auth_unidades_select on public.unidades;
create policy auth_unidades_select on public.unidades
for select to authenticated
using (ativo = true and private.usuario_ativo());

drop policy if exists auth_perfil_proprio_select on public.perfis_usuarios;
create policy auth_perfil_proprio_select on public.perfis_usuarios
for select to authenticated
using (user_id = auth.uid() and private.usuario_ativo());

drop policy if exists auth_logs_select on public.logs_sistema;
create policy auth_logs_select on public.logs_sistema
for select to authenticated
using (private.perfil_atual() in ('ADMIN','ESTATISTICA'));

revoke all on public.unidades, public.perfis_usuarios, public.logs_sistema from anon;
revoke insert,update,delete on public.unidades, public.perfis_usuarios, public.logs_sistema from authenticated;
grant select on public.unidades, public.perfis_usuarios, public.logs_sistema to authenticated;

-- ============================================================
-- CONTROLE DE ESCRITA OPERACIONAL + LOG
-- ============================================================
create or replace function private.controle_escrita_operacional()
returns trigger
language plpgsql
security definer
set search_path = public, auth, private
as $$
declare
  v_uid uuid := auth.uid();
  v_perfil text := private.perfil_atual();
  v_role text := coalesce(current_setting('request.jwt.claim.role', true),'');
  v_id text;
begin
  if current_user in ('postgres','service_role') or v_role='service_role' then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;

  if v_uid is null or v_perfil is null then
    raise exception 'Usuário não autenticado ou sem perfil ativo.' using errcode='42501';
  end if;

  if tg_op='INSERT' then
    if v_perfil not in ('ADMIN','ESTATISTICA','OPERADOR') then
      raise exception 'Seu perfil não possui permissão para cadastrar registros.' using errcode='42501';
    end if;
    new.criado_por := coalesce(new.criado_por,v_uid);
    new.atualizado_por := v_uid;
    new.criado_em := coalesce(new.criado_em,now());
    new.atualizado_em := now();
    v_id := coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'numero_bo',to_jsonb(new)->>'numero_tco');
    insert into public.logs_sistema(usuario_id,acao,entidade,entidade_id,detalhes)
      values(v_uid,'CADASTRO',tg_table_name,v_id,'{}'::jsonb);
    return new;
  end if;

  if tg_op='UPDATE' then
    if not (
      v_perfil in ('ADMIN','ESTATISTICA')
      or (v_perfil='OPERADOR' and old.criado_por=v_uid)
    ) then
      raise exception 'Seu perfil não possui permissão para editar este registro.' using errcode='42501';
    end if;
    new.criado_por := old.criado_por;
    new.criado_em := old.criado_em;
    new.atualizado_por := v_uid;
    new.atualizado_em := now();
    v_id := coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'numero_bo',to_jsonb(new)->>'numero_tco');
    insert into public.logs_sistema(usuario_id,acao,entidade,entidade_id,detalhes)
      values(v_uid,'EDICAO',tg_table_name,v_id,'{}'::jsonb);
    return new;
  end if;

  if tg_op='DELETE' then
    if v_perfil not in ('ADMIN','ESTATISTICA') then
      raise exception 'Seu perfil não possui permissão para excluir registros.' using errcode='42501';
    end if;
    v_id := coalesce(to_jsonb(old)->>'id',to_jsonb(old)->>'numero_bo',to_jsonb(old)->>'numero_tco');
    insert into public.logs_sistema(usuario_id,acao,entidade,entidade_id,detalhes)
      values(v_uid,'EXCLUSAO',tg_table_name,v_id,'{}'::jsonb);
    return old;
  end if;

  return null;
end;
$$;
revoke all on function private.controle_escrita_operacional() from public;

-- Ocorrências, TCOs vinculados e ações preventivas.
do $$
declare
  t text;
begin
  foreach t in array array['ocorrencias','tcos','acoes_preventivas'] loop
    if to_regclass('public.'||t) is null then continue; end if;

    execute format('alter table public.%I add column if not exists criado_por uuid references auth.users(id) on delete set null',t);
    execute format('alter table public.%I add column if not exists criado_em timestamptz not null default now()',t);
    execute format('alter table public.%I add column if not exists atualizado_por uuid references auth.users(id) on delete set null',t);
    execute format('alter table public.%I add column if not exists atualizado_em timestamptz not null default now()',t);
    execute format('alter table public.%I enable row level security',t);

    -- Remove todas as políticas antigas, inclusive as temporárias públicas.
    execute (
      select coalesce(string_agg(format('drop policy if exists %I on public.%I;',policyname,t),' '),'')
      from pg_policies where schemaname='public' and tablename=t
    );

    execute format('create policy %I on public.%I for select to authenticated using (private.usuario_ativo())','auth_'||t||'_select',t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.pode_escrever_operacional())','auth_'||t||'_insert',t);
    execute format('create policy %I on public.%I for update to authenticated using (private.pode_administrar_dados() or (private.perfil_atual()=''OPERADOR'' and criado_por=auth.uid())) with check (private.pode_administrar_dados() or (private.perfil_atual()=''OPERADOR'' and criado_por=auth.uid()))','auth_'||t||'_update',t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.pode_administrar_dados())','auth_'||t||'_delete',t);

    execute format('revoke all on public.%I from anon',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);

    execute format('drop trigger if exists trg_controle_escrita_operacional on public.%I',t);
    execute format('create trigger trg_controle_escrita_operacional before insert or update or delete on public.%I for each row execute function private.controle_escrita_operacional()',t);
  end loop;
end $$;

-- ============================================================
-- CATÁLOGOS: leitura a perfis ativos, edição somente Admin/Estatística
-- ============================================================
create or replace function private.controle_catalogos()
returns trigger
language plpgsql
security definer
set search_path = public, auth, private
as $$
declare
  v_role text := coalesce(current_setting('request.jwt.claim.role', true),'');
begin
  if current_user in ('postgres','service_role') or v_role='service_role' then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if private.perfil_atual() not in ('ADMIN','ESTATISTICA') then
    raise exception 'Seu perfil não possui permissão para alterar catálogos.' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function private.controle_catalogos() from public;

do $$
declare
  t text;
begin
  foreach t in array array['bairros','comandantes','enderecos_padronizados','locais_apresentacao','subtipos_ocorrencia','tipos_ocorrencia'] loop
    if to_regclass('public.'||t) is null then continue; end if;

    execute format('alter table public.%I enable row level security',t);
    execute (
      select coalesce(string_agg(format('drop policy if exists %I on public.%I;',policyname,t),' '),'')
      from pg_policies where schemaname='public' and tablename=t
    );
    execute format('create policy %I on public.%I for select to authenticated using (private.usuario_ativo())','auth_'||t||'_select',t);
    execute format('create policy %I on public.%I for all to authenticated using (private.pode_administrar_dados()) with check (private.pode_administrar_dados())','auth_'||t||'_admin',t);
    execute format('revoke all on public.%I from anon',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
    execute format('drop trigger if exists trg_controle_catalogos on public.%I',t);
    execute format('create trigger trg_controle_catalogos before insert or update or delete on public.%I for each row execute function private.controle_catalogos()',t);
  end loop;
end $$;

-- ============================================================
-- STORAGE: fotos continuam públicas para leitura, mas upload exige perfil de escrita
-- ============================================================
drop policy if exists "Envio publico fotos acoes" on storage.objects;
drop policy if exists "Upload autenticado fotos acoes" on storage.objects;
create policy "Upload autenticado fotos acoes"
on storage.objects for insert to authenticated
with check (bucket_id='fotos-acoes' and private.pode_escrever_operacional());

-- ============================================================
-- RPCs: remove EXECUTE público implícito e concede apenas o necessário
-- ============================================================
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef=true
  loop
    execute format('revoke execute on function %s from public, anon, authenticated',f.assinatura);
  end loop;
end $$;

-- RPCs usadas pelo navegador autenticado.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname = any(array[
        'atualizar_ocorrencia_publica','buscar_bo_para_tco','cadastrar_bairro_publico',
        'cadastrar_comandante_publico','cadastrar_endereco_publico','cadastrar_tco_publico',
        'cadastrar_tipo_ocorrencia_publico','consultar_ocorrencias_publicas',
        'consultar_ocorrencias_publicas_v2','editar_comandante_publico','excluir_ocorrencia_publica',
        'excluir_tco_publico','obter_acoes_preventivas','obter_catalogos_cadastro',
        'obter_comandantes_publicos','obter_dados_dashboard','obter_ocorrencia_publica',
        'obter_ocorrencias_mapa','obter_tcos_dashboard',
        'cadastrar_tco_estatistico','excluir_tco_estatistico','obter_tcos_estatisticos'
      ])
  loop
    execute format('grant execute on function %s to authenticated',f.assinatura);
  end loop;
end $$;

-- RPCs internas do espelhamento Google Sheets: somente service_role.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname = any(array['claim_google_sheets_sync_batch','ack_google_sheets_sync','fail_google_sheets_sync'])
  loop
    execute format('grant execute on function %s to service_role',f.assinatura);
  end loop;
end $$;

commit;

notify pgrst, 'reload config';
