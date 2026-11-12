# SIE-CPC — Conciliação da IA com os indicadores oficiais
**Data da leitura:** 12/11/2026 (consulta somente-leitura).  
**Período da ocorrência:** 13/10/2026 a 11/11/2026, ambos inclusive.  
**Fonte:** Supabase de produção SIE-CPC, tabelas `public.ocorrencias` e função oficial `public.obter_dados_dashboard`.  
**Código corrigido:** PR #152, não publicado.

## 1. Conciliados sem divergências

A função oficial retorna uma lista JSON de registros e não um único resumo. A comparação dos valores abaixo foi feita por **agregação na própria consulta SQL**, sem exportar nenhum BO, número de BO, endereço, relato ou identificação de pessoa.

| Indicador | Dashboard oficial | Consulta que fundamenta a IA | Diferença |
|---|---:|---:|---:|
| Boletins no período | 449 | 449 | 0 |
| Conduções operacionais | 160 | 160 | 0 |
| Número de conduzidos | 160 | 160 | 0 |
| Prisões | 0 | 0 | 0 |
| Armas | 8 | 8 | 0 |
| Veículos recuperados | 8 | 8 | 0 |

**Limitações:** esta é uma fotografia do momento, não um resultado imutável; o sistema recebe novos boletins. A equivalência foi conferida para este período e os agregados numéricos acima, não para todas as telas/visualizações. Outros períodos e unidades devem ser testados posteriormente.

## 2. Falha estatística encontrada e corrigida na proposta

A versão anterior analisava somente uma natureza por ocorrência com base nos campos `ocorrencia` ou `crime`. No SIE-CPC existem **listas estruturadas** com mais de uma natureza/crime por BO.

| Dimensão | Contagem na consulta |
|---|---:|
| Boletins | 449 |
| Boletins com mais de uma natureza distinta | 40 |
| Itens em `naturezas_itens` | 506 |
| Naturezas distintas por BO, somadas | 506 |
| Itens em `crimes_itens` | 531 |
| Tipos criminais distintos por BO, somados | 506 |
| Boletins com vários itens de crime | 53 |
| Boletins com múltiplos tipos criminais distintos | 40 |

A auditoria verificou que **todos os 506 nomes dos itens de natureza** e **todos os 531 `tipo_nome` dos itens de crime** correspondem ao catálogo oficial ativo no período consultado.

A PR #152 foi alterada para:
- Ler as categorias de `naturezas_itens[].nome` como fonte prioritária, com fallback aos campos legados apenas quando não houver categoria oficial válida.
- Ler `crimes_itens[].tipo_nome` em dimensão **separada** de tipificação criminal. Não usar nomes livres de subtipos ou descrições como classificação.
- Contar **um único BO** no total geral; contar cada categoria no máximo uma vez por BO, mesmo que repetida no array.
- Reconhecer múltiplas naturezas para o mesmo BO e evitar perdas ou somas duplas em famílias de furto/roubo.
- Exibir classificações em rankings somente com frequência de pelo menos cinco BOs, preservando a política de supressão de grupos pequenos.
- Manter rótulos distintos para **total de ocorrências**, **atribuições de natureza** e **atribuições de tipificação**, pois não são grandezas intercambiáveis.

## 3. Qualidade e cautelas

Os **449 boletins** do período constam no banco como `rascunho`. O sistema usa essa situação por padrão no fluxo atual de cadastro, portanto ela não significa automaticamente erro, mas o comando precisa ser informado de que a série não foi formalmente marcada como `finalizado`.

A IA deve apresentar conclusões como **preliminares**, nunca como prova de queda ou aumento de crimes sem validação de cobertura, duplicidade e status. Nenhum campo de ocorrência, categoria ou relato foi alterado.

## 4. Evidência técnica e próximo passo

A regressão sintética foi adicionada em `tests/ia-cpc-metricas.test.cjs`. Os testes automatizados de Deno, Node e PostgreSQL isolado foram aprovados na PR #152 após a correção das classificações múltiplas.

A aferição independente de acurácia de relatos **ainda não foi realizada**. Exige amostra confidencial anonimizada, pessoas autorizadas para rotular os trechos e procedimento de revisão local que não publique os textos no GitHub.

**Estado de implantação:** IA não liberada, nenhum texto individual enviado à OpenAI, nenhuma migração aplicada ao Supabase de produção, nenhum custo de API.