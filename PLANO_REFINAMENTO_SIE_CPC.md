# Plano de refinamento do SIE-CPC

**Versão:** 3.3 — 14/10/2026  
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
- [x] Revisar títulos e descrições de todas as páginas HTML e scripts JS de nível raiz para consistência: panoramas estatísticos corrigidos, inclusive `painel-tv.html`; manter "operacional" ao descrever atividade efetivamente operacional.
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
- [ ] Homologar legibilidade, desempenho, expansão dos grupos e visualização dos popups em computador/celular. Os brasões agora aparecem **apenas no popup**, os pontos são círculos de **12 px** e a sigla aparece somente no zoom elevado.
- [x] Implementar camada opcional **Abordagens GIRO** desmarcada por padrão no mapa CPC, com modos "ocorrências", "abordagens", "ambos" e consulta autorizada e paginada.
- [x] Separar rigidamente as visualizações em **Agrupamento automático (padrão CPC)**, **Pontos por unidade** e **Mapa de calor limpo (sem pontos/brasões)** nos mapas resumido e completo.
- [x] Implementar clusterização com Leaflet.markercluster (com fallback), expansão ao clicar, contadores em clusters, distinção visual de grupos mistos e sigla em zoom alto.
- [x] Exibir brasão apenas no popup de identificação da ocorrência, com natureza, BO, local e data; manter a mini-marca discreta (12 px) no mapa.
- [x] Incluir contadores na legenda conforme filtros, botão para filtrar unidade e exportação CSV limitada à área e aos filtros visíveis em ambos os mapas.
- [x] Criar regressões de simbologia, legenda, agrupamento e modo calor (`tests/mapa-cpc-profissional.test.cjs`); adaptar teste da CIPTUR para verificar escudo no popup.

- [ ] Homologar integralmente filtros territoriais, unidades, data/hora, geolocalização e segurança com perfil CPC real; exportação CSV da área visível, legenda dinâmica e agrupamento já implementados e cobertos por testes de contrato.
**Aceite:** o mapa CPC distingue unidades e, ao ativar o filtro, exibe apenas abordagens reais do GIRO; mapas individuais seguem intactos.

### Fase 4B — Padronização cartográfica das unidades (expansão solicitada)

**Escopo implementado no código:** os mapas `index.html` (panorama individual), `mapa-criminal.html` (mapa analítico) e `mapa-tv.html` (TV do 2º BPM) reutilizam o núcleo profissional. A cartografia do CPC mantém a identificação por **unidade responsável**, enquanto os mapas individuais passam a mostrar **natureza/atividade** por cor.

- [x] Extrair o componente temático reutilizável `mapa-unidade-profissional.js`, aproveitando o núcleo Leaflet/MarkerCluster e os estilos já aplicados no CPC.
- [x] Aplicar aos mapas individuais do **1º BPM** e do **2º BPM** (natureza da ocorrência; agrupamento, pontos e calor).
- [x] Aplicar ao mapa individual do **BOPE**, preservando a fonte territorial já autorizada e o popup por natureza.
- [x] Aplicar ao mapa individual do **GIRO**, incluindo ocorrências e abordagens, com categorias discretas por tipo de abordagem.
- [x] Aplicar ao mapa individual da **CIPTUR** para ocorrências georreferenciadas por natureza. **Autos de infração/remoções não ganham marcador sem coordenada de origem.**
- [x] Aplicar ao mapa individual da **CIPA** para ocorrências ambientais georreferenciadas, diferenciando fauna, embargo e fiscalização **quando esses atributos estiverem no registro**.
- [x] Aplicar ao mapa de **Cavalaria** para registros de ocorrência georreferenciados. **Serviços/eventos do cadastro especializado não possuem lat/long na fonte e não foram convertidos artificialmente em pontos.**
- [x] Reutilizar o estilo no mapa analítico das unidades, incluindo a **CIPG** para eventuais registros autorizados com coordenadas; o panorama CIPG continua sem mapa de postos/serviços por ausência de coordenadas nos registros de guarda.
- [x] Adaptar o mapa de TV do 2º BPM com agrupamento temático e marcadores discretos, mantendo atualização automática.
- [x] Incluir testes de regressão de cores por natureza, tipos de abordagem, agrupamento, ponto de 12px, calor sem pontos, identificação no popup e exportação.
- [ ] Verificar os mapas com sessões reais de **cada unidade** (desktop, celular, RLS), checar filtro por período/natureza/bairro e exportação CSV; não declarar homologação sem esses testes.
- [ ] Habilitar futuramente camadas geográficas de **serviços de Cavalaria, CIPG, autuações CIPTUR e embargos CIPA**, caso cada tipo de cadastro passe a armazenar coordenadas confiáveis ou geometrias e receba autorização específica.

