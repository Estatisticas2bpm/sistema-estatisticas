# SIE-CPC — Homologação sintética da integração da IA
**Data:** 12/11/2026  
**Local:** branch de desenvolvimento da proposta #152.  
**Status:** função de IA não publicada; nenhuma chave real, conta real ou BO real usada.

## Escopo realizado

A função de IA existente foi importada e executada diretamente em ambiente Deno isolado, substituindo, **somente dentro do teste**, as chamadas de rede por respostas simuladas. Não houve abertura de endpoint, comunicação com Supabase institucional ou cobrança da OpenAI.

Teste: `tests/ia-cpc-edge.integration.test.ts`, executado automaticamente pelo GitHub Actions com `deno test --allow-env` (sem permissão de rede).

### Cenários verificados

| Cenário | Resultado obrigatório |
|---|---|
| Origem não autorizada, IA desativada ou acesso sem JWT | 403, 503 ou 401, sem consulta ao banco |
| Token inválido ou sem identificador de sessão | 401, sem acesso estatístico |
| Sessão revogada/expirada ou RPC de sessão com falha | 401, sem acesso estatístico |
| ADMIN não designado | 403, sem acesso estatístico |
| COMANDANTE de outra unidade, não designado | 403, sem acesso estatístico |
| OPERADOR sem autorização | 403, sem acesso estatístico |
| ADMIN designado e COMANDANTE CPC designado com consulta sem registros | 200, sem chamada paga |
| Falha de RPC de permissão | 403, negado por padrão |
| Falha na leitura de catálogos | 500, sem consulta à OpenAI |
| Cota financeira negada em chamada com dados fictícios | 429, sem consulta à OpenAI |
| Fluxo de consulta com dados fictícios e retorno de provedor simulado | 200, verifica ordem de sessão → autorização → estatísticas → reserva → provedor → fechamento |
| Análise de relatos não homologada | 503, não lê relatos |
| Consulta envolvendo dados de pessoa | recusada sem consultar BO nem OpenAI |

O teste intercepta a função real, inclusive seus módulos auxiliares, e confere a ordem efetiva das chamadas. A operação simulada de IA devolve apenas um resumo inventado. As credenciais são valores fictícios que não permitem faturamento ou acesso ao projeto.

Além disso, foram preservados os testes PostgreSQL isolados para concessões de acesso por duas identidades, exclusividade por categoria, alteração de perfil/unidade, teto de R$100/mês e concorrência de reservas.

## Resultado da integração sintética

A execução no GitHub Actions registrou **7 testes de Edge Function aprovados (0 falhas)**. O conjunto de validação Node passou integralmente, incluindo um teste adicional do JavaScript da página `ia-cpc.html` em DOM simulado.

Arquivo: `tests/ia-cpc-ui.integration.test.cjs`.

Esse teste executa o script verdadeiro da página e verifica: tela oculta quando não há Auth/permissão, ausência de envio de dados por usuários não designados, liberação da interface para usuário autorizado, envio de pergunta à função simulada, renderização de aviso de dados preliminares, atualização do orçamento, gráfico comparativo e tratamento de resposta 403. **Não envolve navegador real nem credenciais verdadeiras.**

## Ajuste de segurança na interface

Mesmo que a configuração geral de autenticação esteja ausente ou desabilitada, a permissão específica `ia_cpc` permanece negada no `auth-guard.js`. A interface permanece oculta e a página também exige `window.SistemaAuth.ready` e `pode('ia_cpc')` antes de mostrar o conteúdo. A Edge Function valida novamente a identidade e nunca confia no navegador como mecanismo único de proteção.

A denominação da interface foi ajustada para **projeto-piloto privado** em vez de sugerir que o site seja institucional.

## O que os testes NÃO comprovam

- Um login verdadeiro de usuários reais via Supabase Auth/GoTrue.
- Uma chamada real à Edge Function hospedada na infraestrutura do Supabase ou execução de `verify_jwt` no gateway.
- As RPCs criadas no Supabase operacional (a migração da IA continua não aplicada).
- Fluxo completo no navegador (incluindo redirects, rede, cache, refresh token e MFA).
- Tratamento de relatos operacionais por IA semântica nem precisão com amostra independente.
- Custos efetivos cobrados pela API da OpenAI.

## Critérios para liberar o piloto posteriormente

1. Em **ambiente segregado**, aplicar a migração SQL proposta e testar a API com o Auth e PostgREST reais, utilizando apenas identidades fictícias ou autorizadas para homologação.
2. Designar **exatamente um ADMIN e um COMANDANTE CPC**, sem registrar IDs/segredos no GitHub público.
3. Verificar login, logout, revogação de sessão, troca de unidade, MFA (quando adotado), autorização na UI e na Edge, inclusive URL direta.
4. Auditar privacidade e desempenho da análise dos relatos com amostra independente e de acesso controlado; não enviar textos individuais ao provedor externo.
5. Confirmar limites financeiros, preço e câmbio vigentes, sem prometer garantia exata de faturamento em BRL.
6. Autorizar habilitação efetiva do piloto. Até lá, manter `IA_CPC_ENABLED=false` e `IA_CPC_RELATOS_ENABLED=false`.

**Situação do sistema principal:** nenhuma implantação, migração, alteração de cadastro ou cobrança.
