-- Homologação de segurança e controle financeiro 100% em banco sintético.
-- Executar DEPOIS de ia-cpc-db-fixture.sql e da proposta SQL.
\set ON_ERROR_STOP on

SELECT public.ci_assert(
 NOT has_function_privilege('anon','public.ia_cpc_permitido()','EXECUTE'),
 'anon não pode chamar verificação de acesso');
SELECT public.ci_assert(
 has_function_privilege('authenticated','public.ia_cpc_permitido()','EXECUTE'),
 'autenticado deve poder consultar apenas seu próprio acesso');
SELECT public.ci_assert(
 NOT has_function_privilege('authenticated','public.ia_cpc_acesso_usuario(uuid)','EXECUTE'),
 'RPC com ID arbitrário deve ser privada para service_role');
SELECT public.ci_assert(
 NOT has_function_privilege('authenticated','public.ia_cpc_reservar_orcamento(uuid,text,integer)','EXECUTE'),
 'conta comum não pode reservar dinheiro da API');
SELECT public.ci_assert(
 NOT has_function_privilege('authenticated','public.ia_cpc_finalizar_custo(uuid,uuid,integer,integer,integer)','EXECUTE'),
 'conta comum não pode alterar custos');
SELECT public.ci_assert(
 has_function_privilege('service_role','public.ia_cpc_reservar_orcamento(uuid,text,integer)','EXECUTE'),
 'serviço autenticado deve executar a reserva');
SELECT public.ci_assert(
 (SELECT relrowsecurity FROM pg_class WHERE oid='private.ia_cpc_consumo'::regclass),
 'RLS na tabela financeira');
SELECT public.ci_assert(
 (SELECT relrowsecurity FROM pg_class WHERE oid='private.ia_cpc_usuarios'::regclass),
 'RLS na lista individual');
SELECT public.ci_assert(
 NOT has_table_privilege('authenticated','private.ia_cpc_consumo','SELECT'),
 'consumo deve ficar invisível aos usuários comuns');

-- Ninguém acessa antes de ativação individual
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SELECT public.ci_assert(public.ia_cpc_permitido() IS FALSE,'nega por padrão quando lista vazia');
COMMIT;

INSERT INTO private.ia_cpc_usuarios(user_id,categoria,ativo) VALUES
 ('00000000-0000-4000-8000-000000000001','ADMIN',true),
 ('00000000-0000-4000-8000-000000000002','COMANDANTE_CPC',true);

DO $do$ DECLARE bloqueado boolean:=false;
BEGIN
 BEGIN
  INSERT INTO private.ia_cpc_usuarios(user_id,categoria,ativo)
  VALUES('00000000-0000-4000-8000-000000000003','ADMIN',true);
 EXCEPTION WHEN unique_violation THEN bloqueado:=true;
 END;
 PERFORM public.ci_assert(bloqueado,'não permitir dois administradores simultâneos');
END $do$;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SELECT public.ci_assert(public.ia_cpc_permitido(),'ADMIN designado acessa');
COMMIT;
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
SELECT public.ci_assert(public.ia_cpc_permitido(),'COMANDANTE CPC designado acessa');
COMMIT;
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';
SELECT public.ci_assert(public.ia_cpc_permitido() IS FALSE,
 'outro ADMIN não designado deve ser bloqueado');
COMMIT;
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
SELECT public.ci_assert(public.ia_cpc_permitido() IS FALSE,
 'outro COMANDANTE não designado deve ser bloqueado');
COMMIT;

SELECT public.ci_assert(
 public.ia_cpc_acesso_usuario('00000000-0000-4000-8000-000000000001'),
 'autorização do serviço para ADMIN designado');
SELECT public.ci_assert(
 NOT public.ia_cpc_acesso_usuario('00000000-0000-4000-8000-000000000003'),
 'autorização do serviço bloqueia outro ADMIN');
SELECT public.ci_assert(
 (public.ia_cpc_reservar_orcamento(
 '00000000-0000-4000-8000-000000000003','gpt-5.6-luna',1)->>'motivo')
 = 'nao_autorizado','usuário não designado não consome orçamento');
SELECT public.ci_assert(
 (public.ia_cpc_reservar_orcamento(
 '00000000-0000-4000-8000-000000000001',NULL,1)->>'permitido')
 = 'false','modelo nulo deve ser negado');
