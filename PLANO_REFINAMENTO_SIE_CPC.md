# Plano de refinamento do SIE-CPC

**Versão:** 1.6 — 12/10/2026  
**Estado:** em execução; homologação pendente.  
**Escopo:** CPC, 1º BPM, 2º BPM, BOPE, Cavalaria, CIPA, CIPG, CIPTUR e GIRO.

## Objetivo

Transformar os painéis, mapas, consultas, auditorias e relatórios PDF em um conjunto estatístico coerente, auditável, responsivo e fiel às peculiaridades de cada unidade, preservando o registro de origem. O CPC é a central de consolidação; serviços especializados não são automaticamente equivalentes a ocorrências policiais.

## Regras transversais

1. Cada indicador possui **nome, unidade de medida, tabela/consulta de origem, campo de data, regra de agregação, filtros aplicáveis e regra de deduplicação**.
2. Com os mesmos parâmetros, a visão rápida da unidade, o cartão do CPC, o dashboard completo e o PDF devem retornar o mesmo valor.
3. Não contabilizar serviços da CIPG, visitas da Cavalaria, abordagens do GIRO, autos da CIPA/CIPTUR como BOs sem correspondência documental.
4. Não misturar **data da ocorrência**, **data do documento** e **data de lançamento** sem declarar qual se aplica.
5. Evitar duplicação na consolidação: unidade de origem, hierarquia pai/filha, BOs compartilhados e relações de registros devem ser verificados.
6. Aplicar permissões já existentes e isolamento por unidade; visualização CPC não concede permissão de edição.
7. Tratar falhas por módulo e mostrar estado "sem dados" diferente de "erro no carregamento"; nunca transformar erro em zero.
8. Não alterar produção em lote sem verificação e plano de reversão; testar também nos dispositivos móveis.

## Fases e critérios de aceite

### Fase 1 — Padronização, inventário e contrato estatístico
- [x] Títulos "Panorama Estatístico" nas páginas iniciais do CPC, 1º BPM, 2º BPM, BOPE, Cavalaria, CIPTUR e GIRO.
- [x] Títulos "Panorama Estatístico" em `cipa-home.js` e `cipg-home.js` (12/10/2026).
- [x] Documentar plano, arquitetura observada e definições iniciais dos indicadores.
- [ ] Revisar outras telas e textos para consistência (sem substituir "operacional" quando descrever efetivamente atividade operacional).
- [ ] Confirmar nomenclaturas, fontes, filtros e permissões de cada indicador junto às unidades.
**Aceite:** título correto conforme unidade ativa; nenhum impacto negativo na autenticação, filtro por unidade ou nos números do período.

