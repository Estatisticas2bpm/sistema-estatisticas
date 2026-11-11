const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

(async () => {
  const functions = await import(pathToFileURL(path.join(
    __dirname, "..", "supabase", "functions", "ia-cpc", "estatisticas.mjs"
  )));
  const { categoria, ranking, somar, conducoesOperacionaisPorOcorrencia } = functions;

  assert.equal(categoria("  Lesão Corporal  "), "LESÃO CORPORAL");
  assert.equal(categoria("Rua 2 < nome >"), "NÃO CLASSIFICADO", "Texto com tags deve ser recusado");
  assert.equal(categoria("X".repeat(66)), "NÃO CLASSIFICADO", "Texto muito longo deve ser recusado");
  assert.equal(categoria(null), "NÃO CLASSIFICADO");

  const grupos = new Map();
  for (let i = 0; i < 4; i++) somar(grupos, "BAIRRO A");
  for (let i = 0; i < 6; i++) somar(grupos, "BAIRRO B");
  for (let i = 0; i < 5; i++) somar(grupos, "BAIRRO C");
  assert.deepEqual(ranking(grupos), [
    { nome: "BAIRRO B", quantidade: 6 },
    { nome: "BAIRRO C", quantidade: 5 }
  ], "Suprimir células com menos de cinco registros");
  assert.deepEqual(ranking(grupos, 1), [{ nome: "BAIRRO B", quantidade: 6 }]);

  assert.equal(conducoesOperacionaisPorOcorrencia(2, 3), 3,
    "Não somar conduzidos e prisões do mesmo registro");
  assert.equal(conducoesOperacionaisPorOcorrencia(4, 1), 4);
  assert.equal(conducoesOperacionaisPorOcorrencia(null, null), 0);
  assert.equal(conducoesOperacionaisPorOcorrencia(-1, -3), 0);
  console.log("OK — regras estatísticas IA CPC testadas com dados sintéticos.");
})().catch(err => { console.error(err); process.exitCode = 1; });
