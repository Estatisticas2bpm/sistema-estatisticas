const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const relatorio=fs.readFileSync(path.join(root,'relatorio.html'),'utf8');
const printRenderer=fs.readFileSync(path.join(root,'relatorio-print.js'),'utf8');

assert.ok(relatorio.includes("function eh2BpmRel(){return String(unidadeRel().sigla||'').toUpperCase()==='2º BPM'}"));
assert.match(relatorio,/const logo2BpmPdf='logo-2bpm-novo\.png';/);
assert.ok(fs.existsSync(path.join(root,'logo-2bpm-novo.png')),'Arquivo do brasão do 2º BPM deve existir.');

const modeloInicio=relatorio.indexOf('function criarModeloRelatorio2Bpm');
const modeloFim=relatorio.indexOf('async function buildRelatorio2Bpm',modeloInicio);
const modelo=relatorio.slice(modeloInicio,modeloFim);
assert.ok(modelo.includes("unit:{sigla:'2º BPM',name:'2º BATALHÃO DE POLÍCIA MILITAR'}"));
assert.ok(modelo.includes("logos:{pmrr:'brasao-pmrr.png',unit:logo2BpmPdf}"),'Modelo deve fornecer os dois brasões ao renderer A4.');
assert.ok(printRenderer.includes('pmrr.src=model.logos.pmrr'));
assert.ok(printRenderer.includes('unit.src=model.logos.unit'));
assert.ok(printRenderer.includes("unit.alt='Brasão do 2º Batalhão de Polícia Militar'"));

// A personalização das demais unidades permanece intacta.
assert.match(relatorio,/logoCipturPdf='assets\/logos\/ciptur-brasao\.png'/);
assert.match(relatorio,/assets\/logos\/giro-brasao\.svg/);
assert.match(relatorio,/<div class="cover-brand">SIE-CPC<\/div>/);

console.log('2º BPM: brasões institucionais fornecidos pelo modelo e renderizados na capa A4.');
