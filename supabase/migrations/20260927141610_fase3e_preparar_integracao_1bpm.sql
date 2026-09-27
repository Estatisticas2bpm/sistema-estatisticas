begin;

set local lock_timeout = '10s';
set local statement_timeout = '1min';

do $fase3e_pre$
declare
  v_total_ocorrencias bigint;
  v_ocorrencias_2bpm bigint;
  v_ocorrencias_1bpm bigint;
  v_sem_unidade bigint;
  v_default text;
  v_check_def text;
  v_check_valid boolean;
begin
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
    raise exception 'FASE 3D-E abortada: cadastro do 1BPM divergiu do estado aprovado';
  end if;

  if (select count(*) from public.unidades where ativo) <> 1
     or not exists (
       select 1 from public.unidades
       where id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
         and sigla = '2BPM'
         and ativo = true
     ) then
    raise exception 'FASE 3D-E abortada: 2BPM deixou de ser a única unidade ativa';
  end if;

  if exists (
    select 1 from public.unidades_integracoes
    where unidade_id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid
      and tipo = 'GOOGLE_SHEETS_OCORRENCIAS'
  ) then
    raise exception 'FASE 3D-E abortada: já existe integração GOOGLE_SHEETS_OCORRENCIAS para o 1BPM';
  end if;

  if (select count(*) from public.unidades_integracoes) <> 1
     or not exists (
       select 1
       from public.unidades_integracoes
       where unidade_id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
         and tipo = 'GOOGLE_SHEETS_OCORRENCIAS'
         and google_sheet_id = '10BcWmWxzSrFghs_y_1L6QchidNWAwS6eAC9T53J_vs8'
         and aba_principal = 'Ocorrências'
         and ativo = true
     ) then
    raise exception 'FASE 3D-E abortada: integração oficial ativa do 2BPM divergiu';
  end if;

  if exists (
    select 1 from public.unidades_integracoes
    where google_sheet_id = '17kfnGH6PMY6smwMtitYOTOwRpuk6ligYSPR3rKE5rMk'
  ) then
    raise exception 'FASE 3D-E abortada: a planilha do 1BPM já está cadastrada';
  end if;

  select count(*),
         count(*) filter (where unidade_id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid),
         count(*) filter (where unidade_id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid),
         count(*) filter (where unidade_id is null)
    into v_total_ocorrencias, v_ocorrencias_2bpm, v_ocorrencias_1bpm, v_sem_unidade
  from public.ocorrencias;

  if v_total_ocorrencias <> 2731
     or v_ocorrencias_2bpm <> 2731
     or v_ocorrencias_1bpm <> 0
     or v_sem_unidade <> 0 then
    raise exception 'FASE 3D-E abortada: ocorrências divergiram (total %, 2BPM %, 1BPM %, sem unidade %)',
      v_total_ocorrencias, v_ocorrencias_2bpm, v_ocorrencias_1bpm, v_sem_unidade;
  end if;

  if exists (
    select 1 from public.perfis_usuarios
    where unidade_id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid
  ) then
    raise exception 'FASE 3D-E abortada: existe usuário vinculado ao 1BPM';
  end if;

  select pg_get_constraintdef(oid), convalidated
    into v_check_def, v_check_valid
  from pg_constraint
  where conrelid = 'public.ocorrencias'::regclass
    and conname = 'ocorrencias_unidade_fase2_2bpm_chk';

  if v_check_def is null
     or v_check_valid is distinct from true
     or position('f09a10df-cd1d-48d1-a093-bf731906e175' in v_check_def) = 0 then
    raise exception 'FASE 3D-E abortada: CHECK temporário do 2BPM ausente ou divergente';
  end if;

  select column_default
    into v_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'ocorrencias'
    and column_name = 'unidade_id';

  if v_default is distinct from '''f09a10df-cd1d-48d1-a093-bf731906e175''::uuid' then
    raise exception 'FASE 3D-E abortada: DEFAULT temporário do 2BPM ausente ou divergente';
  end if;
end
$fase3e_pre$;

insert into public.unidades_integracoes (
  unidade_id,
  tipo,
  google_sheet_id,
  aba_principal,
  ativo
)
values (
  'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid,
  'GOOGLE_SHEETS_OCORRENCIAS',
  '17kfnGH6PMY6smwMtitYOTOwRpuk6ligYSPR3rKE5rMk',
  'Ocorrências',
  false
);

do $fase3e_post$
declare
  v_default text;
  v_check_def text;
  v_check_valid boolean;
begin
  if (select count(*) from public.unidades_integracoes) <> 2
     or (select count(*) from public.unidades_integracoes where ativo) <> 1 then
    raise exception 'FASE 3D-E falhou: quantidade final de integrações inválida';
  end if;

  if not exists (
    select 1
    from public.unidades_integracoes
    where unidade_id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
      and tipo = 'GOOGLE_SHEETS_OCORRENCIAS'
      and google_sheet_id = '10BcWmWxzSrFghs_y_1L6QchidNWAwS6eAC9T53J_vs8'
      and aba_principal = 'Ocorrências'
      and ativo = true
  ) then
    raise exception 'FASE 3D-E falhou: integração oficial do 2BPM foi alterada';
  end if;

  if not exists (
    select 1
    from public.unidades_integracoes
    where unidade_id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid
      and tipo = 'GOOGLE_SHEETS_OCORRENCIAS'
      and google_sheet_id = '17kfnGH6PMY6smwMtitYOTOwRpuk6ligYSPR3rKE5rMk'
      and aba_principal = 'Ocorrências'
      and ativo = false
  ) then
    raise exception 'FASE 3D-E falhou: integração inativa do 1BPM não foi registrada corretamente';
  end if;

  if (select count(*) from public.unidades where ativo) <> 1
     or not exists (
       select 1 from public.unidades
       where id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid and ativo = true
     )
     or not exists (
       select 1 from public.unidades
       where id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid and ativo = false
     ) then
    raise exception 'FASE 3D-E falhou: estado de ativação das unidades foi alterado';
  end if;

  if (select count(*) from public.ocorrencias) <> 2731
     or (select count(*) from public.ocorrencias where unidade_id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid) <> 2731
     or exists (select 1 from public.ocorrencias where unidade_id is null)
     or exists (select 1 from public.ocorrencias where unidade_id <> 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid) then
    raise exception 'FASE 3D-E falhou: ocorrências foram alteradas';
  end if;

  if exists (
    select 1 from public.perfis_usuarios
    where unidade_id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid
  ) then
    raise exception 'FASE 3D-E falhou: usuário do 1BPM foi criado';
  end if;

  select pg_get_constraintdef(oid), convalidated
    into v_check_def, v_check_valid
  from pg_constraint
  where conrelid = 'public.ocorrencias'::regclass
    and conname = 'ocorrencias_unidade_fase2_2bpm_chk';

  if v_check_def is null
     or v_check_valid is distinct from true
     or position('f09a10df-cd1d-48d1-a093-bf731906e175' in v_check_def) = 0 then
    raise exception 'FASE 3D-E falhou: CHECK temporário do 2BPM foi alterado';
  end if;

  select column_default
    into v_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'ocorrencias'
    and column_name = 'unidade_id';

  if v_default is distinct from '''f09a10df-cd1d-48d1-a093-bf731906e175''::uuid' then
    raise exception 'FASE 3D-E falhou: DEFAULT temporário do 2BPM foi alterado';
  end if;
end
$fase3e_post$;

commit;
