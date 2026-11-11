-- PROPOSTA APENAS. NÃO APLICAR EM PRODUÇÃO SEM HOMOLOGAÇÃO INSTITUCIONAL.
-- Assistente de inteligência CPC: 2 usuários designados, orçamento até R$ 100/mês.
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

-- Reserva financeira atômica. Todos os valores monetários são CENTAVOS de real.
-- Calendário mensal e diário em America/Boa_Vista.
CREATE OR REPLACE FUNCTION public.ia_cpc_reservar_orcamento(
  p_usuario_id uuid, p_modelo text, p_reserva_centavos integer
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_valido boolean := false;
  v_agora timestamptz := clock_timestamp();
  v_mes date := date_trunc('month', clock_timestamp() AT TIME ZONE 'America/Boa_Vista')::date;
  v_inicio_dia timestamptz := date_trunc('day', clock_timestamp() AT TIME ZONE 'America/Boa_Vista') AT TIME ZONE 'America/Boa_Vista';
  v_inicio_minuto timestamptz := date_trunc('minute', clock_timestamp() AT TIME ZONE 'America/Boa_Vista') AT TIME ZONE 'America/Boa_Vista';
  v_minuto integer := 0; v_dia integer := 0; v_mes_consultas integer := 0;
  v_utilizado integer := 0; v_id uuid;
BEGIN
  IF p_usuario_id IS NULL OR p_modelo IS DISTINCT FROM 'gpt-5.6-luna'
    OR p_reserva_centavos IS NULL OR p_reserva_centavos < 1 OR p_reserva_centavos > 1000 THEN
     RETURN jsonb_build_object('permitido',false,'motivo','configuracao_invalida');
  END IF;

  SELECT EXISTS (
   SELECT 1 FROM private.ia_cpc_usuarios a
   JOIN public.perfis_usuarios p ON p.user_id=a.user_id AND p.ativo=true
   JOIN public.unidades u ON u.id=p.unidade_id AND u.ativo=true
   WHERE a.user_id=p_usuario_id AND a.ativo=true
    AND ((a.categoria='ADMIN' AND p.perfil='ADMIN')
    OR (a.categoria='COMANDANTE_CPC' AND p.perfil='COMANDANTE'
        AND upper(u.sigla)='CPC'))
  ) INTO v_valido;
  IF NOT v_valido THEN
    RETURN jsonb_build_object('permitido',false,'motivo','nao_autorizado');
  END IF;

  -- Lock serializa chamadas simultâneas de todos os usuários, inclusive dias diferentes.
  PERFORM pg_catalog.pg_advisory_xact_lock(208760, 12);
  SELECT
    count(*) FILTER (WHERE usuario_id=p_usuario_id AND criado_em>=v_inicio_minuto)::int,
    count(*) FILTER (WHERE usuario_id=p_usuario_id AND criado_em>=v_inicio_dia)::int,
    count(*)::int,
    coalesce(sum(CASE WHEN estado='finalizado' THEN custo_final_centavos ELSE reserva_centavos END),0)::int
  INTO v_minuto,v_dia,v_mes_consultas,v_utilizado
  FROM private.ia_cpc_consumo
  WHERE mes_referencia=v_mes;

  IF v_minuto>=3 OR v_dia>=20 OR v_mes_consultas>=300 THEN
    RETURN jsonb_build_object('permitido',false,'motivo','limite_consultas');
  END IF;
  IF v_utilizado+p_reserva_centavos>10000 THEN
    RETURN jsonb_build_object('permitido',false,'motivo','limite_orcamento',
        'restante_centavos',greatest(0,10000-v_utilizado));
  END IF;

  INSERT INTO private.ia_cpc_consumo
      (usuario_id,modelo,mes_referencia,reserva_centavos,estado,criado_em)
  VALUES (p_usuario_id,p_modelo,v_mes,p_reserva_centavos,'reservado',v_agora)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('permitido',true,'reserva_id',v_id,
    'restante_dia',19-v_dia,'restante_mes_global',299-v_mes_consultas,
    'consumo_comprometido_centavos',v_utilizado+p_reserva_centavos,
    'restante_centavos',10000-v_utilizado-p_reserva_centavos,
    'alerta_80',v_utilizado+p_reserva_centavos>=8000);
END;
$fn$;
REVOKE ALL ON FUNCTION public.ia_cpc_reservar_orcamento(uuid,text,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ia_cpc_reservar_orcamento(uuid,text,integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.ia_cpc_finalizar_custo(
   p_reserva_id uuid, p_usuario_id uuid, p_custo_final_centavos integer,
   p_input_tokens integer, p_output_tokens integer
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
 v_reg private.ia_cpc_consumo%ROWTYPE;
 v_total integer;
BEGIN
 IF p_reserva_id IS NULL OR p_usuario_id IS NULL OR p_custo_final_centavos IS NULL
    OR p_custo_final_centavos < 0 OR p_input_tokens IS NULL OR p_input_tokens < 0
    OR p_output_tokens IS NULL OR p_output_tokens < 0 THEN
   RETURN jsonb_build_object('ok',false,'motivo','parametros_invalidos');
 END IF;
 SELECT * INTO v_reg FROM private.ia_cpc_consumo
 WHERE id=p_reserva_id AND usuario_id=p_usuario_id FOR UPDATE;
 IF NOT FOUND OR v_reg.estado <> 'reservado' THEN
   RETURN jsonb_build_object('ok',false,'motivo','reserva_invalida');
 END IF;
 -- Nunca contabilizar menos que custo efetivo esperado nem esconder extrapolação.
 IF p_custo_final_centavos > v_reg.reserva_centavos THEN
   RETURN jsonb_build_object('ok',false,'motivo','custo_superou_reserva');
 END IF;
 UPDATE private.ia_cpc_consumo SET estado='finalizado',
   custo_final_centavos=p_custo_final_centavos,
   input_tokens=p_input_tokens,output_tokens=p_output_tokens,
   finalizado_em=clock_timestamp()
 WHERE id=p_reserva_id;
 SELECT coalesce(sum(CASE WHEN estado='finalizado'
   THEN custo_final_centavos ELSE reserva_centavos END),0)::int INTO v_total
 FROM private.ia_cpc_consumo WHERE mes_referencia=v_reg.mes_referencia;
 RETURN jsonb_build_object('ok',true,'consumo_comprometido_centavos',v_total,
    'restante_centavos',greatest(0,10000-v_total),'alerta_80',v_total>=8000);
END;
$fn$;
REVOKE ALL ON FUNCTION public.ia_cpc_finalizar_custo(uuid,uuid,integer,integer,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ia_cpc_finalizar_custo(uuid,uuid,integer,integer,integer)
  TO service_role;
COMMIT;

-- INSTRUÇÃO AO DBA EM HOMOLOGAÇÃO:
-- 1. Aplicar em banco NÃO produtivo e validar GRANT/RLS. NÃO cadastrar os IDs em repositório.
-- 2. Escolher exatamente um ADMIN e um COMANDANTE da unidade principal CPC.
-- 3. Inserir os 2 UUIDs escolhidos em private.ia_cpc_usuarios, com categoria e ativo=true.
-- 4. Testar o limite de R$ 100, alerta de R$ 80, concorrência e reversão.
-- 5. Não ativar IA_CPC_ENABLED sem aprovação institucional e credenciais configuradas.
