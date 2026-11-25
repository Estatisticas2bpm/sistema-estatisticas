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

-- Carteira vazia: não existe crédito automático, nem saldo de R$100 implícito.
SELECT public.ci_assert(
 (public.ia_cpc_reservar_orcamento('00000000-0000-4000-8000-000000000001','gpt-5.6-luna',1)->>'motivo')='limite_orcamento',
 'saldo zero deve bloquear reserva');
SELECT public.ci_assert(
 NOT has_function_privilege('authenticated','private.ia_cpc_registrar_recarga(text,integer,timestamptz,timestamptz)','EXECUTE')
 AND NOT has_function_privilege('service_role','private.ia_cpc_registrar_recarga(text,integer,timestamptz,timestamptz)','EXECUTE')
 AND NOT has_table_privilege('authenticated','private.ia_cpc_recargas','INSERT')
 AND NOT has_table_privilege('service_role','private.ia_cpc_recargas','INSERT'),
 'apenas DBA pode registrar recarga verificada');
SELECT public.ci_assert(
 NOT has_function_privilege('authenticated','public.ia_cpc_consultar_saldo(uuid)','EXECUTE')
 AND has_function_privilege('service_role','public.ia_cpc_consultar_saldo(uuid)','EXECUTE'),
 'saldo é consultado apenas pelo backend autorizado');
SELECT public.ci_assert(
 (public.ia_cpc_consultar_saldo('00000000-0000-4000-8000-000000000003')->>'motivo')='nao_autorizado',
 'conta não designada não pode consultar saldo');
SELECT private.ia_cpc_registrar_recarga('CI-RECARGA-1',10000,now()-interval '1 day',now()+interval '364 days');
SELECT public.ci_assert((private.ia_cpc_saldo_interno()->>'restante_centavos')::int=10000,'recarga comprovada de R$100');
DO $do$ DECLARE bloqueado boolean:=false;
BEGIN
 BEGIN
  PERFORM private.ia_cpc_registrar_recarga('CI-RECARGA-1',10000,now()-interval '1 day',now()+interval '364 days');
 EXCEPTION WHEN unique_violation THEN bloqueado:=true;
 END;
 PERFORM public.ci_assert(bloqueado,'referência repetida não dobra crédito');
END $do$;
DO $do$ DECLARE r jsonb; fechamento jsonb; id_reserva uuid;
BEGIN
 r:=public.ia_cpc_reservar_orcamento('00000000-0000-4000-8000-000000000001','gpt-5.6-luna',100);
 PERFORM public.ci_assert((r->>'restante_centavos')::int=9900,'reserva desconta saldo');
 id_reserva:=(r->>'reserva_id')::uuid;
 fechamento:=public.ia_cpc_finalizar_custo(id_reserva,'00000000-0000-4000-8000-000000000001',20,200,600);
 PERFORM public.ci_assert(fechamento->>'ok'='true' AND (fechamento->>'restante_centavos')::int=9980,'libera diferença não consumida');
 PERFORM public.ci_assert(public.ia_cpc_finalizar_custo(id_reserva,'00000000-0000-4000-8000-000000000001',20,200,600)->>'motivo'='reserva_invalida','rejeita dupla finalização');
 -- Simula débito registrado no mês passado sem alterar relógio do servidor.
 UPDATE private.ia_cpc_consumo SET mes_referencia=(date_trunc('month',now() AT TIME ZONE 'America/Boa_Vista')-interval '1 month')::date,
   criado_em=now()-interval '1 month' WHERE id=id_reserva;
 PERFORM public.ci_assert((private.ia_cpc_saldo_interno()->>'restante_centavos')::int=9980,'virada de mês não renova ou zera saldo');
END $do$;
SELECT private.ia_cpc_registrar_recarga('CI-RECARGA-2',10000,now()-interval '1 day',now()+interval '364 days');
SELECT public.ci_assert((private.ia_cpc_saldo_interno()->>'restante_centavos')::int=19980,'nova recarga acumula saldo anterior');
-- Testes com lotes fracionados, vencidos e vencimento após reserva.
TRUNCATE private.ia_cpc_debitos_excedentes,private.ia_cpc_excedentes,private.ia_cpc_conciliacoes,private.ia_cpc_alocacoes,private.ia_cpc_consumo,private.ia_cpc_recargas;
SELECT private.ia_cpc_registrar_recarga('CI-LOTE-1',10,now()-interval '2 days',now()+interval '1 day');
SELECT private.ia_cpc_registrar_recarga('CI-LOTE-2',15,now()-interval '1 day',now()+interval '2 days');
INSERT INTO private.ia_cpc_recargas(referencia,valor_centavos,comprado_em,expira_em)
 VALUES('CI-VENCIDO',10000,now()-interval '2 days',now()-interval '1 day');
