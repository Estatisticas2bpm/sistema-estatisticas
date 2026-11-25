# SIE-CPC — Homologação sintética de relatos (12/11/2026)

**Escopo:** PR #152, somente desenvolvimento. IA não ativada. Nenhum dado policial real utilizado.

## Método

O teste `tests/ia-cpc-relatos-benchmark.test.cjs` contém 83 relatos **inteiramente fictícios**, de furto, roubo, violência doméstica, trânsito, ambiental, patrulhamento, cavalaria, administrativo e privacidade. Cada exemplo foi rotulado manualmente com as menções e contextos esperados. Os rótulos são definidos no código de teste e não são retirados de boletins verdadeiros.

Métricas:
- **Precisão:** menções corretas divididas pelo total de menções detectadas.
- **Cobertura (recall):** menções corretas divididas pelas menções esperadas.
- **Acerto contextual:** qualificações corretas divididas pelas menções detectadas.
- **Erro grave:** frase negativa, incerta ou atribuída a terceiro classificada como se fosse constatação.

## Resultados observados no CI

| Métrica | 57 casos básicos | 26 casos de estresse — antes | 26 casos de estresse — depois |
|---|---:|---:|---:|
| Precisão das menções | 100% | 84% | 100% |
| Cobertura das menções | 100% | 100% | 100% |
| Acerto de contexto | 100% | 71,4% | 100% |
| Falsos positivos | 0 | 4 | 0 |
| Constatação indevida de negação/incerteza/relato | 0 | 1 | 0 |

Total: **83 exemplos sintéticos e 72 menções positivas**. A bateria de estresse também orientou as correções. **Logo, esse resultado não é uma validação independente e não demonstra 100% de precisão nos BOs reais.**

## Correções aplicadas

- A frase “verificou não existir arma de fogo” deixou de ser tratada como constatação.
- Hipóteses como “a moto teria sido utilizada” e “foi supostamente utilizada” passaram a ser classificadas como incertas.
- Ferramentas e brinquedos (“pistola de pintura”, “pistola de cola”, “pistola de brinquedo”) não são tratados como armas de fogo nessa contagem.
- “Veículo de comunicação” não é contabilizado como automóvel.
- Negativas como “não informou a presença de pistola” e hipóteses descartadas foram incluídas.

## Portas de qualidade automatizadas

A CI bloqueia alterações que causem, nos exemplos de estresse: qualquer constatação indevida de negativa/incerteza/relato de terceiro, precisão de menções abaixo de 95%, cobertura abaixo de 95% ou acerto contextual abaixo de 90%. Os testes principais também continuam obrigatórios.

## Limitações e próxima homologação

- **Detecção lexical não é interpretação semântica completa.** Abreviaturas, negações distantes, erros de OCR, frases longas e terminologias locais ainda podem produzir falsos resultados.
- “Descrita como constatada” reflete apenas a redação do relato, não comprova materialidade, autoria ou veracidade.
- Um termo associado a arma ou veículo pode descrever conduta da própria guarnição ou um fato informativo; não atribuir automaticamente a suspeitos.
- Grupos pequenos são ocultados, mas comparações repetidas com períodos sobrepostos ainda podem revelar dados por inferência; isto requer testes adicionais.
- Não reclassificar historicamente o envolvimento de policiais/autoridades, conforme decisão anterior.
- Para estimar precisão real, usar uma **amostra anonimizada e rotulada por revisores independentes**, em ambiente autorizado e fora do GitHub público. Registrar divergências, taxa de indecisão e falsos positivos de constatação.
- Depois testar performance, Supabase Auth/Edge, permissões e integração de indicadores com dashboards. Não liberar relatórios decisórios com base somente em rascunhos.
- A integração externa continua desativada; nenhuma chave da API foi configurada e nenhum texto integral, identificador pessoal ou BO foi enviado à OpenAI.

**Estado final desta etapa:** análise sintética e regressão melhoradas; sistema de produção inalterado.