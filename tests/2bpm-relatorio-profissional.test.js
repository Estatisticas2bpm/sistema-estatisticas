const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'relatorio.html'),'utf8');
const js=fs.readFileSync(path.join(root,'relatorio-2bpm-profissional.js'),'utf8');
const css=fs.readFileSync(path.join(root,'relatorio-2bpm-profissional.css'),'utf8');

assert.ok(html.includes('relatorio-2bpm-profissional.css'));
assert.ok(html.includes('relatorio-2bpm-profissional.js'));
assert.ok(html.includes("if(eh2BpmRel()&&window.buildRelatorio2BpmProfissional)return window.buildRelatorio2BpmProfissional();"));
assert.ok(html.includes("if(!eh2BpmRel())finalizarLayoutRelatorio()"),'2º BPM não deve passar pelo paginador legado antes da impressão.');

assert.ok(js.includes("window.buildRelatorio2BpmProfissional=async function()"));
assert.ok(js.includes("scopeLabel()"));
assert.ok(!js.includes("TODAS AS SISC E COMPANHIAS"),'Renderer profissional não pode possuir fallback “Todas”.');
assert.ok(!js.includes("Todas</"),'Renderer profissional não pode imprimir “Todas”.');

assert.ok(js.includes("topComOutros(occ,15,'OUTRAS OCORRÊNCIAS')"),'Principais ocorrências devem usar Top 15 + outras.');
assert.ok(js.includes("topComOutros(hoods,9,'OUTROS')"),'Gráfico de bairros deve ser resumido.');
assert.ok(js.includes("distribuir(cmdData,26)"),'Comandantes devem ser distribuídos de forma balanceada, sem blocos fixos de 20.');
assert.ok(js.includes("RESULTADOS OPERACIONAIS"),'Quadro de comandantes deve usar coluna consolidada.');
assert.ok(js.includes("rank(d,'endereco',15)"),'Logradouros devem usar Top 15 para evitar quebra de página.');
assert.ok(js.includes("r2-kpis"),'Página de apreensões deve aproveitar melhor a área com indicadores-resumo.');
assert.ok(js.includes("return p.join(' · ')||'—';"),'Indicadores zerados não devem poluir a linha do comandante.');
assert.ok(js.includes("resultadoTotalComandantes(cmdData)"),'Total dos comandantes também deve ocultar indicadores zerados.');
assert.ok(js.includes("comandantesNaPaginaResultados"),'Períodos curtos devem poder incorporar comandantes à página de atuações.');
assert.ok(js.includes("if(temDetalhesApreensao)"),'Página de apreensões só deve existir quando houver dados relevantes.');
assert.ok(js.includes("if(weapons.length)blocosArmasMunicoes.push"),'Bloco de armas vazio não deve ser exibido.');
assert.ok(js.includes("if(ammo.length)blocosArmasMunicoes.push"),'Bloco de munições vazio não deve ser exibido.');
assert.ok(!js.includes("AME e Tático Setorial são classificações operacionais"),'Nota explicativa de AME/Tático não deve aparecer no relatório executivo.');
assert.ok(!js.includes("A coluna “Resultados operacionais” exibe somente indicadores maiores que zero"),'Nota explicativa dos comandantes não deve aparecer.');
assert.ok(!js.includes("A quantidade física considera a forma visual registrada"),'Nota metodológica de entorpecentes não deve aparecer.');

assert.ok(js.includes("chart.toBase64Image"),'Gráficos do PDF devem ser transformados em imagens estáticas.');
assert.ok(js.includes("animation:false"),'Gráficos devem estar estáveis antes da impressão.');
assert.ok(js.includes("await Promise.all([...doc.images]"),'Renderer deve aguardar imagens antes de concluir.');
assert.ok(js.includes("document.fonts?.ready"),'Renderer deve aguardar fontes.');

assert.ok(css.includes('body>*:not(#document){display:none!important}'),'Somente o documento deve ser imprimível.');
assert.ok(css.includes('.r2-page{position:relative;width:210mm;height:297mm'),'Cada página profissional deve representar uma folha A4.');
assert.ok(!css.includes('overflow:hidden'),'Conteúdo não pode ser escondido para simular paginação.');
assert.ok(css.includes('.r2-commander-table th:nth-child(4)'),'Tabela de comandantes deve possuir layout próprio.');

assert.ok(html.includes(".replace(/\\bPM\\b/g,' ')"),'Normalização do comandante deve ignorar o token PM para consolidar aliases.');

console.log('2º BPM: renderer profissional A4 validado por contrato.');
