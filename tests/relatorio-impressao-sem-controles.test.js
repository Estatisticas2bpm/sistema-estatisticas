const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const relatorio=fs.readFileSync(path.resolve(__dirname,'..','relatorio.html'),'utf8');

assert.ok(relatorio.includes('@media print'),'CSS de impressão não encontrado.');
assert.match(relatorio,/\.toolbar[^{}]*,#sistemaUsuarioSessao[^{}]*,#sistemaUnidadeAtiva[^{}]*,#sistemaAvisoAcesso\{display:none!important\}/,'Toolbar, sessão, seletor de unidade e avisos devem permanecer ocultos na impressão.');

console.log('Relatório: controles do painel ocultados no PDF/impressão.');
