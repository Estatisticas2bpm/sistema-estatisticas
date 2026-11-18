# Procedimento administrativo — carteira pré-paga da IA CPC
**Proposta para homologação — 18/11/2026.** Não autoriza compra, cadastro de usuários, alteração de Secrets, migração ou publicação no ambiente operacional.

## 1. Responsabilidades e segregação
- Gestor financeiro institucional: autorizar cada compra, selecionar a organização correta na OpenAI, guardar comprovante em local protegido e confirmar o saldo líquido. A conta não deve depender de um comandante específico.
- DBA responsável: registrar somente créditos comprovados por meio da função privada de recarga; conferir o saldo antes e depois, com referência única, validade e valor inteiro em centavos. Não inserir CPF, cartão, nome de pagador, credenciais ou comprovantes no GitHub.
- Revisor designado: conferir independentemente compra, referência, saldo, vencimento, cálculo de conversão e consumo. O procedimento deve registrar autorização e responsáveis fora do repositório. Esta revisão por duas pessoas é uma recomendação para aprovação, ainda não é fluxo eletrônico.
- ADMIN e COMANDANTE_CPC designados: consultar a IA e o saldo estimado por conta nominal. Nenhum deles recebe automaticamente permissão de pagar ou alterar a carteira. A função de recarga é privada, sem EXECUTE para anon, authenticated ou service_role.

## 2. Preparação junto à OpenAI, antes de qualquer pagamento
1. Confirmar autorização institucional para o tratamento de agregados e a contratação; identificar uma organização de faturamento dedicada ao SIE-CPC e um projeto exclusivo para o piloto. Os créditos pertencem à organização; um projeto dedicado sozinho não isola o saldo de outros projetos da mesma organização.
2. Em https://platform.openai.com/settings/organization/billing/overview confirmar a organização, modalidade de faturamento pré-paga e saldo anterior. Se houver faturamento mensal, outras cargas ou saldo negativo sem conciliação, não ativar.
3. Selecionar recarga manual; verificar explicitamente que Use auto-reload/Auto recharge está desabilitado antes e após pagamento. A compra inicial mínima documentada é US$5, e o operador deve verificar o valor final em BRL, taxas e tributos antes de confirmar. R$100 são uma referência de autorização, não mensalidade ou quantidade fixa de dólares.
4. Confirmar que o crédito comprado entrou efetivamente no saldo e verificar a validade real. A documentação consultada em 18/11/2026 informa validade normal de um ano; o código usa a data comprovada e não permite vencimento superior a um ano.
5. Configurar, mediante aprovação, os limites de utilização do projeto e da organização, alertas e opção de limite rígido quando disponível. Mesmo um limite rígido externo pode apresentar atraso de contabilização; não substitui reserva local.
6. Criar uma chave restrita de conta de serviço do projeto somente quando autorizado, com os acessos necessários às consultas da API. Confirmar que o modelo escolhido está habilitado para essa conta. Não enviar chave por chat/e-mail nem guardar no código, navegador, PR ou documentação.

Fontes oficiais verificadas em 18/11/2026:
- https://help.openai.com/en/articles/8264644-setting-up-and-managing-prepaid-api-billing
- https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform
- https://developers.openai.com/api/docs/models/gpt-5.6-luna — preços Standard de referência: US$0,20/1M entrada e US$1,20/1M saída. Disponibilidade na conta real não verificada.

## 3. Registrar recarga comprovada (somente após aprovação)
O SIE-CPC mantém uma carteira preventiva ESTIMADA em reais, não um espelho automático do saldo de dólares. A aquisição real ocorre na OpenAI, não no site. Nenhuma compra é executada pela RPC de registro.

Registrar na planilha/livro administrativo protegido: identificador único do comprovante, data/hora da compra, valor total pago e autorizado em BRL, créditos líquidos em USD efetivamente adicionados, eventual abatimento de dívida anterior, validade confirmada, câmbio conservador vigente para reserva, fator de segurança, valor local autorizado em centavos, responsável e revisão. Não contar um bônus temporário, saldo de outro projeto, crédito já contabilizado, estorno, pagamento pendente ou valor bruto de uma recarga que quitou saldo negativo.

Usar o menor valor entre o limite incremental autorizado em BRL (já descontadas as parcelas não destinadas a créditos) e o equivalente conservador de consumo suportado pelo incremento líquido confirmado de USD, sem contar créditos já comprometidos ou indisponíveis. O custo local inclui margem 2x e câmbio de reserva de 8 a 30 BRL/USD; mantenha a mesma base de conversão da função de custo. Não aumentar o saldo por mera revisão cambial. Se não for possível conciliar com segurança, registrar ZERO e manter o piloto desligado.

