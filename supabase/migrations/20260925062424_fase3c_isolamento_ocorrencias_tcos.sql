-- FASE 3C — isolamento real de ocorrências e TCOs por escopo organizacional
-- Regras:
--   LEITURA: unidades presentes no escopo do usuário.
--   ESCRITA: somente a unidade PRINCIPAL ativa do usuário.
--   RPCs operacionais passam a SECURITY INVOKER para respeitar RLS.
--   Nenhuma segunda unidade é ativada nesta migration.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '3min';

lock table public.ocorrencias in share row exclusive mode;
lock table public.tcos in share row exclusive mode;
lock table public.perfis_usuarios in share mode;
lock table public.usuarios_unidades_escopo in share mode;

-- =========================================================
-- 1. PRÉ-CONDIÇÕES
-- =========================================================

do $$
declare
  v_ativas bigint;
begin
  select count(*) into v_ativas
  from public.unidades
  where ativo = true;

  if v_ativas <> 1 then
    raise exception
      'Fase 3C cancelada: esperada exatamente 1 unidade ativa, encontradas %.',
      v_ativas;
  end if;

  if not exists (
    select 1
    from public.unidades
    where id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
      and sigla = '2BPM'
      and ativo = true
  ) then
    raise exception
      'Fase 3C cancelada: o 2º BPM oficial não é a unidade ativa atual.';
  end if;

  if exists (
    select 1
    from public.ocorrencias
    where unidade_id is distinct from
      'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
  ) then
    raise exception
      'Fase 3C cancelada: existem ocorrências fora do 2º BPM antes da abertura multiunidade.';
  end if;

  if exists (
    select 1
    from public.perfis_usuarios p
    join public.unidades u on u.id = p.unidade_id
    where p.ativo = true
      and u.sigla <> '2BPM'
  ) then
    raise exception
      'Fase 3C cancelada: existe usuário ativo fora do 2º BPM nesta etapa.';
  end if;

  if exists (
    select 1
    from public.usuarios_unidades_escopo e
    where e.origem = 'EXPLICITO'
  ) then
    raise exception
      'Fase 3C cancelada: já existem escopos EXPLICITO; revisar antes de alterar a RLS.';
  end if;
end
$$;

-- =========================================================
-- 2. HELPERS PARA TCOs E ENTIDADES VINCULADAS
-- =========================================================

