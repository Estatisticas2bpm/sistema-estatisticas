-- SIE-CPC | Encerramento DEFINITIVO da integração Google Sheets (18/10/2026).
-- Determinação: todas as unidades, inclusive 1º e 2º BPM, operam somente no Supabase.
-- Mantém 100% das ocorrências. Preserva em esquema privado:
--  * metadados + hash de cada um dos 11.330 eventos da fila histórica;
--  * o último payload completo de cada um dos 3.316 identificadores históricos
--    (inclusive registros excluídos que não existem mais em ocorrencias);
--  * manifesto da operação para auditoria.
-- Versões intermediárias dos payloads deixam de ficar armazenadas na outbox;
-- seus IDs, datas, versões e hashes persistem no histórico compacto.
-- As antigas planilhas do Google não são apagadas por esta migração.
BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '180s';
SELECT pg_advisory_xact_lock(20261018, 2359);

-- Bloquear brevemente escritas concorrentes enquanto backup e limpeza são atômicos.
LOCK TABLE public.ocorrencias IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.google_sheets_sync_outbox IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.unidades_integracoes IN SHARE ROW EXCLUSIVE MODE;

DO $precheck$
BEGIN
  IF (SELECT count(*) FROM public.unidades_integracoes
      WHERE tipo='GOOGLE_SHEETS_OCORRENCIAS' AND ativo) <> 2
     OR EXISTS (
       SELECT 1 FROM public.unidades_integracoes i
       WHERE i.tipo='GOOGLE_SHEETS_OCORRENCIAS' AND i.ativo
         AND i.unidade_id NOT IN (
           'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid,
           'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
         )
     ) THEN
    RAISE EXCEPTION 'Abortado: integrações atuais são diferentes de 1BPM/2BPM';
  END IF;
  IF EXISTS (SELECT 1 FROM public.google_sheets_sync_outbox
             WHERE status NOT IN ('CONCLUIDO','CANCELADO')) THEN
    RAISE EXCEPTION 'Abortado: existem envios pendentes/erro que devem ser avaliados antes da limpeza';
  END IF;
  IF (SELECT count(*) FROM public.google_sheets_sync_outbox) < 11330 THEN
    RAISE EXCEPTION 'Abortado: a outbox já foi alterada antes desta auditoria';
  END IF;
END
$precheck$;

-- Arquivo histórico de eventos: metadados auditáveis, sem duplicar o JSON completo
-- a cada uma das muitas edições do mesmo boletim.
CREATE TABLE private.sheets_historico_eventos_20261018 (
  id bigint PRIMARY KEY,
  occurrence_sync_id uuid NOT NULL,
  sync_version bigint NOT NULL,
  unidade_id uuid NOT NULL,
  status_original text NOT NULL,
  attempts integer NOT NULL,
  criado_em timestamptz NOT NULL,
  concluido_em timestamptz,
  cancelado_em timestamptz,
  motivo_cancelamento text,
  era_exclusao boolean NOT NULL,
  payload_bytes integer NOT NULL,
  payload_md5 text NOT NULL
);
INSERT INTO private.sheets_historico_eventos_20261018
(id,occurrence_sync_id,sync_version,unidade_id,status_original,attempts,
 criado_em,concluido_em,cancelado_em,motivo_cancelamento,
 era_exclusao,payload_bytes,payload_md5)
SELECT q.id,q.occurrence_sync_id,q.sync_version,q.unidade_id,q.status,
       q.attempts,q.created_at,q.completed_at,q.cancelled_at,q.cancel_reason,
       coalesce((q.payload->>'_deleted')::boolean,false),
       pg_column_size(q.payload),md5(q.payload::text)
FROM public.google_sheets_sync_outbox q;

