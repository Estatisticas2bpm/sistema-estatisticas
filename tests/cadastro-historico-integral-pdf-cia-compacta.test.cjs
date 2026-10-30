'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const base=fs.readFileSync(path.join(root,'cadastro-base.html'),'utf8');
const rota=fs.readFileSync(path.join(root,'cadastro.html'),'utf8');
const parser=fs.readFileSync(path.join(root,'pdf-historico.js'),'utf8');
const ctx={window:{}};
vm.createContext(ctx);
vm.runInContext(parser,ctx);
const extrair=ctx.window.PdfHistorico.extrair;

const relato='A guarnição iniciou o atendimento às 20h50.\n'+
  'A vítima informou que a pessoa esteve na residência.\n'+
  'Foram recolhidos 02 objetos, R$ 224,00 e registrada a situação.\n\n'+
  'As declarações seguiram literalmente como no documento.\n'+
  'Era o que havia a relatar.\n';
const documento='GOVERNO DO ESTADO DE RORAIMA\nDADOS DA OCORRÊNCIA\n'+
  'Unidade de Apuração: 2ª CIA\nOBJETO(S) ENVOLVIDO(S)\n01 CELULAR\n'+
  'RELATO/HISTÓRICO\n'+relato+'\nASSINATURAS\nPOLICIAL MILITAR\nImpresso por: Operador';
assert.equal(extrair(documento),relato.replace(/\s+/g,' ').trim().toLocaleUpperCase('pt-BR'));
assert.doesNotMatch(extrair(documento),/ASSINATURAS|IMPRESSO POR/);
assert.doesNotMatch(extrair(documento),/^RESUMO\s*:/);
assert.doesNotMatch(extrair(documento),/OBJETO\(S\) ENVOLVIDO\(S\)/);
const relatoLongo=Array.from({length:35},(_,i)=>'Parágrafo '+(i+1)+': fato registrado integralmente.').join('\n');
assert.equal(extrair('RELATO/HISTORICO\n'+relatoLongo+'\nASSINATURAS'),relatoLongo.replace(/\s+/g,' ').toLocaleUpperCase('pt-BR'));
assert.ok(extrair('RELATO/HISTÓRICO\n'+relatoLongo+'\nASSINATURAS').length>600);
assert.equal(extrair('DADOS DA OCORRÊNCIA\nSem seção narrativa'),'');
assert.equal(extrair('RELATO/HISTÓRICO\nLinha sem bloco de assinaturas.'),'LINHA SEM BLOCO DE ASSINATURAS.');
assert.equal(extrair('RELATO/HISTÓRICO\r\nPrimeira linha\r\n\r\nSegunda linha\r\nASSINATURAS'),'PRIMEIRA LINHA SEGUNDA LINHA');
assert.equal(extrair('RELATO / HISTÓRICO:\nO militar compareceu.\nASSINATURAS'),'O MILITAR COMPARECEU.');

const impresso='RELATO/HISTÓRICO\nEncontrava-\nse no local. A vítima informou que estava separada\n'+
  'Impresso por: Operador - IP de Registro: 0.0.0.0 Página 3 de 4\n'+
  'Data de Impressão: 18/10/2026 06:45:09 PPe - Procedimentos Policiais Eletrônicos\n'+
  'GOVERNO DO ESTADO DE RORAIMA\nPOLÍCIA MILITAR\n'+
  '1ª COMPANHIA DO 2º BATALHÃO DE POLÍCIA MILITAR - BOA VISTA - RR\n'+
  'BOLETIM DE OCORRÊNCIA Nº: 00000001/2026\n'+
  'do suposto autor havia um ano.\nEra o que tinha a relatar.\n'+
  'VTR 235\nCMT: SGT TESTE\nMOT: TESTE\nP3: TESTE\nASSINATURAS\n';
assert.equal(extrair(impresso),'ENCONTRAVA-SE NO LOCAL. A VÍTIMA INFORMOU QUE ESTAVA SEPARADA DO SUPOSTO AUTOR HAVIA UM ANO. ERA O QUE TINHA A RELATAR.');
assert.equal(extrair('RELATO/HISTÓRICO\nA VTR 235 foi empregada.\nASSINATURAS'),'A VTR 235 FOI EMPREGADA.');
const bloco=base.slice(base.indexOf('function extrairDadosOcorrenciaPdf(texto) {'),base.indexOf('async function preencherEnderecoPdfAutomatico(dados)'));
assert.match(bloco,/const relatoFonte = extrairRelatoHistoricoIntegralPdf\(texto\)/);
assert.match(bloco,/const relato = relatoFonte;/);
assert.doesNotMatch(bloco,/resumirRelatoPdf\s*\(/);
assert.doesNotMatch(bloco,/limparRelatoPdfBruto\s*\(/);
assert.match(bloco,/historico: relato/);
assert.match(bloco,/materialidade: objetos \? resumirMaterialidadePdf\(objetos\[1\]\) : ""/);
assert.match(base,/document\.getElementById\("mo"\)\.value = dados\.historico;/);
assert.match(base,/document\.getElementById\("materialidade"\)\.value = dados\.materialidade;/);
assert.match(base,/historico_resumido: document\.getElementById\("mo"\)\.value \|\| null/);
assert.match(base,/materialidade: document\.getElementById\("materialidade"\)\.value \|\| null/);
assert.match(base,/return window\.PdfHistorico\?\.extrair\(texto\) \|\| "";/);
assert.match(base,/Relato\/HISTÓRICO completo \(texto contínuo\)/);
assert.match(base,/textarea id="mo" name="mo" rows="10"/);
assert.match(base,/<div class="campo">\s*<label for="companhia">CIA \(Unidade de Apuração\)<\/label>/);
assert.doesNotMatch(base,/<div class="campo duplo">\s*<label for="companhia">/);
assert.match(base,/class="campo inteiro" id="campoMotivo"/);
assert.match(base,/CIA \(Unidade de Apuração\)/);
assert.match(base,/<script src="pdf-historico\.js\?v=20261030-1"><\/script>/);
assert.match(rota,/cadastro-base\.html/);
console.log('Histórico integral normalizado, paginação limpa, CIA compacta e materialidade separada.');
