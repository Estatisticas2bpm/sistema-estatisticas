const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const relatorio=fs.readFileSync(path.resolve(__dirname,'..','relatorio.html'),'utf8');

const printMatch=relatorio.match(/@media print\{[\s\S]*?\}\}/);
assert.ok(printMatch,'CSS de impressão não encontrado.');
const css=printMatch[0];

for(const seletor of ['.toolbar','#sistemaUsuarioSessao','#sistemaUnidadeAtiva','#sistemaAvisoAcesso']){
  assert.ok(css.includes(seletor),`Controle de interface não ocultado na impressão: ${seletor}`);
}
assert.ok(css.includes('display:none!important'),'Controles devem ser forçados a não imprimir.');

console.log('Relatório: controles do painel ocultados no PDF/impressão.');
