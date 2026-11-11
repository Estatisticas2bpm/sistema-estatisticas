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

**Limitações importantes:** resultados que estão em rascunho podem distorcer tendências; a cobertura histórica dos campos não é uniforme. A natureza é consolidada primeiro pelo campo padronizado `ocorrencia` e, na falta de correspondência, pelo campo `crime`: o valor enviado tem de constar do catálogo oficial, ou ser agrupado de forma conservadora em FURTO/ROUBO por prefixo. Tentativas permanecem classificadas separadamente. Naturezas e bairros fora do catálogo são classificados como "NÃO CLASSIFICADO", para evitar enviar textos livres ou identificadores ao provedor. Contagens de campos incompletos não podem ser apresentadas como total criminal definitivo. É necessário auditar a cobertura real antes de confiar nos rankings. O piloto interpreta perguntas sobre "últimos N dias" pelo formulário (limite 366 dias), identifica perguntas focalizadas em FURTO/ROUBO/MARIA DA PENHA e somente divulga contagens dessas naturezas com pelo menos 5 registros. O piloto não faz comparações por nacionalidade, subtipo, análise causal ou avaliação especializada de operações CIPA/CIPTUR/BOPE. Foi adicionada análise LOCAL limitada de menções em relatos, bloqueada por padrão, sem compartilhamento de textos integrais. Não pressupor dados que não existam.

### Proteção adicional dos dados no piloto

- O servidor converte as perguntas livres em **intenções estatísticas padronizadas**. Não encaminha à API externa o texto literal da pergunta, nome de bairros digitados pelo usuário, histórico bruto ou identificadores de pessoas.
- Perguntas sobre identificação individual, suspeitos, policiais, vítimas, nacionalidade e documentos são recusadas localmente pela função, e não enviadas ao modelo. Consultas fora do vocabulário estatístico do piloto também são recusadas.
- A IA recebe dados agregados, mas não tem acesso a cruzamentos individuais por bairro × natureza, nem pode alegar que os calculou.
- Séries mensais só são fornecidas quando **todos** os meses exibidos apresentam cinco registros ou mais. Caso contrário, a série inteira é omitida para evitar inferência de contagens pequenas.
- A consolidação "FURTO" e "ROUBO" inclui categorias oficiais da mesma família (por exemplo, roubo de arma de fogo), mas exclui tentativas, localização/recuperação de objetos e categorias ambíguas. Sempre conferir as convenções do dashboard.
- Se o recorte tiver **zero registros finalizados**, a IA deve identificá-lo como **exclusivamente preliminar**, sem conclusões criminais definitivas nem recomendações operacionais derivadas apenas dos rascunhos.
- Tais barreiras reduzem, mas não eliminam, riscos de privacidade. Revisão de segurança e autorização institucional continuam obrigatórias.

O histórico de conversa é **temporário na página** (perde-se ao recarregar). O backend não armazena perguntas/respostas. Persistência protegida e relatórios PDF institucionais são etapas futuras, não implementadas.

## 2A. Expansão para análise contextual de relatos e observações — proposta NÃO ativada

