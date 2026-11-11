-- PENDENTE DE REVISÃO/APLICAÇÃO INSTITUCIONAL. NÃO EXECUTAR AUTOMATICAMENTE.
-- SIE-CPC: reservar uma chamada de IA com cotas de uso, atomicamente.
-- A função trabalha com a tabela de auditoria existente, sem expor dados pessoais de ocorrências.
-- A aplicação requer DBA autorizado e janela de homologação.
BEGIN;

CREATE OR REPLACE FUNCTION public.ia_cpc_reservar_cota(p_usuario_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_perfil text;
  v_ativo boolean;
  v_sigla text;
  v_unidade_ativa boolean;
  v_dia int;
  v_minuto int;
  v_mes int;
  v_agora timestamptz := clock_timestamp();
  v_mes_inicio timestamptz;
  v_dia_inicio timestamptz;
  v_minuto_inicio timestamptz;
BEGIN
  IF p_usuario_id IS NULL THEN
    RETURN jsonb_build_object('permitido', false, 'motivo', 'nao_autorizado');
  END IF;
  SELECT upper(trim(p.perfil)), p.ativo, upper(trim(u.sigla)), u.ativo
    INTO v_perfil, v_ativo, v_sigla, v_unidade_ativa
  FROM public.perfis_usuarios p
    LEFT JOIN public.unidades u ON u.id = p.unidade_id
  WHERE p.user_id = p_usuario_id;

  IF coalesce(v_ativo, false) = false
     OR NOT (v_perfil = 'ADMIN' OR (v_perfil = 'COMANDANTE' AND v_sigla = 'CPC' AND v_unidade_ativa)) THEN
    RETURN jsonb_build_object('permitido', false, 'motivo', 'nao_autorizado');
  END IF;

  -- Cotas: 3 consultas/minuto por usuário, 20/dia por usuário e 300/mês para o projeto.
  -- Lock transacional: impede simultaneidade de ultrapassar as cotas.
  PERFORM pg_catalog.pg_advisory_xact_lock(208760, 11);
  v_mes_inicio := pg_catalog.date_trunc('month', v_agora AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_dia_inicio := pg_catalog.date_trunc('day', v_agora AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_minuto_inicio := pg_catalog.date_trunc('minute', v_agora AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  SELECT
    count(*) FILTER (WHERE criado_em >= v_minuto_inicio AND usuario_id = p_usuario_id)::int,
    count(*) FILTER (WHERE criado_em >= v_dia_inicio AND usuario_id = p_usuario_id)::int,
    count(*) FILTER (WHERE criado_em >= v_mes_inicio)::int
    INTO v_minuto, v_dia, v_mes
  FROM public.logs_sistema
  WHERE acao = 'consulta_ia_reservada'
    AND entidade = 'IA_CPC'
    AND criado_em >= v_mes_inicio;

  IF v_minuto >= 3 OR v_dia >= 20 OR v_mes >= 300 THEN
    RETURN jsonb_build_object('permitido', false, 'motivo', 'cota_atingida',
      'restante_dia', greatest(0, 20 - v_dia),
      'restante_mes_global', greatest(0, 300 - v_mes));
  END IF;

  INSERT INTO public.logs_sistema(usuario_id, acao, entidade, detalhes, criado_em)
  VALUES (p_usuario_id, 'consulta_ia_reservada', 'IA_CPC',
    jsonb_build_object('tipo', 'reserva', 'versao', 1), v_agora);

  RETURN jsonb_build_object('permitido', true,
    'restante_dia', 19 - v_dia,
    'restante_mes_global', 299 - v_mes);
END;
$function$;

REVOKE ALL ON FUNCTION public.ia_cpc_reservar_cota(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ia_cpc_reservar_cota(uuid) TO service_role;

COMMIT;

-- Após aplicação, conferir:
-- select has_function_privilege('anon','public.ia_cpc_reservar_cota(uuid)','EXECUTE') = false;
-- select has_function_privilege('authenticated','public.ia_cpc_reservar_cota(uuid)','EXECUTE') = false;
-- select has_function_privilege('service_role','public.ia_cpc_reservar_cota(uuid)','EXECUTE') = true;
-- NÃO executar com p_usuario_id real para testar sem planejamento de consumo.