### Fase 2 — Visão rápida especializada em todas as unidades
- [ ] Revisar fonte, período, agregação e comparativo de cada um dos quatro cartões em TODAS as unidades (a revisão técnica de CIPA, CIPG, GIRO, Cavalaria e CIPTUR avançou; BOPE e BPMs carecem de aceite).
- [ ] Conferir CIPA e CIPG com seus próprios relatórios/cadernos; Cavalaria com serviços e atividades; CIPTUR com A.I. e remoções; GIRO com abordagens; BOPE e BPMs conforme suas naturezas.
- [ ] Rever estados de carregamento, ausência de dados e falhas (em andamento: corrigida a exibição indevida de zero quando consultas básicas da visão rápida falham; ainda faltam estados por módulo e testes).
- [x] Inspecionar no Supabase as colunas e tipos das tabelas especializadas da CIPA, CIPG, GIRO, Cavalaria e CIPTUR.
- [x] Implantar paginação estável por `id` (até 1.000 registros por página) nos indicadores mensais GIRO, Cavalaria e CIPTUR da página inicial; verificar com simulação de **2.205 registros** e propagação de erros.
- [x] Implantar paginação também nos eventos da CIPG vinculados aos serviços, em grupos de até 150 IDs; verificar com simulação de **1.375 eventos** distribuídos entre 150 serviços.
- [x] Ajustar a legenda de CIPTUR de "Veículos removidos" para **"Autos com remoção"** na visão rápida, de acordo com o campo `houve_remocao`: um auto não prova uma remoção de veículo distinta.
- [x] Verificar agregados do banco em 01–12/10/2026: GIRO = **6 abordagens / 6 pessoas**, CIPTUR = **28 autos / 8 autos com indicação de remoção**. Conferência das fórmulas, **não homologação do resultado no navegador/perfis**.
- [x] Auditar regras de leitura RLS das oito tabelas especializadas: todas com RLS habilitado, políticas SELECT por unidade ou ocorrência vinculada; **teste prático com perfis autenticados ainda pendente**.
- [x] Extrair funções `CipaHome.indicadores` e `CipgHome.indicadores` e usá-las nos próprios cartões, comparativos e resumos, preparando reuso dos mesmos critérios no CPC.
- [x] Esclarecer datas de referência da CIPA nas descrições (ocorrência, fauna, embargo, autuação) e explicitar datas/anos no comparativo de CIPA e CIPG.
- [x] Adicionar `tests/indicadores-home.test.cjs` para conferir fórmulas, situações sem registros, total de efetivo, vedação de dupla soma de embargo e renderização; execução do conteúdo com ambiente JS compatível aprovada. **Execução nativa no Node e homologação no navegador pendentes**.
- [ ] Homologar os números com o acesso real de cada unidade, inclusive políticas RLS e os filtros do painel, e obter documentos de referência.
- [ ] Confirmar com a CIPTUR se existe forma de contabilizar **veículos únicos removidos**, diferente de autos sinalizados com remoção.
- [ ] Validar período, comparativo e correção dos cartões especializados da CIPA, CIPG e Cavalaria com registros representativos (essas tabelas estavam vazias em 12/10/2026).
- [x] Centralizar `GIRO`, `CAVALARIA` e `CIPTUR` em `estatistica-indicadores.js`, com as mesmas fórmulas na visão rápida individual e no CPC.
- [x] Criar testes de regressão dos cinco contratos especializados, distinguindo **erro** de **zero**, eventos sobrepostos e autos com remoção (arquivo `tests/estatistica-indicadores.test.cjs`); adicionar arquivos CJS à rotina CI.
- [ ] Executar homologação manual dos cartões e comparativos com login real nos nove perfis de unidade.
**Aceite:** cartões e comparativos validados contra consultas aos registros, unidade a unidade.

### Fase 3 — "Unidades em números" no CPC
- [x] Implementar a substituição do modelo homogêneo na página inicial do CPC pelos quatro KPIs específicos de cada unidade (BOPE permanece com contrato genérico até homologação).
- [x] Criar serviço de leitura especializado no CPC que reutiliza os contratos de CIPA/CIPG/GIRO/Cavalaria/CIPTUR com paginação e isolamento das falhas por unidade.
- [ ] Aplicar período único, comparações e hierarquia de unidades; preservar filtros e links para detalhes.
- [x] Diferenciar visualmente dados especializados indisponíveis/carregando (`—`) de zero legítimo e registrar fontes nas descrições dos cartões.
**Aceite:** para cada unidade, os quatro números do CPC coincidem com a visão rápida individual no mesmo período e escopo.

### Fase 4 — Mapa estatístico do CPC
- [x] Implementar **somente no modo CPC** a identificação visual principal pela **unidade responsável** no mapa resumido e no completo; manter filtros de natureza como atributos secundários.
- [ ] Mini-brasões e cores por unidade implementados com `divIcon` e fallback colorido; faltam testes de carregamento, desempenho e legibilidade em celulares.
- [x] Implementar camada opcional **Abordagens GIRO** desmarcada por padrão no mapa CPC, com modos "ocorrências", "abordagens", "ambos" e consulta autorizada e paginada.
- [ ] Harmonizar integralmente período, geolocalização, permissões, legenda, agrupamentos e exportação (fuso UTC−04 e filtros territoriais por bairro implementados, mas testes práticos, agrupamento/exportação pendentes).
**Aceite:** o mapa CPC distingue unidades e, ao ativar o filtro, exibe apenas abordagens reais do GIRO; mapas individuais seguem intactos.

