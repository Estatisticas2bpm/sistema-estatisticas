-- FASE 3D-A — catálogo de módulos e habilitação por unidade principal.
--
-- Escopo deliberadamente limitado:
--   * cria apenas a fundação de módulos por unidade;
--   * cadastra somente ACOES_SOCIAIS para a CAVALARIA;
--   * não ativa a CAVALARIA;
--   * não altera ocorrencias, acoes_preventivas, perfis ou escopos;
--   * não usa usuarios_unidades_escopo para decidir funcionalidades.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '2min';

do $$
declare
  v_cavalaria_total integer;
  v_cavalaria_ativa boolean;
  v_unidades_ativas integer;
begin
  if to_regclass('public.modulos_sistema') is not null
     or to_regclass('public.unidades_modulos') is not null then
    raise exception
      'Fase 3D-A cancelada: uma das tabelas de módulos já existe.';
  end if;

  select count(*), coalesce(bool_or(ativo), false)
    into v_cavalaria_total, v_cavalaria_ativa
  from public.unidades
  where sigla = 'CAVALARIA';

  if v_cavalaria_total <> 1 then
    raise exception
      'Fase 3D-A cancelada: esperado exatamente um cadastro da CAVALARIA; encontrado %.',
      v_cavalaria_total;
  end if;

  if v_cavalaria_ativa then
    raise exception
      'Fase 3D-A cancelada: a CAVALARIA deve permanecer inativa nesta etapa.';
  end if;

  select count(*) into v_unidades_ativas
  from public.unidades
  where ativo = true;

  if v_unidades_ativas <> 1 or not exists (
    select 1
    from public.unidades
    where id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
      and sigla = '2BPM'
      and ativo = true
  ) then
    raise exception
      'Fase 3D-A cancelada: somente o 2BPM deve estar ativo antes desta migration.';
  end if;
end
$$;

create table public.modulos_sistema (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nome text not null,
  descricao text,
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  constraint modulos_sistema_codigo_unique unique (codigo),
  constraint modulos_sistema_codigo_formato_check
    check (codigo ~ '^[A-Z][A-Z0-9_]*$'),
  constraint modulos_sistema_nome_check
    check (length(btrim(nome)) > 0),
  constraint modulos_sistema_ordem_check
    check (ordem >= 0)
);

comment on table public.modulos_sistema is
  'Catálogo estável de funcionalidades especializadas disponíveis no sistema.';
comment on column public.modulos_sistema.codigo is
  'Identificador técnico estável do módulo, em maiúsculas e sem espaços.';

create table public.unidades_modulos (
  unidade_id uuid not null,
  modulo_id uuid not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint unidades_modulos_pkey primary key (unidade_id, modulo_id),
  constraint unidades_modulos_unidade_fkey
    foreign key (unidade_id)
    references public.unidades(id)
    on update restrict
    on delete restrict,
  constraint unidades_modulos_modulo_fkey
    foreign key (modulo_id)
    references public.modulos_sistema(id)
    on update restrict
    on delete restrict
);

comment on table public.unidades_modulos is
  'Habilitação de módulos por unidade; não representa escopo de leitura do usuário.';

create index unidades_modulos_modulo_id_idx
  on public.unidades_modulos (modulo_id);

alter table public.modulos_sistema enable row level security;
alter table public.unidades_modulos enable row level security;

-- A leitura do navegador ocorre exclusivamente pela RPC abaixo. Sem políticas,
-- o acesso direto permanece em negação por padrão mesmo se um grant for criado
-- acidentalmente no futuro.
revoke all on table public.modulos_sistema
  from public, anon, authenticated;
revoke all on table public.unidades_modulos
  from public, anon, authenticated;

grant select on table public.modulos_sistema to service_role;
grant select on table public.unidades_modulos to service_role;

insert into public.modulos_sistema (
  codigo,
  nome,
  descricao,
  ativo,
  ordem
)
values (
  'ACOES_SOCIAIS',
  'Ações Sociais / Proximidade',
  'Registro de ações sociais e de proximidade realizadas pela unidade.',
  true,
  10
);

insert into public.unidades_modulos (unidade_id, modulo_id, ativo)
select u.id, m.id, true
from public.unidades u
cross join public.modulos_sistema m
where u.sigla = 'CAVALARIA'
  and m.codigo = 'ACOES_SOCIAIS';

create function public.obter_modulos_usuario()
returns table (
  codigo text,
  nome text,
  descricao text,
  ordem integer
)
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
  select
    m.codigo,
    m.nome,
    m.descricao,
    m.ordem
  from public.perfis_usuarios p
  join public.unidades u
    on u.id = p.unidade_id
   and u.ativo = true
  join public.unidades_modulos um
    on um.unidade_id = u.id
   and um.ativo = true
  join public.modulos_sistema m
    on m.id = um.modulo_id
   and m.ativo = true
  where p.user_id = (select auth.uid())
    and p.ativo = true
  order by m.ordem, m.nome;
$function$;

comment on function public.obter_modulos_usuario() is
  'Retorna módulos ativos da unidade principal do usuário autenticado; não usa o escopo de leitura.';

revoke all on function public.obter_modulos_usuario()
  from public, anon, authenticated;
grant execute on function public.obter_modulos_usuario()
  to authenticated, service_role;

do $$
declare
  v_modulos integer;
  v_vinculos integer;
begin
  select count(*) into v_modulos
  from public.modulos_sistema
  where codigo = 'ACOES_SOCIAIS'
    and ativo = true;

  if v_modulos <> 1 then
    raise exception
      'Validação da Fase 3D-A falhou: esperado um módulo ACOES_SOCIAIS ativo.';
  end if;

  select count(*) into v_vinculos
  from public.unidades_modulos um
  join public.unidades u on u.id = um.unidade_id
  join public.modulos_sistema m on m.id = um.modulo_id
  where m.codigo = 'ACOES_SOCIAIS'
    and um.ativo = true
    and u.sigla = 'CAVALARIA';

  if v_vinculos <> 1 then
    raise exception
      'Validação da Fase 3D-A falhou: vínculo ACOES_SOCIAIS/CAVALARIA ausente ou duplicado.';
  end if;

  if exists (
    select 1
    from public.unidades_modulos um
    join public.unidades u on u.id = um.unidade_id
    join public.modulos_sistema m on m.id = um.modulo_id
    where m.codigo = 'ACOES_SOCIAIS'
      and u.sigla <> 'CAVALARIA'
  ) then
    raise exception
      'Validação da Fase 3D-A falhou: ACOES_SOCIAIS foi associado a outra unidade.';
  end if;

  if exists (
    select 1 from public.unidades
    where sigla = 'CAVALARIA' and ativo = true
  ) then
    raise exception
      'Validação da Fase 3D-A falhou: a CAVALARIA foi ativada indevidamente.';
  end if;

  if has_function_privilege('anon', 'public.obter_modulos_usuario()', 'EXECUTE') then
    raise exception
      'Validação da Fase 3D-A falhou: anon recebeu EXECUTE na RPC de módulos.';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.obter_modulos_usuario()',
    'EXECUTE'
  ) then
    raise exception
      'Validação da Fase 3D-A falhou: authenticated não recebeu EXECUTE na RPC.';
  end if;
end
$$;

commit;
