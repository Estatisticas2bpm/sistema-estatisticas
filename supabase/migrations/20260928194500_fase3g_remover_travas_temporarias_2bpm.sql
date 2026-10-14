begin;

set local lock_timeout = '10s';
set local statement_timeout = '1min';

lock table public.ocorrencias in access exclusive mode;

do $fase3g_pre$
declare
  v_total_ocorrencias bigint;
  v_ocorrencias_2bpm bigint;
  v_ocorrencias_1bpm bigint;
  v_sem_unidade bigint;
  v_outras_unidades bigint;
  v_default text;
  v_check_def text;
  v_check_valid boolean;
  v_is_nullable text;
  v_trigger_enabled "char";
begin
  -- O 1º BPM precisa continuar preparado, porém fechado.
  if not exists (
    select 1
    from public.unidades
    where id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid
      and sigla = '1BPM'
      and nome = '1º Batalhão de Polícia Militar'
      and tipo = 'BATALHAO'
      and parent_id = '156c7bc6-0970-499b-92ce-a924f6b0da66'::uuid
      and ativo = false
  ) then
    raise exception 'FASE 3G abortada: 1BPM não está no estado inativo aprovado';
  end if;

  if (select count(*) from public.unidades where ativo) <> 1
     or not exists (
       select 1
       from public.unidades
       where id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
         and sigla = '2BPM'
         and ativo = true
     ) then
    raise exception 'FASE 3G abortada: 2BPM deixou de ser a única unidade ativa';
  end if;

  -- A integração do 1º BPM também precisa continuar inativa.
  if (select count(*) from public.unidades_integracoes) <> 2
     or (select count(*) from public.unidades_integracoes where ativo) <> 1
     or not exists (
       select 1
       from public.unidades_integracoes
       where unidade_id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
         and tipo = 'GOOGLE_SHEETS_OCORRENCIAS'
         and google_sheet_id = '10BcWmWxzSrFghs_y_1L6QchidNWAwS6eAC9T53J_vs8'
         and aba_principal = 'Ocorrências'
         and ativo = true
     )
     or not exists (
       select 1
       from public.unidades_integracoes
       where unidade_id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid
         and tipo = 'GOOGLE_SHEETS_OCORRENCIAS'
         and google_sheet_id = '17kfnGH6PMY6smwMtitYOTOwRpuk6ligYSPR3rKE5rMk'
         and aba_principal = 'Ocorrências'
         and ativo = false
     ) then
    raise exception 'FASE 3G abortada: integrações não estão no estado aprovado';
  end if;

  if exists (
    select 1
    from public.perfis_usuarios
    where unidade_id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid
  ) then
    raise exception 'FASE 3G abortada: já existe usuário vinculado ao 1BPM';
  end if;

  select
    count(*),
    count(*) filter (where unidade_id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid),
    count(*) filter (where unidade_id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid),
    count(*) filter (where unidade_id is null),
    count(*) filter (
      where unidade_id is not null
        and unidade_id <> 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
    )
  into
    v_total_ocorrencias,
    v_ocorrencias_2bpm,
    v_ocorrencias_1bpm,
    v_sem_unidade,
    v_outras_unidades
  from public.ocorrencias;

  if v_total_ocorrencias < 2753
     or v_ocorrencias_2bpm <> v_total_ocorrencias
     or v_ocorrencias_1bpm <> 0
     or v_sem_unidade <> 0
     or v_outras_unidades <> 0 then
    raise exception
      'FASE 3G abortada: ocorrências divergiram (total %, 2BPM %, 1BPM %, sem unidade %, outras %)',
      v_total_ocorrencias,
      v_ocorrencias_2bpm,
      v_ocorrencias_1bpm,
      v_sem_unidade,
      v_outras_unidades;
  end if;

  perform set_config('app.fase3g_total_ocorrencias', v_total_ocorrencias::text, true);

  select pg_get_constraintdef(oid), convalidated
    into v_check_def, v_check_valid
  from pg_constraint
  where conrelid = 'public.ocorrencias'::regclass
    and conname = 'ocorrencias_unidade_fase2_2bpm_chk';

  if v_check_def is null
     or v_check_valid is distinct from true
     or position('f09a10df-cd1d-48d1-a093-bf731906e175' in v_check_def) = 0 then
    raise exception 'FASE 3G abortada: CHECK temporário do 2BPM ausente ou divergente';
  end if;

  select column_default, is_nullable
    into v_default, v_is_nullable
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'ocorrencias'
    and column_name = 'unidade_id';

  if v_default is distinct from '''f09a10df-cd1d-48d1-a093-bf731906e175''::uuid' then
    raise exception 'FASE 3G abortada: DEFAULT temporário do 2BPM ausente ou divergente';
  end if;

  if v_is_nullable is distinct from 'NO' then
    raise exception 'FASE 3G abortada: unidade_id deixou de ser NOT NULL';
  end if;

  select tgenabled
    into v_trigger_enabled
  from pg_trigger
  where tgrelid = 'public.ocorrencias'::regclass
    and tgname = 'trg_definir_unidade_ocorrencia'
    and not tgisinternal;

  if v_trigger_enabled is distinct from 'O' then
    raise exception 'FASE 3G abortada: trigger autoritativo de unidade está ausente ou desabilitado';
  end if;
end
$fase3g_pre$;

-- Remove somente as duas travas temporárias exclusivas do 2º BPM.
alter table public.ocorrencias
  drop constraint ocorrencias_unidade_fase2_2bpm_chk;

alter table public.ocorrencias
  alter column unidade_id drop default;

comment on column public.ocorrencias.unidade_id is
  'Unidade responsável pela ocorrência. Campo obrigatório e definido de forma autoritativa pelo backend/perfil da unidade; não possui default global.';

do $fase3g_post$
declare
  v_total_antes bigint := current_setting('app.fase3g_total_ocorrencias')::bigint;
  v_total_depois bigint;
  v_default text;
  v_is_nullable text;
  v_trigger_enabled "char";
  v_fk_valid boolean;
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ocorrencias'::regclass
      and conname = 'ocorrencias_unidade_fase2_2bpm_chk'
  ) then
    raise exception 'FASE 3G falhou: CHECK temporário do 2BPM ainda existe';
  end if;

  select column_default, is_nullable
    into v_default, v_is_nullable
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'ocorrencias'
    and column_name = 'unidade_id';

  if v_default is not null then
    raise exception 'FASE 3G falhou: unidade_id ainda possui DEFAULT';
  end if;

  if v_is_nullable is distinct from 'NO' then
    raise exception 'FASE 3G falhou: NOT NULL de unidade_id foi removido indevidamente';
  end if;

  select convalidated
    into v_fk_valid
  from pg_constraint
  where conrelid = 'public.ocorrencias'::regclass
    and conname = 'ocorrencias_unidade_id_fkey'
    and contype = 'f';

  if v_fk_valid is distinct from true then
    raise exception 'FASE 3G falhou: FK de unidade_id está ausente ou inválida';
  end if;

  select tgenabled
    into v_trigger_enabled
  from pg_trigger
  where tgrelid = 'public.ocorrencias'::regclass
    and tgname = 'trg_definir_unidade_ocorrencia'
    and not tgisinternal;

  if v_trigger_enabled is distinct from 'O' then
    raise exception 'FASE 3G falhou: trigger autoritativo de unidade foi alterado';
  end if;

  select count(*) into v_total_depois
  from public.ocorrencias;

  if v_total_depois <> v_total_antes
     or exists (
       select 1
       from public.ocorrencias
       where unidade_id is null
          or unidade_id <> 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
     ) then
    raise exception 'FASE 3G falhou: ocorrências foram alteradas durante a retirada das travas';
  end if;

  -- Esta etapa não pode abrir o piloto.
  if (select count(*) from public.unidades where ativo) <> 1
     or not exists (
       select 1
       from public.unidades
       where id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
         and ativo = true
     )
     or not exists (
       select 1
       from public.unidades
       where id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid
         and ativo = false
     ) then
    raise exception 'FASE 3G falhou: estado de ativação das unidades foi alterado';
  end if;

  if (select count(*) from public.unidades_integracoes where ativo) <> 1
     or not exists (
       select 1
       from public.unidades_integracoes
       where unidade_id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid
         and tipo = 'GOOGLE_SHEETS_OCORRENCIAS'
         and ativo = false
     ) then
    raise exception 'FASE 3G falhou: integração do 1BPM foi ativada indevidamente';
  end if;

  if exists (
    select 1
    from public.perfis_usuarios
    where unidade_id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid
  ) then
    raise exception 'FASE 3G falhou: usuário do 1BPM foi criado indevidamente';
  end if;
end
$fase3g_post$;

commit;
