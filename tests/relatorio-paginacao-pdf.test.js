const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const relatorio=fs.readFileSync(path.join(root,'relatorio.html'),'utf8');
const renderer=fs.readFileSync(path.join(root,'relatorio-print.js'),'utf8');
const css=fs.readFileSync(path.join(root,'relatorio-print.css'),'utf8');

assert.ok(relatorio.includes('id="relatorioPrint"'),'Relatório físico deve ter DOM independente.');
assert.ok(relatorio.includes('window.RelatorioPrint.render2Bpm(model)'),'2º BPM deve usar o renderer exclusivo.');
assert.ok(relatorio.includes('window.RelatorioPrint.prepareForPrint()'),'Impressão deve aguardar a composição física.');
assert.ok(!relatorio.includes('function paginarRelatorio2Bpm()'),'Paginador legado não pode coexistir com o compositor A4.');
assert.ok(!relatorio.includes('setTimeout(finalizarLayoutRelatorio'),'Temporizador arbitrário do layout antigo deve ser removido.');

assert.match(css,/\.print-page\s*\{[\s\S]*?width:\s*210mm;[\s\S]*?height:\s*297mm;/,'Cada .print-page deve representar uma folha A4.');
assert.ok(!/\.print-page\s*\{[^}]*overflow\s*:\s*hidden/i.test(css),'Conteúdo excedente não pode ser ocultado.');
assert.ok(renderer.includes('class A4Composer'),'Compositor A4 não encontrado.');
assert.ok(renderer.includes('rows.forEach(cells=>'),'Tabelas devem ser compostas linha a linha.');
assert.ok(renderer.includes("config.title+' - CONTINUAÇÃO'"),'Páginas continuadas devem repetir o título.');
assert.ok(renderer.includes('const table=makeTable(config.headers,[]'),'Cada continuação deve reconstruir o cabeçalho da tabela.');
assert.ok(renderer.includes("makeRow(config.totalRow,'print-total')"),'Total deve ser inserido pelo compositor no último segmento.');
assert.ok(renderer.includes('composer.removeEmptyPages();composer.updateSummary();composer.numberPages()'),'Sumário e rodapés devem ser calculados após a paginação.');
assert.ok(renderer.includes("record.footer.textContent='Página '+(index+1)+' de '+total"),'Rodapé deve refletir páginas físicas.');
assert.ok(renderer.includes("const image=create('img','print-chart')"),'Gráficos impressos devem ser imagens estáticas.');
assert.ok(renderer.includes("const canvases=this.container.querySelectorAll('canvas').length"),'Validação deve rejeitar canvas no documento final.');
assert.ok(renderer.includes('const overflow=pages.filter(x=>x.overflow)'),'Validação deve rejeitar páginas com overflow.');
assert.ok(renderer.includes('const empty=pages.filter'),'Validação deve rejeitar páginas vazias.');

assert.ok(relatorio.includes("const cia=companhia.value?companhia.options[companhia.selectedIndex]?.text:''"),'Filtro vazio não pode gerar “Todas”.');
assert.ok(relatorio.includes("periodo.arquivo+(escopoArquivo?' - '+escopoArquivo:'')"),'Nome do PDF só deve incluir filtro real.');
assert.ok(renderer.includes("headers:['ITEM','COMANDANTE','OCORRÊNCIAS','RESULTADOS OPERACIONAIS']"),'Tabela de comandantes deve usar quatro colunas legíveis.');
assert.ok(!renderer.includes('i+=20'),'Comandantes não podem ser divididos por quantidade fixa.');

console.log('Relatório: compositor A4, tabelas dinâmicas, gráficos estáticos, sumário e rodapés validados.');
