const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const relatorio=fs.readFileSync(path.join(root,'relatorio.html'),'utf8');
const renderer=fs.readFileSync(path.join(root,'relatorio-print.js'),'utf8');
const css=fs.readFileSync(path.join(root,'relatorio-print.css'),'utf8');

const toolbarAt=relatorio.indexOf('<nav class="toolbar"');
const printAt=relatorio.indexOf('<main id="relatorioPrint"');
assert.ok(toolbarAt>=0&&printAt>toolbarAt,'Container físico deve existir depois da interface, como árvore independente.');
const printTag=relatorio.slice(printAt,relatorio.indexOf('</main>',printAt)+7);
assert.ok(!/toolbar|input|select|button|sistemaUsuarioSessao|sistemaUnidadeAtiva|sistemaAvisoAcesso/.test(printTag),'Interface administrativa não pode integrar #relatorioPrint.');

assert.ok(css.includes('body.relatorio-print-2bpm > *:not(#relatorioPrint)'),'Na mídia impressa somente o documento físico deve permanecer.');
assert.ok(renderer.includes("document.body.classList.add('relatorio-print-2bpm')"),'Renderer deve ativar o modo exclusivo de impressão.');
assert.ok(renderer.includes("this.container.querySelectorAll('button,input,select,.toolbar,#sistemaUsuarioSessao,#sistemaUnidadeAtiva,#sistemaAvisoAcesso').length"),'Validação deve detectar qualquer controle administrativo infiltrado.');
assert.ok(renderer.includes('controlCount:controls'),'Resultado da validação deve expor a contagem de controles.');

console.log('Relatório: interface administrativa fisicamente separada do DOM A4.');
