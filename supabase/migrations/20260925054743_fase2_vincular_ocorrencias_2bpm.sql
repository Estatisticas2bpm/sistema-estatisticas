-- FASE 2 — vínculo organizacional das ocorrências ao 2º BPM
-- Preparada para o projeto CPC. NÃO ativa outras unidades e NÃO altera RLS.
-- Compatibilidade temporária:
--   1) default de unidade_id = 2º BPM;
--   2) CHECK restringindo unidade_id ao 2º BPM.
-- Ambos deverão ser removidos antes da ativação de qualquer segunda unidade.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '2min';

lock table public.ocorrencias in access exclusive mode;

-- =========================================================
-- 1. PRÉ-CONDIÇÕES
-- =========================================================

do $$
declare
  v_total_unidades bigint;
  v_ativas bigint;
begin
  select count(*) into v_total_unidades
  from public.unidades;

  if v_total_unidades <> 13 then
    raise exception
      'Fase 2 cancelada: esperadas 13 unidades da Fase 1, mas foram encontradas %.',
      v_total_unidades;
  end if;

  if not exists (
    select 1
    from public.unidades u
    join public.unidades p
      on p.id = u.parent_id
    where u.id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
      and u.sigla = '2BPM'
      and u.nome = '2º Batalhão de Polícia Militar'
      and u.tipo = 'BATALHAO'
      and u.ativo = true
      and p.sigla = 'CPC'
  ) then
    raise exception
      'Fase 2 cancelada: a unidade oficial e ativa do 2º BPM não está no estado esperado.';
  end if;

  select count(*) into v_ativas
  from public.unidades
  where ativo = true;

  if v_ativas <> 1 then
    raise exception
      'Fase 2 cancelada: esperada exatamente 1 unidade ativa, mas foram encontradas %.',
      v_ativas;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ocorrencias'
      and column_name = 'unidade_id'
  ) then
    raise exception
      'Fase 2 cancelada: public.ocorrencias.unidade_id já existe.';
  end if;

  if exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.ocorrencias'::regclass
      and not tgisinternal
      and tgenabled <> 'O'
  ) then
    raise exception
      'Fase 2 cancelada: existe trigger de usuário de ocorrencias que não está habilitado no estado normal.';
  end if;
end
$$;

-- =========================================================
-- 2. SNAPSHOT DE INTEGRIDADE
-- =========================================================
-- O hash usa todo o conteúdo atual de cada linha.
-- Depois do backfill, o mesmo hash será recalculado removendo apenas
-- a nova chave unidade_id do JSON da linha.

create temporary table _fase2_snapshot
on commit drop
as
select
  count(*)::bigint as total,
  count(distinct id)::bigint as ids_distintos,
  count(distinct sync_id)::bigint as sync_ids_distintos,
  md5(
    string_agg(
      md5(to_jsonb(o)::text),
      ','
      order by o.id
    )
  ) as dados_hash,
  (
    select count(*)::bigint
    from public.google_sheets_sync_outbox
  ) as outbox_total
from public.ocorrencias o;

-- =========================================================
-- 3. CRIAÇÃO DA COLUNA
-- =========================================================

alter table public.ocorrencias
  add column unidade_id uuid;

do $$
declare
  v_total bigint;
  v_nulls bigint;
begin
  select total
    into v_total
  from _fase2_snapshot;

  select count(*)
    into v_nulls
  from public.ocorrencias
  where unidade_id is null;

  if v_nulls <> v_total then
    raise exception
      'Fase 2 cancelada: quantidade de NULLs inesperada após criação de unidade_id.';
  end if;
end
$$;

-- =========================================================
-- 4. BACKFILL
-- =========================================================
-- Suspende somente os triggers de usuário durante o backfill para evitar:
-- - alteração de atualizado_em / updated_at;
-- - aumento de sync_version;
-- - geração de milhares de eventos no Google Sheets;
-- - auditoria como se cada BO tivesse sido editado manualmente.
--
-- A operação está protegida por transação e ACCESS EXCLUSIVE LOCK.

alter table public.ocorrencias disable trigger user;

do $$
declare
  v_esperado bigint;
  v_atualizados bigint;
begin
  select total
    into v_esperado
  from _fase2_snapshot;

  update public.ocorrencias
  set unidade_id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
  where unidade_id is null;

  get diagnostics v_atualizados = row_count;

  if v_atualizados <> v_esperado then
    raise exception
      'Fase 2 cancelada: esperado atualizar %, mas foram atualizados %.',
      v_esperado,
      v_atualizados;
  end if;
end
$$;

alter table public.ocorrencias enable trigger user;

-- =========================================================
-- 5. VALIDAÇÃO DO BACKFILL
-- =========================================================

do $$
declare
  v_total bigint;
  v_ids_distintos bigint;
  v_sync_ids_distintos bigint;
  v_dados_hash text;
  v_outbox_total bigint;