create or replace function private.ocorrencia_acessivel(
  p_ocorrencia_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth', 'private'
as $function$
  select exists (
    select 1
    from public.ocorrencias o
    where o.id = p_ocorrencia_id
      and private.pode_acessar_unidade(o.unidade_id)
  )
$function$;

create or replace function private.ocorrencia_na_unidade_principal(
  p_ocorrencia_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth', 'private'
as $function$
  select exists (
    select 1
    from public.ocorrencias o
    where o.id = p_ocorrencia_id
      and o.unidade_id = private.unidade_atual()
  )
$function$;

revoke all on function private.ocorrencia_acessivel(uuid)
  from public, anon;

revoke all on function private.ocorrencia_na_unidade_principal(uuid)
  from public, anon;

grant execute on function private.ocorrencia_acessivel(uuid)
  to authenticated;

grant execute on function private.ocorrencia_na_unidade_principal(uuid)
  to authenticated;

-- =========================================================
-- 3. RLS DE OCORRÊNCIAS
-- =========================================================

drop policy if exists auth_ocorrencias_select
  on public.ocorrencias;

create policy auth_ocorrencias_select
on public.ocorrencias
for select
to authenticated
using (
  (select private.usuario_ativo())
  and private.pode_acessar_unidade(unidade_id)
);

drop policy if exists auth_ocorrencias_insert
  on public.ocorrencias;

create policy auth_ocorrencias_insert
on public.ocorrencias
for insert
to authenticated
with check (
  (select private.pode_escrever_operacional())
  and unidade_id = (select private.unidade_atual())
);

drop policy if exists auth_ocorrencias_update
  on public.ocorrencias;

create policy auth_ocorrencias_update
on public.ocorrencias
for update
to authenticated
using (
  unidade_id = (select private.unidade_atual())
  and (
    (select private.pode_administrar_dados())
    or (
      (select private.perfil_atual()) = 'OPERADOR'
      and criado_por = (select auth.uid())
    )
  )
)
with check (
  unidade_id = (select private.unidade_atual())
  and (
    (select private.pode_administrar_dados())
    or (
      (select private.perfil_atual()) = 'OPERADOR'
      and criado_por = (select auth.uid())
    )
  )
);

drop policy if exists auth_ocorrencias_delete
  on public.ocorrencias;

create policy auth_ocorrencias_delete
on public.ocorrencias
for delete
to authenticated
using (
  unidade_id = (select private.unidade_atual())
  and (select private.pode_administrar_dados())
);

-- =========================================================
-- 4. RLS DE TCOs PELO BO VINCULADO
-- =========================================================

drop policy if exists auth_tcos_select
  on public.tcos;

create policy auth_tcos_select
on public.tcos
for select
to authenticated
using (
  (select private.usuario_ativo())
  and private.ocorrencia_acessivel(ocorrencia_id)
);

drop policy if exists auth_tcos_insert
  on public.tcos;

create policy auth_tcos_insert
on public.tcos
for insert
to authenticated
with check (
  (select private.pode_escrever_operacional())
  and private.ocorrencia_na_unidade_principal(ocorrencia_id)
);

drop policy if exists auth_tcos_update
  on public.tcos;

create policy auth_tcos_update
on public.tcos
for update
to authenticated
using (
  private.ocorrencia_na_unidade_principal(ocorrencia_id)
  and (
    (select private.pode_administrar_dados())
    or (
      (select private.perfil_atual()) = 'OPERADOR'
      and criado_por = (select auth.uid())
    )
  )
)
with check (
  private.ocorrencia_na_unidade_principal(ocorrencia_id)
  and (
    (select private.pode_administrar_dados())
    or (
      (select private.perfil_atual()) = 'OPERADOR'
      and criado_por = (select auth.uid())
    )
  )
);

drop policy if exists auth_tcos_delete
  on public.tcos;

create policy auth_tcos_delete
on public.tcos
for delete
to authenticated
using (
  private.ocorrencia_na_unidade_principal(ocorrencia_id)
  and (select private.pode_administrar_dados())
);

-- =========================================================
-- 5. RPCs OPERACIONAIS DEVEM RESPEITAR RLS
-- =========================================================

alter function public.atualizar_ocorrencia_publica(uuid, jsonb)
  security invoker;

alter function public.buscar_bo_para_tco(text, integer, uuid)
  security invoker;

alter function public.cadastrar_tco_publico(uuid, text, date, text)
  security invoker;

alter function public.consultar_ocorrencias_por_ids_publicas(uuid[])
  security invoker;

alter function public.consultar_ocorrencias_publicas(text, date)
  security invoker;

alter function public.consultar_ocorrencias_publicas_v2(text, date)
  security invoker;

alter function public.excluir_ocorrencia_publica(uuid)
  security invoker;

alter function public.obter_dados_dashboard(date, date)
  security invoker;

alter function public.obter_ocorrencia_publica(uuid)
  security invoker;

alter function public.obter_ocorrencias_mapa(date, date, text)
  security invoker;

alter function public.obter_tcos_dashboard(date, date)
  security invoker;

-- Retira acesso anônimo legado das consultas operacionais.
revoke all on function public.consultar_ocorrencias_por_ids_publicas(uuid[])
  from public, anon;

grant execute on function public.consultar_ocorrencias_por_ids_publicas(uuid[])
  to authenticated, service_role;

-- Preserva acesso autenticado e administrativo esperado.
grant execute on function public.atualizar_ocorrencia_publica(uuid, jsonb)
  to authenticated, service_role;

grant execute on function public.buscar_bo_para_tco(text, integer, uuid)
  to authenticated, service_role;

grant execute on function public.cadastrar_tco_publico(uuid, text, date, text)
  to authenticated, service_role;

grant execute on function public.consultar_ocorrencias_publicas(text, date)
  to authenticated, service_role;

grant execute on function public.consultar_ocorrencias_publicas_v2(text, date)
  to authenticated, service_role;

grant execute on function public.excluir_ocorrencia_publica(uuid)
  to authenticated, service_role;

grant execute on function public.obter_dados_dashboard(date, date)
  to authenticated, service_role;

grant execute on function public.obter_ocorrencia_publica(uuid)
  to authenticated, service_role;

grant execute on function public.obter_ocorrencias_mapa(date, date, text)
  to authenticated, service_role;

grant execute on function public.obter_tcos_dashboard(date, date)
  to authenticated, service_role;

-- =========================================================
-- 6. TESTE TRANSACIONAL COM O PERFIL ATUAL
-- =========================================================

select set_config(
  'app.fase3c_total_ocorrencias',
  (select count(*)::text from public.ocorrencias),
  true
);

select set_config(
  'app.fase3c_total_tcos',
  (select count(*)::text from public.tcos),
  true
);

select set_config(
  'request.jwt.claim.sub',
  (
    select p.user_id::text
    from public.perfis_usuarios p
    join public.unidades u on u.id = p.unidade_id
    where p.ativo = true
      and u.sigla = '2BPM'
    order by p.criado_em
    limit 1
  ),
  true
);

select set_config(
  'request.jwt.claim.role',
  'authenticated',
  true
);

set local role authenticated;

do $$
declare
  v_total_ocorrencias bigint;
  v_total_tcos bigint;
  v_dashboard_total bigint;
begin
  if auth.uid() is null then
    raise exception
      'Fase 3C cancelada: não foi possível simular o usuário autenticado.';
  end if;

  if private.unidade_atual() is distinct from
     'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid then
    raise exception
      'Fase 3C cancelada: unidade principal simulada não corresponde ao 2º BPM.';
  end if;

  if not private.pode_acessar_unidade(
    'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
  ) then
    raise exception
      'Fase 3C cancelada: o usuário atual perdeu acesso ao 2º BPM.';
  end if;

  if private.pode_acessar_unidade(
    '666ede43-c259-4e02-a493-7f70fd776d6d'::uuid
  ) then
    raise exception
      'Fase 3C cancelada: o usuário do 2º BPM recebeu acesso indevido ao GIRO.';
  end if;

  select count(*) into v_total_ocorrencias
  from public.ocorrencias;

  if v_total_ocorrencias <>
     current_setting('app.fase3c_total_ocorrencias')::bigint then
    raise exception
      'Fase 3C cancelada: a RLS alterou indevidamente a visão atual das ocorrências.';
  end if;

  select count(*) into v_total_tcos
  from public.tcos;

  if v_total_tcos <>
     current_setting('app.fase3c_total_tcos')::bigint then
    raise exception
      'Fase 3C cancelada: a RLS alterou indevidamente a visão atual dos TCOs.';
  end if;

  select jsonb_array_length(
    public.obter_dados_dashboard(null, null)
  )
  into v_dashboard_total;

  if v_dashboard_total <> v_total_ocorrencias then
    raise exception
      'Fase 3C cancelada: o dashboard via RPC não respeitou a mesma visão da tabela.';
  end if;
end
$$;

reset role;

-- =========================================================
-- 7. VALIDAÇÃO FINAL
-- =========================================================

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'atualizar_ocorrencia_publica',
        'buscar_bo_para_tco',
        'cadastrar_tco_publico',
        'consultar_ocorrencias_por_ids_publicas',
        'consultar_ocorrencias_publicas',
        'consultar_ocorrencias_publicas_v2',
        'excluir_ocorrencia_publica',
        'obter_dados_dashboard',
        'obter_ocorrencia_publica',
        'obter_ocorrencias_mapa',
        'obter_tcos_dashboard'
      )
      and p.prosecdef = true
  ) then
    raise exception
      'Fase 3C cancelada: uma ou mais RPCs operacionais permaneceram SECURITY DEFINER.';
  end if;

  if has_function_privilege(
    'anon',
    'public.consultar_ocorrencias_por_ids_publicas(uuid[])',
    'EXECUTE'
  ) then
    raise exception
      'Fase 3C cancelada: a consulta por IDs continua executável por anon.';
  end if;
end
$$;

commit;