**Aceite parcial:** código compartilhado, regras estatísticas preservadas e testes automatizados aprovados. A homologação visual e as fontes especializadas sem localização continuam pendentes.

### Fase 5 — Dashboard completo, consultas e séries temporais
- [x] Acrescentar no `dashboard-cpc.html` bloco de quatro indicadores específicos por unidade e manter seletor de unidade existente, com mesmas regras de cálculo da visão rápida.
- [x] Preservar visão transversal e permitir aprofundamento (drill-down) dos cartões por unidade, com **documento/ID, fonte de origem, data de referência, medida e exportação CSV** dos registros autorizados; histórico mostrado em lista limitada a 30 linhas e CSV completo.
- [ ] Integrar plenamente produtividade, fiscalizações, serviços, abordagens, distribuição espacial e séries temporais (mini-séries por unidade especializada implementadas; gráficos analíticos/exportações comparativas e homologação ainda pendentes).
- [ ] Conferir período e critérios estatísticos em todas as consultas, rankings e gráficos (série de abordagens GIRO do CPC corrigida para o dia UTC−04 e testes de trilha documental incluídos; **filtro anual CPC: timeout identificado, otimização SQL e tratamento visual implementados; homologação autenticada pendente**).
**Aceite:** os valores e detalhes conciliam entre visão rápida, dashboard e bases; filtros não vazam dados.

- [x] Disponibilizar `cpc-rastreabilidade.js`, unificando a trilha verificável dos registros especializados: **CIPA** (fauna, embargo, multas), **CIPG** (serviços e eventos), **Cavalaria** (serviços), **CIPTUR** (autos) e **GIRO** (abordagens), além de BO e TCO por unidade.
- [x] Acrescentar os campos de identificação documental às consultas especializadas do CPC, preservando os critérios estatísticos, as fontes e as políticas RLS existentes.
- [x] Evitar exibição de zero falso e preservar os BOs/TCOs da unidade quando uma consulta especializada falhar; marcar trilha parcial.
- [x] Corrigir a série temporal de abordagens GIRO da Central Executiva para o **dia civil de Boa Vista (UTC−04)**, eliminando troca indevida de dia perto da meia-noite UTC.
- [x] Proteger exportação CSV contra valores interpretáveis como fórmulas por programas de planilha; incluir regressões automatizadas das fontes e períodos em `tests/cpc-rastreabilidade.test.cjs`.
- [ ] Conciliar em navegador e com amostras documentais as trilhas com PDFs e indicadores de cada unidade; a aplicação automática de filtros adicionais de natureza, turno, companhia e território nas fontes especializadas ainda depende de contrato específico.


- [x] Refatorar após inspeção em navegador a conferência dos documentos no CPC: os cartões não devem conter tabelas longas em colunas estreitas; abrir painel de largura completa abaixo dos KPIs com **pesquisa, seleção de fonte, paginação de 12 registros, metadados e CSV do conjunto filtrado**.
- [x] Acrescentar regressões de 33 registros, navegação entre páginas, pesquisa tolerante a acentos, filtro por fonte, exportação integral do filtro, proteção contra HTML inserido e limpeza de consulta ao alterar escopo.
- [ ] Revalidar visualmente a versão ampliada no navegador autenticado, em desktop e celular, inclusive com registros de CIPTUR, GIRO e CIPA (captura anterior confirmou dados presentes, mas revelou tabelas excessivamente estreitas).


