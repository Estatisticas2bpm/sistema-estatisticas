-- PROPOSTA APENAS. NÃO APLICAR EM PRODUÇÃO SEM HOMOLOGAÇÃO INSTITUCIONAL.
-- Assistente de inteligência CPC: 2 usuários designados, carteira pré-paga manual, sem renovação de saldo.
-- Esta mudança NÃO altera perfis_usuarios, ocorrencias, RLS existentes ou dashboards.
-- NENHUM usuário autorizado é inserido automaticamente.
BEGIN;
CREATE TABLE IF NOT EXISTS private.ia_cpc_usuarios (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria text NOT NULL CHECK (categoria IN ('ADMIN', 'COMANDANTE_CPC')),
  ativo boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ia_cpc_um_ativo_por_categoria
  ON private.ia_cpc_usuarios (categoria) WHERE ativo;
ALTER TABLE private.ia_cpc_usuarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.ia_cpc_usuarios FROM PUBLIC, anon, authenticated;
GRANT SELECT ON private.ia_cpc_usuarios TO service_role;

CREATE TABLE IF NOT EXISTS private.ia_cpc_consumo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id),
  modelo text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  mes_referencia date NOT NULL,
  estado text NOT NULL DEFAULT 'reservado'
    CHECK (estado IN ('reservado','finalizado')),
  reserva_centavos integer NOT NULL CHECK (reserva_centavos BETWEEN 1 AND 10000),
  custo_final_centavos integer CHECK (custo_final_centavos >= 0),
  input_tokens integer CHECK (input_tokens >= 0),
  output_tokens integer CHECK (output_tokens >= 0),
  finalizado_em timestamptz,
  CHECK (estado <> 'finalizado' OR custo_final_centavos IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ia_cpc_consumo_mes_idx
  ON private.ia_cpc_consumo (mes_referencia, criado_em);
CREATE INDEX IF NOT EXISTS ia_cpc_consumo_usuario_idx
  ON private.ia_cpc_consumo (usuario_id, criado_em);
ALTER TABLE private.ia_cpc_consumo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.ia_cpc_consumo FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON private.ia_cpc_consumo TO service_role;

-- A RPC de leitura retorna somente um booleano para o próprio usuário autenticado.
CREATE OR REPLACE FUNCTION public.ia_cpc_permitido()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
 SELECT private.usuario_ativo() AND EXISTS (
   SELECT 1 FROM private.ia_cpc_usuarios a
   JOIN public.perfis_usuarios p ON p.user_id = a.user_id AND p.ativo
   JOIN public.unidades u ON u.id = p.unidade_id AND u.ativo
   WHERE a.user_id = (SELECT auth.uid())
      AND a.ativo = true
      AND (
         (a.categoria = 'ADMIN' AND p.perfil = 'ADMIN')
         OR (a.categoria = 'COMANDANTE_CPC' AND p.perfil = 'COMANDANTE'
             AND upper(u.sigla) = 'CPC')
      )
 );
$fn$;
REVOKE ALL ON FUNCTION public.ia_cpc_permitido() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ia_cpc_permitido() TO authenticated, service_role;

-- Confirmação independente de acesso ao backend (sem consultas operacionais).
CREATE OR REPLACE FUNCTION public.ia_cpc_acesso_usuario(p_usuario_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
 SELECT p_usuario_id IS NOT NULL AND EXISTS (
   SELECT 1 FROM private.ia_cpc_usuarios a
   JOIN public.perfis_usuarios p ON p.user_id = a.user_id AND p.ativo
   JOIN public.unidades u ON u.id = p.unidade_id AND u.ativo
   WHERE a.user_id = p_usuario_id AND a.ativo
     AND ((a.categoria = 'ADMIN' AND p.perfil = 'ADMIN')
      OR (a.categoria = 'COMANDANTE_CPC' AND p.perfil = 'COMANDANTE'
       AND upper(u.sigla) = 'CPC'))
 );
$fn$;
REVOKE ALL ON FUNCTION public.ia_cpc_acesso_usuario(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ia_cpc_acesso_usuario(uuid) TO service_role;

-- Carteira local de controle, NÃO é o saldo em dólares do provedor.
-- Cada lote representa crédito líquido efetivamente confirmado pelo gestor.
-- A proposta é para instalação inicial; não converter dados de consumo antigos
-- sem conciliação independente. Não há recarga inicial, agendada ou automática.
CREATE TABLE IF NOT EXISTS private.ia_cpc_recargas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia text NOT NULL UNIQUE CHECK (length(referencia) BETWEEN 1 AND 160),
  valor_centavos integer NOT NULL CHECK (valor_centavos BETWEEN 1 AND 1000000),
  comprado_em timestamptz NOT NULL,
  expira_em timestamptz NOT NULL CHECK (expira_em > comprado_em AND expira_em <= comprado_em + interval '1 year'),
  registrado_em timestamptz NOT NULL DEFAULT now(),
  registrado_por text NOT NULL DEFAULT session_user
);
CREATE TABLE IF NOT EXISTS private.ia_cpc_alocacoes (
  consumo_id uuid NOT NULL REFERENCES private.ia_cpc_consumo(id) ON DELETE RESTRICT,
  recarga_id uuid NOT NULL REFERENCES private.ia_cpc_recargas(id) ON DELETE RESTRICT,
  ordem integer NOT NULL CHECK (ordem > 0),
  reservado_centavos integer NOT NULL CHECK (reservado_centavos > 0),
  comprometido_centavos integer NOT NULL CHECK (comprometido_centavos BETWEEN 0 AND reservado_centavos),
  UNIQUE (consumo_id,ordem),
  PRIMARY KEY (consumo_id,recarga_id)
);
CREATE INDEX IF NOT EXISTS ia_cpc_alocacoes_recarga_idx ON private.ia_cpc_alocacoes(recarga_id);
ALTER TABLE private.ia_cpc_recargas ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.ia_cpc_alocacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.ia_cpc_recargas,private.ia_cpc_alocacoes,private.ia_cpc_consumo
  FROM PUBLIC,anon,authenticated,service_role;

-- Veda ativação sobre histórico antigo não alocado (proposta anterior não implantada).
DO $fn$
BEGIN
 IF EXISTS (SELECT 1 FROM private.ia_cpc_consumo c
   WHERE NOT EXISTS (SELECT 1 FROM private.ia_cpc_alocacoes a WHERE a.consumo_id=c.id)) THEN
   RAISE EXCEPTION 'Histórico financeiro não alocado; conciliar antes de instalar carteira';
 END IF;
END $fn$;

-- Débito administrativo de excedentes: preserva o consumo original e reduz
-- apenas créditos disponíveis, nunca gera crédito nem autoriza nova compra.
CREATE TABLE IF NOT EXISTS private.ia_cpc_excedentes (
 consumo_id uuid PRIMARY KEY REFERENCES private.ia_cpc_consumo(id) ON DELETE RESTRICT,
 referencia text NOT NULL UNIQUE CHECK(length(referencia) BETWEEN 1 AND 160),
 valor_centavos integer NOT NULL CHECK(valor_centavos>0),
 registrado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
 registrado_por text NOT NULL DEFAULT session_user
);
CREATE TABLE IF NOT EXISTS private.ia_cpc_debitos_excedentes (
 consumo_id uuid NOT NULL REFERENCES private.ia_cpc_excedentes(consumo_id) ON DELETE RESTRICT,
 recarga_id uuid NOT NULL REFERENCES private.ia_cpc_recargas(id) ON DELETE RESTRICT,
 valor_centavos integer NOT NULL CHECK(valor_centavos>0),
 PRIMARY KEY(consumo_id,recarga_id)
);
CREATE INDEX IF NOT EXISTS ia_cpc_debitos_recarga_idx ON private.ia_cpc_debitos_excedentes(recarga_id);
ALTER TABLE private.ia_cpc_excedentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.ia_cpc_debitos_excedentes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.ia_cpc_excedentes,private.ia_cpc_debitos_excedentes
 FROM PUBLIC,anon,authenticated,service_role;

-- Uma única definição contábil compartilhada entre reserva, saldo e conciliação.
CREATE OR REPLACE FUNCTION private.ia_cpc_lotes_validos(p_agora timestamptz)
RETURNS TABLE(id uuid,valor_centavos integer,expira_em timestamptz,comprometido bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $fn$
 SELECT r.id,r.valor_centavos,r.expira_em,
   coalesce((SELECT sum(a.comprometido_centavos) FROM private.ia_cpc_alocacoes a WHERE a.recarga_id=r.id),0)
   +coalesce((SELECT sum(d.valor_centavos) FROM private.ia_cpc_debitos_excedentes d WHERE d.recarga_id=r.id),0)
 FROM private.ia_cpc_recargas r WHERE r.expira_em>p_agora
$fn$;
REVOKE ALL ON FUNCTION private.ia_cpc_lotes_validos(timestamptz) FROM PUBLIC,anon,authenticated,service_role;

-- Todas as mutações da carteira usam o mesmo lock transacional.
-- Registro manual APENAS pelo DBA autorizado, após verificar comprovante e
-- saldo real do projeto OpenAI dedicado. Referência única evita crédito duplicado.
-- Não chamar esta função a partir do navegador; nenhum pagamento é iniciado.
CREATE OR REPLACE FUNCTION private.ia_cpc_registrar_recarga(
 p_referencia text,p_valor_centavos integer,p_comprado_em timestamptz,p_expira_em timestamptz
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE v_id uuid;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(208760,12);
 IF p_referencia IS NULL OR length(btrim(p_referencia)) NOT BETWEEN 1 AND 160
    OR p_valor_centavos IS NULL OR p_valor_centavos NOT BETWEEN 1 AND 1000000
    OR p_comprado_em IS NULL OR p_comprado_em>clock_timestamp()
    OR p_expira_em IS NULL OR p_expira_em<=clock_timestamp()
    OR p_expira_em>p_comprado_em+interval '1 year' THEN
   RAISE EXCEPTION 'Recarga inválida ou vencida';
 END IF;
 INSERT INTO private.ia_cpc_recargas(referencia,valor_centavos,comprado_em,expira_em)
 VALUES(btrim(p_referencia),p_valor_centavos,p_comprado_em,p_expira_em)
 RETURNING id INTO v_id;
 RETURN v_id;
END $fn$;
REVOKE ALL ON FUNCTION private.ia_cpc_registrar_recarga(text,integer,timestamptz,timestamptz)
 FROM PUBLIC,anon,authenticated,service_role;

-- Lotes ativos; consumo comprometido inclui reservas sem telemetria.
-- Custos excedentes congelam a carteira até débito integral e auditado.
-- A verificação inclui a soma efetiva dos débitos, não só a existência de uma referência.
CREATE OR REPLACE FUNCTION private.ia_cpc_saldo_interno()
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=''
AS $fn$
 WITH lotes AS (
   SELECT * FROM private.ia_cpc_lotes_validos(clock_timestamp())
 ), totais AS (
   SELECT coalesce(sum(valor_centavos),0)::bigint AS creditos,
     coalesce(sum(comprometido),0)::bigint AS comprometido,
     coalesce(sum(greatest(0,valor_centavos-comprometido)),0)::bigint AS disponivel,
     min(expira_em) FILTER(WHERE valor_centavos>comprometido) AS proximo_vencimento
   FROM lotes
 ), bloqueio AS (
   SELECT EXISTS(SELECT 1 FROM private.ia_cpc_consumo c
    WHERE c.estado='finalizado' AND c.custo_final_centavos>c.reserva_centavos
    AND NOT EXISTS (
      SELECT 1 FROM private.ia_cpc_excedentes e
      WHERE e.consumo_id=c.id AND e.valor_centavos=c.custo_final_centavos-c.reserva_centavos
        AND e.valor_centavos=(SELECT coalesce(sum(d.valor_centavos),0)
          FROM private.ia_cpc_debitos_excedentes d WHERE d.consumo_id=c.id)
    )) AS bloqueado
 )
 SELECT jsonb_build_object(
  'creditos_validos_centavos',creditos,
  'consumo_comprometido_centavos',comprometido,
  'restante_centavos',CASE WHEN bloqueado THEN 0 ELSE disponivel END,
  'saldo_baixo',disponivel<=2000 OR bloqueado,
  'bloqueado_conciliacao',bloqueado,
  'proximo_vencimento',proximo_vencimento
 ) FROM totais CROSS JOIN bloqueio;
$fn$;
REVOKE ALL ON FUNCTION private.ia_cpc_saldo_interno() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.ia_cpc_consultar_saldo(p_usuario_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF NOT public.ia_cpc_acesso_usuario(p_usuario_id) THEN
  RETURN jsonb_build_object('permitido',false,'motivo','nao_autorizado');
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(208760,12);
 RETURN private.ia_cpc_saldo_interno() || jsonb_build_object('permitido',true);
END $fn$;
REVOKE ALL ON FUNCTION public.ia_cpc_consultar_saldo(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ia_cpc_consultar_saldo(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.ia_cpc_reservar_orcamento(
 p_usuario_id uuid,p_modelo text,p_reserva_centavos integer
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_agora timestamptz; v_mes date; v_inicio_dia timestamptz; v_inicio_minuto timestamptz;
 v_minuto integer; v_dia integer; v_mes_consultas integer; v_id uuid;
 v_saldo jsonb; v_falta integer; v_parcela integer; v_lote record; v_ordem integer:=0;
BEGIN
 IF p_usuario_id IS NULL OR p_modelo IS DISTINCT FROM 'gpt-5.6-luna'
   OR p_reserva_centavos IS NULL OR p_reserva_centavos NOT BETWEEN 1 AND 1000 THEN
   RETURN jsonb_build_object('permitido',false,'motivo','configuracao_invalida');
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(208760,12);
 IF NOT public.ia_cpc_acesso_usuario(p_usuario_id) THEN
   RETURN jsonb_build_object('permitido',false,'motivo','nao_autorizado');
 END IF;
 v_agora:=clock_timestamp();
 v_mes:=date_trunc('month',v_agora AT TIME ZONE 'America/Boa_Vista')::date;
 v_inicio_dia:=date_trunc('day',v_agora AT TIME ZONE 'America/Boa_Vista') AT TIME ZONE 'America/Boa_Vista';
 v_inicio_minuto:=date_trunc('minute',v_agora AT TIME ZONE 'America/Boa_Vista') AT TIME ZONE 'America/Boa_Vista';
 SELECT count(*) FILTER(WHERE usuario_id=p_usuario_id AND criado_em>=v_inicio_minuto)::int,
   count(*) FILTER(WHERE usuario_id=p_usuario_id AND criado_em>=v_inicio_dia)::int,
   count(*)::int
 INTO v_minuto,v_dia,v_mes_consultas FROM private.ia_cpc_consumo WHERE mes_referencia=v_mes;
 v_saldo:=private.ia_cpc_saldo_interno();
 IF (v_saldo->>'bloqueado_conciliacao')::boolean THEN
   RETURN v_saldo || jsonb_build_object('permitido',false,'motivo','conciliacao_pendente');
 END IF;
 IF v_minuto>=3 OR v_dia>=20 OR v_mes_consultas>=300 THEN
   RETURN v_saldo || jsonb_build_object('permitido',false,'motivo','limite_consultas');
 END IF;
 IF (v_saldo->>'restante_centavos')::bigint<p_reserva_centavos THEN
   RETURN v_saldo || jsonb_build_object('permitido',false,'motivo','limite_orcamento');
 END IF;
 INSERT INTO private.ia_cpc_consumo(usuario_id,modelo,mes_referencia,reserva_centavos,estado,criado_em)
 VALUES(p_usuario_id,p_modelo,v_mes,p_reserva_centavos,'reservado',v_agora)
 RETURNING id INTO v_id;
 -- Usa primeiro o lote que vence antes. Pode combinar vários lotes.
 v_falta:=p_reserva_centavos;
 FOR v_lote IN
   SELECT l.id,l.expira_em,l.valor_centavos-l.comprometido AS livre
   FROM private.ia_cpc_lotes_validos(v_agora) l
   WHERE l.valor_centavos>l.comprometido
   ORDER BY l.expira_em,l.id
 LOOP
   v_parcela:=least(v_falta,v_lote.livre)::integer;
   v_ordem:=v_ordem+1;
   INSERT INTO private.ia_cpc_alocacoes(consumo_id,recarga_id,ordem,reservado_centavos,comprometido_centavos)
   VALUES(v_id,v_lote.id,v_ordem,v_parcela,v_parcela);
   v_falta:=v_falta-v_parcela;
   EXIT WHEN v_falta=0;
 END LOOP;
 IF v_falta<>0 THEN RAISE EXCEPTION 'Reserva não integral; transação revertida'; END IF;
 RETURN private.ia_cpc_saldo_interno() || jsonb_build_object('permitido',true,
   'reserva_id',v_id,'restante_dia',19-v_dia,'restante_mes_global',299-v_mes_consultas);
END $fn$;
REVOKE ALL ON FUNCTION public.ia_cpc_reservar_orcamento(uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ia_cpc_reservar_orcamento(uuid,text,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.ia_cpc_finalizar_custo(
 p_reserva_id uuid,p_usuario_id uuid,p_custo_final_centavos integer,
 p_input_tokens integer,p_output_tokens integer
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_reg private.ia_cpc_consumo%ROWTYPE; v_falta integer; v_parcela integer; v_lote record;
BEGIN
 IF p_reserva_id IS NULL OR p_usuario_id IS NULL OR p_custo_final_centavos IS NULL
   OR p_custo_final_centavos<0 OR p_input_tokens IS NULL OR p_input_tokens<0
   OR p_output_tokens IS NULL OR p_output_tokens<0 THEN
   RETURN jsonb_build_object('ok',false,'motivo','parametros_invalidos');
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(208760,12);
 SELECT * INTO v_reg FROM private.ia_cpc_consumo
 WHERE id=p_reserva_id AND usuario_id=p_usuario_id FOR UPDATE;
 IF NOT FOUND OR v_reg.estado<>'reservado' THEN
   RETURN jsonb_build_object('ok',false,'motivo','reserva_invalida');
 END IF;
 -- Registra inclusive extrapolação efetiva e congela futuras chamadas.
 -- Nenhum excedente é falsamente tratado como saldo disponível.
 UPDATE private.ia_cpc_consumo SET estado='finalizado',custo_final_centavos=p_custo_final_centavos,
   input_tokens=p_input_tokens,output_tokens=p_output_tokens,finalizado_em=clock_timestamp()
 WHERE id=p_reserva_id;
 IF p_custo_final_centavos>v_reg.reserva_centavos THEN
   RETURN private.ia_cpc_saldo_interno() || jsonb_build_object('ok',true,'motivo','custo_superou_reserva');
 END IF;
 v_falta:=v_reg.reserva_centavos-p_custo_final_centavos;
 -- Restitui pela ordem ORIGINAL da reserva, não pela validade atual dos lotes.
 -- Se o lote venceu, a restituição não recria saldo utilizável.
 FOR v_lote IN
   SELECT a.recarga_id,a.comprometido_centavos FROM private.ia_cpc_alocacoes a
   WHERE a.consumo_id=p_reserva_id ORDER BY a.ordem DESC
 LOOP
   EXIT WHEN v_falta=0;
   v_parcela:=least(v_falta,v_lote.comprometido_centavos);
   UPDATE private.ia_cpc_alocacoes SET comprometido_centavos=comprometido_centavos-v_parcela
   WHERE consumo_id=p_reserva_id AND recarga_id=v_lote.recarga_id;
   v_falta:=v_falta-v_parcela;
 END LOOP;
 IF v_falta<>0 THEN RAISE EXCEPTION 'Alocação inconsistente; transação revertida'; END IF;
 RETURN private.ia_cpc_saldo_interno() || jsonb_build_object('ok',true);
END $fn$;
REVOKE ALL ON FUNCTION public.ia_cpc_finalizar_custo(uuid,uuid,integer,integer,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ia_cpc_finalizar_custo(uuid,uuid,integer,integer,integer) TO service_role;
-- Conciliação MANUAL de reserva pendente, após evidência externa e revisão.
-- Não libera automaticamente após timeout; a janela mínima não prova ausência de cobrança.
CREATE TABLE IF NOT EXISTS private.ia_cpc_conciliacoes (
 consumo_id uuid PRIMARY KEY REFERENCES private.ia_cpc_consumo(id) ON DELETE RESTRICT,
 referencia text NOT NULL UNIQUE CHECK(length(referencia) BETWEEN 1 AND 160),
 reserva_original_centavos integer NOT NULL CHECK(reserva_original_centavos>0),
 custo_confirmado_centavos integer NOT NULL CHECK(custo_confirmado_centavos>=0),
 input_tokens integer NOT NULL CHECK(input_tokens>=0),
 output_tokens integer NOT NULL CHECK(output_tokens>=0),
 registrado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
 registrado_por text NOT NULL DEFAULT session_user
);
ALTER TABLE private.ia_cpc_conciliacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.ia_cpc_conciliacoes FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.ia_cpc_conciliar_reserva(
 p_reserva_id uuid,p_referencia text,p_custo_confirmado_centavos integer,
 p_input_tokens integer,p_output_tokens integer
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE v_reg private.ia_cpc_consumo%ROWTYPE; v_resultado jsonb;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(208760,12);
 IF p_reserva_id IS NULL OR p_referencia IS NULL OR length(btrim(p_referencia)) NOT BETWEEN 1 AND 160
   OR p_custo_confirmado_centavos IS NULL OR p_custo_confirmado_centavos<0
   OR p_input_tokens IS NULL OR p_input_tokens<0 OR p_output_tokens IS NULL OR p_output_tokens<0
   OR (p_custo_confirmado_centavos=0 AND (p_input_tokens<>0 OR p_output_tokens<>0)) THEN
   RAISE EXCEPTION 'Conciliação inválida';
 END IF;
 SELECT * INTO v_reg FROM private.ia_cpc_consumo WHERE id=p_reserva_id FOR UPDATE;
 IF NOT FOUND OR v_reg.estado<>'reservado' THEN
   RAISE EXCEPTION 'Reserva não está pendente';
 END IF;
 IF v_reg.criado_em>clock_timestamp()-interval '24 hours' THEN
   RAISE EXCEPTION 'Reserva recente; aguardar e comprovar situação no provedor';
 END IF;
 -- Referência única do registro administrativo protegido; nunca anexar recibos ou dados pessoais aqui.
 INSERT INTO private.ia_cpc_conciliacoes(consumo_id,referencia,reserva_original_centavos,custo_confirmado_centavos,input_tokens,output_tokens)
 VALUES(p_reserva_id,btrim(p_referencia),v_reg.reserva_centavos,p_custo_confirmado_centavos,p_input_tokens,p_output_tokens);
 v_resultado:=public.ia_cpc_finalizar_custo(p_reserva_id,v_reg.usuario_id,p_custo_confirmado_centavos,p_input_tokens,p_output_tokens);
 IF (v_resultado->>'ok') IS DISTINCT FROM 'true' THEN
   RAISE EXCEPTION 'Conciliação não concluída; revertida integralmente';
 END IF;
 RETURN v_resultado;
END $fn$;
REVOKE ALL ON FUNCTION private.ia_cpc_conciliar_reserva(uuid,text,integer,integer,integer)
 FROM PUBLIC,anon,authenticated,service_role;
-- Excedente confirmado continua bloqueando até débito integral auditado.
CREATE OR REPLACE FUNCTION private.ia_cpc_conciliar_excedente(
 p_consumo_id uuid,p_referencia text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE v_reg private.ia_cpc_consumo%ROWTYPE; v_agora timestamptz;
 v_falta integer; v_parcela integer; v_lote record; v_livre bigint;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(208760,12);
 IF p_consumo_id IS NULL OR p_referencia IS NULL OR length(btrim(p_referencia)) NOT BETWEEN 1 AND 160 THEN
   RAISE EXCEPTION 'Referência de conciliação inválida';
 END IF;
 SELECT * INTO v_reg FROM private.ia_cpc_consumo WHERE id=p_consumo_id FOR UPDATE;
 IF NOT FOUND OR v_reg.estado<>'finalizado' OR v_reg.custo_final_centavos<=v_reg.reserva_centavos THEN
   RAISE EXCEPTION 'Consumo sem excedente confirmado';
 END IF;
 IF EXISTS(SELECT 1 FROM private.ia_cpc_excedentes e WHERE e.consumo_id=p_consumo_id) THEN
   RAISE EXCEPTION 'Excedente já conciliado';
 END IF;
 IF EXISTS(SELECT 1 FROM private.ia_cpc_consumo WHERE estado='reservado') THEN
   RAISE EXCEPTION 'Concluir reservas pendentes antes da conciliação de excedente';
 END IF;
 -- Evidência e revisão externa são obrigatórias no procedimento institucional;
 -- a função não confirma faturas nem muda flags. Nenhuma liberação automática.
 v_agora:=clock_timestamp();
 v_falta:=v_reg.custo_final_centavos-v_reg.reserva_centavos;
 SELECT coalesce(sum(greatest(0,l.valor_centavos-l.comprometido)),0) INTO v_livre
 FROM private.ia_cpc_lotes_validos(v_agora) l;
 IF v_livre<v_falta THEN
   RAISE EXCEPTION 'Crédito válido insuficiente para quitar excedente';
 END IF;
 INSERT INTO private.ia_cpc_excedentes(consumo_id,referencia,valor_centavos)
 VALUES(p_consumo_id,btrim(p_referencia),v_falta);
 FOR v_lote IN
   SELECT l.id,l.valor_centavos-l.comprometido AS livre
   FROM private.ia_cpc_lotes_validos(v_agora) l
   WHERE l.valor_centavos>l.comprometido ORDER BY l.expira_em,l.id
 LOOP
   v_parcela:=least(v_falta,v_lote.livre)::integer;
   INSERT INTO private.ia_cpc_debitos_excedentes(consumo_id,recarga_id,valor_centavos)
   VALUES(p_consumo_id,v_lote.id,v_parcela);
   v_falta:=v_falta-v_parcela;
   EXIT WHEN v_falta=0;
 END LOOP;
 IF v_falta<>0 THEN RAISE EXCEPTION 'Débito incompleto; transação revertida'; END IF;
 RETURN private.ia_cpc_saldo_interno() || jsonb_build_object('ok',true);
END $fn$;
REVOKE ALL ON FUNCTION private.ia_cpc_conciliar_excedente(uuid,text)
 FROM PUBLIC,anon,authenticated,service_role;
-- Estorno de compra e divergências externas não seguem este fluxo: manter
-- API paga desligada até procedimento específico e revisão dos créditos.


COMMIT;

-- APENAS DBA, em homologação: designar 2 UUIDs autorizados fora do repositório.
-- Não criar saldo fictício em produção. Registrar cada recarga líquida comprovada
-- por referência única, valor conservador em centavos, data da compra e validade
-- efetiva do crédito (no máximo um ano). Manter recarga automática DESLIGADA.
-- O saldo local é estimado, exige conciliação com o faturamento do provedor.
-- Limites de frequência: 3/minuto e 20/dia por usuário; 300/mês global.
-- NÃO aplicar ou ativar sem aprovação. Divergência de custo congela a carteira;
-- recuperação administrativa exige procedimento de conciliação aprovado.
