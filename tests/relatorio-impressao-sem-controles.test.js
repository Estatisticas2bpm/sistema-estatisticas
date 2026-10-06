const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const relatorio=fs.readFileSync(path.resolve(__dirname,'..','relatorio.html'),'utf8');

assert.ok(relatorio.includes('@media print'),'CSS de impressão não encontrado.');
assert.ok(relatorio.includes('.toolbar,#sistemaUsuarioSessao{display:none!important}'),'Toolbar e sessão devem permanecer ocultos na impressão.');
assert.ok(relatorio.includes('#sistemaUnidadeAtiva,#sistemaAvisoAcesso{display:none!important}'),'Seletor de unidade e avisos não podem aparecer no PDF.');

console.log('Relatório: controles do painel ocultados no PDF/impressão.');