O banco existente contém os campos \`historico_resumido\`, \`detalhes\`, \`observacao\` e \`observacao_final\`. A verificação estrutural (sem leitura de relatos individuais) encontrou 4.075 dos 5.312 registros ativos com \`historico_resumido\` preenchido. O potencial analítico justifica tratar os relatos como fonte auxiliar, não como fonte automaticamente validada.

### Funcionamento da primeira entrega

- A Edge Function pode buscar os campos narrativos somente após autenticação, validação de sessão, lista individual de duas contas e solicitação expressa de análise de relatos.
- **Barreira adicional:** segredo \`IA_CPC_RELATOS_ENABLED=true\`, ausente por padrão, e \`IA_CPC_ENABLED=true\`. O módulo de relato permanece bloqueado até homologação, mesmo que a IA estatística geral seja liberada.
- A análise é realizada localmente na Edge Function, por dicionário explícito de menções (arma de fogo, arma branca, motocicleta, automóvel, residência, comércio, via pública, câmera, ameaça e danos materiais).
- O código não produz lista de nomes, trechos, números de BO, locais específicos, endereços, placas, pessoas ou citações do histórico.
- **Não envia o texto dos relatos ao serviço OpenAI.** Envia somente contagens de marcadores com pelo menos 5 registros, totais de documentos com/sem texto e metodologia/ressalvas.
- O texto é limitado a 16 mil caracteres por registro para análise local; ocorrências longas são contabilizadas como truncadas.
- Um marcador significa **menção textual**, não fato confirmado, arma utilizada, autoria, causalidade ou modus operandi comprovado. Negativas, citações de terceiros e referências à própria guarnição podem gerar falso positivo.
- Não inferir envolvimento de policiais ou autoridades no histórico; manter o indicador restrito ao CPC e somente para novos registros, conforme a regra estatística anterior do projeto. Não reclassificar nada automaticamente.
- Nenhuma classificação retroativa é persistida: os agregados são produzidos sob demanda, em memória, sem modificações no banco.
- Não usar os marcadores para atribuir periculosidade a pessoas, discriminar grupos ou direcionar ações individuais.

**Limitação técnica:** esta primeira implementação reconhece sinais textuais por regras fixas, não compreende semanticamente o relato inteiro. Para perguntas investigativas mais complexas ou sínteses narrativas profundas seria necessário um processamento semântico protegido, com avaliação de segurança e base válida para o tratamento dos dados, de preferência dentro do ambiente controlado. O fato de a aplicação ser privada ou acessada somente por profissionais da segurança pública não elimina a necessidade de proteger dados pessoais e informações restritas.

### Homologação específica ainda necessária

- [ ] Testes sintéticos de falsos positivos e negativos com relatos criados para teste, incluindo negações e cenários de trânsito, ambiental, patrulhamento e policial.
- [ ] Verificar performance e timeout com muitos relatos sem transportar texto ao provedor.
- [ ] Validar controles de acesso, logs, isolamento de unidades e orçamento.
- [ ] Aprovar expressamente a ampliação de escopo técnico e ativar a flag apenas após validação; nenhum dado real é enviado à OpenAI durante essa etapa.
- [ ] Rever as categorias de marcadores com a equipe responsável pela estatística; nenhum resultado individualizado deve ser usado como prova.


## 3. Orçamento financeiro: R$ 100,00 / mês

**Modelo de referência:** gpt-5.6-luna, Standard API. Preços consultados em 11/11/2026 na tabela oficial:
https://developers.openai.com/api/docs/models/gpt-5.6-luna

- Entrada: US$ 0,20 por 1 milhão de tokens.
- Saída: US$ 1,20 por 1 milhão de tokens.
- Máximo de saída do piloto: 800 tokens por consulta.
- Câmbio de reserva e margem de segurança: configurar IA_CPC_BRL_USD_RESERVA com taxa institucional de reserva entre **8 e 30 BRL/USD**, mais margem 2x; não confundir o piso conservador com a cotação oficial da moeda. Não depende de consulta automática a serviços de câmbio.
- Reserva máxima estimada ANTES de enviar a requisição; até 80.000 bytes de payload.
- Controle atômico por advisory transaction lock compartilhado, registro em private.ia_cpc_consumo, total mensal de **10.000 centavos**, alerta a partir de **8.000 centavos**. Limites adicionais: **3/minuto por usuário, 20/dia por usuário, 300/mês global**. Dia e mês no fuso America/Boa_Vista.
- Após retorno da API, o sistema reconcilia tokens reais, modelo e custo conservador; se não vier telemetria, a reserva integral permanece comprometida. Falhas de serviço também mantêm reserva, evitando cobrança não contabilizada.

**Importante:** o teto é do **custo estimado/reservado pelo sistema**, não garantia legal de faturamento exato em reais. Taxas de câmbio, tarifas, impostos, mudanças de preço e custos externos podem divergir. Exigir projeto de API institucional dedicado, orçamento/limites junto ao fornecedor, monitoramento da fatura e validação das premissas de câmbio antes da ativação. Jamais tratar os alertas do provedor como único bloqueio.

## 4. Segurança e tratamento institucional

- Chaves OPENAI_API_KEY e SUPABASE_SERVICE_ROLE_KEY somente em Secrets de Edge Functions, NUNCA no navegador ou GitHub.
- IA_CPC_ENABLED permanece não configurado/false até aprovação.
- IA_CPC_ALLOWED_ORIGINS: origens exatas HTTPS; nenhuma permitida por padrão.
- OPENAI_MODEL: deve ser exatamente gpt-5.6-luna na versão piloto; sem fallback inválido.
- IA_CPC_BRL_USD_RESERVA: câmbio conservador documentado, entre 8 e 30 BRL/USD, aprovado internamente.
- store:false na API Responses; isso não dispensa avaliação jurídica/institucional sobre os dados trafegados.
- Nenhum SQL arbitrário gerado pelo modelo; nenhum BO, trecho de relato ou texto de observação é enviado ao provedor externo. Textos narrativos só são processados localmente em contagens agregadas quando a funcionalidade for homologada; campos categóricos precisam constar de catálogos.
- O controle de acesso **não depende de CORS**; ele exige token, sessão e lista individual.
- Até homologação, não enviar dados policiais reais ou informações pessoais/sigilosas ao fornecedor. A chave IA_CPC_RELATOS_ENABLED fica ausente/false por padrão.

## 5. Etapas de implantação/aceite, ainda PENDENTES

- [ ] Aprovação institucional de segurança e processamento externo de estatísticas policiais, incluindo legislação aplicável.
- [ ] Revisar SQL em ambiente de homologação e verificar RLS e permissões; **não executado no banco de produção**.
- [ ] Designar exatamente as duas contas por UUID, sem divulgar IDs no repositório; avaliar procedimento de substituição.
- [ ] Verificar que conta não designada (incluindo outros ADMIN/COMANDANTE CPC) é bloqueada no frontend E na Edge.
- [ ] Testar suspensão, expiração, revogação e alteração de perfil/unidade, MFA quando adotado.
- [ ] Conferir os indicadores com dashboard e amostra sintética/anonimizada, especialmente campos não classificados, rascunhos e duplicidades. O banco atualmente apresenta períodos compostos inteiramente por rascunhos; não interpretar isso automaticamente como série criminal consolidada.
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

Além dos testes de contrato e das regras estatísticas, o CI executa a proposta de SQL em um serviço **PostgreSQL 17 descartável**, alimentado exclusivamente por identidades e registros sintéticos. São validados:
- PRÉ-ATIVAÇÃO: acesso negado sem cadastramento individual;
- exclusividade de um ADMIN e um COMANDANTE do CPC, inclusive bloqueio de outros usuários com o mesmo perfil;
- RLS e impossibilidade de usuário comum executar RPCs financeiras;
- desativação de usuário e troca de unidade principal;
- bloqueio de modelo não homologado;
- teto mensal estimado de R$ 100, alerta de R$ 80, reconciliação e rejeição de dupla finalização;
- limites de 3 reservas/minuto, 20/dia e 300/mês;
- duas reservas concorrentes, comprovando que somente uma consome o último saldo disponível.

**Isto é homologação da migração em PostgreSQL isolado**, não implantação da migração no Supabase real. Ainda faltam teste de infraestrutura Supabase/Auth/PostgREST, contas reais, revisão jurídica, autorização institucional, qualidade estatística e teste da API paga, nessa ordem.

## 7. Próximas fases

- Fase 3 complementar: conversas persistidas com RLS auditado e sugestões adaptadas ao contexto.
- Fase 4: relatórios personalizados em PDF, respeitando o gerador institucional já existente, e consultas especializadas CIPA/CIPTUR/BOPE/Cavalaria.
- Fase 5: auditoria de qualidade, divergências e possíveis duplicidades para revisão humana; avaliação não causal das operações.

**Nenhuma alteração de funcionalidades existentes nem de dados históricos está autorizada por este documento.**