### Fase 5 — Dashboard completo, consultas e séries temporais
- [x] Acrescentar no `dashboard-cpc.html` bloco de quatro indicadores específicos por unidade e manter seletor de unidade existente, com mesmas regras de cálculo da visão rápida.
- [ ] Preservar visão transversal e permitir aprofundamento (drill-down) com registro fonte.
- [ ] Integrar plenamente produtividade, fiscalizações, serviços, abordagens, distribuição espacial e séries temporais (mini-séries por unidade especializada implementadas; gráficos analíticos/exportações comparativas e homologação ainda pendentes).
- [ ] Conferir período e critérios estatísticos em consultas, rankings e gráficos.
**Aceite:** os valores e detalhes conciliam entre visão rápida, dashboard e bases; filtros não vazam dados.

### Fase 6 — Relatórios PDF
- [ ] Elaborar template personalizado e homologado para todas as unidades (CIPA, GIRO, CIPTUR e 2º BPM já tinham versões específicas; CIPG e Cavalaria receberam novos modelos; conferir BOPE e 1º BPM).
- [ ] Incluir metodologia (origem, período, data de referência e critérios), gráficos, tabelas e resultados sem duplicações.
- [ ] Ajustar e homologar paginação A4, cabeçalho, numeração e legibilidade; validar impressão/download em navegadores e telefones (paginação de CONSULTAS de dados dos PDFs GIRO/CIPTUR corrigida, testes visuais pendentes).
- [ ] Comparar amostras de diferentes períodos com os indicadores de tela.
- [x] Criar relatórios por fontes próprias para **CIPG (livro de guarda)** e **Cavalaria (produtividade dos serviços)**, com metodologia, comparativos e tratamento de períodos sem registros.
- [x] Impedir truncamento silencioso de consultas dos relatórios **GIRO** e **CIPTUR** (paginação), corrigindo o termo da CIPTUR para **autos com indicação de remoção**, sem afirmar veículos distintos.
- [ ] Testar visualmente a impressão A4 dos relatórios CIPG/Cavalaria e conferir seus valores com dados reais e responsáveis.
**Aceite:** PDF fiel aos mesmos filtros/dados e às especificidades da unidade; conferência por amostragem registrada.

### Fase 7 — Auditoria e integridade
- [ ] Identificar e homologar duplicações, registros incompletos, problemas de classificação, datas inconsistentes e eventuais erros geográficos (levantamento inicial e indicador de suspeita implementados, triagem humana pendente).
- [ ] Criar trilha completa de divergências e validação documental, sem corrigir silenciosamente o banco (auditoria passa a sinalizar BO potencialmente repetido dentro da mesma unidade e ano).
- [ ] Verificar acessos e consultas com **usuários de perfis reais**; auditoria de RLS no esquema já efetuada, mas não equivale a homologação de sessão.
**Aceite:** relatório de divergências reproduzível, sem perda de dados.

### Fase 8 — Homologação e entrega
- [ ] Testar todas as unidades, perfis, browsers, celular, tablets e PDFs.
- [ ] Testes de regressão e desempenho por intervalo curto e longo.
- [ ] Registrar aprovação por unidade, versão publicada e instruções operacionais.
**Aceite:** checklist assinado/confirmado pelos responsáveis e versão estável em produção.

## Acompanhamento de execução

**Legenda:** [x] implementado e conferido no código; [ ] pendente ou parcialmente executado. Implementação não equivale a homologação em navegador/banco.

- **Fase 1:** 3/5 itens implementados; dois itens aguardam revisão ampla e confirmação com unidades. Aceite pendente.
- **Fase 2:** contratos reutilizáveis CIPA/CIPG/GIRO/Cavalaria/CIPTUR e regressões implementadas; pendem perfis reais, documentos de origem e definição especializada do BOPE.
- **Fases 3 a 8:** não homologadas; manter os itens não concluídos desmarcados.

## Inventário inicial de módulos (código)