### Fase 6 — Relatórios PDF
- [ ] Homologar modelo personalizado para todas as unidades. CIPA/GIRO/CIPTUR/2º BPM e CIPG/Cavalaria possuem versões próprias; BOPE e 1º BPM agora têm anexos específicos e filtros institucionais, mas ainda precisam de amostras e conferência visual de PDF.
- [ ] Incluir metodologia (origem, período, data de referência e critérios), gráficos, tabelas e resultados sem duplicações.
- [ ] Ajustar e homologar paginação A4, cabeçalho, numeração e legibilidade; validar impressão/download em navegadores e telefones (paginação de CONSULTAS de dados dos PDFs GIRO/CIPTUR corrigida, testes visuais pendentes).
- [ ] Comparar amostras de diferentes períodos com os indicadores de tela.
- [x] Criar relatórios por fontes próprias para **CIPG (livro de guarda)** e **Cavalaria (produtividade dos serviços)**, com metodologia, comparativos e tratamento de períodos sem registros.
- [x] Impedir truncamento silencioso de consultas dos relatórios **GIRO** e **CIPTUR** (paginação), corrigindo o termo da CIPTUR para **autos com indicação de remoção**, sem afirmar veículos distintos.
- [ ] Testar visualmente a impressão A4 dos relatórios CIPG/Cavalaria e conferir seus valores com dados reais e responsáveis.
**Aceite:** PDF fiel aos mesmos filtros/dados e às especificidades da unidade; conferência por amostragem registrada.

- [x] Habilitar no relatório PDF **BOPE** o seletor de subunidades oficiais `FORCA_TATICA`, `CHOQUE`, `CANIL`, `GATE`, com filtros aplicados tanto aos BOs quanto aos TCOs vinculados; a procedência foi verificada nas consultas territoriais do banco.
- [x] Incluir anexo técnico do BOPE com ocorrências por subunidade, campo para registros não classificados e total conciliável, sem alocar automaticamente ocorrências sem vínculo.
- [x] Incluir anexo técnico do 1º BPM com distribuição por SISC e companhia, esclarecendo que são **duas leituras dos mesmos registros**, e não valores para somar.
- [x] Retirar dos PDFs genéricos a referência fixa a **PR6 e VTR AME** nas ações preventivas, usando título compatível com a fonte real; retirar a indicação fixa **Tático Setorial — Área Oeste** dos relatórios não pertencentes ao 2º BPM.
- [x] Impedir PDF genérico aparentemente completo quando falharem consultas comparativas, TCOs ou atividades preventivas; exibir erro explícito, sem substituir falha por zero silenciosamente.
- [x] Cobrir escopo e semântica dos anexos em `tests/relatorio-bope-1bpm-especifico.test.cjs`, com testes de subunidade e filtros territoriais.
- [ ] Homologar visualmente A4, numeração, recortes com mais de uma página e conciliar os resultados com documentos representativos das duas unidades.


### Fase 7 — Auditoria e integridade
- [ ] Identificar e homologar duplicações, registros incompletos, problemas de classificação, datas inconsistentes e eventuais erros geográficos (levantamento inicial e indicador de suspeita implementados, triagem humana pendente).
- [ ] Criar trilha completa de divergências e validação documental, sem corrigir silenciosamente o banco (auditoria passa a sinalizar BO potencialmente repetido dentro da mesma unidade e ano).
- [ ] Verificar acessos e consultas com **usuários de perfis reais**; auditoria de RLS no esquema já efetuada, mas não equivale a homologação de sessão.
**Aceite:** relatório de divergências reproduzível, sem perda de dados.

- [x] Criar relatório de divergências **exportável em CSV** sem dados pessoais, com ID do registro, unidade, BO, data, tipo, descrição, gravidade e origem do levantamento; respeitar período/filtro de severidade.
- [x] Identificar todos os registros de **grupos de possível repetição de BO** por unidade/ano/número em vez de sinalizar somente o segundo registro; esclarecer que são suspeitas e não duplicidades confirmadas.
- [x] Acrescentar alertas de coordenadas numéricas fora dos limites aproximados de Roraima e de datas de ocorrência futuras no dia civil UTC−04, sem corrigir automaticamente.
- [x] Adicionar regressão `tests/auditoria-exportacao.test.cjs` cobrindo rastreabilidade, filtro de severidade, segurança CSV e regras geográficas.
- [ ] Homologar as divergências com as unidades mediante comparação dos documentos originais; qualquer correção demanda revisão humana e autorização.


