-- CPC / PMRR — FASE 3F — PÓS-CHECK (somente leitura)
-- PROJETO AUTORIZADO: jppmhhukujigxupgskdk
--
-- Execute somente depois de executar com sucesso:
-- supabase/migrations/20260928154500_fase3f_remover_travas_temporarias_2bpm.sql
--
-- Compare "total_ocorrencias" abaixo com o total exibido no pré-check.
-- Este arquivo não altera dados nem schema.

select
  count(*) as total_ocorrencias,
  count(*) filter (
    where unidade_id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
  ) as ocorrencias_2bpm,
  count(*) filter (
    where unidade_id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid
  ) as ocorrencias_1bpm,
  count(*) filter (where unidade_id is null) as sem_unidade,
  count(*) filter (
    where unidade_id is distinct from 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
  ) as fora_2bpm
from public.ocorrencias;

select id, sigla, nome, ativo
from public.unidades
where sigla in ('1BPM','2BPM')
order by sigla;

select
  u.sigla,
  ui.tipo,
  ui.google_sheet_id,
  ui.aba_principal,
  ui.ativo
from public.unidades_integracoes ui
join public.unidades u on u.id = ui.unidade_id
where u.sigla in ('1BPM','2BPM')
order by u.sigla, ui.tipo;

select count(*) as usuarios_1bpm
from public.perfis_usuarios
where unidade_id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid;

select
  a.attname as coluna,
  a.attnotnull as not_null,
  pg_get_expr(d.adbin, d.adrelid) as default_atual
from pg_attribute a
left join pg_attrdef d
  on d.adrelid = a.attrelid
 and d.adnum = a.attnum
where a.attrelid = 'public.ocorrencias'::regclass
  and a.attname = 'unidade_id'
  and not a.attisdropped;

select
  c.conname,
  c.convalidated,
  pg_get_constraintdef(c.oid, true) as definicao
from pg_constraint c
where c.conrelid = 'public.ocorrencias'::regclass
  and c.conname in (
    'ocorrencias_unidade_fase2_2bpm_chk',
    'ocorrencias_unidade_id_fkey'
  )
order by c.conname;

select
  to_regclass('public.ocorrencia_numero_ano_unico') as indice_numero_ano,
  to_regclass('public.ocorrencias_chave_importacao_uq') as indice_importacao;

do $fase3f_postcheck$
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

  if v_total <> v_2bpm or v_1bpm <> 0 or v_sem <> 0 then
    raise exception
      'PÓS-CHECK FASE 3F FALHOU: ocorrências total %, 2BPM %, 1BPM %, sem unidade %',
      v_total, v_2bpm, v_1bpm, v_sem;
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.ocorrencias'::regclass
      and conname = 'ocorrencias_unidade_fase2_2bpm_chk'
  ) then
    raise exception 'PÓS-CHECK FASE 3F FALHOU: CHECK temporário ainda existe';
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
    raise exception 'PÓS-CHECK FASE 3F FALHOU: unidade_id ainda possui DEFAULT (%)', v_default;
  end if;

  if not exists (
    select 1 from pg_attribute
    where attrelid = 'public.ocorrencias'::regclass
      and attname = 'unidade_id'
      and atttypid = 'uuid'::regtype
      and attnotnull
      and not attisdropped
  ) then
    raise exception 'PÓS-CHECK FASE 3F FALHOU: unidade_id deixou de ser UUID NOT NULL';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ocorrencias'::regclass
      and conname = 'ocorrencias_unidade_id_fkey'
      and contype = 'f'
      and convalidated
  ) then
    raise exception 'PÓS-CHECK FASE 3F FALHOU: FK de unidade foi alterada';
  end if;

  if to_regclass('public.ocorrencia_numero_ano_unico') is null
     or to_regclass('public.ocorrencias_chave_importacao_uq') is null then
    raise exception 'PÓS-CHECK FASE 3F FALHOU: índices multiunidade foram alterados';
  end if;

  if (select count(*) from public.unidades where ativo) <> 1
     or not exists (
       select 1 from public.unidades
       where id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
         and sigla = '2BPM'
         and ativo = true
     )
     or not exists (
       select 1 from public.unidades
       where id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid
         and sigla = '1BPM'
         and ativo = false
     ) then
    raise exception 'PÓS-CHECK FASE 3F FALHOU: ativação das unidades mudou';
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
    raise exception 'PÓS-CHECK FASE 3F FALHOU: estado das integrações mudou';
  end if;

  if exists (
    select 1 from public.perfis_usuarios
    where unidade_id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid
  ) then
    raise exception 'PÓS-CHECK FASE 3F FALHOU: usuário do 1BPM foi criado';
  end if;

  raise notice 'PÓS-CHECK FASE 3F APROVADO — total atual de ocorrências: %', v_total;
end
$fase3f_postcheck$;

select 'POSTCHECK_FASE3F_OK' as resultado;
