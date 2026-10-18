-- SIE-CPC | Decisão institucional de 18/10/2026:
-- Google Sheets EXCLUSIVAMENTE para 1º BPM e 2º BPM.
-- Todas as outras unidades armazenam ocorrências somente no PostgreSQL.
--
-- Segurança:
--  - não exclui nem altera dados policiais de negócio;
--  - não marca eventos sem envio como CONCLUIDO;
--  - preserva o payload e a trilha dos eventos antigos CANCELADOS;
--  - não altera as integrações ativas nem o fluxo dos dois batalhões;
--  - bloqueia novas tarefas para qualquer outra unidade, mesmo em novo cadastro,
--    edição ou exclusão, com proteção adicional na CHECK da outbox.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- 1. Diferenciar "sincronização desabilitada" de falha/pendência no registro policial.
alter table public.ocorrencias
  drop constraint ocorrencias_sync_status_check;
alter table public.ocorrencias
  add constraint ocorrencias_sync_status_check
  check (sync_status in ('PENDENTE','SINCRONIZADO','ERRO','CONFLITO','NAO_APLICAVEL'));

-- 2. Marcar a decisão de cancelamento, sem apagar o conteúdo original da tarefa.
alter table public.google_sheets_sync_outbox
  add column if not exists cancelled_at timestamptz;
alter table public.google_sheets_sync_outbox
  add column if not exists cancel_reason text;
alter table public.google_sheets_sync_outbox
  drop constraint google_sheets_sync_outbox_status_check;
alter table public.google_sheets_sync_outbox
  add constraint google_sheets_sync_outbox_status_check
  check (status in ('PENDENTE','CONCLUIDO','ERRO','CANCELADO'));

-- 3. Eventos que não têm planilha por decisão do projeto não ficarão pendentes.
-- Os 202 registros hoje existentes são mantidos como CANCELADO e auditáveis.
update public.google_sheets_sync_outbox q
   set status='CANCELADO',
       cancelled_at=now(),
       cancel_reason='Integração Google Sheets descontinuada por decisão do CPC: apenas 1BPM e 2BPM sincronizam.'
 where q.unidade_id not in (
   'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid,
   'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
 ) and q.status in ('PENDENTE','ERRO');

-- Defesa em profundidade: proíbe novas tarefas acionáveis de outras unidades
-- mesmo que uma função ou aplicação tente inserir diretamente na outbox.
alter table public.google_sheets_sync_outbox
  add constraint google_sheets_sync_outbox_somente_bpm_check
  check (
    unidade_id in (
      'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid,
      'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
    ) or status='CANCELADO'
  );

-- 4. Na inclusão/edição de ocorrências sem Sheets, o status deve ser
-- NAO_APLICAVEL, não PENDENTE. Continua atualizando metadados e validando
-- alterações normalmente, sem marcar dados oficiais como sincronizados.
create or replace function public.prepare_occurrence_sync_metadata()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_sheets_habilitado boolean;
  v_alterou_conteudo boolean;
begin
  if current_setting('app.google_sheets_ack', true)='1' then
    return new;
  end if;

  v_sheets_habilitado := new.unidade_id in (
    'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid,
    'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
  );

  if tg_op='INSERT' then
    new.sync_id := coalesce(new.sync_id, gen_random_uuid());
    new.sync_version := coalesce(new.sync_version, 1);
    new.updated_at := now();
    new.sync_error := null;
    new.sync_status := case when v_sheets_habilitado then 'PENDENTE' else 'NAO_APLICAVEL' end;
  else
    v_alterou_conteudo := public.occurrence_business_payload(new)
                           is distinct from public.occurrence_business_payload(old);
    if v_alterou_conteudo then
      new.sync_version := old.sync_version+1;
      new.updated_at := now();
      new.sync_error := null;
      new.sync_status := case when v_sheets_habilitado then 'PENDENTE' else 'NAO_APLICAVEL' end;
    elsif not v_sheets_habilitado then
      new.sync_status := 'NAO_APLICAVEL';
      new.sync_error := null;
    end if;
  end if;
  return new;