-- Mantém um payload integral por identificador, incluindo 34 ocorrências
-- excluídas; é um backup compacto para conferência/reconstrução do último estado.
CREATE TABLE private.sheets_ultimos_payloads_20261018 (
  occurrence_sync_id uuid PRIMARY KEY,
  ultimo_evento_id bigint NOT NULL,
  sync_version bigint NOT NULL,
  unidade_id uuid NOT NULL,
  status_original text NOT NULL,
  payload jsonb NOT NULL,
  era_exclusao boolean NOT NULL,
  payload_md5 text NOT NULL
);
INSERT INTO private.sheets_ultimos_payloads_20261018
(occurrence_sync_id,ultimo_evento_id,sync_version,unidade_id,status_original,
 payload,era_exclusao,payload_md5)
SELECT DISTINCT ON (q.occurrence_sync_id)
       q.occurrence_sync_id,q.id,q.sync_version,q.unidade_id,q.status,
       q.payload,coalesce((q.payload->>'_deleted')::boolean,false),
       md5(q.payload::text)
FROM public.google_sheets_sync_outbox q
ORDER BY q.occurrence_sync_id,q.sync_version DESC,q.id DESC;

CREATE TABLE private.sheets_encerramento_manifesto_20261018 (
  id integer PRIMARY KEY CHECK(id=1),
  data_encerramento timestamptz NOT NULL DEFAULT now(),
  total_eventos bigint NOT NULL,
  total_identificadores bigint NOT NULL,
  eventos_concluidos bigint NOT NULL,
  eventos_cancelados bigint NOT NULL,
  referencias_sem_bo_atual bigint NOT NULL,
  ocorrencias_ativas_antes bigint NOT NULL,
  tamanho_outbox_antes_bytes bigint NOT NULL,
  motivo text NOT NULL
);
INSERT INTO private.sheets_encerramento_manifesto_20261018
(id,total_eventos,total_identificadores,eventos_concluidos,eventos_cancelados,
 referencias_sem_bo_atual,ocorrencias_ativas_antes,tamanho_outbox_antes_bytes,motivo)
SELECT 1,
       count(*),
       count(distinct q.occurrence_sync_id),
       count(*) FILTER (WHERE q.status='CONCLUIDO'),
       count(*) FILTER (WHERE q.status='CANCELADO'),
       count(distinct q.occurrence_sync_id) FILTER (WHERE o.id IS NULL),
       (select count(*) FROM public.ocorrencias),
       pg_total_relation_size('public.google_sheets_sync_outbox'::regclass),
       'Decisão do CPC: somente banco Supabase, encerrando Google Sheets inclusive no 1º e 2º BPM.'
FROM public.google_sheets_sync_outbox q
LEFT JOIN public.ocorrencias o ON o.sync_id=q.occurrence_sync_id;

-- O histórico permanece fora da Data API (esquema private) e sem acessos públicos.
REVOKE ALL ON TABLE private.sheets_historico_eventos_20261018,
  private.sheets_ultimos_payloads_20261018,
  private.sheets_encerramento_manifesto_20261018
  FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE private.sheets_historico_eventos_20261018 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.sheets_ultimos_payloads_20261018 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.sheets_encerramento_manifesto_20261018 ENABLE ROW LEVEL SECURITY;

DO $backup_check$
DECLARE v_events bigint; v_snapshots bigint; v_missing bigint;
BEGIN
  SELECT total_eventos,total_identificadores,referencias_sem_bo_atual
    INTO v_events,v_snapshots,v_missing
    FROM private.sheets_encerramento_manifesto_20261018 WHERE id=1;
  IF v_events <> (SELECT count(*) FROM private.sheets_historico_eventos_20261018)
     OR v_snapshots <> (SELECT count(*) FROM private.sheets_ultimos_payloads_20261018)
     OR v_missing <> (
         SELECT count(*) FROM private.sheets_ultimos_payloads_20261018 a
         LEFT JOIN public.ocorrencias o ON o.sync_id=a.occurrence_sync_id
         WHERE o.id IS NULL
     )
     OR EXISTS (
       SELECT 1 FROM private.sheets_ultimos_payloads_20261018 a
       WHERE a.payload_md5 <> md5(a.payload::text)
     )
  THEN RAISE EXCEPTION 'Falha de integridade: arquivo histórico incompleto. Nenhuma limpeza realizada.'; END IF;
END
$backup_check$;

