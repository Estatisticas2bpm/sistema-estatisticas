# Auditoria corretiva — quantidades do 1º BPM (18/10/2026)

**Situação:** correção autorizada, aplicada e verificada no Supabase.
**Escopo:** 1º BPM, registros de 2026 importados de `PLANILHA ANUAL 2026.xlsx / DADOS TOTAIS`.
**Não houve exclusão de BOs, alteração das naturezas, das pessoas ou dos números de documentos.**

## Causa identificada

Durante a carga histórica, números que integram nomes de modelos de veículos
(Honda CG 125/150/160, Yamaha Lander XTZ 250, Honda Biz 100, VW Gol 1000L)
e calibres de armas (.38, 9 mm) foram interpretados como quantidades e copiados
tanto para os totais de ocorrências quanto para o JSON de itens estruturados.

Não é erro de soma do Dashboard Completo. Os dados fonte estavam inflados.
Foi verificada a quantidade única de cada descrição desses 17 itens.
O registro histórico original e o valor corrigido permanecem arquivados em
`private.auditoria_correcao_quantidades_1bpm_20261018` para conferência e reversão.

## Resultado após a correção (2026)

| Indicador | Antes | Depois |
| --- | ---: | ---: |
| Veículos recuperados | 2534 | 30 |
| Armas de fogo | 108 | 10 |
| Simulacros | 39 | 2 |
| Armas e simulacros | 147 | 12 |
| Total de BOs do 1º BPM | 1676 | 1676 |

**Importante:** esses valores derivam dos campos armazenados e das descrições
disponíveis. A homologação estatística final poderá confrontar os 17 documentos
originais, sem prejuízo do registro da alteração e dos valores anteriores.

## Relação dos BOs (original → corrigido)

**Veículos recuperados (11 BOs):**

| BO | Antes | Depois | Referência da descrição |
| --- | ---: | ---: | --- |
| 00099/2026 | 100 | 1 | Honda Biz 100 |
| 03823/2026 | 1000 | 1 | VW Gol 1000L |
| 07843/2026 | 125 | 1 | Honda CG 125 |
| 09709/2026 | 150 | 1 | Honda CG 150 |
| 11365/2026 | 160 | 1 | Honda CG 160 |
| 12702/2026 | 160 | 1 | Honda CG 160 |
| 17363/2026 | 125 | 1 | Honda CG 125 |
| 25741/2026 | 125 | 1 | Honda CG 125 |
| 27852/2026 | 160 | 1 | Honda CG 160 |
| 29408/2026 | 160 | 1 | Honda CG 160 |
| 42239/2026 | 250 | 1 | Yamaha Lander XTZ 250 |

**Armas e simulacros (6 BOs):**

| BO | Antes | Depois | Referência da descrição |
| --- | ---: | ---: | --- |
| 08598/2026 | 38 | 1 | Revólver calibre .38 |
| 11258/2026 | 9 | 1 | Pistola 9 mm |
| 16821/2026 | 38 | 1 | Pistola calibre .38 |
| 30870/2026 | 9 | 1 | Pistola 9 mm |
| 31287/2026 | 9 | 1 | Pistola 9 mm |
| 49742/2026 | 38 | 1 | Um simulacro calibre .38 |

## Segurança e rastreabilidade

1. A migração contém UUID, número de BO, unidade, quantidade anterior,
   descrição e categoria previamente conferidos; qualquer divergência
   interrompe a transação inteira.
2. A migração guarda quantidades e JSON originais, novos valores e
   metadados de sincronização em tabela de auditoria do esquema `private`.
3. `anon`, `authenticated` e `service_role` não recebem acesso à
   tabela de auditoria. O mecanismo de RLS operacional não foi modificado.
4. Os triggers normais de `ocorrencias` continuam ativos; o fluxo de
   sincronização Google Sheets é de **saída do banco para a planilha**,
   com atualização das versões após alteração legítima da ocorrência.
5. Mudanças no conteúdo de um BO **não** exigem sua exclusão ou novo cadastro.
6. Para reverter alguma linha, consultar `itens_antes` e
   `quantidade_antes` na auditoria; nunca reaplicar a migração.

## Como verificar após implantação

```sql
select count(*) as auditados,
       count(*) filter(where indicador='VEICULO') as veiculos,
       count(*) filter(where indicador='ARMA') as armas
from private.auditoria_correcao_quantidades_1bpm_20261018;

select count(*) ocorrencias,
       sum(coalesce(veiculos_recuperados,0)) veiculos,
       sum(coalesce(quantidade_armas,0)) armas_e_simulacros
from public.ocorrencias
where unidade_id='fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid
  and data_ocorrencia between '2026-01-01' and '2026-12-31';
```

## Prevenção para novas importações

- O cadastro por PDF passa a sinalizar antes de salvar quando uma quantidade
  coincide com número de modelo de veículo ou calibre na descrição; o
  operador precisa confirmar a exceção, sem alteração automática.
- O leitor de PDF usa o núcleo `pdf-importer-core.js`, cuja leitura de
  quantidade depende de expressão explícita, e não do primeiro número
  encontrado no nome do objeto. Foi acrescentado teste de regressão.
- **Importações em lote de planilhas** são um fluxo distinto do leitor de
  PDF e devem obrigatoriamente separar `quantidade` da descrição de
  veículos e armamento. Números de calibres/modelos não são contagens.
- Antes de importar novas bases, executar validação de amostras,
  confrontar BOs extremos e comparar totais por unidade. Esta correção
  histórica não é autorização para normalizar automaticamente lotes futuros.
- Em planilhas de origem, os campos alterados devem continuar coerentes com
  os campos enviados pelo banco; não reimportar o arquivo anual bruto sem revisão.