SELECT public.ci_assert((private.ia_cpc_saldo_interno()->>'restante_centavos')::int=25,'excluir lote vencido');
SELECT public.ci_assert((public.ia_cpc_reservar_orcamento('00000000-0000-4000-8000-000000000001','gpt-5.6-luna',26)->>'motivo')='limite_orcamento','saldo insuficiente recusa');
DO $do$ DECLARE r jsonb; id_reserva uuid; f jsonb;
BEGIN
 r:=public.ia_cpc_reservar_orcamento('00000000-0000-4000-8000-000000000001','gpt-5.6-luna',25);
 id_reserva:=(r->>'reserva_id')::uuid;
 PERFORM public.ci_assert(r->>'permitido'='true' AND (r->>'restante_centavos')::int=0 AND r->>'saldo_baixo'='true','combinou lotes e acionou alerta');
 PERFORM public.ci_assert((SELECT count(*) FROM private.ia_cpc_alocacoes WHERE consumo_id=id_reserva)=2,'reserva dividida em dois lotes');
 UPDATE private.ia_cpc_recargas SET expira_em=now()-interval '1 hour' WHERE referencia='CI-LOTE-2';
 f:=public.ia_cpc_finalizar_custo(id_reserva,'00000000-0000-4000-8000-000000000001',10,200,600);
 PERFORM public.ci_assert(f->>'ok'='true' AND (f->>'restante_centavos')::int=0,'estorno de lote vencido não recria crédito');
END $do$;
-- Extrapolação de custo é registrada e congela toda a carteira.
TRUNCATE private.ia_cpc_debitos_excedentes,private.ia_cpc_excedentes,private.ia_cpc_conciliacoes,private.ia_cpc_alocacoes,private.ia_cpc_consumo,private.ia_cpc_recargas;
SELECT private.ia_cpc_registrar_recarga('CI-BLOQUEIO',10000,now()-interval '1 day',now()+interval '100 days');
DO $do$ DECLARE r jsonb; f jsonb;
BEGIN
 r:=public.ia_cpc_reservar_orcamento('00000000-0000-4000-8000-000000000001','gpt-5.6-luna',5);
 f:=public.ia_cpc_finalizar_custo((r->>'reserva_id')::uuid,'00000000-0000-4000-8000-000000000001',6,200,600);
 PERFORM public.ci_assert(f->>'bloqueado_conciliacao'='true' AND f->>'restante_centavos'='0','extrapolação trava carteira');
 PERFORM public.ci_assert((SELECT custo_final_centavos FROM private.ia_cpc_consumo WHERE id=(r->>'reserva_id')::uuid)=6,'custo excedido preservado no histórico');
 PERFORM public.ci_assert((public.ia_cpc_reservar_orcamento('00000000-0000-4000-8000-000000000001','gpt-5.6-luna',1)->>'motivo')='conciliacao_pendente','não libera chamada até conciliar');
END $do$;

-- Janela de três consultas por minuto.
TRUNCATE private.ia_cpc_debitos_excedentes,private.ia_cpc_excedentes,private.ia_cpc_conciliacoes,private.ia_cpc_alocacoes,private.ia_cpc_consumo;
INSERT INTO private.ia_cpc_consumo
 (usuario_id,modelo,mes_referencia,reserva_centavos,estado)
 SELECT '00000000-0000-4000-8000-000000000001','gpt-5.6-luna',
 date_trunc('month',now() AT TIME ZONE 'America/Boa_Vista')::date,1,'reservado'
 FROM generate_series(1,3);
SELECT public.ci_assert(
 (public.ia_cpc_reservar_orcamento(
 '00000000-0000-4000-8000-000000000001','gpt-5.6-luna',1)->>'motivo')
 = 'limite_consultas','bloquear quarta chamada no minuto');

-- Vinte consultas no dia: nenhuma chamada adicional deve passar.
TRUNCATE private.ia_cpc_debitos_excedentes,private.ia_cpc_excedentes,private.ia_cpc_conciliacoes,private.ia_cpc_alocacoes,private.ia_cpc_consumo;
INSERT INTO private.ia_cpc_consumo
  (usuario_id,modelo,mes_referencia,reserva_centavos,estado,criado_em)