### Fase 8 — Homologação e entrega
- [ ] Testar todas as unidades, perfis, browsers, celular, tablets e PDFs.
- [ ] Testes de regressão e desempenho por intervalo curto e longo.
- [ ] Registrar aprovação por unidade, versão publicada e instruções operacionais.
- [x] Criar o documento `HOMOLOGACAO_SIE_CPC_2026.md` com matriz de aceite do CPC e oito unidades, roteiros de amostra, permissões, mapas, PDFs, compatibilidade e registro de divergências.
- [x] Adicionar pré-homologação estática automatizada de recursos locais, scripts embutidos e oito contratos de unidade (`tests/prehomologacao-recursos.test.cjs`), integrada à suíte CI.
- [ ] Confirmar execução e cobertura da suíte após integração; homologar perfis e dados reais antes de declarar a fase concluída.
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

## Revisão de cartografia CPC — 12/10/2026

**Solicitação do Comando:** reduzir drasticamente a poluição visual dos escudos, manter identificação por unidade e aproximar a interface de mapas de geointeligência.

- Agrupamento automático por proximidade como modo inicial do CPC, cor da unidade para grupos homogêneos e tom neutro para grupos mistos.
- Pontos coloridos compactos (12 px) e siglas apenas em zoom alto; mini-brasão transferido para popup com dados estatísticos.
- Mapa de calor isolado, sem pontos sobrepostos; legenda contextual (concentração vs. unidades, com totais).
- Preservados filtros existentes; camada de abordagens GIRO opcional; exportação CSV dos registros georreferenciados **visíveis no enquadramento**, respeitando os filtros.
- Biblioteca de clusterização com fallback para pontos simples em caso de indisponibilidade; ambos os mapas compartilham a mesma simbologia.
- Pendências: testes reais de usabilidade, impressão/captura do mapa, eventuais limites de exportação e verificação da densidade em grandes períodos.

## Expansão dos mapas individuais — 12/10/2026

- Mesmo padrão profissional para os mapas disponíveis das unidades: clusterização por natureza/atividade, símbolos discretos, calor isolado e brasão no popup.
- Respeitadas as fontes de dados e limites espaciais do cadastro. Não gerar coordenadas a partir de texto livre ou do endereço de uma instituição sem georreferenciamento validado.
- `mapa-tv.html` atualizado para o 2º BPM. Testes de código não equivalem à validação em produção por unidade.

## Fase 5 — rastreabilidade dos indicadores executivos (12/10/2026)

- No **Dashboard Geral do CPC**, cada cartão de unidade passa a disponibilizar a opção **Conferir registros de origem**: as fontes autorizadas são listadas com data, referência documental/ID, critério temporal e quantidade de medida, sem exibir dados pessoais sensíveis.
- A fonte CIPA distingue separadamente `cipa_fauna`, `cipa_termos_embargo` e `cipa_autos_infracao` para não somar animais, hectares e reais como se fossem ocorrências. A CIPG distingue eventos de serviços; a CIPTUR identifica autos com remoção indicada sem afirmá-los como veículos efetivamente removidos.
- O CSV da trilha exporta todos os registros retornados pelas fontes autorizadas, mesmo quando a prévia de tela mostra no máximo 30 registros, com proteção contra fórmulas.
- A série de abordagens GIRO no dashboard completo passa a usar o dia de Boa Vista (UTC−04), coerente com o cadastro e a visão mensal.
- **Homologação pendente:** conferência visual, testes com sessões reais e confronto documental, inclusive quando houver filtros territoriais/criminais que não se aplicam à fonte especializada.

## Fase 6 — compatibilidade de relatórios BOPE e 1º BPM (12/10/2026)

- BOPE: filtro de Força Tática, Choque, Canil e GATE passou a ser exibido; contagens derivadas de `subunidade_operacional_sigla` que já integra as RPCs territoriais. São preservados registros sem classificação em grupo próprio.
- 1º BPM: anexo de SISC/companhia não confunde divisão territorial com volume adicional de produção.
- Relatórios genéricos: título de prevenção deixou de fazer referência fixa a programas de outra unidade; ocorrências de Tático Setorial ficam identificadas apenas onde o campo estiver configurado para o tipo de relatório.
- Consulta incompleta ou erro de RPC não é mascarado como `0` no PDF. **Sem edição de dados originais no banco**.
- Ainda pendem conferência por perfis reais, amostras históricas e inspeção visual do PDF em A4.

## Fase 7 — exportação de auditoria e suspeitas reproduzíveis (12/10/2026)

