'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const content=fs.readFileSync(path.join(__dirname,'../relatorio-especializado.js'),'utf8');
const indicadorCode=fs.readFileSync(path.join(__dirname,'../estatistica-indicadores.js'),'utf8');
let html='';
const root={set innerHTML(v){html=v},get innerHTML(){return html},querySelectorAll(sel){
  return Array.from({length:(html.match(/<section class="page/g)||[]).length},()=>({querySelector:()=>({textContent:''})}));
}};
const doc={getElementById:()=>root};
const scope={window:{},document:doc,console,Date,Intl,Map,Number,String};
vm.runInNewContext(indicadorCode,scope);
vm.runInNewContext(content,scope);
const fakeQuery={
  select(){return this},gte(){return this},lte(){return this},order(){return this},range(){return Promise.resolve({data:[],error:null})}
};
const db={from(){return Object.create(fakeQuery)}};
const opts={db,inicio:'2026-10-01',fim:'2026-10-12',intervaloComparado:['2026-09-01','2026-09-12'],assinatura:'Assinatura validada'};
(async()=>{
 await scope.window.RelatorioEspecializado.cavalaria({...opts,unidade:{sigla:'CAVALARIA',nome:'Esquadrão Montado'}});
 assert.ok(html.includes('RELATÓRIO ESTATÍSTICO DE PRODUTIVIDADE DA CAVALARIA'));
 assert.ok(html.includes('Serviços registrados'));
 assert.ok(html.includes('Data da execução do serviço'));
 assert.ok(html.includes('SEM REGISTROS NO PERÍODO'));
 assert.equal((html.match(/<section class="page/g)||[]).length,3);
 scope.window.CipgHome={
  consultar:async()=>({servicos:[],eventos:[]}),
  indicadores:()=>({relatoriosServico:0,entradasPmHospital:0,servicosSemAlteracao:0,empregosEfetivo:0,instituicoesAtendidas:0})
 };
 await scope.window.RelatorioEspecializado.cipg({...opts,unidade:{sigla:'CIPG',nome:'Companhia de Guarda'}});
 assert.ok(html.includes('RELATÓRIO ESTATÍSTICO DE SERVIÇOS DE GUARDA'));
 assert.ok(html.includes('Serviços sem alteração'));
 assert.ok(html.includes('não significam policiais únicos'));
 assert.ok(html.includes('SEM REGISTROS NO PERÍODO'));
 assert.equal((html.match(/<section class="page/g)||[]).length,3);
 console.log('OK: geração de relatórios próprios CIPG e Cavalaria com dados vazios.');
})().catch(e=>{console.error(e);process.exitCode=1});
