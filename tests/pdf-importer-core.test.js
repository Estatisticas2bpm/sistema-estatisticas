const assert = require("node:assert/strict");
const core = require("../pdf-importer-core.js");

const comandantes = [
  "SGT PM DANIEL PIRES",
  "SD PM KENNEDY",
  "SGT JULIANA LIMA",
  "SGT PEREIRA",
  "CB PEREIRA",
  "SD PEREIRA",
  "CB PM FERREIRA"
];

let resultado = core.associarComandante(
  "Comandante da Guarnição: Daniel Pires Barbosa\nASSINATURAS\nDaniel Pires Barbosa\nPOLICIAL MILITAR\nResponsável pelo Atendimento",
  comandantes
);
assert.equal(resultado.valor, "SGT PM DANIEL PIRES");
assert.ok(resultado.score >= 0.85);

resultado = core.associarComandante(
  "Comandante da Guarnição: Marcos Kennedy Araujo Ferreira\nTÁTICO SETORIAL - VTR 904\nCMT SD PM KENNEDY\nMOT SD PM J HENRIQUE",
  comandantes
);
assert.equal(resultado.valor, "SD PM KENNEDY");
assert.ok(resultado.score >= 0.85);

resultado = core.associarComandante("Comandante da Guarnição: Juliana Aparecida Miguel Lima Correa", comandantes);
assert.equal(resultado.valor, "SGT JULIANA LIMA");

resultado = core.associarComandante("Comandante da Guarnição: José Carlos Pereira", comandantes);
assert.equal(resultado.valor, null);
assert.equal(resultado.ambiguo, true);

let local = core.associarLocalEntrega(
  "O conduzido foi apresentado no Segundo Distrito Policial para providências.",
  ["PC I", "PC II", "4º DP", "DICAP"]
);
assert.equal(local.valor, "PC II");

local = core.associarLocalEntrega(
  "Ao Senhor Chefe da DICAP. Após consulta via DICAP, os reeducandos foram apresentados nesta especializada.",
  ["PC I", "PC II", "DICAP"]
);
assert.equal(local.valor, "DICAP");

const resumo = core.resumirHistorico(
  "A guarnição foi acionada via CIOPS para atender ocorrência de violência doméstica. No local, a vítima informou que havia sido agredida pelo companheiro. O suspeito deixou o local, sendo posteriormente localizado pela guarnição e conduzido à delegacia para adoção das medidas cabíveis. Foi necessário o uso de algemas para garantir a integridade física.",
  {vitimas:[],infratores:[],envolvidos:[]}
);
assert.match(resumo,/VIOLÊNCIA DOMÉSTICA/);
assert.match(resumo,/LOCALIZADO/);
assert.match(resumo,/CONDUZIDO/);
assert.doesNotMatch(resumo,/ALGEMAS/);

const cautelar = core.resumirHistorico(
  "Durante patrulhamento, dois indivíduos em atitude suspeita foram abordados. Após consulta à DICAP, constatou-se que eram reeducandos em descumprimento de medidas cautelares. Foi necessário o uso de algemas. Ambos foram conduzidos.",
  {vitimas:[],infratores:[{},{}],envolvidos:[]}
);
assert.match(cautelar,/DOIS INDIVÍDUOS/);
assert.match(cautelar,/DESCUMPRIMENTO DE MEDIDAS CAUTELARES/);
assert.doesNotMatch(cautelar,/ALGEMAS/);

const trafico = core.resumirHistorico(
  "Durante patrulhamento, a guarnição avistou um indivíduo tentando receber um invólucro de substância entorpecente. Foi realizada a abordagem e localizadas outras porções de drogas, uma balança e um celular. O infrator foi conduzido e apresentado na unidade policial.",
  {vitimas:[],infratores:[{}],envolvidos:[]}
);
assert.match(trafico,/DURANTE PATRULHAMENTO/);
assert.match(trafico,/SUBSTÂNCIAS ENTORPECENTES/);
assert.match(trafico,/CONDUZIDO À UNIDADE POLICIAL/);
assert.ok(trafico.length < 500);
assert.doesNotMatch(trafico,/\$1/);

const itensDrogas = core.extrairItensOperacionais(`
Descrição  2 (dois) invólucros de substancia em pó aparentando ser cocaína
Situação  Apreendido
DrogaGrupo CocaínaSubgrupo
Descrição  1 (uma) pedra amarelada aparentando ser pasta base
Situação  Apreendido
DrogaGrupo CrackSubgrupo
Descrição  14 (quatorze) invólucros com substância amarelada
Situação  Apreendido
DrogaGrupo Pasta Base de Cocaína/COCAÍNASubgrupo
Descrição  BALANÇA DE PRECISÃO DE COR PRATA Quantidade  1,00 Unidade
Situação  Apreendido
OutrosGrupo Balança de PrecisãoSubgrupo
`);
assert.deepEqual(itensDrogas.entorpecentes.map(item=>[item.tipo,item.quantidade,item.forma_apresentacao]),[
  ["COCAÍNA",2,"INVÓLUCRO"],
  ["CRACK",1,"UNIDADE"],
  ["PASTA BASE",14,"INVÓLUCRO"]
]);
assert.equal(itensDrogas.balanca,true);
assert.equal(itensDrogas.recuperados.filter(item=>item.tipo==="BALANÇA DE PRECISÃO").length,1);