- A auditoria gera CSV com campos reproduzíveis e metadados do período/fonte RLS, sem nomes de pessoas ou dados de saúde.
- Se dois ou mais registros coincidirem em unidade, ano e número de BO, **todos os envolvidos** são sinalizados para conferência; não há fusão nem exclusão automática.
- Coordenadas geográficas fora de uma faixa ampla que cobre Roraima e datas futuras em UTC−04 são destacadas, sem inferir localização verdadeira ou invalidar registros sem conferência.
- A interface mantém a ação manual de corrigir com o operador, mas a exportação apenas lê o escopo já autorizado.
- A avaliação de regras em JavaScript é automatizável; a homologação documental e o teste com sessões reais são pendências institucionais.

## Fase 8 — preparação de homologação (12/10/2026)

- Criado [Roteiro de Homologação Institucional 2026](HOMOLOGACAO_SIE_CPC_2026.md), com critérios de aceite, evidências e responsáveis por unidade; **todas as aprovações permanecem pendentes**.
- Adicionado teste estático das páginas centrais, scripts, brasões e links locais ao GitHub Actions; isso não substitui acesso autenticado ou inspeção de PDF A4.
- Encerramento condicionado a testes reais do CPC e das unidades subordinadas, inclusive registros de CIPA, CIPG e Cavalaria quando disponíveis.

## Fase 5 — revisão visual da rastreabilidade CPC (12/10/2026)

- **Evidência recebida:** captura do dashboard executivo autenticado no CPC, período 1º a 12/10/2026. Mostrou os quatro indicadores por unidade e abertura da opção *Conferir registros de origem* para unidades com dados.
- **Problema visual constatado:** tabela de origem embutida em cartões estreitos; longas listas comprimiam colunas e esticavam desnecessariamente a altura dos cartões.
- **Correção implementada:** conferência documental movida para seção independente na largura do dashboard, com tabela de seis colunas, busca por BO/natureza/data, filtro por fonte, navegação em páginas de 12 linhas e exportação de todos os registros filtrados. Cartões permanecem resumidos.
- **Limite do aceite:** a captura comprova a renderização inicial e presença de registros, mas não a conciliação com documentação de origem nem a responsividade da nova seção; exigem nova validação.

## Fase 5 / Fase 7 — inspeção da conferência documental CIPTUR (12/10/2026)

- [x] **Validação visual parcial** do Dashboard CPC, registrada por novas capturas com todos os cartões e painel de registros de origem aberto, pesquisa/colunas e paginação legíveis. Continuidade de testes em celular, filtros, exportação e fidelidade ao documento original permanece pendente.
- [x] Confirmar por consulta SQL **somente leitura** o período 01–12/10/2026: 28 linhas diferentes na tabela `ciptur_autos_infracao`, com 28 IDs únicos e somente 5 valores diferentes de `codigo_infracao`. A conferência exibe 81 linhas (53 ocorrências policiais + 28 autos), sem que isso represente 81 ocorrências.
- [x] Corrigir interpretação do campo `codigo_infracao`: **não é número identificador de auto**; a consulta da fonte não dispõe de número individual de AIT. A coluna de identificação passa a usar o UUID próprio de cada cadastro, enquanto o código de infração permanece na descrição, preservando os 28 autos e as 53 ocorrências e sem alteração do banco.
- [x] Adicionar explicação contextual ao conferir a CIPTUR e testes para dois autos distintos com o mesmo código, diferenciando corretamente repetição de enquadramento e repetição do mesmo documento.
- [ ] Verificar com o operador da CIPTUR se existe um número de AIT/PDF que precise ser cadastrado de forma específica no futuro, separado de `codigo_infracao`; não atribuir o UUID como se fosse o número oficial do AIT.

## Fase 5 — correção do filtro anual e prevenção de dados antigos (12/10/2026)

