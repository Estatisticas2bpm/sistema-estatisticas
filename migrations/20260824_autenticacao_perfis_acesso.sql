begin;

create schema if not exists private;

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
  criado_por uuid references auth.users(id),
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
    select 1 from public.perfis_usuarios p
    where p.user_id = auth.uid() and p.ativo = true
  );
$$;

revoke all on function private.perfil_atual() from public;
revoke all on function private.usuario_ativo() from public;
grant usage on schema private to authenticated;
grant execute on function private.perfil_atual() to authenticated;
grant execute on function private.usuario_ativo() to authenticated;

alter table public.unidades enable row level security;
alter table public.perfis_usuarios enable row level security;
alter table public.logs_sistema enable row level security;

drop policy if exists auth_unidades_select on public.unidades;
create policy auth_unidades_select on public.unidades for select to authenticated using (ativo = true and private.usuario_ativo());

drop policy if exists auth_perfil_proprio_select on public.perfis_usuarios;
create policy auth_perfil_proprio_select on public.perfis_usuarios for select to authenticated using (user_id = auth.uid());

drop policy if exists auth_logs_select on public.logs_sistema;
create policy auth_logs_select on public.logs_sistema for select to authenticated using (private.perfil_atual() in ('ADMIN','ESTATISTICA'));

revoke all on public.unidades from anon;
revoke all on public.perfis_usuarios from anon;
revoke all on public.logs_sistema from anon;
grant select on public.unidades to authenticated;
grant select on public.perfis_usuarios to authenticated;
grant select on public.logs_sistema to authenticated;

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
begin
  if v_role = 'service_role' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if v_uid is null or v_perfil is null then
    raise exception 'Usuário não autenticado ou sem perfil ativo.' using errcode='42501';
  end if;

  if tg_op = 'INSERT' then
    if v_perfil not in ('ADMIN','ESTATISTICA','OPERADOR') then
      raise exception 'Seu perfil não possui permissão para cadastrar registros.' using errcode='42501';
    end if;
    new.criado_por := coalesce(new.criado_por,v_uid);
    new.atualizado_por := v_uid;
    new.atualizado_em := now();
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if not (
      v_perfil in ('ADMIN','ESTATISTICA')
      or (v_perfil='OPERADOR' and old.criado_por=v_uid)
    ) then
      raise exception 'Seu perfil não possui permissão para editar este registro.' using errcode='42501';
    end if;
    new.criado_por := old.criado_por;
    new.atualizado_por := v_uid;
    new.atualizado_em := now();
    return new;
  end if;

  if tg_op = 'DELETE' then
    if v_perfil not in ('ADMIN','ESTATISTICA') then
      raise exception 'Seu perfil não possui permissão para excluir registros.' using errcode='42501';
    end if;
    return old;
  end if;

  return null;
end;
$$;
revoke all on function private.controle_escrita_operacional() from public;

-- Ocorrências: mantém leitura para todos os perfis ativos e controla escrita por trigger.
do $$
begin
  if to_regclass('public.ocorrencias') is not null then
    alter table public.ocorrencias add column if not exists criado_por uuid references auth.users(id) on delete set null;
    alter table public.ocorrencias add column if not exists criado_em timestamptz not null default now();
    alter table public.ocorrencias add column if not exists atualizado_por uuid references auth.users(id) on delete set null;
    alter table public.ocorrencias add column if not exists atualizado_em timestamptz not null default now();
    alter table public.ocorrencias enable row level security;

    drop policy if exists auth_ocorrencias_select on public.ocorrencias;
    create policy auth_ocorrencias_select on public.ocorrencias for select to authenticated using (private.usuario_ativo());
    drop policy if exists auth_ocorrencias_insert on public.ocorrencias;
    create policy auth_ocorrencias_insert on public.ocorrencias for insert to authenticated with check (private.perfil_atual() in ('ADMIN','ESTATISTICA','OPERADOR'));
    drop policy if exists auth_ocorrencias_update on public.ocorrencias;
    create policy auth_ocorrencias_update on public.ocorrencias for update to authenticated using (private.usuario_ativo()) with check (private.usuario_ativo());
    drop policy if exists auth_ocorrencias_delete on public.ocorrencias;
    create policy auth_ocorrencias_delete on public.ocorrencias for delete to authenticated using (private.perfil_atual() in ('ADMIN','ESTATISTICA'));

    revoke all on public.ocorrencias from anon;
    grant select,insert,update,delete on public.ocorrencias to authenticated;

    drop trigger if exists trg_controle_escrita_operacional on public.ocorrencias;
    create trigger trg_controle_escrita_operacional before insert or update or delete on public.ocorrencias for each row execute function private.controle_escrita_operacional();
  end if;
end $$;

-- Aplica o mesmo modelo, quando as tabelas já existirem no projeto.
do $$
declare t text;
begin
  foreach t in array array['tcos_estatisticos','acoes_preventivas'] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I add column if not exists criado_por uuid references auth.users(id) on delete set null',t);
      execute format('alter table public.%I add column if not exists criado_em timestamptz not null default now()',t);
      execute format('alter table public.%I add column if not exists atualizado_por uuid references auth.users(id) on delete set null',t);
      execute format('alter table public.%I add column if not exists atualizado_em timestamptz not null default now()',t);
      execute format('alter table public.%I enable row level security',t);
      execute format('revoke all on public.%I from anon',t);
      execute format('grant select,insert,update,delete on public.%I to authenticated',t);
      execute format('drop trigger if exists trg_controle_escrita_operacional on public.%I',t);
      execute format('create trigger trg_controle_escrita_operacional before insert or update or delete on public.%I for each row execute function private.controle_escrita_operacional()',t);
    end if;
  end loop;
end $$;

-- As RPCs que abastecem o site deixam de ser anônimas. O conteúdo permanece acessível
-- a usuários autenticados; operações de escrita continuam submetidas ao trigger acima.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname = any(array[
        'obter_dados_dashboard','obter_tcos_dashboard','obter_catalogos_cadastro',
        'obter_ocorrencias_mapa','obter_acoes_preventivas','obter_ocorrencia_publica',
        'atualizar_ocorrencia_publica','consultar_ocorrencias_publicas_v2','excluir_ocorrencia_publica',
        'cadastrar_tco_estatistico','excluir_tco_estatistico','obter_tcos_estatisticos',
        'obter_comandantes_publicos','cadastrar_comandante_publico','editar_comandante_publico'
      ])
  loop
    execute format('revoke execute on function %s from anon',f.assinatura);
    execute format('grant execute on function %s to authenticated',f.assinatura);
  end loop;
end $$;

commit;
