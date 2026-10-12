'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const raw=fs.readFileSync(path.join(__dirname,'../cpc-indicadores-dashboard.js'),'utf8');
const box={window:{},document:{getElementById:()=>null},console};
vm.runInNewContext(raw,box);
const serie=box.window.CpcIndicadoresDashboard.serieEspecializada;
const dadosCipa={status:'ok',data:{fauna:[
  {data_registro:'2026-10-01',quantidade:3},
  {data_registro:'2026-10-03',quantidade:2}
]}};
let v=serie('CIPA',dadosCipa,'2026-10-01','2026-10-03');
assert.deepEqual(Array.from(v.series,p=>p.valor),[3,0,2]);
assert.equal(v.rotulo,'Animais registrados');
const dadosGiro={status:'ok',data:[
  {registrado_em:'2026-10-02T02:30:00Z',quantidade_pessoas:2},
  {registrado_em:'2026-10-02T13:00:00Z',quantidade_pessoas:5}
]};
v=serie('GIRO',dadosGiro,'2026-10-01','2026-10-03');
assert.deepEqual(Array.from(v.series,p=>p.valor),[1,1,0],'cada abordagem conta uma, não pessoas');
assert.equal(serie('CIPG',{status:'erro'},'2026-10-01','2026-10-03'),null,'erro sem gráfico');
assert.equal(serie('CIPG',{status:'carregando'},'2026-10-01','2026-10-03'),null,'carregando sem zeros falsos');
v=serie('CIPG',{status:'ok',data:{servicos:[{data_servico:'2026-10-03'}]}},'2026-10-01','2026-10-03');
assert.deepEqual(Array.from(v.series,p=>p.valor),[0,0,1]);
v=serie('CIPTUR',{status:'ok',data:[{data_infracao:'2026-09-10'},{data_infracao:'2026-10-12'}]},'2026-09-01','2026-10-20');
assert.equal(v.agrupamento,'mês');
assert.deepEqual(Array.from(v.series,p=>p.valor),[1,1]);
assert.equal(serie('CAVALARIA',{status:'ok',data:[]},'2026-10-05','2026-10-04'),null,'período inválido');
console.log('OK: séries especializadas com fuso local, critérios independentes e lacunas.');
