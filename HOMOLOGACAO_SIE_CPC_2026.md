# SIE-CPC — Roteiro de Homologação Institucional 2026

**Situação:** roteiro preparado; **homologação funcional com perfis reais NÃO realizada**.  
**Referência:** [Plano de Refinamento](PLANO_REFINAMENTO_SIE_CPC.md).  
**Ambiente de validação:** https://estatisticas2bpm.github.io/sistema-estatisticas/

## Princípios de aceite

1. **Uma fonte, uma regra:** números da visão mensal, do dashboard, da consulta e do PDF devem ser conciliáveis quando unidade, período e critério de data coincidirem. Registros de serviço não são contados automaticamente como BOs.
2. **Origem auditável:** divergências precisam apontar para ID/documento e a data de referência correta. Não transformar consulta que falhou em zero estatístico.
3. **Permissões efetivas:** um usuário de unidade não acessa registros de outra unidade; usuário autorizado do CPC pode consolidar a hierarquia.
4. **Georreferenciamento confiável:** não apresentar pontos de cadastros sem latitude/longitude comprovadas; mapas de calor não têm marcadores sobrepostos.
5. **PDF fiel:** manter cabeçalho/brasão correto, fontes/métodos, A4 legível, páginas enumeradas e quadros com a produtividade real da unidade.
6. **Nenhuma correção silenciosa:** ocorrência supostamente repetida, dado incompleto e geolocalização incorreta são encaminhados para conferência documental.

## Checklist transversal

| Verificação | Status | Evidência exigida |
|---|---|---|
| GitHub Actions passa testes de contrato e sintaxe | A confirmar no CI após integração | URL da execução e SHA |
| Recursos locais, scripts e brasões existentes | A confirmar no CI após integração | `tests/prehomologacao-recursos.test.cjs` |
| Login autenticado do CPC e das oito unidades | PENDENTE | Capturas de tela, sem senha |
| Indicadores mensal × dashboard × documentos | PENDENTE | Planilha de comparação por amostra |
| Perfis/RLS e impossibilidade de acessar outra unidade | PENDENTE | Evidências de acesso permitido/negado |
| Tablet e smartphone (360px, 768px), desktop (1440px) | PENDENTE | Captura de cada modo do mapa e dashboard |
| PDF A4 e pré-visualização de impressão | PENDENTE | Arquivo ou captura da prévia, sem corte |
| Volume grande, zero registros e falha de consulta | PENDENTE | Resultado sob as três condições |
| Exportação CSV e conferência com fonte | PENDENTE | Arquivos de teste e totais conciliados |

## Validação por unidade

| Unidade | Indicadores a conciliar | Regras próprias obrigatórias | Status |
|---|---|---|---|
| CPC | Soma correta de ocorrências/conduções/TCOs e quatro KPIs de cada unidade | Unidade e período; filtros territoriais criminais não devem distorcer serviços especializados | PENDENTE |
| 1º BPM | BO, conduções, TCOs, veículos recuperados e produção territorial | SISC, companhia e Tático Setorial, quando informado | PENDENTE |
| 2º BPM | BO, TCO, conduções, indicadores próprios, relatórios profissionais | Registros do Tático Setorial/AME somente onde aplicáveis | PENDENTE |
| BOPE | BO, conduções, prisões e produtividade por subunidade | Força Tática, Choque, Canil e GATE; classificação não informada preservada | PENDENTE |
| Cavalaria | Serviços, policiamento montado, eventos/operações, pessoas abordadas | Data do serviço; números do relatório não confundidos com BOs | PENDENTE |
| CIPA | Ocorrências, animais, hectares embargados, valor de multas | Datas do fato, do registro de fauna, do embargo e da autuação podem ser diferentes; evitar dupla soma de área | PENDENTE |
| CIPG | Relatórios de guarda, eventos hospitalares, serviços sem alteração e empregos de efetivo | Livro de serviço; empregos não representam PMs distintos | PENDENTE |
| CIPTUR | Ocorrências, conduções, autos e autos com remoção indicada | Auto com remoção NÃO equivale automaticamente a um veículo distinto removido; TOR quando identificado | PENDENTE |
| GIRO | Ocorrências, abordagens, pessoas abordadas e séries diárias | Data/hora de Roraima (UTC−04), tipo de abordagem e filtro separado de BOs | PENDENTE |

## Roteiro para amostragem

- Para cada unidade com dados, escolher **no mínimo três registros**, incluindo um caso comum e um caso com informação especializada.
- Conferir os valores exibidos em três pontos: **visão rápida**, **dashboard completo/CPC** e **relatório PDF ou documento de origem**.
- Registrar ID/BO/PPE/auto/serviço, datas de referência, total esperado, total apresentado e eventual divergência.
- Para bases sem dados, confirmar que o painel mostra **0** após consulta bem-sucedida; quando a consulta falhar, confirmar que mostra **indisponível/erro**, sem inventar 0.
- Para cada mapa, confirmar agrupamento, pontos por natureza/unidade, calor isolado, popup, camada GIRO e exportação CSV. Ausência de coordenadas não pode ser interpretada como ausência da ocorrência nas estatísticas.
- Para PDFs longos, conferir **primeira página, páginas intermediárias com tabelas e última página**; validar cabeçalho, rodapé, quebra de página, fontes e assinatura.

### Modelo de registro de divergência

| Unidade | Registro/ID | Período | Indicador | Valor no documento | Valor no sistema | Resultado e encaminhamento |
|---|---|---|---|---|---|---|
| A preencher | A preencher | A preencher | A preencher | A preencher | A preencher | PENDENTE |

## Critérios para entrega final

**Homologação só será concluída** quando não houver divergências críticas sem encaminhamento, os perfis tiverem sido testados, os PDFs e mapas tiverem sido visualizados por unidade e os responsáveis tiverem confirmado as regras estatísticas de cada especialidade.

| Responsável / área | Aprovação / data | Observação |
|---|---|---|
| CPC — comando e estatística | PENDENTE | Consolidação e acessos |
| 1º BPM | PENDENTE | Dados policiais e PDF |
| 2º BPM | PENDENTE | Dados policiais e PDF |
| BOPE | PENDENTE | Subunidades e PDF |
| Cavalaria | PENDENTE | Serviços e produtividade |
| CIPA | PENDENTE | Ambiental/PPE/embargos/autos |
| CIPG | PENDENTE | Livro de guarda |
| CIPTUR | PENDENTE | Infrações/remoções/TOR |
| GIRO | PENDENTE | Abordagens georreferenciadas |

*Observação:* este documento não contém credenciais de acesso nem substitui evidência do funcionamento no navegador autenticado.