SELECT public.ci_assert(
 (public.ia_cpc_reservar_orcamento(
 '00000000-0000-4000-8000-000000000001','modelo-caro',1)->>'permitido')
 = 'false','modelo não homologado deve ser negado');

-- Caso de desativação e troca de unidade, sem afetar contas verdadeiras
UPDATE public.perfis_usuarios SET ativo=false
 WHERE user_id='00000000-0000-4000-8000-000000000001';
SELECT public.ci_assert(
 NOT public.ia_cpc_acesso_usuario('00000000-0000-4000-8000-000000000001'),
 'desativação impede acesso à IA');
UPDATE public.perfis_usuarios SET ativo=true
 WHERE user_id='00000000-0000-4000-8000-000000000001';
UPDATE public.perfis_usuarios SET unidade_id='00000000-0000-4000-8000-000000000103'
 WHERE user_id='00000000-0000-4000-8000-000000000002';
SELECT public.ci_assert(
 NOT public.ia_cpc_acesso_usuario('00000000-0000-4000-8000-000000000002'),
 'COMANDANTE fora do CPC não tem acesso');
UPDATE public.perfis_usuarios SET unidade_id='00000000-0000-4000-8000-000000000101'
 WHERE user_id='00000000-0000-4000-8000-000000000002';

-- Teto mensal, reserva atômica e reconciliação
TRUNCATE private.ia_cpc_consumo;
INSERT INTO private.ia_cpc_consumo
 (usuario_id,modelo,mes_referencia,reserva_centavos,estado)
 VALUES ('00000000-0000-4000-8000-000000000001','gpt-5.6-luna',
 date_trunc('month',now() AT TIME ZONE 'America/Boa_Vista')::date,9975,'reservado');

SELECT public.ci_assert(
 (public.ia_cpc_reservar_orcamento(
 '00000000-0000-4000-8000-000000000001','gpt-5.6-luna',26)->>'motivo')
 = 'limite_orcamento','recusa chamada que ultrapassa R$100');
DO $do$ DECLARE res jsonb; id_reserva uuid; fechamento jsonb;
BEGIN
 res:=public.ia_cpc_reservar_orcamento(
 '00000000-0000-4000-8000-000000000001','gpt-5.6-luna',25);
 PERFORM public.ci_assert(res->>'permitido'='true','aceitar reserva até R$100');
 PERFORM public.ci_assert(res->>'alerta_80'='true','alerta ao atingir R$80');
 PERFORM public.ci_assert((res->>'restante_centavos')::int=0,'sem saldo após teto');
 id_reserva:=(res->>'reserva_id')::uuid;
 fechamento:=public.ia_cpc_finalizar_custo(
 id_reserva,'00000000-0000-4000-8000-000000000001',20,200,600);
 PERFORM public.ci_assert(fechamento->>'ok'='true','reconciliar custo registrado');
 PERFORM public.ci_assert(
 public.ia_cpc_finalizar_custo(id_reserva,'00000000-0000-4000-8000-000000000001',20,200,600)
 ->>'motivo'='reserva_invalida','impedir dupla finalização');
END $do$;
SELECT public.ci_assert((SELECT sum(
 CASE WHEN estado='finalizado' THEN custo_final_centavos ELSE reserva_centavos END)
 FROM private.ia_cpc_consumo)<=10000,'nunca superar orçamento comprometido');

-- Janela de três consultas por minuto.
TRUNCATE private.ia_cpc_consumo;
INSERT INTO private.ia_cpc_consumo
 (usuario_id,modelo,mes_referencia,reserva_centavos,estado)
 SELECT '00000000-0000-4000-8000-000000000001','gpt-5.6-luna',
 date_trunc('month',now() AT TIME ZONE 'America/Boa_Vista')::date,1,'reservado'
 FROM generate_series(1,3);
SELECT public.ci_assert(
 (public.ia_cpc_reservar_orcamento(
 '00000000-0000-4000-8000-000000000001','gpt-5.6-luna',1)->>'motivo')
 = 'limite_consultas','bloquear quarta chamada no minuto');

SELECT 'SUCESSO — testes financeiros e controle de acesso sintéticos concluídos' AS homologacao;