const itensDrogasOrdemPdfJs = core.extrairItensOperacionais(`
Grupo Droga Subgrupo Cocaína Identificador Único RR1 Descrição 2 (dois) invólucros de substância em pó Situação Apreendido Nome Envolvido X
Grupo Droga Subgrupo Crack Identificador Único RR2 Descrição 1 (uma) pedra amarelada Situação Apreendido Nome Envolvido X
Grupo Droga Subgrupo Pasta Base de Cocaína/COCAÍNA Identificador Único RR3 Descrição 14 (quatorze) invólucros com substância amarelada Situação Apreendido Nome Envolvido X
`);
assert.deepEqual(itensDrogasOrdemPdfJs.entorpecentes.map(item=>[item.tipo,item.quantidade]),[["COCAÍNA",2],["CRACK",1],["PASTA BASE",14]]);
assert.equal(itensDrogasOrdemPdfJs.recuperados.length,0);

const itensArmas = core.extrairItensOperacionais(`
Descrição canivete de bolso cinza Situação Meio Empregado, Apreendido
Arma BrancaGrupo CaniveteSubgrupo
Descrição FACA DE CABO PRETO Situação Apreendido, Meio Empregado
Arma BrancaGrupo FacaSubgrupo
Descrição 01 ARMA SIMULACRO PRETA Situação Meio Empregado
Arma de FogoGrupo Simulacro (Réplica)Subgrupo
`);
assert.equal(itensArmas.armasBrancas.length,2);
assert.equal(itensArmas.armas.length,1);
assert.equal(itensArmas.armas[0].categoria,"SIMULACRO");

const armaEMunicao = core.extrairItensOperacionais(`Grupo Arma de Fogo Subgrupo Pistola Identificador Único RR10 Descrição 01 PISTOLA CALIBRE 9 MM Situação Apreendido
Grupo Munição Subgrupo Cartucho Identificador Único RR11 Descrição 15 MUNIÇÕES CALIBRE 9 MM Situação Apreendido`);
assert.equal(armaEMunicao.armas[0].tipo,"PISTOLA");
assert.equal(armaEMunicao.armas[0].calibre,"9 MM");
assert.equal(armaEMunicao.municoes[0].quantidade,15);
assert.equal(armaEMunicao.municoes[0].calibre,"9 MM");

const veiculos = core.extrairItensOperacionais(`Grupo Veículo Subgrupo Motocicleta/Motoneta Identificador Único RR1 Placa OAH0I80 Número do Chassi 9C2KC1650CR508646 Ano/Modelo Fabricação 2012/2011 Cor PRETA UF Veículo RR Município Veículo Boa Vista Marca/Modelo HONDA/CG 150 TITAN ESD Veículo Adulterado? Não Situação Furtado, Recuperado, Roubado
Grupo Veículo Subgrupo Motocicleta/Motoneta Identificador Único RR2 Placa NUI4890 Número do Chassi 9C2JC4220AR407162 Ano/Modelo Fabricação 2010/2010 Cor VERMELHA UF Veículo RR Município Veículo Boa Vista Marca/Modelo HONDA/BIZ 125 ES Veículo Adulterado? Não Situação Recuperado, Roubado, Furtado`);
assert.equal(veiculos.subtraidos.length,2);
assert.equal(veiculos.recuperados.length,2);
assert.deepEqual(veiculos.recuperados.map(item=>item.detalhes),[
  "HONDA/CG 150 TITAN ESD, COR PRETA, PLACA OAH0I80, ANO/MODELO 2012/2011",
  "HONDA/BIZ 125 ES, COR VERMELHA, PLACA NUI4890, ANO/MODELO 2010/2010"
]);

const viasDeFato = core.resumirHistorico(
  "A guarnição foi acionada para atender uma ocorrência envolvendo vias de fato e confusão familiar. Durante o desentendimento foram localizados e apreendidos um canivete e uma faca. Os envolvidos foram conduzidos e apresentados à delegacia.",
  {vitimas:[],infratores:[],envolvidos:[{nome:"CLEDSON DA COSTA MONTEIRO"}]}
);
assert.match(viasDeFato,/VIAS DE FATO EM CONTEXTO FAMILIAR/);
assert.match(viasDeFato,/ARMAS BRANCAS/);
assert.match(viasDeFato,/CONDUZIDOS/);
assert.ok(viasDeFato.length < 500);

console.log("pdf-importer-core: todos os testes passaram");
