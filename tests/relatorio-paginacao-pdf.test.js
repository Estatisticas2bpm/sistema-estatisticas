const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const relatorio=fs.readFileSync(path.resolve(__dirname,'..','relatorio.html'),'utf8');

assert.ok(relatorio.includes('onclick="imprimirRelatorio()"'),'Botão de PDF deve preparar a página antes de imprimir.');
assert.ok(relatorio.includes('async function imprimirRelatorio()'),'Impressão deve aguardar a finalização assíncrona do layout.');
assert.ok(relatorio.includes('await layoutRelatorioPromise;await finalizarLayoutRelatorio()'),'Impressão não pode iniciar antes da paginação e dos gráficos.');
assert.ok(relatorio.includes("window.addEventListener('beforeprint',prepararImpressaoRelatorio)"),'beforeprint deve permanecer como proteção adicional.');
assert.ok(relatorio.includes("['sistemaUnidadeAtiva','sistemaUsuarioSessao','sistemaAvisoAcesso']"),'Controles administrativos precisam ser excluídos da impressão.');

assert.ok(relatorio.includes('<div class="page-content">'),'Cada folha lógica deve possuir um contêiner de conteúdo mensurável.');
assert.ok(!relatorio.includes('.page.page-2bpm{height:297mm;min-height:297mm;max-height:297mm;overflow:hidden}'),'A paginação não pode apagar conteúdo com overflow oculto.');
assert.ok(relatorio.includes('thead{display:table-header-group}'),'Cabeçalhos de tabela devem ser repetíveis na impressão.');
assert.ok(relatorio.includes('tr,.chart,.photo,.signature{break-inside:avoid;page-break-inside:avoid}'),'Linhas, gráficos e assinatura não devem ser cortados.');

assert.ok(relatorio.includes('function dividirTabelaRelatorio('),'Tabelas extensas devem ter um paginador próprio.');
assert.ok(relatorio.includes('tabela.tHead.cloneNode(true)'),'A continuação deve repetir o cabeçalho da tabela.');
assert.ok(relatorio.includes('linhas.slice(indice).forEach'),'Somente as linhas que não cabem devem ir para a continuação.');
assert.ok(relatorio.includes("' - CONTINUAÇÃO</h3>'"),'Página adicional deve ser identificada como continuação.');
assert.ok(relatorio.includes('function moverBlocoParaContinuacaoRelatorio('),'Conteúdo não tabular também deve ser paginado.');
assert.ok(relatorio.includes('function removerPaginasVaziasRelatorio('),'Páginas lógicas vazias devem ser removidas.');
assert.ok(relatorio.includes("$('document').dataset.paginado==='1'"),'Paginação precisa ser idempotente antes da impressão.');

assert.ok(relatorio.includes('async function aguardarRecursosRelatorio()'),'Recursos visuais devem ser aguardados explicitamente.');
assert.ok(relatorio.includes('setTimeout(fim,80)'),'Finalização deve possuir fallback para abas em segundo plano e impressão automatizada.');
assert.ok(relatorio.includes("chart.update('none')"),'Chart.js deve concluir o desenho sem animação antes da medição.');
assert.ok(relatorio.includes('layoutRelatorioPromise=finalizarLayoutRelatorio();await layoutRelatorioPromise'),'Build deve terminar somente após a paginação.');
assert.ok(!relatorio.includes('setTimeout(finalizarLayoutRelatorio,250)'),'Não deve existir temporizador frágil para finalizar a paginação.');

assert.ok(relatorio.includes('data-toc-target'),'Sumário deve usar referências dinâmicas.');
assert.ok(relatorio.includes('atualizarSumarioRelatorio()'),'Numeração do sumário deve ser recalculada após a paginação.');
assert.ok(relatorio.includes("if(p.dataset.section==='summary')return;"),'A página do sumário não pode ser confundida com as seções listadas.');
assert.ok(relatorio.includes("f.textContent='Página '+(i+1)+' de '+total"),'Rodapé deve usar a quantidade real de páginas DOM.');

assert.ok(relatorio.includes('function escopoTerritorialVisivel()'),'Escopo visível deve ser calculado separadamente.');
assert.ok(relatorio.includes("const cia=companhia.value?companhia.options[companhia.selectedIndex]?.text:''"),'O rótulo Todas não pode ser tratado como filtro territorial selecionado.');
assert.ok(relatorio.includes("e||(!eh2BpmRel()?'TODAS AS SISC E COMPANHIAS':'')"),'O texto Todas não deve aparecer no cabeçalho do 2º BPM sem filtro territorial.');
assert.ok(relatorio.includes("periodo.arquivo+(escopoArquivo?' - '+escopoArquivo:'')"),'Nome do PDF não deve receber Todas quando não houver filtro.');

assert.ok(relatorio.includes('.cmd-table{font-size:8.4px;table-layout:fixed}'),'Tabela de comandantes deve ter layout próprio e legível.');
assert.ok(relatorio.includes("'FORAGIDOS/DESCUMPRIMENTO':'FORAG./DESC.'"),'Cabeçalhos extensos da tabela de comandantes devem ser abreviados no PDF.');

console.log('Relatório: paginação DOM, gráficos finalizados, impressão limpa, sumário e rodapés validados.');
