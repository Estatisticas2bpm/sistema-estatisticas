create table public.giro_acessos_abordagem (
  user_id uuid primary key references auth.users(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.giro_acessos_abordagem enable row level security;
grant select on public.giro_acessos_abordagem to authenticated;

create policy "giro_acesso_proprio_select"
  on public.giro_acessos_abordagem for select to authenticated
  using (user_id = (select auth.uid()));

create table public.giro_abordagens (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete restrict,
  registrado_em timestamptz not null default now(),
  tipo_abordagem text not null check (tipo_abordagem in ('A_PE','MOTO','VEICULO')),
  pessoas jsonb not null check (jsonb_typeof(pessoas) = 'array'),
  quantidade_pessoas smallint not null check (quantidade_pessoas between 1 and 20),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  precisao_metros real check (precisao_metros is null or precisao_metros >= 0),
  endereco text,
  bairro text,
  municipio text,
  criado_por uuid not null references auth.users(id) on delete restrict,
  criado_em timestamptz not null default now()
);

create index giro_abordagens_unidade_data_idx on public.giro_abordagens (unidade_id, registrado_em desc);
create index giro_abordagens_criado_por_idx on public.giro_abordagens (criado_por);

alter table public.giro_abordagens enable row level security;
grant select, insert on public.giro_abordagens to authenticated;

create policy "giro_abordagens_select_escopo"
  on public.giro_abordagens for select to authenticated
  using (unidade_id = any(private.unidades_acessiveis_atual()));

create policy "giro_abordagens_insert_acesso_compartilhado"
  on public.giro_abordagens for insert to authenticated
  with check (
    criado_por = (select auth.uid())
    and exists (
      select 1
      from public.giro_acessos_abordagem a
      join public.unidades u on u.id = a.unidade_id
      where a.user_id = (select auth.uid())
        and a.ativo = true
        and u.ativo = true
        and upper(u.sigla) = 'GIRO'
        and a.unidade_id = giro_abordagens.unidade_id
    )
  );

create or replace function public.registrar_abordagem_giro(
  p_tipo_abordagem text,
  p_pessoas jsonb,
  p_latitude double precision,
  p_longitude double precision,
  p_precisao_metros real default null,
  p_endereco text default null,
  p_bairro text default null,
  p_municipio text default null
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_unidade uuid;
  v_tipo text := upper(trim(coalesce(p_tipo_abordagem,'')));
  v_qtd integer;
  v_id uuid;
begin
  if v_user is null then raise exception 'Sessão inválida.' using errcode='42501'; end if;

  select a.unidade_id into v_unidade
  from public.giro_acessos_abordagem a
  join public.unidades u on u.id = a.unidade_id
  where a.user_id = v_user and a.ativo = true and u.ativo = true and upper(u.sigla) = 'GIRO'
  limit 1;

  if v_unidade is null then
    raise exception 'Acesso de abordagem do GIRO não autorizado ou unidade ainda inativa.' using errcode='42501';
  end if;
  if v_tipo not in ('A_PE','MOTO','VEICULO') then raise exception 'Selecione o tipo da abordagem.' using errcode='23514'; end if;
  if p_pessoas is null or jsonb_typeof(p_pessoas) <> 'array' then raise exception 'Informe as pessoas abordadas.' using errcode='23514'; end if;

  v_qtd := jsonb_array_length(p_pessoas);
  if v_qtd < 1 or v_qtd > 20 then raise exception 'Informe entre 1 e 20 pessoas por abordagem.' using errcode='23514'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_pessoas) p
    where coalesce(p->>'nacionalidade','') not in ('BR','VE','OUTRA')
       or coalesce(p->>'sexo','') not in ('M','F','NI')
       or coalesce(p->>'idade','') !~ '^[0-9]{1,3}$'
       or (p->>'idade')::integer not between 0 and 130
  ) then raise exception 'Há pessoa com nacionalidade, sexo ou idade inválida.' using errcode='23514'; end if;

  if p_latitude is null or p_longitude is null then raise exception 'Capture a localização antes de salvar.' using errcode='23514'; end if;

  insert into public.giro_abordagens (
    unidade_id,tipo_abordagem,pessoas,quantidade_pessoas,latitude,longitude,
    precisao_metros,endereco,bairro,municipio,criado_por
  ) values (
    v_unidade,v_tipo,p_pessoas,v_qtd,p_latitude,p_longitude,p_precisao_metros,
    nullif(trim(coalesce(p_endereco,'')),''),
    nullif(trim(coalesce(p_bairro,'')),''),
    nullif(trim(coalesce(p_municipio,'')),''),
    v_user
  ) returning id into v_id;

  return v_id;
end
$$;

revoke all on function public.registrar_abordagem_giro(text,jsonb,double precision,double precision,real,text,text,text) from public;
revoke all on function public.registrar_abordagem_giro(text,jsonb,double precision,double precision,real,text,text,text) from anon;
grant execute on function public.registrar_abordagem_giro(text,jsonb,double precision,double precision,real,text,text,text) to authenticated;