SELECT '00000000-0000-4000-8000-000000000001','gpt-5.6-luna',
 date_trunc('month',now() AT TIME ZONE 'America/Boa_Vista')::date,
 1,'reservado',
 (date_trunc('day',now() AT TIME ZONE 'America/Boa_Vista') AT TIME ZONE 'America/Boa_Vista')
  + interval '10 seconds'
FROM generate_series(1,20);
SELECT public.ci_assert(
 (public.ia_cpc_reservar_orcamento(
  '00000000-0000-4000-8000-000000000001','gpt-5.6-luna',1)->>'motivo')
 = 'limite_consultas','bloquear consulta adicional após vinte no dia');

-- Trezentas consultas globais no mês, divididas entre duas contas.
TRUNCATE private.ia_cpc_debitos_excedentes,private.ia_cpc_excedentes,private.ia_cpc_conciliacoes,private.ia_cpc_alocacoes,private.ia_cpc_consumo;
INSERT INTO private.ia_cpc_consumo
 (usuario_id,modelo,mes_referencia,reserva_centavos,estado,criado_em)
SELECT CASE WHEN n%2=0
 THEN '00000000-0000-4000-8000-000000000001'::uuid
 ELSE '00000000-0000-4000-8000-000000000002'::uuid END,
 'gpt-5.6-luna',
 date_trunc('month',now() AT TIME ZONE 'America/Boa_Vista')::date,
 1,'reservado',
 date_trunc('month',now() AT TIME ZONE 'America/Boa_Vista') AT TIME ZONE 'America/Boa_Vista'
FROM generate_series(1,300) n;
SELECT public.ci_assert(
 (public.ia_cpc_reservar_orcamento(
  '00000000-0000-4000-8000-000000000001','gpt-5.6-luna',1)->>'motivo')
 = 'limite_consultas','bloquear consulta após trezentas globais no mês');
SELECT public.ci_assert(
 (SELECT count(*) FROM private.ia_cpc_consumo)=300,
 'limite global não criou reserva excedente');


