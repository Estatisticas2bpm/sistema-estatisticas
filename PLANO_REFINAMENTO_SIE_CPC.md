# Plano de refinamento do SIE-CPC

**Versão:** 1.2 — 12/10/2026  
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
- [ ] Revisar fonte, período, agregação e comparativo de cada um dos quatro cartões.
- [ ] Conferir CIPA e CIPG com seus próprios relatórios/cadernos; Cavalaria com serviços e atividades; CIPTUR com A.I. e remoções; GIRO com abordagens; BOPE e BPMs conforme suas naturezas.
- [ ] Rever estados de carregamento, ausência de dados e falhas (em andamento: corrigida a exibição indevida de zero quando consultas básicas da visão rápida falham; ainda faltam estados por módulo e testes).
**Aceite:** cartões e comparativos validados contra consultas aos registros, unidade a unidade.

### Fase 3 — "Unidades em números" no CPC
- [ ] Substituir o modelo homogêneo atual (ocorrências, conduções, TCOs, veículos) por quatro KPIs específicos por unidade.
- [ ] Criar serviço de agregação por unidade, com mesmo contrato da visão rápida; buscar fontes especializadas conforme cada tipo.
- [ ] Aplicar período único, comparações e hierarquia de unidades; preservar filtros e links para detalhes.
- [ ] Diferenciar "não disponível" de zero e registrar a origem dos números.
**Aceite:** para cada unidade, os quatro números do CPC coincidem com a visão rápida individual no mesmo período e escopo.

### Fase 4 — Mapa estatístico do CPC
- [ ] Alterar **somente no modo CPC** a simbologia principal de natureza da ocorrência para **unidade responsável**; manter filtros por natureza como atributos secundários.
- [ ] Usar uma cor por unidade e estudar mini-brasões como `divIcon`/ícones de mapa, com fallback simples e performance adequada.
- [ ] Adicionar camada opcional **Abordagens GIRO** desmarcada por padrão; permitir "ocorrências", "abordagens", "ambos".
- [ ] Harmonizar período, geolocalização, permissões, legenda, agrupamentos e exportação.
**Aceite:** o mapa CPC distingue unidades e, ao ativar o filtro, exibe apenas abordagens reais do GIRO; mapas individuais seguem intactos.

### Fase 5 — Dashboard completo, consultas e séries temporais
- [ ] Expor seletor de unidade no modo CPC e blocos especializados condicionais.
- [ ] Preservar visão transversal e permitir aprofundamento (drill-down) com registro fonte.
- [ ] Incluir produtividade, fiscalizações, serviços, abordagens, distribuição espacial e séries temporais onde couber.
- [ ] Conferir período e critérios estatísticos em consultas, rankings e gráficos.
**Aceite:** os valores e detalhes conciliam entre visão rápida, dashboard e bases; filtros não vazam dados.

### Fase 6 — Relatórios PDF
- [ ] Elaborar template por unidade, com identificação e seções próprias (não um PDF genérico).
- [ ] Incluir metodologia (origem, período, data de referência e critérios), gráficos, tabelas e resultados sem duplicações.
- [ ] Ajustar paginação A4, cabeçalho, numeração e legibilidade; validar download/impressão.
- [ ] Comparar amostras de diferentes períodos com os indicadores de tela.
**Aceite:** PDF fiel aos mesmos filtros/dados e às especificidades da unidade; conferência por amostragem registrada.

### Fase 7 — Auditoria e integridade
- [ ] Identificar duplicações, registros incompletos, problemas de classificação, datas inconsistentes e eventuais erros de georreferência.
- [ ] Criar trilha de divergências e validação documental, sem corrigir silenciosamente o banco.
- [ ] Verificar acessos e consultas por perfis.
**Aceite:** relatório de divergências reproduzível, sem perda de dados.

### Fase 8 — Homologação e entrega
- [ ] Testar todas as unidades, perfis, browsers, celular, tablets e PDFs.
- [ ] Testes de regressão e desempenho por intervalo curto e longo.
- [ ] Registrar aprovação por unidade, versão publicada e instruções operacionais.
**Aceite:** checklist assinado/confirmado pelos responsáveis e versão estável em produção.

## Acompanhamento de execução

**Legenda:** [x] implementado e conferido no código; [ ] pendente ou parcialmente executado. Implementação não equivale a homologação em navegador/banco.

- **Fase 1:** 3/5 itens implementados; dois itens aguardam revisão ampla e confirmação com unidades. Aceite pendente.
- **Fase 2:** em andamento; fontes e fórmulas inspecionadas para CIPA, CIPG, GIRO, Cavalaria e CIPTUR. Corrigida apresentação de zero por falha de consulta básica e delimitado o período das abordagens do GIRO pelo fuso de Roraima (UTC-04:00). Validação com registros reais ainda pendente.
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
| CIPTUR | Ocorrências; conduções; autos de infração; veículos removidos | RPC territorial e `ciptur_autos_infracao`; distinguir remoções de autos dos BOs |
| GIRO | Ocorrências; conduções; abordagens; pessoas abordadas | RPC territorial e `giro_abordagens`; pessoas abordadas podem ser maiores que abordagens registradas |

**Atenção:** esta tabela é o levantamento inicial baseado no código; não representa homologação dos números e regras. O BOPE necessita definição de KPIs mais especializados. O cartão do CPC atualmente usa modelo genérico para todas as unidades — fase 3 ainda não implementada.

## Registro de progresso

- **12/10/2026:** fases e contratos documentados; complementada a padronização de CIPA e CIPG.
- **12/10/2026:** Fase 2 iniciada: conferidas as consultas e fórmulas de CIPA/CIPG no código; protegidas as cinco consultas básicas da visão rápida contra apresentação de zero em caso de falha. Falta testar com dados reais e concluir as demais unidades.
- **12/10/2026:** revisão estática dos cálculos dos cartões GIRO, Cavalaria e CIPTUR; corrigidos limites de data/hora das abordagens GIRO para o fuso UTC-04:00. Não foram feitas mudanças no banco de dados.\n- **Próximo trabalho:** verificar paginação e cobertura de consultas especializadas, validar amostras reais de CIPA/CIPG/Cavalaria/CIPTUR/GIRO e conferir permissões e filtros por unidade.
