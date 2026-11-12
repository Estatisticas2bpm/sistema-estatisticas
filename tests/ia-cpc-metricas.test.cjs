const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

(async () => {
  const functions = await import(pathToFileURL(path.join(
    __dirname, "..", "supabase", "functions", "ia-cpc", "estatisticas.mjs"
  )));
  const { categoria, ranking, somar, conducoesOperacionaisPorOcorrencia, intervaloAnterior, compararTotal, mudancasSignificativas, classificarNatureza, naturezaAlvoPergunta, serieMensalSegura, familiaNatureza, intencaoEstatistica, extrairClassificacoesOficiais } = functions;

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
  assert.equal(classificarNatureza("FURTO E ROUBO",null,catalogo),"NÃO CLASSIFICADO");
  assert.equal(classificarNatureza("ROUBO OU FURTO",null,catalogo),"NÃO CLASSIFICADO");
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

  // Um BO pode carregar MAIS DE UMA natureza. Não duplicar o total de BOs.
  const estrutura={
    ocorrencia:"FURTO",crime:"ROUBO",
    naturezas_itens:[{nome:"FURTO",tipo_id:1},{nome:"ROUBO",tipo_id:2},
       {nome:"FURTO",tipo_id:1}],
    crimes_itens:[
      {nome:"Subtipo fictício A",tipo_nome:"ROUBO"},
      {nome:"Subtipo fictício B",tipo_nome:"ROUBO"},
      {nome:"Subtipo fictício C",tipo_nome:"FURTO"}
    ]
  };
  const multi=extrairClassificacoesOficiais(estrutura,catalogo);
  assert.deepEqual(multi.naturezas,["FURTO","ROUBO"],
    "Não descartar segunda natureza nem contar repetição como novo BO");
  assert.deepEqual(multi.familias,["FURTO","ROUBO"],
    "Um BO entra uma única vez por família, mesmo com subtipos repetidos");
  assert.deepEqual(multi.crimes,["ROUBO","FURTO"],
    "Tipificações criminais deduplicadas dentro do mesmo BO");
  assert.equal(multi.multiplas_naturezas,true);
  assert.equal(multi.varios_itens_crime,true);
  assert.equal(multi.fonte,"naturezas_itens");
  const zero=extrairClassificacoesOficiais({
    ocorrencia:"FURTO",crime:"ROUBO",
    naturezas_itens:[{nome:"Pessoa identificável, RG 12345"}],
    crimes_itens:[{nome:"Descrição sigilosa",tipo_nome:"Pessoa identificável"}]
  },catalogo);
  assert.deepEqual(zero.naturezas,["FURTO"]);
  assert.deepEqual(zero.crimes,[]);
  assert.equal(zero.fonte,"colunas_legadas");
  const semCampos=extrairClassificacoesOficiais({},catalogo);
  assert.deepEqual(semCampos.naturezas,["NÃO CLASSIFICADO"]);
  assert.deepEqual(semCampos.crimes,[]);
  const tentativa=extrairClassificacoesOficiais({
    ocorrencia:"TENTATIVA DE FURTO",
    naturezas_itens:[{nome:"TENTATIVA DE FURTO"}],
    crimes_itens:[]
  },catalogo);
  assert.deepEqual(tentativa.familias,[],
    "Tentativa não pode ser somada à família de furtos consumados");
  const modelos=[
    {naturezas_itens:[{nome:"FURTO"}],crimes_itens:[{tipo_nome:"FURTO"}]},
    {naturezas_itens:[{nome:"ROUBO"},{nome:"FURTO"}],crimes_itens:[{tipo_nome:"ROUBO"}]},
    {naturezas_itens:[{nome:"ROUBO"},{nome:"ROUBO"}],crimes_itens:[]}
  ];
  let boletins=0,atribuicoes=0;
  const tNaturezas=new Map();
  for(const o of modelos) {
    boletins++;
    const itens=extrairClassificacoesOficiais(o,catalogo);
    atribuicoes+=itens.naturezas.length;
    for(const n of itens.naturezas)somar(tNaturezas,n);
  }
  assert.equal(boletins,3);
  assert.equal(atribuicoes,4);
  assert.equal(tNaturezas.get("ROUBO"),2);
  assert.equal(tNaturezas.get("FURTO"),2);
  console.log("OK — regras estatísticas IA CPC testadas com dados sintéticos.");
})().catch(err => { console.error(err); process.exitCode = 1; });
