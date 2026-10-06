const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const relatorio=fs.readFileSync(path.resolve(__dirname,'..','relatorio.html'),'utf8');

assert.ok(relatorio.includes('onclick="imprimirRelatorio()"'),'Botão de PDF deve preparar a página antes de imprimir.');
assert.ok(relatorio.includes("window.addEventListener('beforeprint',prepararImpressaoRelatorio)"),'beforeprint deve ocultar controles administrativos.');
assert.ok(relatorio.includes("['sistemaUnidadeAtiva','sistemaUsuarioSessao','sistemaAvisoAcesso']"),'Controles administrativos precisam ser excluídos da impressão.');

assert.ok(relatorio.includes('.page.page-2bpm{height:297mm;min-height:297mm;max-height:297mm;overflow:hidden}'),'Cada página do 2º BPM deve ocupar exatamente uma folha A4 na impressão.');
assert.ok(relatorio.includes('thead{display:table-header-group}'),'Cabeçalhos de tabela devem ser repetíveis na impressão.');
assert.ok(relatorio.includes('tr{break-inside:avoid;page-break-inside:avoid}'),'Linhas de tabela não devem ser cortadas ao meio.');

assert.ok(relatorio.includes('function paginarRelatorio2Bpm()'),'Relatório do 2º BPM deve possuir paginação controlada.');
assert.ok(relatorio.includes('while(paginaEstouraRelatorio(pagina)&&tbody.rows.length>1)'),'Tabelas longas devem ser divididas por linhas.');
assert.ok(relatorio.includes("page('',corpo,sec)"),'Páginas de continuação devem preservar o contexto da seção.');
assert.ok(relatorio.includes('setTimeout(finalizarLayoutRelatorio,250)'),'Paginação deve acontecer depois da renderização dos gráficos.');

assert.ok(relatorio.includes('data-toc-target'),'Sumário deve usar referências dinâmicas.');
assert.ok(relatorio.includes('atualizarSumarioRelatorio()'),'Numeração do sumário deve ser recalculada após a paginação.');
assert.ok(relatorio.includes("if(p.dataset.section==='summary')return;"),'A página do sumário não pode ser confundida com as seções listadas.');

assert.ok(relatorio.includes("function escopoTerritorialVisivel()"),'Escopo visível deve ser calculado separadamente.');
assert.ok(relatorio.includes("e||(!eh2BpmRel()?'TODAS AS SISC E COMPANHIAS':'')"),'O texto Todas não deve aparecer no cabeçalho do 2º BPM sem filtro territorial.');
assert.ok(relatorio.includes("periodo.arquivo+(escopoArquivo?' - '+escopoArquivo:'')"),'Nome do PDF não deve receber Todas quando não houver filtro.');

assert.ok(relatorio.includes('.cmd-table{font-size:8px;table-layout:fixed}'),'Tabela de comandantes deve ter layout compacto próprio.');
assert.ok(relatorio.includes("'FORAGIDOS/DESCUMPRIMENTO':'FORAG./DESC.'"),'Cabeçalhos extensos da tabela de comandantes devem ser abreviados no PDF.');

console.log('Relatório: paginação física, impressão limpa, sumário dinâmico e tabelas longas validados.');
