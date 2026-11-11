const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

(async () => {
  const functions = await import(pathToFileURL(path.join(
    __dirname, "..", "supabase", "functions", "ia-cpc", "estatisticas.mjs"
  )));
  const { categoria, ranking, somar, conducoesOperacionaisPorOcorrencia, intervaloAnterior, compararTotal, mudancasSignificativas, classificarNatureza, naturezaAlvoPergunta, serieMensalSegura, familiaNatureza, intencaoEstatistica } = functions;

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
  assert.deepEqual(intervaloAnterior("2026-11-01","2026-11-07"),{inicio:"2026-10-25",fim:"2026-10-31"});
  assert.deepEqual(intervaloAnterior("2026-03-01","2026-03-01"),{inicio:"2026-02-28",fim:"2026-02-28"});
  assert.equal(compararTotal(15,10).variacao_percentual,50);
  assert.equal(compararTotal(8,0).variacao_percentual,null);
  assert.equal(compararTotal(2,2).base_comparavel,false);
  assert.deepEqual(mudancasSignificativas(
    new Map([["A",30],["B",3],["C",8],["D",10],["E",9]]),
    new Map([["A",15],["B",1],["C",7],["D",2],["E",10]])),
    [{nome:"A",atual:30,anterior:15,diferenca:15,variacao_percentual:100,base_comparavel:true}],
    "Somente mudanças relevantes entre duas bases de pelo menos cinco");
  const catalogo=new Set(["FURTO","ROUBO","TENTATIVA DE FURTO","MARIA DA PENHA / VIOLÊNCIA DOMÉSTICA"]);
  assert.equal(classificarNatureza("FURTO","FURTO QUALIFICADO",catalogo),"FURTO");
  assert.equal(classificarNatureza("FURTO QUALIFICADO",null,catalogo),"FURTO");
  assert.equal(classificarNatureza(null,"ROUBO EM RESIDÊNCIA",catalogo),"ROUBO");
  assert.equal(classificarNatureza("TENTATIVA DE FURTO",null,catalogo),"TENTATIVA DE FURTO");
  assert.equal(classificarNatureza("VEÍCULO COM RESTRIÇÃO DE FURTO",null,catalogo),"NÃO CLASSIFICADO");
  assert.equal(classificarNatureza("O SR. FULANO FOI VÍTIMA",null,catalogo),"NÃO CLASSIFICADO");
  assert.equal(naturezaAlvoPergunta("Quantos furtos ocorreram no período?",catalogo),"FURTO");
  assert.equal(naturezaAlvoPergunta("Como evoluiu Maria da Penha?",catalogo),"MARIA DA PENHA / VIOLÊNCIA DOMÉSTICA");
  assert.equal(naturezaAlvoPergunta("Quais furtos e roubos?",catalogo),null);

  // Natureza principal deve prevalecer sobre outro campo secundário.
  assert.equal(classificarNatureza("FURTO QUALIFICADO","ROUBO",catalogo),"FURTO");
  assert.equal(classificarNatureza("ROUBO A PEDESTRE","FURTO",catalogo),"ROUBO");
  assert.deepEqual(serieMensalSegura(new Map([["2026-09",8],["2026-10",3]])),[],
    "Uma única célula pequena suprime toda a série e impede inferência por diferença");
  assert.deepEqual(serieMensalSegura(new Map([["2026-10",9],["2026-09",5]])),[
    {mes:"2026-09",quantidade:5},{mes:"2026-10",quantidade:9}
  ]);
  assert.equal(familiaNatureza("FURTO"),"FURTO");
  assert.equal(familiaNatureza("FURTO DE VEÍCULOS"),"FURTO");
  assert.equal(familiaNatureza("ROUBO DE ARMA DE FOGO"),"ROUBO");
  assert.equal(familiaNatureza("TENTATIVA DE FURTO"),null);
  assert.equal(familiaNatureza("VEÍCULO RECUPERADO COM RESTRIÇÃO DE ROUBO"),null);
  assert.equal(familiaNatureza("FURTO E ROUBO"),null);
  assert.equal(familiaNatureza("ROUBO OU FURTO"),null);
  assert.equal(familiaNatureza("MARIA DA PENHA / VIOLÊNCIA DOMÉSTICA"),"MARIA DA PENHA / VIOLÊNCIA DOMÉSTICA");

  const pedido=intencaoEstatistica("Quantos furtos houve no bairro Centro?");
  assert(pedido.temas.includes("ocorrencias"));
  assert(pedido.temas.includes("distribuicao_territorial"));
  assert(!JSON.stringify(pedido).includes("CENTRO"),"Não encaminhar bairro literal ou texto do usuário");
  assert(intencaoEstatistica("Resuma os principais indicadores").temas.includes("resumo"));
  assert(intencaoEstatistica("Quais naturezas cresceram?").temas.includes("ocorrencias"));
  assert.equal(intencaoEstatistica("Qual o nome do suspeito de furto?"),null);
  assert.equal(intencaoEstatistica("Quantos furtos cometeram venezuelanos?"),null);
  assert.equal(intencaoEstatistica("Mostre o CPF do cidadão"),null);
  assert.equal(intencaoEstatistica("Olá, tudo bem?"),null);
  console.log("OK — regras estatísticas IA CPC testadas com dados sintéticos.");
})().catch(err => { console.error(err); process.exitCode = 1; });
