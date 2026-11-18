# SIE-CPC — Homologação da integração da IA (sintética e Supabase local)
**Data:** 12/11/2026  
**Local:** branch de desenvolvimento da proposta #152.  
**Status:** função de IA não publicada; nenhuma chave real, conta real ou BO real usada.

## Nova homologação ponta a ponta com serviços reais em instância local

Na execução do GitHub Actions **43263740849**, em 12/11/2026, foram aprovados os três trabalhos: validação do código, PostgreSQL isolado e **Supabase local com Auth (GoTrue), PostgREST e Edge Function reais**.

A instalação foi criada no diretório temporário do executor e destruída após os testes. Isso impede a aplicação de migrações históricas do projeto que dependem de tabelas operacionais preexistentes. **Nenhuma branch, tabela, conta ou função foi criada no Supabase de produção.**

Arquivos:
- `.github/workflows/ci.yml` — trabalho `homologar-supabase-local-ia`, usando Supabase CLI v2.stable fixado para evitar mudanças incompatíveis do CLI v3;
- `tests/ia-cpc-supabase-local-fixture.sql` — esquema mínimo com RLS, funções de autenticação e sessão e catálogos exclusivamente fictícios;
- `tests/ia-cpc-supabase-local-e2e.cjs` — cliente de teste que aceita somente `http://127.0.0.1:54321` ou `http://localhost:54321` e recusa credenciais de projeto remoto.

### Resultados observados

1. GoTrue real criou e autenticou **cinco usuários fictícios** por email e senha, com JWT contendo identificador de sessão.
2. A RPC `ia_cpc_permitido()` no PostgREST real autorizou **exatamente dois** (um ADMIN e um COMANDANTE da unidade CPC), negou os três restantes e não ficou disponível ao papel `anon`.
3. A RPC financeira `ia_cpc_reservar_orcamento` não pôde ser chamada diretamente pelo usuário autenticado.
4. A Edge Function real respondeu **200** às duas contas autorizadas em consulta a período sem registros (sem qualquer chamada à OpenAI) e **403** às três contas não designadas.
5. A inclusão da sessão fictícia na tabela de revogação ocasionou recusa **401** na Edge Function.
6. A desativação do perfil fictício no banco ocasionou recusa **403** na Edge Function.
7. Origem HTTP externa não permitida e acesso anônimo foram rejeitados.
8. Resultado do script: **SUCESSO; cinco identidades, duas permitidas, três negadas, zero chamadas pagas, zero BOs reais e zero alterações em produção**.

Uma dificuldade da primeira execução foi o carregamento das migrações históricas ao iniciar um banco vazio. Foi resolvida criando workspace de teste isolado. Outra dificuldade foi detectar o worker Edge como pronto a partir de uma resposta do gateway; o teste passou a aguardar uma resposta de autenticação produzida pela própria função.

**Alcance da homologação:** componentes reais executados localmente, com JWTs/sessões gerados pelo GoTrue local e PostgREST real. Não é um teste de hospedagem, gateway e autenticação no Supabase de produção.

## Homologação em navegador Chromium real — 12/11/2026

A execução **GitHub Actions 43265696881** passou integralmente nos três trabalhos: validação geral (Deno, Node e HTML), PostgreSQL isolado (acesso e teto financeiro) e Supabase local (GoTrue, PostgREST, Edge e **Chromium real**).

A execução no navegador utilizou o HTML `ia-cpc.html`, o **`auth-guard.js` original** e o `auth-config.js` adaptado *somente no servidor HTTP local de testes*. A biblioteca `@supabase/supabase-js@2.95.0` foi empacotada pelo `esbuild` e carregada localmente, sem depender da CDN e sem permitir conexões do navegador a domínios externos. O Chromium foi executado em modo headless no runner do GitHub. Não há nenhuma mudança na configuração real do site.

**Resultados confirmados em log:**
- navegador sem sessão: redirecionado à página de login;
- ADMIN individualmente designado: página exibida e consulta sem registros concluída sem cobrança;
- COMANDANTE CPC individualmente designado: página exibida e consulta sem registros concluída sem cobrança;
- outro ADMIN: bloqueado pelo `auth-guard.js`;
- outro COMANDANTE: bloqueado;
- OPERADOR: bloqueado;
- pós-testes, o backend real local rejeitou sessão revogada e perfil desativado.

Arquivos principais: `tests/ia-cpc-browser-local.e2e.cjs`, `tests/ia-cpc-supabase-local-e2e.cjs`, `tests/ia-cpc-supabase-local-fixture.sql` e `.github/workflows/ci.yml`.

**Limites:** trata-se de navegador real ligado à stack Supabase **local**. Ainda não houve verificação do domínio público, do gateway hospedado, de contas policiais reais, de upload/consulta de BO real ou de API paga. O teste de consulta em período vazio evita propositalmente toda cobrança. A autorização da IA e dos relatos permanece desativada no Supabase de produção.

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
- Uma chamada à Edge Function **hospedada na infraestrutura remota** do Supabase (o executor e o gateway locais foram exercitados com JWTs reais do GoTrue local).
- As RPCs criadas no Supabase operacional (a migração da IA continua não aplicada).
- Fluxo em navegador com autenticação na **instância hospedada**, incluindo login/logout, refresh token, MFA e comportamento do domínio real; o navegador ligado ao Supabase local já foi testado.
- Tratamento de relatos operacionais por IA semântica nem precisão com amostra independente.
- Custos efetivos cobrados pela API da OpenAI.

## Critérios para liberar o piloto posteriormente

1. **Concluído em ambiente local descartável:** aplicar a migração SQL proposta e testar Auth, PostgREST e Edge reais com identidades fictícias. **Pendente:** verificar o comportamento em ambiente Supabase hospedado segregado, se necessário, antes de produção.
2. Designar **exatamente um ADMIN e um COMANDANTE CPC**, sem registrar IDs/segredos no GitHub público.
3. **Concluído localmente:** login em Chromium, acesso por URL direta, revogação e verificação individual na UI e Edge. **Pendente:** validar domínio hospedado, logout, refresh token, mudança de contexto e MFA (quando adotado).
4. Auditar privacidade e desempenho da análise dos relatos com amostra independente e de acesso controlado; não enviar textos individuais ao provedor externo.
5. Confirmar limites financeiros, preço e câmbio vigentes, sem prometer garantia exata de faturamento em BRL.
6. Autorizar habilitação efetiva do piloto. Até lá, manter `IA_CPC_ENABLED=false` e `IA_CPC_RELATOS_ENABLED=false`.

**Situação do sistema principal:** nenhuma implantação, migração, alteração de cadastro ou cobrança.
