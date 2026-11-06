"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,"..");
const modulo=fs.readFileSync(path.join(root,"pdf-envolvimento-institucional.js"),"utf8");
const base=fs.readFileSync(path.join(root,"cadastro-base.html"),"utf8");
const ctx={};
vm.createContext(ctx);
vm.runInContext(modulo,ctx);
const det=ctx.PdfEnvolvimentoInstitucional;
assert.ok(det);
const p=(nome,bloco="Nacionalidade: Brasileira Sexo: Masculino")=>({nome,bloco});
function analisar(pessoa,papel,relato,quantidade=1) {
 return JSON.parse(JSON.stringify(det.analisarPessoa(pessoa,papel,relato,quantidade)));
}
const texto=[
"A EQUIPE POLICIAL DO GRUPO TATICO FOI ACIONADA PELO OFICIAL DE SERVICO.",
"A GUARNICAO PRESTOU APOIO A POLICIA CIVIL NA EXECUCAO DE MANDADO EM DESFAVOR DO POLICIAL MILITAR",
"MATEUS BRUNO LIMA DE SOUSA. APOS AS BUSCAS, O REFERIDO POLICIAL FOI LOCALIZADO."
].join("\n");
const infrator=p("MATEUS BRUNO LIMA DE SOUZA");
const resultado=analisar(infrator,"infrator",texto);
assert.equal(resultado.situacao,"SIM");
assert.equal(resultado.tipo,"POLICIAL_MILITAR");
assert.equal(resultado.origem,"relato vinculado à pessoa");
assert.equal(infrator.nome,"MATEUS BRUNO LIMA DE SOUZA","O nome no cadastro deve ficar intocado.");
assert.ok(texto.includes("SOUSA"),"A narrativa original deve ficar intocada.");
assert.equal(analisar(p("BEATRIZ FICTICIA","Sexo: Feminino"),"vitima",texto).situacao,"","A vítima não é policial porque a guarnição era.");
assert.equal(analisar(p("CAMILO EXEMPLO","Profissão: Policial Militar"),"comunicante",texto).situacao,"SIM","A profissão explícita do comunicante não contamina as outras pessoas.");

const semVinculo="A GUARNICAO DA POLICIA MILITAR FEZ A OCORRENCIA. O POLICIAL MILITAR QUE ACOMPANHOU O RELATO ASSINOU.";
assert.equal(analisar(infrator,"infrator",semVinculo).situacao,"","Não confundir servidor atendente e infrator.");
assert.equal(analisar(infrator,"infrator","O POLICIAL MILITAR MATEUS BRUNO LIMA DE SAUSA ATENDEU.").situacao,"","Não aceitar semelhança arbitrária em nome.");
assert.equal(analisar(p("MATEUS BRUNO LIMA DE SOUSA"),"infrator",texto).tipo,"POLICIAL_MILITAR","Nome exato continua funcionando.");
assert.equal(analisar(infrator,"infrator",texto,2).tipo,"POLICIAL_MILITAR","Com várias pessoas, usar vinculação pelo nome completo.");
assert.equal(analisar(p("OUTRO EXEMPLO"),"infrator",texto,2).situacao,"","Não atribuir profissão de um envolvido a outro.");

// Teste conjunto do leitor de envolvidos já existente no cadastro.
// Todos os nomes, profissões e fatos neste teste são fictícios.
const inicio=base.indexOf("    function extrairPessoasPdf(texto) {");
const fim=base.indexOf("    function quantidadeObjetoPdf(",inicio);
assert.ok(inicio>0 && fim>inicio);
const helper=base.slice(inicio,fim);
const ctxCadastro={
 textoComparavel:x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase(),
 nacionalidadeCodigo:x=>/BRASILEIRA/i.test(String(x))?"BR":"",
 sexoCodigo:x=>/MASCULINO/i.test(String(x))?"M":/FEMININO/i.test(String(x))?"F":""
};
vm.createContext(ctxCadastro);
vm.runInContext(helper,ctxCadastro);
const pdfFicticio=[
 "Nome Civil: CAMILO EXEMPLO (COMUNICANTE )",
 "Nacionalidade: Brasileira Sexo: Masculino",
 "Profissão: Policial Militar",
 "Nome Civil: BEATRIZ FICTICIA (VÍTIMA )",
 "Nacionalidade: Brasileira Sexo: Feminino",
 "Nome Civil: MATEUS BRUNO LIMA DE SOUZA (SUPOSTO AUTOR/INFRATOR )",
 "Nacionalidade: Brasileira Sexo: Masculino",
 "OBJETO(S) ENVOLVIDO(S)",
 "Nenhum Objeto Informado",
 "RELATO/HISTÓRICO",
 texto,
 "ASSINATURAS",
 "CAMILO EXEMPLO", "POLICIAL MILITAR"
].join("\n");
const pessoas=ctxCadastro.extrairPessoasPdf(pdfFicticio);
assert.equal(pessoas.vitimas.length,1);
assert.equal(pessoas.infratores.length,1);
assert.equal(pessoas.envolvidos.length,1);
const classificadas=JSON.parse(JSON.stringify(det.analisarPessoas(pessoas,texto)));
assert.equal(classificadas.infratores[0].tipo,"POLICIAL_MILITAR","Detectar o infrator via histórico mesmo sem campo de profissão.");
assert.equal(classificadas.vitimas[0].situacao,"","Não classificar a vítima pela profissão do comunicante.");
assert.match(base,/pdf-envolvimento-institucional\.js\?v=20261106-2/,"Recarregar módulo de PDF sem versão antiga do cache");
console.log("Regressão SOUSA/SOUZA, BO multipágina fictício e isolamento dos papéis: OK.");
