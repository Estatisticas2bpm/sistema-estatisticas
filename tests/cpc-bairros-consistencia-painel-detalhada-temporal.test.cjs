'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261029130000_dashboard_cpc_bairros_equivalentes.sql'),'utf8');
const detalhe=fs.readFileSync(path.join(root,'cpc-analise-integrada.js'),'utf8');
const temporal=fs.readFileSync(path.join(root,'analise-temporal.html'),'utf8');
const painel=fs.readFileSync(path.join(root,'dashboard-cpc.html'),'utf8');
const extrair=(origem,inicio,fim)=>{
  const i=origem.indexOf(inicio),j=origem.indexOf(fim,i+inicio.length);
  assert.ok(i>=0&&j>i,'Trecho ausente: '+inicio);
  return origem.slice(i,j);
};
const catalogo={
  bairros:[{id:'sta',nome:'SANTA TERESA'},{id:'canaa',nome:'CANAÃ'},{id:'luzia',nome:'SANTA LUZIA'}],
  aliases:[
    {alias_chave:'SANTA TERESA',bairro_id:'sta'},
    {alias_chave:'SANTA TEREZA',bairro_id:'sta'},
    {alias_chave:'CANAÃ',bairro_id:'canaa'},
    {alias_chave:'CANAA',bairro_id:'canaa'},
    {alias_chave:'NOVA CANAA',bairro_id:'canaa'},
    {alias_chave:'SANTA LUZIA',bairro_id:'luzia'}
  ]
};
const normalizar=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
const reg=[
 {id:'BO1',bairro:'SANTA TEREZA',territorio_bairro:'SANTA TERESA',unidade_id:'2bpm',ocorrencia:'FURTO'},
 {id:'BO2',bairro:'SANTA TERESA',territorio_bairro:'SANTA TERESA',unidade_id:'2bpm',ocorrencia:'ROUBO'},
 {id:'BO3',bairro:'SANTA LUZIA',territorio_bairro:'SANTA LUZIA',unidade_id:'2bpm',ocorrencia:'ROUBO'},
 {id:'BO4',bairro:'NOVA CANAÃ',territorio_bairro:'CANAÃ',unidade_id:'2bpm',ocorrencia:'FURTO'}
];
const a={config:{territorio:catalogo},chave:normalizar,};
vm.createContext(a);
vm.runInContext(extrair(detalhe,'function contem(a,b){','function pessoas(o,tipo){'),a);
const filtro=(pesquisa)=>reg.filter(o=>a.filtro(o,{p_bairro:pesquisa},null)).map(o=>o.id);
assert.deepEqual(filtro('Santa Teresa'),['BO1','BO2']);
assert.deepEqual(filtro('Santa Tereza'),['BO1','BO2']);
assert.deepEqual(filtro('Canaã'),['BO4']);
assert.deepEqual(filtro('Santa Luzia'),['BO3']);
assert.deepEqual(filtro('Santa'),['BO1','BO2','BO3'],'Pesquisa parcial deve continuar funcionando');

const inp={tipo:{value:''},bairro:{value:'Santa Teresa'}};
const t={
 chave:normalizar,catalogoBairrosTemporal:catalogo,
 $:id=>inp[id],unidadeEntrada:'',
 bopeSubTemporal:null,window:{BopePainel:{emEscopo:()=>true}}
};
vm.createContext(t);
vm.runInContext(extrair(temporal,'function chaveBairroTemporal(v){','function maxItem(arr){'),t);
const tf=(v)=>{inp.bairro.value=v;return Array.from(t.filtrar(reg),o=>o.id)};
assert.deepEqual(tf('Santa Teresa'),['BO1','BO2']);
assert.deepEqual(tf('Santa Tereza'),['BO1','BO2']);
assert.deepEqual(tf('Santa Luzia'),['BO3']);
assert.deepEqual(tf('Canaã'),['BO4']);
assert.deepEqual(tf('Santa'),['BO1','BO2','BO3']);
assert.ok(temporal.includes("if(bairro&&!catalogoBairrosTemporal)"));
assert.ok(temporal.includes("(bopeSubTemporal||unidadeEntrada||bairro)?'obter_dados_dashboard_territorial'"));

assert.equal((sql.match(/t.info->>'bairro_id'=public.territorio_por_bairro\(p_bairro\)->>'bairro_id'/g)||[]).length,2,
 'BOs e TCOs devem usar o mesmo bairro_id cadastrado');
assert.match(sql,/t.info->>'bairro' territorio_bairro/);
assert.match(sql,/coalesce\(nullif\(btrim\(b.territorio_bairro\),''\),nullif\(btrim\(b.bairro\),''\),'NÃO INFORMADO'\)/);
assert.doesNotMatch(sql,/SECURITY DEFINER/i);
assert.match(painel,/list="cpcBairrosSugestoes"/);
assert.match(painel,/r.data.resumo\?\.total_ocorrencias,catalogoTerritorial/);
console.log('CPC: filtros e rankings territoriais reconhecem os mesmos bairros nas visões executiva, detalhada e temporal.');