- [x] Confirmar que o banco contém **1.649 ocorrências do 1º BPM e 1.883 do 2º BPM** entre 01/01 e 12/10/2026; a Central Executiva não pode permanecer com 1 e 33 (somente outubro).
- [x] Diagnosticar captura de erro: `canceling statement due to statement timeout` ao filtrar o ano. Os 88 registros vistos na tela eram os últimos resultados carregados, **não o total anual**.
- [x] Conferir que a RPC `obter_painel_cpc_territorial` recebe datas, unidade, AISC, SISC, setor, natureza, bairro, companhia e turno e que o SQL aplica esses filtros. Não equivale a testes de todas as combinações autenticadas.
- [x] Testar consulta territorial original e otimizada por bairro em leitura: **3.598 ocorrências no ano, zero divergências de informações territoriais**; plano de execução comparativo: aproximadamente **441 ms contra 19 ms** para agregação territorial isolada.
- [x] Preparar migração reversível para materializar a correspondência territorial por bairro, reutilizada em BOs e TCOs; sem modificar registros, contagens, RLS ou permissões.
- [x] Atualizar interface para ocultar cartões/gráficos da consulta anterior em caso de timeout ou datas inválidas, exibir erro e confirmar período consultado; preservar proteção contra respostas assíncronas fora de ordem.
- [x] Criar teste de regressão para consultas simultâneas, falha, intervalo inválido, cache territorial e encaminhamento conjunto de todos os dez parâmetros de filtro à RPC (sem substituir homologação no navegador).
- [x] Aplicar migração no Supabase de produção e verificar por SQL a presença dos dois joins com cache, segurança invoker e permissões (authenticated=true, anon=false). **Consulta autenticada do período anual ainda pendente.**
- [ ] Validar a resposta da RPC em sessão CPC autenticada para o ano completo (1º BPM 1.649; 2º BPM 1.883; total 3.598 no banco em 01/01–12/10/2026).
- [ ] Homologar os filtros combinados (unidade, AISC/SISC/setor, turno, companhia, natureza, bairro), inclusive com registros especializados e RLS de perfis reais.

## Fase 5 — indicadores por unidade após filtro anual (12/10/2026)

- [x] Captura autenticada confirmou **3.598 BOs** carregados no Painel CPC, sem timeout no resumo geral.
- [x] Identificada segunda consulta independente: `cpc-indicadores-dashboard.js` chama `obter_home_cpc_territorial`, que ainda calculava `territorio_por_bairro` para cada BO do ano, sem reutilizar a otimização do painel principal.
- [x] Migração SQL da RPC secundária **aplicada no Supabase de produção**, materializando o JSON autorizado e resolvendo território apenas por bairro distinto, sem alterar registros ou permissões. Equivalência de 3.598 ocorrências: **zero divergências**; teste isolado do plano territorial: **609 ms → 26 ms**, sujeito a cache/carga. Pós-aplicação: SECURITY INVOKER preservado, authenticated=true, anon=false.
- [x] Atualizada a nota dos indicadores especializados ao **iniciar** cada consulta; falhas exibem período solicitado e erro/timeout, sem manter a data de um filtro anterior.
- [x] Adicionada versão do script para atualização do cache e teste automatizado de sucesso, timeout, falta de autorização, erro de rede e consultas concorrentes.
- [ ] Homologar no navegador autenticado o carregamento anual de todos os cartões especializados e suas trilhas documentais; checar a consistência de filtros combinados e permissões.

### Alerta de qualidade — veículos recuperados no 1º BPM

- [ ] Auditar 11 ocorrências do 1º BPM com `veiculos_recuperados >= 100` no intervalo 01/01–12/10/2026; **somam 2.515** dos **2.537** veículos exibidos pelo CPC. Uma ocorrência está registrada com **1.000 veículos**. Suspeita de importação/mapeamento, não é duplicidade ou erro confirmado.
- [ ] Conferir os documentos e a planilha histórica de origem antes de qualquer alteração. **Não houve correção automática dos valores.**

## Fase de refinamento — navegação executiva CPC somente leitura (13/10/2026)

- [x] Tornar os quatro indicadores de cada cartão subordinado clicáveis e acessíveis (botões com rótulos e foco visível).
- [x] Filtrar a conferência de registros de origem pelo indicador selecionado, mantendo pesquisa, paginação, período e exportação CSV.
- [x] Separar **quantidade de documentos contribuintes** da **medida agregada** (animais, hectares, multas, conduções, veículos, efetivo).
- [x] Reutilizar exclusivamente os dados autorizados já carregados, sem operações de escrita; alinhar regras de serviço sem alteração e entrada hospitalar à CIPG.
- [ ] Abrir BO, relato/histórico e anexos originais em visualizador autenticado, quando existentes; não presumir acesso ao documento a partir do número.
- [ ] Implementar e testar permissões CPC somente leitura também no banco/storage, incluindo bloqueio de inserção, atualização e exclusão em todas as fontes.
- [ ] Homologar visualmente todos os indicadores por unidade e a correspondência entre cada indicador e os registros exibidos.

