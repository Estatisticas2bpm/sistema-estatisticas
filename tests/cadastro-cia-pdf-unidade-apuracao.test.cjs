'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const core=fs.readFileSync(path.join(root,'pdf-companhia.js'),'utf8');
const base=fs.readFileSync(path.join(root,'cadastro-base.html'),'utf8');
const rota=fs.readFileSync(path.join(root,'cadastro.html'),'utf8');
const mapa=fs.readFileSync(path.join(root,'mapa-criminal.html'),'utf8');
const win={},ctx={window:win};
vm.createContext(ctx);vm.runInContext(core,ctx);
const extrair=win.PdfCompanhia.extrair;
const casos=[
 ['DADOS DA OCORRÊNCIA\nUnidade de Apuração: 1ª Companhia do 2º Batalhão\nData/Hora do Fato Início: 29/10/2026 19:00\nRELATO/HISTÓRICO\n', '1ª CIA'],
 ['Dados da Ocorrência\nUnidade de Apuração:\n2ª CIA / 1º BPM\nLocal do Fato\n','2ª CIA'],
 ['Unidade de Apuração: 2º Batalhão PM - 3ª Cia\nData/Hora do Fato Início: 30/10/2026 09:00','3ª CIA'],
 ['Unidade de Apuracao: 1a Companhia da PMRR\nData/Hora','1ª CIA'],
 ['Unidade de Apuração: Polícia Militar de Roraima\n3ª Companhia do 2º BPM\nLocal do Fato','3ª CIA'],
 ['Unidade de Apuração: CIA 2 - 2º BPM\nData/Hora','2ª CIA'],
 ['Unidade de Apuração: 2ª CIA\nUnidade de Apuração: 2ª Companhia','2ª CIA']
];
for(const [pdf,valor] of casos){
  const out=extrair(pdf);
  assert.equal(out.companhia,valor,'Pré-preenchimento falhou no trecho: '+pdf.slice(0,80));
  assert.equal(out.ambigua,false);
  assert.ok(out.unidadeApuracao.length>0);
}
const desconhecidos=[
 'RELATO/HISTÓRICO\nA 2ª Companhia prestou apoio no atendimento.',
 'Unidade de Apuração: 2º BPM\nLocal do Fato\n1ª CIA esteve no local',
 'Unidade de Apuração: CIPTUR\nLocal do Fato\n1ª CIA',
 'DADOS DA OCORRÊNCIA\nLocal do Fato: Zona Oeste\nRELATO/HISTÓRICO: 1ª CIA'
];
for(const pdf of desconhecidos){
  const out=extrair(pdf);
  assert.equal(out.companhia,'','Não se deve inferir CIA de outra seção/unidade/bairro');
}
const ambiguo=extrair('Unidade de Apuração: 1ª CIA\nUnidade de Apuração: 3ª CIA\nLocal do Fato');
assert.equal(ambiguo.companhia,'');
assert.equal(ambiguo.ambigua,true);
assert.equal(extrair('').companhia,'');
assert.equal(extrair(null).companhia,'');

assert.match(base,/<script src="pdf-companhia\.js\?v=20261030-1"><\/script>/);
assert.match(base,/<input id="companhia" name="companhia"/);
assert.match(base,/ciaDocumento = window\.PdfCompanhia\?\.extrair\(texto\)/);
assert.match(base,/companhiaExtraida: ciaDocumento\.companhia/);
assert.match(base,/document\.getElementById\("companhia"\)\.value = dados\.companhiaExtraida \|\| ""/);
assert.match(base,/numero_bo:"numeroBo",cia_unidade_apuracao:"companhia"/);
assert.match(base,/cia_unidade_apuracao: document\.getElementById\("companhia"\)\.value\.trim\(\) \|\| null/);
assert.match(base,/não representa necessariamente a área de responsabilidade territorial/);
assert.match(base,/Não será inferida pelo bairro ou unidade logada/);
assert.match(rota,/cadastro-base\.html/,'Cadastro real usa esta base');
assert.match(mapa,/\.map\(x=>String\(x\.cia_unidade_apuracao\|\|''\)\.trim\(\)\)/,'Mapa usa coluna persistida de CIA');
console.log('CIA: extração da Unidade de Apuração, ambiguidade, não-inferência territorial, edição, salvamento e filtro do mapa aprovados.');
