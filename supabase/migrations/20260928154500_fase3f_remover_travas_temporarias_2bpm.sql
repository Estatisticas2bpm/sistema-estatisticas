begin;

set local lock_timeout = '10s';
set local statement_timeout = '1min';

-- FASE 3F
-- Remove somente as duas travas temporárias que impedem a abertura multiunidade:
--   1) CHECK que restringe ocorrencias.unidade_id ao 2º BPM;
--   2) DEFAULT que atribui automaticamente o 2º BPM.
--
-- Esta migration NÃO ativa o 1º BPM, NÃO ativa sua integração, NÃO cria usuários
-- e NÃO altera nenhuma ocorrência existente.

lock table public.ocorrencias in share row exclusive mode;
lock table public.unidades in share mode;
lock table public.unidades_integracoes in share mode;
lock table public.perfis_usuarios in share mode;

create temporary table fase3f_snapshot (
  total_ocorrencias bigint not null,
  ocorrencias_2bpm bigint not null,
  ocorrencias_1bpm bigint not null,
  sem_unidade bigint not null
) on commit drop;

do $fase3f_pre$
declare
  v_default text;
  v_check_def text;
  v_check_valid boolean;
begin
  if to_regclass('public.ocorrencias') is null
     or to_regclass('public.unidades') is null
     or to_regclass('public.unidades_integracoes') is null
     or to_regclass('public.perfis_usuarios') is null then
    raise exception 'FASE 3F abortada: tabelas obrigatórias não foram encontradas';
  end if;

  insert into fase3f_snapshot (
    total_ocorrencias,
    ocorrencias_2bpm,
    ocorrencias_1bpm,
    sem_unidade
  )
  select
    count(*),
    count(*) filter (
      where unidade_id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
    ),
    count(*) filter (
      where unidade_id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid
    ),
    count(*) filter (where unidade_id is null)
  from public.ocorrencias;

  if exists (
    select 1
    from fase3f_snapshot
    where total_ocorrencias <> ocorrencias_2bpm
       or ocorrencias_1bpm <> 0
       or sem_unidade <> 0
  ) then
    raise exception
      'FASE 3F abortada: ocorrências não estão 100%% vinculadas ao 2º BPM';
  end if;

  if (select count(*) from public.unidades where ativo) <> 1
     or not exists (
       select 1
       from public.unidades
       where id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
         and sigla = '2BPM'
         and ativo = true
     )
     or not exists (
       select 1
       from public.unidades
       where id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid
         and sigla = '1BPM'
         and ativo = false
     ) then
    raise exception 'FASE 3F abortada: estado de ativação das unidades divergiu';
  end if;

  if not exists (
    select 1
    from public.unidades_integracoes
    where unidade_id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
      and tipo = 'GOOGLE_SHEETS_OCORRENCIAS'
      and ativo = true
  ) then
    raise exception 'FASE 3F abortada: integração ativa do 2º BPM não encontrada';
  end if;

  if not exists (
    select 1
    from public.unidades_integracoes
    where unidade_id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid
      and tipo = 'GOOGLE_SHEETS_OCORRENCIAS'
      and ativo = false
  ) then
    raise exception 'FASE 3F abortada: integração inativa do 1º BPM não encontrada';
  end if;

  if exists (
    select 1
    from public.perfis_usuarios
    where unidade_id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid
  ) then
    raise exception 'FASE 3F abortada: já existe usuário vinculado ao 1º BPM';
  end if;

  if not exists (
    select 1
    from pg_attribute
    where attrelid = 'public.ocorrencias'::regclass
      and attname = 'unidade_id'
      and atttypid = 'uuid'::regtype
      and attnotnull
      and not attisdropped
  ) then
    raise exception 'FASE 3F abortada: ocorrencias.unidade_id deixou de ser UUID NOT NULL';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ocorrencias'::regclass
      and conname = 'ocorrencias_unidade_id_fkey'
      and contype = 'f'
      and convalidated
  ) then
    raise exception 'FASE 3F abortada: FK de unidade não encontrada ou inválida';
  end if;

  select pg_get_constraintdef(oid, true), convalidated
    into v_check_def, v_check_valid
  from pg_constraint
  where conrelid = 'public.ocorrencias'::regclass
    and conname = 'ocorrencias_unidade_fase2_2bpm_chk';

  if v_check_def is null
     or v_check_valid is distinct from true
     or v_check_def <> 'CHECK (unidade_id = ''f09a10df-cd1d-48d1-a093-bf731906e175''::uuid)' then
    raise exception 'FASE 3F abortada: CHECK temporário do 2º BPM ausente ou divergente';
  end if;

  select pg_get_expr(d.adbin, d.adrelid)
    into v_default
  from pg_attribute a
  join pg_attrdef d
    on d.adrelid = a.attrelid
   and d.adnum = a.attnum
  where a.attrelid = 'public.ocorrencias'::regclass
    and a.attname = 'unidade_id';

  if v_default is distinct from
     '''f09a10df-cd1d-48d1-a093-bf731906e175''::uuid' then
    raise exception 'FASE 3F abortada: DEFAULT temporário do 2º BPM ausente ou divergente';
  end if;

  if to_regclass('public.ocorrencia_numero_ano_unico') is null
     or to_regclass('public.ocorrencias_chave_importacao_uq') is null then
    raise exception 'FASE 3F abortada: índices multiunidade obrigatórios não foram encontrados';
  end if;
end
$fase3f_pre$;

alter table public.ocorrencias
  drop constraint ocorrencias_unidade_fase2_2bpm_chk;

alter table public.ocorrencias
  alter column unidade_id drop default;

do $fase3f_post$
declare
  v_total bigint;
  v_2bpm bigint;
  v_1bpm bigint;
  v_sem bigint;
  v_default text;
begin
  select
    count(*),
    count(*) filter (
      where unidade_id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
    ),
    count(*) filter (
      where unidade_id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid
    ),
    count(*) filter (where unidade_id is null)
  into v_total, v_2bpm, v_1bpm, v_sem
  from public.ocorrencias;

  if not exists (
    select 1
    from fase3f_snapshot s
    where s.total_ocorrencias = v_total
      and s.ocorrencias_2bpm = v_2bpm
      and s.ocorrencias_1bpm = v_1bpm
      and s.sem_unidade = v_sem
  ) then
    raise exception 'FASE 3F falhou: dados de ocorrências mudaram durante a retirada das travas';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ocorrencias'::regclass
      and conname = 'ocorrencias_unidade_fase2_2bpm_chk'
  ) then
    raise exception 'FASE 3F falhou: CHECK temporário ainda existe';
  end if;

  select pg_get_expr(d.adbin, d.adrelid)
    into v_default
  from pg_attribute a
  left join pg_attrdef d
    on d.adrelid = a.attrelid
   and d.adnum = a.attnum
  where a.attrelid = 'public.ocorrencias'::regclass
    and a.attname = 'unidade_id';

  if v_default is not null then
    raise exception 'FASE 3F falhou: unidade_id ainda possui DEFAULT (%)', v_default;
  end if;

  if not exists (
    select 1
    from pg_attribute
    where attrelid = 'public.ocorrencias'::regclass
      and attname = 'unidade_id'
      and attnotnull
      and not attisdropped
  ) then
    raise exception 'FASE 3F falhou: unidade_id deixou de ser NOT NULL';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ocorrencias'::regclass
      and conname = 'ocorrencias_unidade_id_fkey'
      and contype = 'f'
      and convalidated
  ) then
    raise exception 'FASE 3F falhou: FK de unidade foi alterada';
  end if;

  if to_regclass('public.ocorrencia_numero_ano_unico') is null
     or to_regclass('public.ocorrencias_chave_importacao_uq') is null then
    raise exception 'FASE 3F falhou: índices multiunidade foram alterados';
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
    raise exception 'FASE 3F falhou: ativação das unidades foi alterada';
  end if;

  if (select count(*) from public.unidades_integracoes where ativo) <> 1
     or not exists (
       select 1 from public.unidades_integracoes
       where unidade_id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
         and tipo = 'GOOGLE_SHEETS_OCORRENCIAS'
         and ativo = true
     )
     or not exists (
       select 1 from public.unidades_integracoes
       where unidade_id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid
         and tipo = 'GOOGLE_SHEETS_OCORRENCIAS'
         and ativo = false
     ) then
    raise exception 'FASE 3F falhou: estado das integrações foi alterado';
  end if;

  if exists (
    select 1 from public.perfis_usuarios
    where unidade_id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid
  ) then
    raise exception 'FASE 3F falhou: usuário do 1º BPM foi criado';
  end if;
end
$fase3f_post$;

commit;
