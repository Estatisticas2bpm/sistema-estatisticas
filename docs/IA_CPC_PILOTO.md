# SIE-CPC — Assistente de Inteligência Operacional (piloto)

**Estado em 11/11/2026:** código em branch e PR de revisão. **Não publicado, não habilitado, não consome API paga.**
Não fazer merge, deploy, ativação de faturamento ou envio de dados operacionais à OpenAI sem autorização institucional expressa e homologação.

## 1. Arquitetura e autorização

Frontend: ia-cpc.html, auth-guard.js, index.html, dashboard-cpc.html.
Backend: Supabase Edge Function ia-cpc (verify_jwt=true quando houver implantação).
Persistência necessária (ainda NÃO aplicada): docs/sql/ia_cpc_cota_pendente_aprovacao.sql.

A autorização inicial é **por identidade**, não apenas por perfil. O sistema possui mais de um ADMIN e mais de um COMANDANTE CPC. Exatamente **um usuário com perfil ADMIN** e **um usuário com perfil COMANDANTE cuja unidade principal ativa é CPC** deverão ser designados depois da homologação. A tabela private.ia_cpc_usuarios começa SEM NENHUM usuário ativo. O índice de unicidade impede autorizar mais de um de cada categoria simultaneamente.

O navegador consulta public.ia_cpc_permitido() para exibir o acesso. A Edge Function **independentemente** verifica:
- JWT e usuário em Supabase Auth;
- sessão vigente, não revogada, por public.admin_validar_sessao (service_role);
- lista individual e perfil/unidade principal por public.ia_cpc_acesso_usuario (service_role);
- limites de entrada, origem CORS, período e parâmetros;
- reserva atômica antes de qualquer chamada paga.

Se a migração ou qualquer verificação falhar: **acesso bloqueado por padrão**.

## 2. Indicadores e inteligência estatística

Fase 1 implementada em código: totais de ocorrências, rascunhos/finalizados, unidades, naturezas, bairros, conduções conforme regra max(conduzidos, prisões) por BO, apreensões básicas e veículos recuperados. Todas as leituras são do banco pelo servidor, somente dados agregados para a API externa.

Fases 2 e parte da 3 implementadas em código: comparação de dois períodos consecutivos de mesma duração, variação absoluta/percentual, rankings e mudanças relevantes por unidade, natureza e bairro. Questões com menos de cinco casos em qualquer um dos períodos não são apresentadas nas comparações; alertas de categorias requerem também variação relativa de 25% e absoluta de cinco casos. O front oferece resumos de 7, 15 e 30 dias, gráfico simples comparativo e perguntas sugeridas.

**Limitações importantes:** resultados que estão em rascunho podem distorcer tendências; a cobertura histórica dos campos não é uniforme. A natureza é consolidada primeiro pelo campo padronizado `ocorrencia` e, na falta de correspondência, pelo campo `crime`: o valor enviado tem de constar do catálogo oficial, ou ser agrupado de forma conservadora em FURTO/ROUBO por prefixo. Tentativas permanecem classificadas separadamente. Naturezas e bairros fora do catálogo são classificados como "NÃO CLASSIFICADO", para evitar enviar textos livres ou identificadores ao provedor. Contagens de campos incompletos não podem ser apresentadas como total criminal definitivo. É necessário auditar a cobertura real antes de confiar nos rankings. O piloto interpreta perguntas sobre "últimos N dias" pelo formulário (limite 366 dias), identifica perguntas focalizadas em FURTO/ROUBO/MARIA DA PENHA e somente divulga contagens dessas naturezas com pelo menos 5 registros. O piloto não faz comparações por nacionalidade, subtipo, análise causal, avaliação especializada de operações, CIPA/CIPTUR/BOPE, ou consulta ao relato integral. Não pressupor dados que não existam.

O histórico de conversa é **temporário na página** (perde-se ao recarregar). O backend não armazena perguntas/respostas. Persistência protegida e relatórios PDF institucionais são etapas futuras, não implementadas.

## 3. Orçamento financeiro: R$ 100,00 / mês

**Modelo de referência:** gpt-5.6-luna, Standard API. Preços consultados em 11/11/2026 na tabela oficial:
https://developers.openai.com/pt-BR/api/docs/pricing