É necessário utilizar um DBA com autorização institucional e privilégio efetivo de proprietário da função. Em homologação isolada, conferir a consulta de saldo e o histórico de recargas antes, durante e após a operação. Modelo de comando parametrizado (placeholders, NÃO executar como está):
```sql
BEGIN;
SELECT pg_catalog.pg_advisory_xact_lock(208760,12);
SELECT private.ia_cpc_saldo_interno();
SELECT private.ia_cpc_registrar_recarga(
  :referencia_confirmada::text,
  :centavos_autorizados::integer,
  :data_hora_compra_comprovada::timestamptz,
  :data_hora_vencimento_comprovada::timestamptz
);
SELECT private.ia_cpc_saldo_interno();
COMMIT;
```
Usar variáveis vinculadas pelo cliente autorizado, não concatenar texto. Confirmar a mudança esperada antes do COMMIT, considerando eventual crédito vencido. Em caso de inconsistência, ROLLBACK. Se houver erro de chave duplicada, não criar outro identificador para contorná-lo: conferir a recarga existente. Não executar diretamente INSERT/UPDATE/DELETE para acertar saldo. Uma recarga financeira não autoriza habilitar IA_CPC_ENABLED.

## 4. Conciliação preventiva
Proposta de rotina: no início do piloto conferir diariamente e sempre antes de recarga, mudança de comandante, mudança de modelo/preços/câmbio, falha de provedor, vencimento, estorno ou contestação de pagamento. Não é automação nem consulta remota automática de saldo.
- Pausar novas requisições quando houver divergência relevante, dados externos atrasados, uso de outra aplicação, saldo negativo, alteração de parâmetros ou perda de controle da chave. A flag IA_CPC_ENABLED=false impede novas execuções do módulo; manter os dashboards convencionais funcionando. Requisições já iniciadas podem terminar; exigir verificação de drenagem antes de fechar a conferência.
- Comparar saldo e uso da organização/projeto no painel OpenAI, no mesmo intervalo, projeto, modelo e unidade monetária. Incluir reservas pendentes, janela de atraso, impostos, créditos expirados e ajustes. A consulta a seguir é somente leitura, em ambiente autorizado, sem dados de ocorrências:
```sql
SELECT private.ia_cpc_saldo_interno();
SELECT referencia,valor_centavos,comprado_em,expira_em,registrado_em
FROM private.ia_cpc_recargas ORDER BY registrado_em;
SELECT estado, count(*) AS consultas, sum(reserva_centavos) AS reservado,
       sum(custo_final_centavos) AS custo_final,
       sum(input_tokens) AS tokens_entrada, sum(output_tokens) AS tokens_saida
FROM private.ia_cpc_consumo GROUP BY estado ORDER BY estado;
SELECT count(*) AS excedentes
FROM private.ia_cpc_consumo WHERE custo_final_centavos>reserva_centavos;
SELECT count(*) AS reservas_pendentes
FROM private.ia_cpc_consumo WHERE estado='reservado';
```
- Valores locais são conservadores, portanto não se espera igualdade direta com o faturamento absoluto em USD. Registrar o cálculo comparável, divergências explicadas e saldo local que pode ser efetivamente honrado. Nunca liberar saldo superior ao crédito disponível líquido confirmado.
- Sem telemetria completa, manter a reserva integral comprometida. Não liberar apenas porque não apareceu débito imediatamente. Exigir evidência confiável para cada correção futura.
- Extrapolação registrada (custo final superior à reserva) congela a carteira por regra de banco, mesmo que nova recarga seja registrada. Não modificar ou apagar consumo para desbloqueá-la. A versão atual não possui RPC auditada para ajuste/reabertura; se acontecer, interromper operação paga até implementar, testar e aprovar procedimento corretivo com trilha imutável. Nenhuma recarga deve desbloquear automaticamente essa condição.
- Quando não houver divergência, verificar flag de bloqueio, permissões individuais, saldo local, proteção de cobrança e aprovação do responsável antes de reabilitar. Em caso de dúvida, permanecer desligado.

## 5. Mudança de comando e continuidade
O gestor de faturamento continua responsável pela organização; trocar a conta individual do comandante pela via administrativa somente mediante designação formal. Revogar o acesso do anterior e verificar permissão de exatamente um comandante CPC e um administrador designados. Não compartilhar credenciais nem migrar saldos por uma troca de comando. Se o novo comandante não solicitar crédito, não recarregar. Sem saldo, as consultas pagas são bloqueadas; o sistema estatístico convencional permanece disponível.

## 6. Checklist para homologação institucional
- [ ] Aprovação institucional do procedimento e dos responsáveis.
- [ ] Homologação hospedada segregada autorizada, com dados fictícios, sem OpenAI paga.
- [ ] Conferir proteção de RPCs/tabelas, zero inicial, persistência entre meses, expiração e referências únicas.
- [ ] Testar pagamento não confirmado, duplicação, saldo vencido, consumo simultâneo, falha de telemetria e excesso de reserva em ambiente fictício.
- [ ] Procedimento corretivo auditável para divergência/estorno e recuperação após bloqueio implementado e testado (pendente).
- [ ] Confirmar faturamento pré-pago, auto-reload desligado, projeto dedicado e limites do provedor; comprar apenas mediante autorização do responsável.
- [ ] Conciliação e aprovação dos dois responsáveis antes de ativar.
- [ ] Registro de rollback e teste do site principal sem IA.
