'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const core=require('../pdf-importer-core.js');
const contexto={window:{}};
vm.createContext(contexto);
vm.runInContext(fs.readFileSync(path.join(root,'pdf-historico.js'),'utf8'),contexto);
const historico=contexto.window.PdfHistorico;

const concatenado=[
  'RELATO/HISTÓRICO',
  'A guarnição compareceu ao local e ouviu as partes. O texto menciona que a VTR 999 passou pela avenida durante a diligência.',
  'CÓDIGO VERIFICADOR (MAC): RQZ9VTL - CÓDIGO CRC: 3972461023PP PG. 3/5 POLICIA MILITAR DO ESTADO DE RORAIMA - BOA VISTA - RR VTR PM 231 CMD: SGT PM TESTE MOT: SD PM EXEMPLO',
  'ASSINATURAS'
].join('\n');
const analisado=historico.analisar(concatenado);
assert.equal(analisado.texto,'A GUARNIÇÃO COMPARECEU AO LOCAL E OUVIU AS PARTES. O TEXTO MENCIONA QUE A VTR 999 PASSOU PELA AVENIDA DURANTE A DILIGÊNCIA.');
assert.equal(analisado.necessitaConferencia,false);
assert.doesNotMatch(analisado.texto,/CÓDIGO|CRC|PP PG|CMD|MOT|VTR PM 231/);

const multipagina='RELATO HISTÓRICO\nA equipe iniciou o poli-\ncial atendimento.\nCódigo CRC: 1234567890\nPágina 2 de 3\nPOLÍCIA MILITAR\nA vítima confirmou os fatos.\nASSINATURAS';
assert.equal(historico.extrair(multipagina),'A EQUIPE INICIOU O POLICIAL ATENDIMENTO. A VÍTIMA CONFIRMOU OS FATOS.');
assert.equal(historico.extrair('RELATO/HISTÓRICO\nA VTR 235 foi empregada durante o atendimento.\nASSINATURAS'),'A VTR 235 FOI EMPREGADA DURANTE O ATENDIMENTO.');
const semFim=historico.analisar('RELATO/HISTÓRICO\nTexto sem seção de assinaturas.');
assert.equal(semFim.texto,'TEXTO SEM SEÇÃO DE ASSINATURAS.');
assert.equal(semFim.necessitaConferencia,true);

assert.deepEqual(core.extrairVtr('VTR PM 231\nCMD: SGT TESTE\nMOT: SD EXEMPLO'),{valor:'231',automatico:true,ambiguo:false,candidatos:['231'],origem:'identificação da guarnição'});
assert.equal(core.extrairVtr('A VIATURA 123 realizou apoio.').valor,'123');
assert.equal(core.extrairVtr('BO 12345/2026 CRC 987654321').valor,'');
const vtrConflitante=core.extrairVtr('VTR 231\nCMT: A\nMOT: B\nA VIATURA 235 prestou apoio.');
assert.equal(vtrConflitante.valor,'');
assert.equal(vtrConflitante.ambiguo,true);
assert.deepEqual(vtrConflitante.candidatos,['231','235']);

assert.deepEqual(core.detectarGrupamento('Guarnição do Tático Setorial realizou o atendimento.','MARIA DA PENHA'),{valor:'TÁTICO SETORIAL',conflito:false,confirmacao:false,origem:'menção explícita no PDF'});
assert.equal(core.detectarGrupamento('Atendimento comum.','VIOLÊNCIA DOMÉSTICA').valor,'AME');
assert.equal(core.detectarGrupamento('Equipe AME realizou apoio.','LESÃO CORPORAL').confirmacao,true);
const conflito=core.detectarGrupamento('Equipe do Tático Setorial e equipe AME participaram.','VIOLÊNCIA DOMÉSTICA');
assert.equal(conflito.valor,null);
assert.equal(conflito.conflito,true);

const cadastro=fs.readFileSync(path.join(root,'cadastro.html'),'utf8');
const base=fs.readFileSync(path.join(root,'cadastro-base.html'),'utf8');
[...cadastro.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(resultado=>resultado[1].trim()).filter(Boolean)
  .forEach(codigo=>assert.doesNotThrow(()=>new Function(codigo),'JavaScript inline de cadastro.html deve ter sintaxe válida'));
assert.match(cadastro,/ehBatalhaoTerritorialCadastro=\['1BPM','2BPM'\]\.includes\(siglaCadastro\)/);
assert.match(cadastro,/blocoGrupamento=ehBatalhaoTerritorialCadastro/);
assert.match(cadastro,/campoCompanhia" hidden aria-hidden="true/);
assert.match(cadastro,/window\.SIE_CADASTRO_PERMITE_CIA/);
assert.match(cadastro,/window\.aplicarSugestaoGrupamentoPdf=aplicarDeteccaoGrupamento/);
assert.match(cadastro,/grupamentoCorrigidoManualmente/);
assert.match(base,/window\.aplicarSugestaoGrupamentoPdf\?\.\(dados\.grupamentoPdf\)/);
assert.match(base,/PDF_CORE\?\.extrairVtr/);
assert.match(base,/PDF_CORE\?\.detectarGrupamento/);
assert.match(base,/dados\.vtrAnalise\?\.ambiguo/);
console.log('PDF operacional: histórico limpo, VTR segura, AME/Tático e CIA por unidade aprovados.');