end
$$;

-- 5. Triggers de eventos: proibição efetiva para qualquer outra unidade.
-- Além da whitelist, mantém a configuração de destino ativa no catálogo.
create or replace function public.enqueue_occurrence_for_google_sheets()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if current_setting('app.google_sheets_ack',true)='1' then
    return new;
  end if;

  if new.unidade_id not in (
    'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid,
    'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
  ) then
    return new;
  end if;

  if not exists (
    select 1 from public.unidades_integracoes i
    where i.unidade_id=new.unidade_id
      and i.tipo='GOOGLE_SHEETS_OCORRENCIAS'
      and i.ativo=true
      and nullif(btrim(i.google_sheet_id),'') is not null
  ) then
    return new;
  end if;

  if tg_op='INSERT'
    or public.occurrence_business_payload(new)
       is distinct from public.occurrence_business_payload(old) then
    insert into public.google_sheets_sync_outbox
      (occurrence_sync_id,sync_version,unidade_id,payload)
    values
      (new.sync_id,new.sync_version,new.unidade_id,to_jsonb(new))
    on conflict (occurrence_sync_id,sync_version)
    do update set
      unidade_id=excluded.unidade_id,
      payload=excluded.payload,
      status='PENDENTE',
      next_attempt_at=now(),
      last_error=null,
      cancelled_at=null,
      cancel_reason=null;
  end if;

  return new;
end
$$;

create or replace function public.enqueue_deleted_occurrence_for_google_sheets()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if old.unidade_id not in (
    'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid,
    'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
  ) then
    return old;
  end if;

  if not exists (
    select 1 from public.unidades_integracoes i
    where i.unidade_id=old.unidade_id
      and i.tipo='GOOGLE_SHEETS_OCORRENCIAS'
      and i.ativo=true
      and nullif(btrim(i.google_sheet_id),'') is not null
  ) then
    return old;
  end if;

  insert into public.google_sheets_sync_outbox
    (occurrence_sync_id,sync_version,unidade_id,payload,status,next_attempt_at,last_error)
  values
    (old.sync_id,old.sync_version+1,old.unidade_id,
     to_jsonb(old)||jsonb_build_object('_deleted',true),
     'PENDENTE',now(),null)
  on conflict (occurrence_sync_id,sync_version)
  do update set
    unidade_id=excluded.unidade_id,
    payload=excluded.payload,
    status='PENDENTE',
    next_attempt_at=now(),
    last_error=null,
    cancelled_at=null,
    cancel_reason=null;
  return old;
end
$$;

-- 6. Corrigir o status de registros ainda ativos de outras unidades.
-- A trigger BEFORE UPDATE reconhece só a alteração do status e não reabre fila.
update public.ocorrencias o
   set sync_status='NAO_APLICAVEL',
       sync_error=null,
       last_synced_at=null
 where o.unidade_id not in (
   'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid,
   'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
 ) and o.sync_status is distinct from 'NAO_APLICAVEL';

-- 7. Invariantes finais: qualquer violação interrompe e reverte a transação.
do $$
begin
  if exists (
    select 1 from public.google_sheets_sync_outbox
    where unidade_id not in (
      'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid,
      'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
    ) and status<>'CANCELADO'
  ) then
    raise exception 'Existem eventos acionáveis de unidades sem Google Sheets';
  end if;
  if exists (
    select 1 from public.ocorrencias
    where unidade_id not in (
      'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid,
      'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
    ) and sync_status<>'NAO_APLICAVEL'
  ) then
    raise exception 'Existem ocorrências não-BPM ainda aguardando Sheets';
  end if;
  if (select count(*) from public.unidades_integracoes
      where tipo='GOOGLE_SHEETS_OCORRENCIAS' and ativo=true)<>2 then
    raise exception 'Invariável: deveriam existir exatamente duas integrações Sheets ativas';
  end if;
end
$$;
commit;
