# SIE-CPC — Protocolo privado de validação dos relatos

**Situação: preparado para homologação; nenhuma amostra real foi analisada nesta etapa.**

## Objetivo

Medir a qualidade da classificação dos relatos com uma **amostra independente da bateria de desenvolvimento**, revisada por profissionais autorizados. O resultado deverá apoiar a decisão sobre habilitar a análise textual do piloto, mas não autoriza conclusões policiais individuais.

## Seleção da amostra

Recomenda-se uma amostra diversificada (idealmente 100 a 200 boletins, dependendo da disponibilidade), contendo registros de furto, roubo, violência doméstica, trânsito urbano/rodoviário, fiscalização ambiental, patrulhamento e unidades especializadas. Incluir documentos com negações, hipóteses, versões conflitantes, relatos de terceiros, descrições de apreensão e boletins informativos sem ocorrência criminal.

A seleção deve ser documentada antes da rotulagem, com distribuição por natureza e períodos. Não publicar identificadores dos BOs, números de ocorrência, endereços, nomes, telefones, placas, coordenadas ou narrativas integrais.

## Revisão humana independente

1. Duas pessoas autorizadas classificam cada exemplo **independentemente**. Uma terceira resolve divergências, registrando os critérios de decisão.
2. Registrar somente as categorias de menção e seu estado contextual esperado. Não classificar autoria, periculosidade ou envolvimento de policiais/autoridades em ocorrências históricas.
3. Os trechos de teste devem ser redigidos ou verdadeiramente anonimizados com revisão humana e mantidos em ambiente privado. A mera remoção de nomes não garante anonimização.
4. Não alterar o BO de origem nem salvar classificações históricas automaticamente.

## Avaliador local preparado

Código: `scripts/ia-cpc-avaliar-amostra-local.cjs` (PR #152).

**O arquivo de dados deve permanecer FORA da pasta do repositório.** Exemplo de formato JSONL contendo apenas material fictício:

```json
{"historico_resumido":"Segundo a testemunha, havia uma motocicleta.","rotulos":{"mencao_motocicleta":"atribuida_a_relato"}}
{"historico_resumido":"A equipe não encontrou uma pistola.","rotulos":{"mencao_arma_fogo":"negada_ou_ausente_no_texto"}}
```

Executar em uma máquina autorizada, sem compartilhar o arquivo de entrada:

```bash
node scripts/ia-cpc-avaliar-amostra-local.cjs /caminho-privado/fora-do-repositorio/amostra.jsonl
```

A ferramenta:
- valida até 1.000 registros, tamanho de arquivo até 20 MB e vocabulário de rótulos;
- lê os textos localmente e calcula **precisão, cobertura, acerto de contexto e constatações indevidas**;
- não realiza chamadas de rede, não grava dados e não imprime trechos da amostra;
- só apresenta métricas de categorias com pelo menos cinco menções rotuladas e detectadas;
- exige arquivo situado fora do repositório para reduzir risco de commit acidental;
- não substitui a revisão de segurança da estação, o controle de acesso ao arquivo ou a política de descarte.

## Critérios sugeridos antes de liberação

Aferir desempenho em amostra independente, com distribuição mínima por tipo de narrativa. Estabelecer limites de erro coerentes com o uso: nenhum resultado individual deve ser tomado como fato. Uma meta de **zero afirmação indevida de constatação nos casos examinados** deve ser priorizada; entretanto, zero erros em amostra pequena não garante taxa nula no universo de BOs.

Avaliar também discrepâncias de categorias oficiais, dupla contagem de naturezas, dados `rascunho` e inferência de grupos pequenos por consultas com intervalos sobrepostos.

## Pendências

- [x] Algoritmo sintético testado e CI com regressões.
- [x] Conciliação dos indicadores numéricos com o dashboard em consulta somente-leitura.
- [x] Leitura de múltiplas naturezas oficiais corrigida na PR.
- [x] Ferramenta de avaliação offline criada e testada com dados fictícios.
- [ ] Seleção autorizada de amostra e anonimização revisada.
- [ ] Rotulagem cega independente por profissionais autorizados.
- [ ] Execução local do avaliador com amostra independente, revisão dos erros e decisão sobre liberação.
- [ ] Teste E2E das duas contas, Supabase Auth/Edge e limite de orçamento em ambiente segregado.

**Nenhum registro operacional foi modificado. IA e relato contextual permanecem desligados.**
