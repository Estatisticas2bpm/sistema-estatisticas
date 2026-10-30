'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const base=fs.readFileSync(path.join(root,'cadastro-base.html'),'utf8');
const rota=fs.readFileSync(path.join(root,'cadastro.html'),'utf8');
function extrairFuncao(inicio,fim){
  const i=base.indexOf(inicio),j=base.indexOf(fim,i+inicio.length);
  assert.ok(i!==-1&&j>i,'Função não encontrada: '+inicio);
  const ctx={};vm.createContext(ctx);vm.runInContext(base.slice(i,j),ctx);
  return ctx.extrairRelatoHistoricoIntegralPdf;
}
const extrair=extrairFuncao('function extrairRelatoHistoricoIntegralPdf(texto) {','    function limparRelatoPdfBruto(valor) {');
const longo='A guarnição iniciou o atendimento às 20h50.\n'+
  'A Sra. Maria informou que o Sr. José encontrava-se no local.\n'+
  'Foram recolhidos 02 objetos, R$ 224,00, e registrada a situação.\n\n'+
  'As declarações seguiram literalmente como no documento.\n'+
  'Era o que havia a relatar.\n';
const documento='GOVERNO DO ESTADO DE RORAIMA\nDADOS DA OCORRÊNCIA\n'+
  'Unidade de Apuração: 2ª CIA\nOBJETO(S) ENVOLVIDO(S)\n01 CELULAR\n'+
  'RELATO/HISTÓRICO\n'+longo+'\nASSINATURAS\nPOLICIAL MILITAR\nImpresso por: teste';
assert.equal(extrair(documento),longo.trim(),
  'Preservar todas as frases, nomes, números, pontuação, maiúsculas originais e parágrafos');
assert.doesNotMatch(extrair(documento),/ASSINATURAS|Impresso por/);
assert.doesNotMatch(extrair(documento),/^RESUMO\s*:/i);
assert.doesNotMatch(extrair(documento),/OBJETO\(S\) ENVOLVIDO\(S\)/);
const relatoLongo=Array.from({length:35},(_,i)=>'Parágrafo '+(i+1)+': fato registrado integralmente.').join('\n');
assert.equal(extrair('RELATO/HISTORICO\n'+relatoLongo+'\nASSINATURAS'),relatoLongo);
assert.ok(extrair('RELATO/HISTÓRICO\n'+relatoLongo+'\nASSINATURAS').length>600,
  'Não limitar relato ao resumo de 600 caracteres');
assert.equal(extrair('DADOS DA OCORRÊNCIA\nSem seção narrativa'),'');
assert.equal(extrair('RELATO/HISTÓRICO\nLinha sem bloco de assinaturas.'),'Linha sem bloco de assinaturas.');
assert.equal(extrair('RELATO/HISTÓRICO\r\nPrimeira linha\r\n\r\nSegunda linha\r\nASSINATURAS'),'Primeira linha\n\nSegunda linha');
assert.equal(extrair('RELATO / HISTÓRICO:\nO militar compareceu.\nASSINATURAS'),'O militar compareceu.');

const bloco=base.slice(base.indexOf('function extrairDadosOcorrenciaPdf(texto) {'),base.indexOf('async function preencherEnderecoPdfAutomatico(dados)'));
assert.match(bloco,/const relatoFonte = extrairRelatoHistoricoIntegralPdf\(texto\)/);
assert.match(bloco,/const relato = relatoFonte;/);
assert.doesNotMatch(bloco,/resumirRelatoPdf\s*\(/,'Não usar resumos v2, v3, v5 no preenchimento do PDF');
assert.doesNotMatch(bloco,/limparRelatoPdfBruto\s*\(/,'Não cortar linhas do texto narrativo');
assert.match(bloco,/historico: relato/);
assert.match(bloco,/materialidade: objetos \? resumirMaterialidadePdf\(objetos\[1\]\) : ""/);
assert.match(base,/document\.getElementById\("mo"\)\.value = dados\.historico;/);
assert.match(base,/document\.getElementById\("materialidade"\)\.value = dados\.materialidade;/);
assert.match(base,/historico_resumido: document\.getElementById\("mo"\)\.value \|\| null/);
assert.match(base,/materialidade: document\.getElementById\("materialidade"\)\.value \|\| null/);
assert.match(base,/relatoFonte = extrairRelatoHistoricoIntegralPdf/);
assert.match(base,/Relato\/HISTÓRICO integral do PDF/);
assert.match(base,/textarea id="mo" name="mo" rows="10"/);
assert.match(base,/<div class="campo">\s*<label for="companhia">CIA \(Unidade de Apuração\)<\/label>/);
assert.doesNotMatch(base,/<div class="campo duplo">\s*<label for="companhia">/);
assert.match(base,/class="campo inteiro" id="campoMotivo"/);
assert.match(base,/CIA — Unidade de Apuração|CIA \(Unidade de Apuração\)/);
assert.match(rota,/cadastro-base\.html/);
console.log('CIA compacta, campos harmonizados e histórico do PDF integral; materialidade separada e salvamento íntegro.');
