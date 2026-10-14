'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const box={window:{},console};
vm.runInNewContext(read('estatistica-indicadores.js'),box);
vm.runInNewContext(read('cpc-rastreabilidade.js'),box);
const R=box.window.CpcRastreabilidade;
const docs={fauna:[{id:'f1',data_registro:'2026-10-12',numero_tr:'TR-8',nome_comum:'Arara',quantidade:2}],
  embargos:[{id:'e1',data_embargo:'2026-10-11',numero:'E-3',area_embargada_ha:2.75}],
  autos:[{id:'a1',data_autuacao:'2026-10-10',numero:'AI-5',descricao_infracao:'Fauna',valor_multa:5000}]};
const occ=[{id:'oc1',data_ocorrencia:'2026-10-01',numero_bo:'BO-7',ocorrencia:'Crime ambiental'}];
const cipa=R.registros('CIPA',occ,[],docs);
assert.equal(cipa.length,4);
assert.equal(cipa.find(r=>r.fonte==='CIPA · fauna').quantidade,2);
assert.equal(cipa.find(r=>r.fonte==='CIPA · embargo').quantidade,2.75);
assert.equal(cipa.find(r=>r.fonte==='CIPA · auto de infração').quantidade,5000);
assert.equal(cipa.find(r=>r.fonte==='CIPA · fauna').referencia,'TR-8');
assert.equal(cipa.find(r=>r.fonte==='Ocorrência policial').data,'2026-10-01');
const clin=R.registros('CIPG',[],[],{
  servicos:[{id:'srv1',unidade_id:'cg',data_servico:'2026-10-01',documento_referencia:'DOC-1',posto_codigo:'POSTO',situacao:'SEM ALTERACAO',efetivo_ordinario:2,efetivo_svi:1}],
  eventos:[{id:'evt1',servico_id:'srv1',tipo_evento:'ENTRADA DE PM NO HOSPITAL',data_evento:'2026-10-02'}]
});
assert.equal(clin.length,2);
assert.equal(clin.find(r=>r.fonte==='CIPG · serviço').quantidade,3,'empregos de efetivo, não PM únicos');
assert.equal(clin.find(r=>r.fonte==='CIPG · evento').data,'2026-10-02');
assert.equal(R.registros('CAVALARIA',[],[],[{id:'srv2',data_servico:'2026-10-12',numero_documento:'PPE-2',abordagens_pessoas:17}])[0].quantidade,17);
const autosCiptur=R.registros('CIPTUR',[],[],[
  {id:'auto-uuid-01',data_infracao:'2026-10-04',codigo_infracao:'51.691',houve_remocao:true},
  {id:'auto-uuid-02',data_infracao:'2026-10-05',codigo_infracao:'51.691',houve_remocao:false}
]);
assert.equal(autosCiptur.length,2,'dois autos permanecem dois registros distintos');
assert.deepEqual(Array.from(autosCiptur,x=>x.referencia).sort(),['auto-uuid-01','auto-uuid-02']);
assert.ok(autosCiptur.every(x=>x.descricao.includes('51.691')),'código de infração preservado como classificação');
assert.ok(autosCiptur.some(x=>x.descricao.includes('remoção indicada')));
assert.ok(R.csv(autosCiptur).includes('auto-uuid-02'),'CSV exporta ID único em vez de código repetido');
const giro=R.registros('GIRO',[],[],[{id:'g',registrado_em:'2026-10-02T01:00:00Z',tipo_abordagem:'MOTO',quantidade_pessoas:2}]);
assert.equal(giro[0].data,'2026-10-01 21:00','data exibida deve ser UTC−04 em Roraima');
assert.equal(giro[0].quantidade,2);
assert.equal(R.registros('GIRO',occ,[],null).length,1,'falha no GIRO não pode apagar BO');
assert.equal(R.registros('CAVALARIA',[],[],null).length,0);
assert.equal(R.registros('CIPTUR',[],[],null).length,0);
const csv=R.csv([{fonte:'CIPA · fauna',data:'2026-10-12',referencia:'=SOMA(1;1)',descricao:'Animal; fauna',quantidade:3,unidade:'animais',criterio:'data_registro'}]);
assert.ok(csv.startsWith('\uFEFF'));
assert.ok(csv.includes('"\'=SOMA(1;1)"'),'CSV deve impedir execução de fórmula');
assert.ok(csv.includes('"Animal; fauna"'),'CSV deve preservar ponto-e-vírgula');
const documento=read('dashboard-cpc.html');
assert.match(documento,/cpc-rastreabilidade\.js\?v=20261014-documento1/);
assert.match(documento,/CpcRastreabilidade\.localGiro\(x\.registrado_em\)/);
const script=read('cpc-indicadores-dashboard.js');
assert.match(script,/renderizarTrilha\(sigla,linhas,inicio,fim,err\)/);
assert.match(script,/data-abrir-origem/);
assert.match(script,/CpcRastreabilidade\.registros/);
assert.match(script,/servicosIds\.has\(String\(x\.servico_id\)\)/);
console.log('OK: trilha de origem CIPA/CIPG/Cavalaria/CIPTUR/GIRO, UTC−04, sanitização CSV e UI de drill-down.');