## Integração do Painel Estatístico do CPC — fase 1 (14/10/2026)

- [x] Adotar `dashboard-cpc.html` como **Painel Estatístico Integrado do CPC**, mantendo os dashboards operacionais das unidades independentes.
- [x] Usar o filtro existente de **unidade**, inclusive unidades subordinadas e agrupamentos hierárquicos, com período, AISC, SISC, setor, natureza, bairro, companhia e turno.
- [x] Incorporar análises do Dashboard Completo ao CPC: perfis agregados de vítimas e infratores (sexo, nacionalidade, idade), ocorrências por comandante de viatura, produtividade (conduções, veículos, foragidos), apreensões de armas e munições, incidência de drogas e bens subtraídos.
- [x] Disponibilizar comparação opcional entre períodos, com mesma unidade e filtros, sem obrigar consulta histórica em cada carregamento.
- [x] Permitir clicar nas quantidades/categorias analíticas e abrir a conferência de BOs de origem com visualizador somente leitura.
- [x] Implementar **consulta aprofundada sob demanda**, para não repetir automaticamente as RPCs de detalhe em períodos longos.
- [x] Exibir alerta quando o número de BOs da consulta detalhada divergir do resumo consolidado, evitando apresentar totais incompatíveis como equivalentes.
- [x] Eliminar o atalho duplicado do Dashboard Completo na navegação do contexto CPC, preservando-o para usuários operacionais e mantendo `dashboard.html` acessível como módulo legado.
- [ ] Homologar os filtros, perfis e comparativos em sessão autenticada do CPC com dados reais; confrontar totais com as fontes oficiais.
- [ ] Validar diferenças entre os contratos de filtro de `obter_painel_cpc_territorial` e `obter_dados_dashboard_territorial` e aprimorar quando necessário.
- [ ] Integrar em fase posterior gráficos analíticos adicionais (se forem necessários após a homologação), preservando o desempenho anual.
- [ ] Após homologação, decidir sobre o redirecionamento de links antigos do CPC ao painel integrado sem afetar as unidades.

## Correção de usabilidade — Dashboard Completo CPC (14/10/2026)

- [x] Identificar a tela exata relatada: `dashboard.html`, com detalhamento de 149 BOs em 01/10/2026–14/10/2026; a coluna Referência estava em texto e o link "Ver ocorrência" abria `consulta.html` operacional.
- [x] Tornar o número de BO da coluna Referência um botão clicável no contexto CPC, sem navegar à consulta operacional.
- [x] Abrir o cadastro completo e histórico no visualizador CPC autenticado, sem TCO, edição ou exclusão.
- [x] Ocultar a coluna Ação e o atalho "Abrir esta lista em Ocorrências" no contexto CPC somente leitura; manter fluxo legado das unidades operacionais.
- [x] Usar `<dialog>` nativo para o visualizador aparecer sobre o diálogo de lista, sem perder a posição dos 149 registros.
- [x] Preservar o UUID próprio do TCO ao gerar lista mista de documentos, permitindo consultar o TCO correto e abrir seu BO vinculado.
- [ ] Homologar no navegador autenticado CPC o clique em números de BO reais e confirmar que o histórico é exibido, sem controles operacionais.

## Fase de refinamento — visualizador documental CPC (14/10/2026)