-- Nenhuma unidade deve possuir integração ativa a partir deste ponto.
UPDATE public.unidades_integracoes
  SET ativo=false, atualizado_em=now()
WHERE tipo='GOOGLE_SHEETS_OCORRENCIAS' AND ativo=true;

-- Retira os dois triggers responsáveis pela criação de tarefas na outbox.
DROP TRIGGER IF EXISTS trg_enqueue_occurrence_for_google_sheets ON public.ocorrencias;
DROP TRIGGER IF EXISTS trg_enqueue_deleted_occurrence_for_google_sheets ON public.ocorrencias;

-- Defesa em profundidade: funções legadas não criam mais tarefas mesmo
-- em chamadas acidentais; nomes mantidos para não quebrar migrations legadas.
CREATE OR REPLACE FUNCTION public.enqueue_occurrence_for_google_sheets()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN RETURN NEW; END
$function$;
CREATE OR REPLACE FUNCTION public.enqueue_deleted_occurrence_for_google_sheets()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN RETURN OLD; END
$function$;

-- Mantém o controle técnico de versão das ocorrências sem exigir planilhas.
CREATE OR REPLACE FUNCTION public.prepare_occurrence_sync_metadata()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF tg_op='INSERT' THEN
    NEW.sync_id := coalesce(NEW.sync_id,gen_random_uuid());
    NEW.sync_version := coalesce(NEW.sync_version,1);
    NEW.updated_at := now();
  ELSIF public.occurrence_business_payload(NEW)
        IS DISTINCT FROM public.occurrence_business_payload(OLD) THEN
    NEW.sync_version := OLD.sync_version+1;
    NEW.updated_at := now();
  END IF;
  NEW.sync_status := 'NAO_APLICAVEL';
  NEW.sync_error := null;
  NEW.last_synced_at := null;
  RETURN NEW;
END
$function$;

-- Mudança APENAS de metadados de sincronização em BOs atuais.
-- Mantém os timestamps operacionais originais; nenhum gráfico/stat é modificado.
ALTER TABLE public.ocorrencias DISABLE TRIGGER atualizar_ocorrencias;
UPDATE public.ocorrencias
 SET sync_status='NAO_APLICAVEL', sync_error=null, last_synced_at=null
WHERE sync_status IS DISTINCT FROM 'NAO_APLICAVEL'
   OR sync_error IS NOT NULL
   OR last_synced_at IS NOT NULL;
ALTER TABLE public.ocorrencias ENABLE TRIGGER atualizar_ocorrencias;

-- Só após validar as cópias e desativar os gatilhos, libera imediatamente
-- o espaço real da fila e seus índices (TRUNCATE, não simples DELETE).
TRUNCATE TABLE public.google_sheets_sync_outbox;

DO $postcheck$
BEGIN
  IF EXISTS (SELECT 1 FROM public.unidades_integracoes
             WHERE tipo='GOOGLE_SHEETS_OCORRENCIAS' AND ativo=true)
   OR EXISTS (SELECT 1 FROM public.ocorrencias
              WHERE sync_status<>'NAO_APLICAVEL')
   OR EXISTS (SELECT 1 FROM public.google_sheets_sync_outbox)
   OR EXISTS (SELECT 1 FROM pg_trigger
              WHERE tgrelid='public.ocorrencias'::regclass
                AND tgname IN ('trg_enqueue_occurrence_for_google_sheets',
                               'trg_enqueue_deleted_occurrence_for_google_sheets')
                AND NOT tgisinternal)
   OR (SELECT count(*) FROM public.ocorrencias) <>
      (SELECT ocorrencias_ativas_antes FROM private.sheets_encerramento_manifesto_20261018 WHERE id=1)
   OR (SELECT count(*) FROM private.sheets_historico_eventos_20261018) <>
      (SELECT total_eventos FROM private.sheets_encerramento_manifesto_20261018 WHERE id=1)
  THEN
    RAISE EXCEPTION 'Verificação final falhou; a transação inteira foi revertida.';
  END IF;
END
$postcheck$;
COMMIT;