-- Conciliação manual: acesso privado, idade mínima, auditoria e preservação do saldo.
TRUNCATE private.ia_cpc_debitos_excedentes,private.ia_cpc_excedentes,private.ia_cpc_conciliacoes,private.ia_cpc_alocacoes,private.ia_cpc_consumo,private.ia_cpc_recargas;
SELECT private.ia_cpc_registrar_recarga('CI-CONCILIACAO',10000,now()-interval '3 days',now()+interval '90 days');
SELECT public.ci_assert(NOT has_function_privilege('anon','private.ia_cpc_conciliar_reserva(uuid,text,integer,integer,integer)','EXECUTE'),'anon não concilia');
SELECT public.ci_assert(NOT has_function_privilege('authenticated','private.ia_cpc_conciliar_reserva(uuid,text,integer,integer,integer)','EXECUTE'),'usuário comum não concilia');
SELECT public.ci_assert(NOT has_function_privilege('service_role','private.ia_cpc_conciliar_reserva(uuid,text,integer,integer,integer)','EXECUTE'),'Edge não tem autoridade para conciliação administrativa');
SELECT public.ci_assert(NOT has_table_privilege('service_role','private.ia_cpc_conciliacoes','UPDATE'),'Edge não altera histórico administrativo');
DO $manual$ DECLARE r jsonb; f jsonb; id1 uuid; id2 uuid; id3 uuid; bloqueou boolean;
BEGIN
 r:=public.ia_cpc_reservar_orcamento('00000000-0000-4000-8000-000000000001','gpt-5.6-luna',100);
 id1:=(r->>'reserva_id')::uuid;
 PERFORM public.ci_assert(id1 IS NOT NULL,'reserva sintética criada');
 bloqueou:=false;
 BEGIN PERFORM private.ia_cpc_conciliar_reserva(id1,'CI-EVIDENCIA-001',0,0,0);
 EXCEPTION WHEN raise_exception THEN bloqueou:=true; END;
 PERFORM public.ci_assert(bloqueou,'reserva recente não pode ser conciliada manualmente');
 PERFORM public.ci_assert((private.ia_cpc_saldo_interno()->>'restante_centavos')::int=9900,'tentativa recusada não libera saldo');
 UPDATE private.ia_cpc_consumo SET criado_em=now()-interval '25 hours' WHERE id=id1;
 f:=private.ia_cpc_conciliar_reserva(id1,'CI-EVIDENCIA-001',25,100,50);
 PERFORM public.ci_assert(f->>'ok'='true' AND (f->>'restante_centavos')::int=9975,'libera apenas diferença da reserva');
 PERFORM public.ci_assert(EXISTS(SELECT 1 FROM private.ia_cpc_conciliacoes WHERE consumo_id=id1 AND reserva_original_centavos=100 AND custo_confirmado_centavos=25),'auditoria registra antes e depois');
 bloqueou:=false;
 BEGIN PERFORM private.ia_cpc_conciliar_reserva(id1,'CI-EVIDENCIA-002',0,0,0);
 EXCEPTION WHEN raise_exception THEN bloqueou:=true; END;
 PERFORM public.ci_assert(bloqueou,'reserva finalizada não pode ser conciliada novamente');
 r:=public.ia_cpc_reservar_orcamento('00000000-0000-4000-8000-000000000001','gpt-5.6-luna',100);
 id2:=(r->>'reserva_id')::uuid;
 UPDATE private.ia_cpc_consumo SET criado_em=now()-interval '25 hours' WHERE id=id2;
 bloqueou:=false;
 BEGIN PERFORM private.ia_cpc_conciliar_reserva(id2,'CI-EVIDENCIA-001',0,0,0);
 EXCEPTION WHEN unique_violation THEN bloqueou:=true; END;
 PERFORM public.ci_assert(bloqueou,'rejeita reutilização de referência administrativa');
 PERFORM public.ci_assert((SELECT estado FROM private.ia_cpc_consumo WHERE id=id2)='reservado','duplicidade não finaliza reserva');
 bloqueou:=false;
 BEGIN PERFORM private.ia_cpc_conciliar_reserva(id2,'CI-EVIDENCIA-002',0,1,0);
 EXCEPTION WHEN raise_exception THEN bloqueou:=true; END;
 PERFORM public.ci_assert(bloqueou,'custo zero com tokens não é aceito');
 f:=private.ia_cpc_conciliar_reserva(id2,'CI-EVIDENCIA-002',0,0,0);
 PERFORM public.ci_assert((f->>'restante_centavos')::int=9975,'ausência de cobrança comprovada libera reserva integral');
 r:=public.ia_cpc_reservar_orcamento('00000000-0000-4000-8000-000000000001','gpt-5.6-luna',5);
 id3:=(r->>'reserva_id')::uuid;
 UPDATE private.ia_cpc_consumo SET criado_em=now()-interval '25 hours' WHERE id=id3;
 f:=private.ia_cpc_conciliar_reserva(id3,'CI-EVIDENCIA-003',6,100,100);
 PERFORM public.ci_assert(f->>'bloqueado_conciliacao'='true' AND f->>'restante_centavos'='0','excedente conciliado conserva bloqueio preventivo');
 PERFORM public.ci_assert((SELECT count(*) FROM private.ia_cpc_conciliacoes)=3,'três conciliações únicas auditadas');
END $manual$;