- `index.html`: visão rápida das unidades, visão central CPC, "Unidades em números" e mapa resumido.
- `cipa-home.js`, `cipg-home.js`: visões rápidas especializadas da CIPA/CIPG.
- `dashboard.html`: dashboard completo de múltiplas unidades e seções especializadas.
- `dashboard-cpc.html`: módulo executivo próprio do CPC.
- `mapa-criminal.html`: mapa analítico de ocorrências e abordagens.
- `analise-temporal.html`, `auditoria.html`, `territorio-cpc.html`: análises correlatas.
- `relatorio.html`, `relatorio-2bpm-profissional.js`, `relatorio-cipa-profissional.js`: relatórios/PDFs.
- `giro-abordagem.html`, `cavalaria-produtividade.html`, `cipg-produtividade.html`, `autos-infracao.html`: cadastros especializados.

## Contrato inicial dos quatro indicadores mensais

| Unidade | Indicadores sugeridos / atualmente visíveis | Fonte ou cuidado |
|---|---|---|
| 1º BPM | Ocorrências; conduções; TCOs; veículos recuperados | Registros de ocorrência e TCO; verificar legados |
| 2º BPM | Ocorrências; conduções; TCOs; veículos recuperados | Registros de ocorrência e TCO |
| BOPE | Ocorrências; conduções; TCOs; veículos recuperados (provisório) | Definir e validar cartões específicos do BOPE por subunidade |
| Cavalaria | Serviços; pessoas abordadas; policiamento montado; eventos/operações | `cavalaria_servicos_produtividade` |
| CIPA | Ocorrências/PPEs; animais envolvidos; área embargada (ha); multas (R$) | RPC territorial; soma `cipa_fauna.quantidade` por `data_registro`; `cipa_termos_embargo.area_embargada_ha` por `data_embargo`; `cipa_autos_infracao.valor_multa` por `data_autuacao` |
| CIPG | Relatórios de serviço; entradas hospitalares de PM; serviços sem alteração; empregos de efetivo | `cipg_servicos_guarda` e `cipg_eventos_guarda`; efetivo é soma de empregos, não policiais únicos |
| CIPTUR | Ocorrências; conduções; autos de infração; autos com indicação de remoção | RPC territorial e `ciptur_autos_infracao`; distinguir remoções de autos dos BOs |
| GIRO | Ocorrências; conduções; abordagens; pessoas abordadas | RPC territorial e `giro_abordagens`; pessoas abordadas podem ser maiores que abordagens registradas |

**Atenção:** a linha CIPTUR refere-se a **autos marcados com remoção**, não necessariamente a veículos removidos distintos. Esta tabela é o levantamento inicial baseado no código; não representa homologação dos números e regras. O BOPE necessita definição de KPIs mais especializados. Os cartões da visão rápida do CPC foram adaptados na ramificação de refinamento para as cinco unidades especializadas; BOPE ainda usa indicadores policiais genéricos. Fase 3 implementada parcialmente, mas não homologada.

## Auditoria quantitativa preliminar — 12/10/2026

Consultas SQL **somente leitura**, sobre o banco de produção, não executam exclusões ou correções automáticas:

- Total de ocorrências: **4.602**; sem unidade: **0**; sem data: **0**; sem número de BO: **0**.
- Ocorrências sem ao menos uma coordenada: **3.883**. Esses registros continuam participando das estatísticas tabulares, mas não geram pontos no mapa.
- Verificação exploratória por unidade + número de BO, sem considerar ano: **18 grupos**, **19 registros excedentes**. Ao refinar a regra para **unidade + ano da ocorrência + número de BO**, o resultado caiu para **3 grupos** e **3 registros excedentes**. **Todos permanecem pendências potenciais**, não duplicidades confirmadas.
- Abordagens GIRO: **6**, nenhuma sem coordenadas ou quantidade de pessoas.
- Recomenda-se revisão documental das 3 coincidências por unidade/ano/BO e orientação gradual para registro de coordenadas; não apagar, unir nem recadastrar automaticamente.

## Progresso da ramificação de validação — 12/10/2026

