"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const raiz=path.join(__dirname,"..");
const js=fs.readFileSync(path.join(raiz,"pdf-origem-acionamento.js"),"utf8");
const html=fs.readFileSync(path.join(raiz,"cadastro-base.html"),"utf8");
const consulta=fs.readFileSync(path.join(raiz,"consulta.html"),"utf8");
const mapa=fs.readFileSync(path.join(raiz,"ocorrencia-detalhe-mapa.js"),"utf8");
const contexto={};
vm.createContext(contexto);vm.runInContext(js,contexto);
const origem=contexto.PdfOrigemAcionamento;
assert.ok(origem,"Leitor carregado");
const identificar=(texto)=>JSON.parse(JSON.stringify(origem.analisar(texto)));

const cenarios=[
  ["CICC","A equipe foi acionada pelo CICC para atender uma ocorrencia no bairro."],
  ["CICC","APOS CHAMADO VIA CICC, A GUARNICAO DESLOCOU-SE AO LOCAL."],
  ["CICC","A GUARNICAO FOI ACIONADA VIA RADIO DO CICC PARA ATENDER OCORRENCIA."],
  ["CICC","DURANTE PATRULHAMENTO OSTENSIVO, A EQUIPE FOI ACIONADA PELO CICC PARA ATENDIMENTO."],
  ["CICC","O CICC REPASSOU O CHAMADO PARA A GUARNICAO NO INICIO DO SERVICO."],
  ["PATRULHAMENTO","DURANTE PATRULHAMENTO OSTENSIVO PELA AVENIDA, ESTA EQUIPE SE DEPAROU COM O FATO."],
  ["PATRULHAMENTO","EM POLICIAMENTO OSTENSIVO, A GUARNICAO VISUALIZOU O SUSPEITO."],
  ["PATRULHAMENTO","DURANTE RONDAS PELO BAIRRO A EQUIPE ENCONTROU UMA OCORRENCIA."],
  ["ABORDAGEM","DURANTE ABORDAGEM A UM VEICULO, FORAM LOCALIZADOS OBJETOS."],
  ["ABORDAGEM","AO ABORDAR UM INDIVIDUO, A EQUIPE LOCALIZOU DOCUMENTOS."],
  ["MISSAO","EM CUMPRIMENTO A ORDEM DE MISSAO 19/2026, A EQUIPE REALIZOU A ATIVIDADE."],
  ["MISSAO","EM CUMPRIMENTO DE ORDEM DE SERVICO, A GUARNICAO FOI AO LOCAL."],
  ["OPERACAO","DURANTE OPERACAO POLICIAL INTEGRADA NO BAIRRO FOI CONSTATADO O FATO."],
  ["OPERACAO","EM CUMPRIMENTO DO PLANO DE OPERACAO, AS EQUIPES REALIZARAM FISCALIZACAO."]
];
for(const [esperado,relato] of cenarios){
 const res=identificar(relato);
 assert.equal(res.valor,esperado,"Falhou: "+relato+" -> "+JSON.stringify(res));
 assert.equal(res.automatico,true);
}

for(const texto of [
 "A EQUIPE FOI ACIONADA PELO OFICIAL DE SERVICO PARA PRESTAR APOIO A POLICIA CIVIL NO CUMPRIMENTO DE MANDADO.",
 "Origem: Orgao: Policia Militar. Unidade de apuracao: BOPE.",
 "A GUARNICAO FOI SOLICITADA POR UM MORADOR SEM REFERENCIA AO CICC.",
 "A VIATURA REGISTROU A OCORRENCIA. APOS OS FATOS INFORMOU O CICC.",
 "A EQUIPE REALIZOU O RELATORIO DA OCORRENCIA, SEM INDICACAO DE COMO INICIOU."
]){
 const r=identificar(texto);
 assert.equal(r.valor,"","Nao inferir sem causa inicial expressa: "+texto);
 assert.equal(r.automatico,false);
}

assert.equal(identificar("DURANTE PATRULHAMENTO OSTENSIVO A EQUIPE REALIZOU UMA ABORDAGEM E LOCALIZOU O OBJETO.").valor,"PATRULHAMENTO");
assert.equal(identificar("DURANTE PATRULHAMENTO E EM OPERACAO INTEGRADA A EQUIPE FOI INFORMADA.").conflito,true);
assert.equal(identificar("NAO HOUVE INFORMACAO SUFICIENTE.").valor,"");
assert.equal(identificar("").valor,"");

// Contratos com cadastro e consulta, independentemente da unidade logada.
assert.match(html,/id="origemAcionamento"/);
for(const val of ["CICC","PATRULHAMENTO","ABORDAGEM","MISSAO","OPERACAO","OUTRA"])
 assert.match(html,new RegExp('option value="'+val+'"'));
assert.match(html,/pdf-origem-acionamento\.js\?v=20261106-1/);
assert.match(html,/PdfOrigemAcionamento\?\.analisar\(relatoFonte\)/);
assert.match(html,/aplicarOrigemAcionamentoPdf\(dados\.origemAcionamento\)/);
assert.match(html,/origem_acionamento:"origemAcionamento"/);
assert.match(html,/origem_acionamento_detalhe:"origemAcionamentoDetalhe"/);
assert.match(html,/origem_acionamento: origemAcionamentoCampo\.value \|\| null/);
assert.match(html,/Descreva a origem do atendimento quando selecionar Outra/);
assert.match(html,/#campoOrigemAcionamentoDetalhe\[hidden\]\{display:none!important\}/);
assert.match(html,/origem_ocorrencia: document\.getElementById\("origemOcorrenciaBope"\)/);
assert.match(consulta,/origem_acionamento','Origem do acionamento/);
assert.match(mapa,/origem_acionamento','Origem do acionamento/);
const router=fs.readFileSync(path.join(raiz,"cadastro.html"),"utf8");
assert.match(router,/Origem da ocorrência — BOPE/,"Não substituir origem institucional própria do BOPE");
console.log("Origem CICC, patrulhamento, abordagem, missão e operação, bloqueios de falsos positivos e integração de cadastro: OK.");