-- Recuperação de excedentes: débito real em lotes válidos, duas divergências,
-- insuficiência, referência duplicada, expiração e nenhuma recarga automática.
TRUNCATE private.ia_cpc_debitos_excedentes,private.ia_cpc_excedentes,private.ia_cpc_conciliacoes,private.ia_cpc_alocacoes,private.ia_cpc_consumo,private.ia_cpc_recargas;
SELECT private.ia_cpc_registrar_recarga('CI-EXC-LOTE-1',30,now()-interval '2 days',now()+interval '1 day');
SELECT public.ci_assert(NOT has_function_privilege('anon','private.ia_cpc_conciliar_excedente(uuid,text)','EXECUTE'),'anon não concilia excedente');
SELECT public.ci_assert(NOT has_function_privilege('authenticated','private.ia_cpc_conciliar_excedente(uuid,text)','EXECUTE'),'usuário não concilia excedente');
SELECT public.ci_assert(NOT has_function_privilege('service_role','private.ia_cpc_conciliar_excedente(uuid,text)','EXECUTE'),'Edge não concilia excedente');
SELECT public.ci_assert(NOT has_table_privilege('service_role','private.ia_cpc_debitos_excedentes','INSERT'),'Edge não insere débito administrativo');
DO $excedente$ DECLARE a jsonb; b jsonb; f jsonb; i1 uuid; i2 uuid; bloqueou boolean;
BEGIN
 a:=public.ia_cpc_reservar_orcamento('00000000-0000-4000-8000-000000000001','gpt-5.6-luna',10);
 b:=public.ia_cpc_reservar_orcamento('00000000-0000-4000-8000-000000000002','gpt-5.6-luna',15);
 i1:=(a->>'reserva_id')::uuid; i2:=(b->>'reserva_id')::uuid;
 PERFORM public.ia_cpc_finalizar_custo(i1,'00000000-0000-4000-8000-000000000001',20,200,50);
 bloqueou:=false;
 BEGIN PERFORM private.ia_cpc_conciliar_excedente(i1,'CI-EXC-1'); EXCEPTION WHEN raise_exception THEN bloqueou:=true; END;
 PERFORM public.ci_assert(bloqueou,'reserva em trânsito impede recuperação');
 PERFORM public.ia_cpc_finalizar_custo(i2,'00000000-0000-4000-8000-000000000002',20,200,50);
 bloqueou:=false;
 BEGIN PERFORM private.ia_cpc_conciliar_excedente(i1,'CI-EXC-1'); EXCEPTION WHEN raise_exception THEN bloqueou:=true; END;
 PERFORM public.ci_assert(bloqueou,'não cria débito parcial se faltar saldo');
 PERFORM public.ci_assert((SELECT count(*) FROM private.ia_cpc_excedentes)=0,'falha não deixa auditoria incompleta');
 PERFORM private.ia_cpc_registrar_recarga('CI-EXC-LOTE-2',20,now()-interval '1 day',now()+interval '30 days');
 PERFORM public.ci_assert((private.ia_cpc_saldo_interno()->>'bloqueado_conciliacao')::boolean,'recarga não desbloqueia');
 f:=private.ia_cpc_conciliar_excedente(i1,'CI-EXC-1');
 PERFORM public.ci_assert((f->>'bloqueado_conciliacao')::boolean,'outro excedente mantém bloqueio');
 PERFORM public.ci_assert((SELECT sum(valor_centavos) FROM private.ia_cpc_debitos_excedentes WHERE consumo_id=i1)=10,'excedente integral debitado em dois lotes');
 PERFORM public.ci_assert((SELECT count(*) FROM private.ia_cpc_debitos_excedentes WHERE consumo_id=i1)=2,'débito distribuído sem ultrapassar lote');
 bloqueou:=false;
 BEGIN PERFORM private.ia_cpc_conciliar_excedente(i2,'CI-EXC-1'); EXCEPTION WHEN unique_violation THEN bloqueou:=true; END;
 PERFORM public.ci_assert(bloqueou,'referência duplicada bloqueada');
 f:=private.ia_cpc_conciliar_excedente(i2,'CI-EXC-2');
 PERFORM public.ci_assert(NOT (f->>'bloqueado_conciliacao')::boolean AND (f->>'restante_centavos')::int=10,'excedentes pagos: retoma saldo líquido de 10');
 bloqueou:=false;
 BEGIN PERFORM private.ia_cpc_conciliar_excedente(i1,'CI-EXC-3'); EXCEPTION WHEN raise_exception THEN bloqueou:=true; END;
 PERFORM public.ci_assert(bloqueou,'proíbe débito duplicado do mesmo consumo');
 PERFORM public.ci_assert((SELECT sum(custo_final_centavos) FROM private.ia_cpc_consumo)=40,'preserva custos originais');
 UPDATE private.ia_cpc_recargas SET expira_em=now()-interval '1 hour' WHERE referencia='CI-EXC-LOTE-1';
 PERFORM public.ci_assert((private.ia_cpc_saldo_interno()->>'restante_centavos')::int=10,'vencimento de lote consumido não recria crédito');
 PERFORM public.ci_assert(public.ia_cpc_reservar_orcamento('00000000-0000-4000-8000-000000000001','gpt-5.6-luna',11)->>'motivo'='limite_orcamento','excedentes entram no saldo da nova reserva');
 f:=public.ia_cpc_reservar_orcamento('00000000-0000-4000-8000-000000000001','gpt-5.6-luna',10);
 PERFORM public.ci_assert(f->>'permitido'='true' AND f->>'restante_centavos'='0','novo consumo só utiliza saldo líquido');
END $excedente$;

SELECT 'SUCESSO — testes financeiros e controle de acesso sintéticos concluídos' AS homologacao;