- Entrada: US$ 0,20 por 1 milhão de tokens.
- Saída: US$ 1,20 por 1 milhão de tokens.
- Máximo de saída do piloto: 800 tokens por consulta.
- Câmbio de reserva e margem de segurança: configurar IA_CPC_BRL_USD_RESERVA com taxa conservadora (valor não presumido) e margem 2x. Não depende de consulta automática a serviços de câmbio.
- Reserva máxima estimada ANTES de enviar a requisição; até 80.000 bytes de payload.
- Controle atômico por advisory transaction lock compartilhado, registro em private.ia_cpc_consumo, total mensal de **10.000 centavos**, alerta a partir de **8.000 centavos**. Limites adicionais: **3/minuto por usuário, 20/dia por usuário, 300/mês global**. Dia e mês no fuso America/Boa_Vista.
- Após retorno da API, o sistema reconcilia tokens reais, modelo e custo conservador; se não vier telemetria, a reserva integral permanece comprometida. Falhas de serviço também mantêm reserva, evitando cobrança não contabilizada.

**Importante:** o teto é do **custo estimado/reservado pelo sistema**, não garantia legal de faturamento exato em reais. Taxas de câmbio, tarifas, impostos, mudanças de preço e custos externos podem divergir. Exigir projeto de API institucional dedicado, orçamento/limites junto ao fornecedor, monitoramento da fatura e validação das premissas de câmbio antes da ativação. Jamais tratar os alertas do provedor como único bloqueio.

## 4. Segurança e tratamento institucional

- Chaves OPENAI_API_KEY e SUPABASE_SERVICE_ROLE_KEY somente em Secrets de Edge Functions, NUNCA no navegador ou GitHub.
- IA_CPC_ENABLED permanece não configurado/false até aprovação.
- IA_CPC_ALLOWED_ORIGINS: origens exatas HTTPS; nenhuma permitida por padrão.
- OPENAI_MODEL: deve ser exatamente gpt-5.6-luna na versão piloto; sem fallback inválido.
- IA_CPC_BRL_USD_RESERVA: câmbio conservador documentado, entre 1 e 30 BRL/USD, aprovado internamente.
- store:false na API Responses; isso não dispensa avaliação jurídica/institucional sobre os dados trafegados.
- Nenhum SQL arbitrário gerado pelo modelo; nenhum documento BO ou relato é enviado; campos categóricos precisam constar de catálogos.
- O controle de acesso **não depende de CORS**; ele exige token, sessão e lista individual.
- Até homologação, não enviar dados policiais reais ou informações pessoais/sigilosas ao fornecedor.

## 5. Etapas de implantação/aceite, ainda PENDENTES

- [ ] Aprovação institucional de segurança e processamento externo de estatísticas policiais, incluindo legislação aplicável.
- [ ] Revisar SQL em ambiente de homologação e verificar RLS e permissões; **não executado no banco de produção**.
- [ ] Designar exatamente as duas contas por UUID, sem divulgar IDs no repositório; avaliar procedimento de substituição.
- [ ] Verificar que conta não designada (incluindo outros ADMIN/COMANDANTE CPC) é bloqueada no frontend E na Edge.
- [ ] Testar suspensão, expiração, revogação e alteração de perfil/unidade, MFA quando adotado.
- [ ] Conferir os indicadores com dashboard e amostra sintética/anonimizada, especialmente campos não classificados, rascunhos e duplicidades.
- [ ] Homologar concorrência de reservas, custo acima do orçamento, aviso dos R$80 e divergências de telemetria.
- [ ] Validar o câmbio conservador e os preços vigentes; obter aprovação de projeto de API e limite de gasto.
- [ ] Configurar OPENAI_API_KEY, OPENAI_MODEL, IA_CPC_BRL_USD_RESERVA, IA_CPC_ALLOWED_ORIGINS, IA_CPC_ENABLED=false.
- [ ] Implantar Edge Function com verify_jwt=true e avaliar logs para não registrar dados pessoais.
- [ ] Realizar testes autenticados E2E em ambiente isolado. Somente depois da autorização, ativar gradualmente em produção.

## 6. Testes locais/CI

- deno check supabase/functions/ia-cpc/index.ts
- tests/ia-cpc-acesso.test.cjs
- tests/ia-cpc-metricas.test.cjs
- tests/ia-cpc-orcamento.test.cjs
- CI GitHub Actions valida HTML/JS do repositório.

As validações são testes de contrato e unitários com exemplos sintéticos. **Não constituem teste de integração com contas reais, com a API paga ou da migração SQL aplicada.**

## 7. Próximas fases

- Fase 3 complementar: conversas persistidas com RLS auditado e sugestões adaptadas ao contexto.
- Fase 4: relatórios personalizados em PDF, respeitando o gerador institucional já existente, e consultas especializadas CIPA/CIPTUR/BOPE/Cavalaria.
- Fase 5: auditoria de qualidade, divergências e possíveis duplicidades para revisão humana; avaliação não causal das operações.

**Nenhuma alteração de funcionalidades existentes nem de dados históricos está autorizada por este documento.**
