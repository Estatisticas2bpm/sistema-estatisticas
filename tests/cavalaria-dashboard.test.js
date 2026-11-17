const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const dash=fs.readFileSync(path.join(root,'dashboard.html'),'utf8');
const stats=fs.readFileSync(path.join(root,'cavalaria-dashboard.js'),'utf8');
const summary=fs.readFileSync(path.join(root,'estatistica-indicadores.js'),'utf8');
assert.match(index,/Panorama Estatístico da Cavalaria/);
assert.match(index,/Atividades registradas/);
assert.match(index,/renderResumoCavalaria\(d,dAnt,hoje,pc\)/);
assert.doesNotMatch(index,/href="cavalaria-produtividade\.html"/);
assert.match(dash,/secCavalariaProdutividade/);
assert.match(dash,/cavalaria-dashboard\.js\?v=/);
for(const id of ['cavServicos','cavOcorrenciasPoliciais','cavLegados','cavPelotao1','cavPelotao2',
 'chartCavModalidades','chartCavContextos','chartCavEvolucao','tabCavLocais','tabCavComandantes','tabCavViaturas','tabCavOcorrencias'])
 assert.ok(dash.includes('id="'+id+'"'),'Indicador ausente: '+id);
assert.match(dash,/x\.cavalaria_classe_registro==='OCORRENCIA'/);
assert.match(dash,/ATIVIDADE_CAVALARIA/);
assert.doesNotMatch(dash,/db\.from\('cavalaria_servicos_produtividade'\)/);
assert.match(stats,/VISITA_EDUCATIVA_ESCOLAR/);
assert.match(stats,/POLICIAMENTO_MONTADO/);
assert.match(stats,/function resumir\(dados\)/);
assert.match(summary,/PPEs e atividades informativas/);
const w={};new Function('window',stats+';return window.CavalariaDashboard;')(w);
const reg=(c,t,p)=>({cavalaria_classe_registro:c,cavalaria_tipo_atividade:t,cavalaria_pelotao:p});
const r=w.CavalariaDashboard.resumir([
 reg('ATIVIDADE','VISITA_EDUCATIVA_ESCOLAR','1_PELOTAO'),
 reg('ATIVIDADE','POLICIAMENTO_MONTADO','2_PELOTAO'),
 reg('OCORRENCIA',null,'2_PELOTAO'),reg(null,null,null)
]);
assert.equal(r.atividades.length,2);
assert.equal(r.ocorrencias.length,1);
assert.equal(r.legados.length,1);
assert.equal(r.pelotao('2_PELOTAO').length,2);
console.log('Cavalaria: dashboard e índices por pelotão validados, sem abordagens.');