- [x] Inspecionada a RPC `obter_ocorrencia_publica`: SECURITY INVOKER, retorna o cadastro completo, incluindo `historico_resumido`, `detalhes` e observações; aplica RLS de `ocorrencias`.
- [x] Vincular as linhas da conferência estatística aos UUIDs de origem, com tabela permitida e vínculo ao BO ou serviço quando existente.
- [x] Implementar visualizador somente leitura para BO, TCO, fauna, autos e embargos da CIPA, serviços e eventos CIPG, serviços da Cavalaria, autos CIPTUR e abordagens GIRO.
- [x] Permitir abrir o BO/serviço vinculado, quando houver referência, sempre por nova consulta autenticada sujeita a RLS.
- [x] Exigir contexto ativo `COMANDO`, `somente_leitura_operacional=true` e módulo `PAINEL_CPC` antes de consultar documento.
- [x] Exibir histórico e campos complementares sem executar HTML fornecido pelo cadastro; não implementar operações de escrita ou links de edição.
- [x] Fechar automaticamente o documento aberto quando período, filtros ou escopo da conferência mudarem, impedindo a permanência de dados de consulta anterior; preservar foco ao abrir BO vinculado.
- [x] Verificar metadados do Storage: **não existe bucket privado de PDFs de BO** neste momento. O visualizador exibe dados salvos; não inventa anexos ou URLs para arquivos originais.
- [ ] Homologar em sessão CPC autenticada a abertura real dos documentos, a correspondência dos UUIDs e os vínculos entre registros de todas as unidades.
- [x] Auditar a política de INSERT compartilhado de `giro_abordagens`: identificada exceção ao bloqueio de escrita em contexto `COMANDO`.
- [x] Preparar migração e rollback para negar INSERT compartilhado do GIRO em contexto `COMANDO`, preservando a regra original para acessos GIRO autorizados, inclusive usuários sem unidade principal.
- [x] Aplicar a migração no Supabase de produção e verificar predicado RLS final: `authenticated`, acesso GIRO compartilhado preservado e `COMANDO` bloqueado para INSERT; verificação lógica para `COMANDO` (false), unidade operacional (true) e sem unidade principal (true), condicionada às demais regras originais. **Teste de usuário real ainda pendente.**
- [ ] Testar negações de escrita com perfis reais CPC e operadores, sem executar exclusões destrutivas; auditar outras RPCs de escrita.
- [ ] Definir fluxo de armazenamento privado e autorização de PDFs originais, caso a unidade decida preservar os documentos enviados.

## Registro de progresso

- **12/10/2026:** fases e contratos documentados; complementada a padronização de CIPA e CIPG.
- **12/10/2026:** Fase 2 iniciada: conferidas as consultas e fórmulas de CIPA/CIPG no código; protegidas as cinco consultas básicas da visão rápida contra apresentação de zero em caso de falha. Falta testar com dados reais e concluir as demais unidades.
- **12/10/2026:** revisão estática dos cálculos dos cartões GIRO, Cavalaria e CIPTUR; corrigidos limites de data/hora das abordagens GIRO para o fuso UTC-04:00. Não foram feitas mudanças no banco de dados.
- **12/10/2026:** corrigida paginação dos indicadores mensais especializados na home (`index.html`) e da lista de eventos da CIPG (`cipg-home.js`). Testes simulados verificaram 2.205 registros em três páginas e 1.375 eventos em duas páginas, além de propagação de erro.
- **12/10/2026:** consulta SQL de validação (somente leitura): GIRO 6 abordagens/6 pessoas e CIPTUR 28 A.I./8 autos com remoção em 01–12/10/2026. CIPA, CIPG e Cavalaria sem registros nas tabelas especializadas na data da verificação. Oito autos com remoção não demonstram oito veículos únicos.
- **12/10/2026:** descrição do quarto indicador da CIPTUR alterada para "Autos com remoção", incluindo comparativo e resumo; a unidade ainda deve confirmar método de apuração de veículos efetivamente removidos.
- **12/10/2026:** verificação de RLS habilitado nas oito tabelas especializadas: políticas SELECT vinculam registros às unidades acessíveis, inclusive via ocorrência (CIPA) e serviço de guarda (CIPG). Não houve simulação de autenticação real.
- **12/10/2026:** fórmulas CIPA/CIPG centralizadas em `indicadores(...)`, com reuso no painel da unidade e preparação para a fase de consolidação CPC; datas de referência explicitadas; arquivo de testes de regressão criado e cenários testados com interpretação JavaScript isolada.
- **12/10/2026:** PR #68 integrado ao main com CI aprovado. PR #69 integrado ao main com CI aprovado, incluindo mini-séries especializadas de produtividade.
- **12/10/2026:** revisão de títulos e descrições em arquivos HTML/JS de nível raiz concluída; `painel-tv.html` padronizado para panorama estatístico.
- **Próximo trabalho:** validar os números e consultas sob sessões autenticadas de cada unidade (incluindo permissões e filtros); reunir amostras reais de CIPA/CIPG/Cavalaria; prosseguir com contratos estatísticos para GIRO/Cavalaria/CIPTUR antes da consolidação CPC.