begin
  select
    count(*)::bigint,
    count(distinct id)::bigint,
    count(distinct sync_id)::bigint,
    md5(
      string_agg(
        md5((to_jsonb(o) - 'unidade_id')::text),
        ','
        order by o.id
      )
    ),
    (
      select count(*)::bigint
      from public.google_sheets_sync_outbox
    )
  into
    v_total,
    v_ids_distintos,
    v_sync_ids_distintos,
    v_dados_hash,
    v_outbox_total
  from public.ocorrencias o;

  if v_total <> (select total from _fase2_snapshot)
     or v_ids_distintos <> (select ids_distintos from _fase2_snapshot)
     or v_sync_ids_distintos <> (select sync_ids_distintos from _fase2_snapshot) then
    raise exception
      'Fase 2 cancelada: quantidade ou identidade das ocorrências foi alterada.';
  end if;

  if v_dados_hash is distinct from (select dados_hash from _fase2_snapshot) then
    raise exception
      'Fase 2 cancelada: um ou mais campos preexistentes das ocorrências foram alterados durante o backfill.';
  end if;

  if v_outbox_total <> (select outbox_total from _fase2_snapshot) then
    raise exception
      'Fase 2 cancelada: o backfill gerou eventos inesperados no Google Sheets.';
  end if;

  if exists (
    select 1
    from public.ocorrencias
    where unidade_id is null
       or unidade_id <> 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
  ) then
    raise exception
      'Fase 2 cancelada: existem ocorrências sem o vínculo correto com o 2º BPM.';
  end if;

  if exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.ocorrencias'::regclass
      and not tgisinternal
      and tgenabled <> 'O'
  ) then
    raise exception
      'Fase 2 cancelada: um ou mais triggers de ocorrencias não retornaram ao estado habilitado.';
  end if;
end
$$;

-- =========================================================
-- 6. COMPATIBILIDADE TEMPORÁRIA COM O SITE ATUAL
-- =========================================================
-- O frontend e os importadores atuais ainda não enviam unidade_id.
-- Enquanto SOMENTE o 2º BPM estiver ativo, o banco atribuirá 2BPM
-- automaticamente e rejeitará qualquer outra unidade.
--
-- IMPORTANTE: remover o DEFAULT e o CHECK antes de ativar uma segunda unidade.

alter table public.ocorrencias
  alter column unidade_id
  set default 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid;

alter table public.ocorrencias
  alter column unidade_id set not null;

-- =========================================================
-- 7. INTEGRIDADE REFERENCIAL
-- =========================================================

alter table public.ocorrencias
  add constraint ocorrencias_unidade_id_fkey
  foreign key (unidade_id)
  references public.unidades(id)
  on update restrict
  on delete restrict
  not valid;

alter table public.ocorrencias
  validate constraint ocorrencias_unidade_id_fkey;

-- Proteção temporária da Fase 2: somente 2º BPM é permitido.
alter table public.ocorrencias
  add constraint ocorrencias_unidade_fase2_2bpm_chk
  check (
    unidade_id =
    'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
  )
  not valid;

alter table public.ocorrencias
  validate constraint ocorrencias_unidade_fase2_2bpm_chk;

-- =========================================================
-- 8. ÍNDICE
-- =========================================================
-- unidade_id será o filtro organizacional principal.
-- data_ocorrencia será frequentemente usada junto com a unidade
-- em dashboard, relatórios e consultas.

create index ocorrencias_unidade_data_idx
  on public.ocorrencias (unidade_id, data_ocorrencia);

comment on column public.ocorrencias.unidade_id is
  'Unidade responsável pela ocorrência. Na Fase 2, todos os registros pertencem ao 2º BPM. O default e o CHECK exclusivos do 2º BPM são temporários e devem ser removidos antes da ativação de outra unidade.';

-- =========================================================
-- 9. VALIDAÇÃO FINAL ANTES DO COMMIT
-- =========================================================

do $$
declare
  v_total bigint;
  v_2bpm bigint;
begin
  select count(*)
    into v_total
  from public.ocorrencias;

  select count(*)
    into v_2bpm
  from public.ocorrencias
  where unidade_id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid;

  if v_total <> (select total from _fase2_snapshot) then
    raise exception
      'Fase 2 cancelada: o total final de ocorrências diverge do snapshot inicial.';
  end if;

  if v_2bpm <> v_total then
    raise exception
      'Fase 2 cancelada: nem todas as ocorrências foram atribuídas ao 2º BPM.';
  end if;

  if exists (
    select 1
    from public.ocorrencias
    where unidade_id is null
  ) then
    raise exception
      'Fase 2 cancelada: ainda existem ocorrências com unidade_id NULL.';
  end if;
end
$$;

commit;
