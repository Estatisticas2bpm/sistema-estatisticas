'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const analise=fs.readFileSync(path.join(root,'cpc-analise-integrada.js'),'utf8');
const indicadores=fs.readFileSync(path.join(root,'cpc-indicadores-dashboard.js'),'utf8');

const trecho=(src,inicio,fim)=>{
  const a=src.indexOf(inicio),b=src.indexOf(fim,a+inicio.length);
  assert.ok(a>=0&&b>a,'Trecho ausente: '+inicio);
  return src.slice(a,b);
};
const texto=trecho(analise,'function filtro(o,a,ids){','function pessoas(o,tipo){');
const filtro=vm.runInNewContext('('+texto.trim()+')',{
  chave:v=>String(v||'').trim().toUpperCase(),
  contem:(a,b)=>String(a||'').toUpperCase().includes(String(b||'').toUpperCase())
});
const bases=[
  {id:'ch01',unidade_id:'bope',subunidade_operacional_id:'choque',aisc:'AISC 2',sisc:'SISC 1',bairro:'Centro',ocorrencia:'APOIO OPERACIONAL'},
  {id:'ch02',unidade_id:'bope',subunidade_operacional_id:'choque',aisc:'AISC 2',sisc:'SISC 3',bairro:'Centro',ocorrencia:'POLICIAMENTO OSTENSIVO'},
  {id:'ca01',unidade_id:'bope',subunidade_operacional_id:'canil',aisc:'AISC 2',sisc:'SISC 3',bairro:'Centro',ocorrencia:'BUSCA COM CÃES'},
  {id:'ft01',unidade_id:'bope',subunidade_operacional_id:'forca',aisc:'AISC 1',sisc:'SISC 2',bairro:'Aeroporto',ocorrencia:'PRISÃO'},
  {id:'bpm01',unidade_id:'1bpm',subunidade_operacional_id:null,aisc:'AISC 1',sisc:'SISC 2',bairro:'Aeroporto',ocorrencia:'FURTO'}
];
const campos={p_unidade_id:'choque',p_aisc:null,p_sisc:null,p_setor:null,p_companhia:null,p_turno:null,p_bairro:null,p_ocorrencia:null};
const selecionados=rows=>rows.filter(o=>filtro(o,campos,new Set(['choque'])));
assert.deepEqual(selecionados(bases).map(o=>o.id),['ch01','ch02'],'Análise de Choque deve reconhecer o vínculo operacional');
campos.p_sisc='SISC 1';
assert.deepEqual(selecionados(bases).map(o=>o.id),['ch01'],'SISC deve permanecer respeitado junto à seleção operacional');
campos.p_sisc=null;
assert.deepEqual(bases.filter(o=>filtro(o,campos,new Set(['bope','choque','canil','forca']))).map(o=>o.id),['ch01','ch02','ca01','ft01'],'BOPE consolidado não pode duplicar ocorrências');
assert.deepEqual(bases.filter(o=>filtro(o,campos,new Set(['1bpm']))).map(o=>o.id),['bpm01'],'Batalhão regular permanece isolado');
assert.equal(bases.filter(o=>filtro(o,campos,new Set(['gate']))).length,0,'GATE sem BO no período não pode herdar BOPE');
assert.equal(bases.filter(o=>filtro(o,campos,null)).length,5,'Visão CPC consolidada não descarta BOs');

const inicio=indicadores.indexOf('const ids=idsDescendentes(u.id,unidades),filtrar=');
assert.ok(inicio>=0,'Filtro dos indicadores CPC deve continuar presente');
const fim=indicadores.indexOf(';\n',inicio);
assert.ok(fim>inicio,'Filtro dos indicadores CPC deve finalizar em ponto e vírgula');
const declaracao=indicadores.slice(inicio,fim+1);
const filtrarIndicadores=vm.runInNewContext(
  '(function(u,unidades,rows){'+declaracao+'return filtrar(rows);})',
  {idsDescendentes:id=>id==='bope'?new Set(['bope','choque','canil','forca','gate']):new Set([id])}
);
assert.deepEqual(Array.from(filtrarIndicadores({id:'choque'},[],bases),x=>x.id),['ch01','ch02']);
assert.deepEqual(Array.from(filtrarIndicadores({id:'canil'},[],bases),x=>x.id),['ca01']);
assert.deepEqual(Array.from(filtrarIndicadores({id:'bope'},[],bases),x=>x.id),['ch01','ch02','ca01','ft01']);
assert.deepEqual(Array.from(filtrarIndicadores({id:'1bpm'},[],bases),x=>x.id),['bpm01']);
console.log('CPC: Análise Detalhada e Indicadores por Unidade reconhecem subunidades sem duplicação nem vazamento entre unidades.');
