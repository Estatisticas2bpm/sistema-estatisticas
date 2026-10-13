'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const box={window:{}};vm.runInNewContext(read('auditoria-exportacao.js'),box);
const A=box.window.AuditoriaCsv;
const fatos=[
 {nivel:'media',tipo:'Possível repetição de BO',texto:'Confirmar documentos',o:{unidade_id:'u1',id:'r1',numero_bo:'BO-100',data_ocorrencia:'2026-10-01',ocorrencia:'FURTO',bairro:'CENTRO'}},
 {nivel:'alta',tipo:'Natureza',texto:'=SOMA(1;2)',o:{unidade_id:'u1',id:'r2',numero_bo:'=BO300',data_ocorrencia:'2026-10-02',ocorrencia:'',bairro:'CENTRO'}},
 {nivel:'baixa',tipo:'Endereço',texto:'Sem logradouro',o:{unidade_id:'u2',id:'r3',numero_bo:'B-20',data_ocorrencia:'2026-10-03',ocorrencia:'ROUBO',bairro:''}}
];
const todas=A.linhas(fatos,'');
assert.equal(todas.length,3);
assert.equal(todas[0].nivel,'alta','severidade deve determinar a ordem');
assert.equal(todas[0].registroId,'r2');
assert.equal(todas[1].registroId,'r1');
assert.equal(A.linhas(fatos,'media').length,1);
assert.equal(A.linhas(fatos,'alta')[0].tipo,'Natureza');
const csv=A.csv(todas,{inicio:'2026-10-01',fim:'2026-10-12',fonte:'consulta paginada'});
assert.ok(csv.startsWith('\uFEFF'));
assert.match(csv,/SIE-CPC/);
assert.match(csv,/consulta paginada/);
assert.match(csv,/PENDENTE DE CONFERÊNCIA DOCUMENTAL/);
assert.match(csv,/"'=BO300"/);
assert.match(csv,/"'=SOMA\(1;2\)"/);
assert.match(csv,/RLS/);
assert.equal(A.linhas([],'' ).length,0);
const html=read('auditoria.html');
assert.match(html,/id="exportarAuditoria"/);
assert.match(html,/auditoria-exportacao\.js\?v=20261012-v1/);
assert.match(html,/window\.AuditoriaCsv\.linhas\(pendencias,\$\('filtro'\)\.value\)/);
assert.match(html,/Possível repetição de BO/);
assert.match(html,/candidatos\.forEach\(mapa=>/);
assert.match(html,/linhas\.forEach\(o=>add\(o,'media','Possível repetição de BO'/);
assert.match(html,/Coordenadas fora da área de referência/);
assert.match(html,/Date\.now\(\)-4\*3600000/);
assert.match(html,/if\(geoPreenchido\(o\)\)/);
assert.match(html,/const candidatos=new Map\(\)/);
console.log('OK: exportação de auditoria por severidade, detalhes rastreáveis e regras geográficas/datas suspeitas.');