As alterações da **Fase 3 (cartões CPC), Fase 4 (mapa), Fase 5 (seção de indicadores executivos), Fase 6 (PDFs CIPG e Cavalaria)** e Fase 7 (auditoria paginada) foram **implementadas na ramificação de trabalho** `refinamento-cpc-20261012-indicadores-mapa`. As marcações [x] significam **implementação/revisão de código**, NÃO homologação institucional. A publicação em `main` depende de integração e testes automáticos.

**Pendências humanas não elimináveis por código:** homologação com sessões autenticadas de cada unidade, amostras de cadernos/PPEs e serviços ainda não cadastrados, definição de veículos únicos efetivamente removidos, revisão de possíveis duplicidades e validação visual dos PDFs em impressão real.

## Série temporal especializada da Central Executiva — 12/10/2026

- [x] Incorporar a data de origem aos datasets especializados usados no CPC, preservando o contrato de cálculo (CIPA: `data_registro`, CIPG/Cavalaria: `data_servico`, CIPTUR: `data_infracao`, GIRO: `registrado_em` em Boa Vista).
- [x] Construir uma série de evolução **independente por unidade**, por dia (período curto) ou mês (período longo). A série da CIPA representa animais registrados, a da CIPG serviços, a da Cavalaria serviços, a da CIPTUR autos e a do GIRO abordagens. **Não comparar diretamente unidades de medida distintas**.
- [x] Cobrir por testes de regressão períodos vazios, fuso de Roraima, dias sem atividade, séries mensais e erros versus zero (`tests/cpc-series-especializadas.test.cjs`).
- [ ] Validar as séries no navegador CPC e amostras de dados por perfil, principalmente CIPA/CIPG/Cavalaria sem registros na base em 12/10/2026.

## Registro de progresso

- **12/10/2026:** fases e contratos documentados; complementada a padronização de CIPA e CIPG.
- **12/10/2026:** Fase 2 iniciada: conferidas as consultas e fórmulas de CIPA/CIPG no código; protegidas as cinco consultas básicas da visão rápida contra apresentação de zero em caso de falha. Falta testar com dados reais e concluir as demais unidades.
- **12/10/2026:** revisão estática dos cálculos dos cartões GIRO, Cavalaria e CIPTUR; corrigidos limites de data/hora das abordagens GIRO para o fuso UTC-04:00. Não foram feitas mudanças no banco de dados.
- **12/10/2026:** corrigida paginação dos indicadores mensais especializados na home (`index.html`) e da lista de eventos da CIPG (`cipg-home.js`). Testes simulados verificaram 2.205 registros em três páginas e 1.375 eventos em duas páginas, além de propagação de erro.
- **12/10/2026:** consulta SQL de validação (somente leitura): GIRO 6 abordagens/6 pessoas e CIPTUR 28 A.I./8 autos com remoção em 01–12/10/2026. CIPA, CIPG e Cavalaria sem registros nas tabelas especializadas na data da verificação. Oito autos com remoção não demonstram oito veículos únicos.
- **12/10/2026:** descrição do quarto indicador da CIPTUR alterada para "Autos com remoção", incluindo comparativo e resumo; a unidade ainda deve confirmar método de apuração de veículos efetivamente removidos.
- **12/10/2026:** verificação de RLS habilitado nas oito tabelas especializadas: políticas SELECT vinculam registros às unidades acessíveis, inclusive via ocorrência (CIPA) e serviço de guarda (CIPG). Não houve simulação de autenticação real.
- **12/10/2026:** fórmulas CIPA/CIPG centralizadas em `indicadores(...)`, com reuso no painel da unidade e preparação para a fase de consolidação CPC; datas de referência explicitadas; arquivo de testes de regressão criado e cenários testados com interpretação JavaScript isolada.
- **12/10/2026:** PR #68 integrado ao main com CI aprovado. A ramificação posterior implementa mini-séries especializadas do dashboard executivo, com indicadores e datas por unidade.
- **Próximo trabalho:** validar os números e consultas sob sessões autenticadas de cada unidade (incluindo permissões e filtros); reunir amostras reais de CIPA/CIPG/Cavalaria; prosseguir com contratos estatísticos para GIRO/Cavalaria/CIPTUR antes da consolidação CPC.
