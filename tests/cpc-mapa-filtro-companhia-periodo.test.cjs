'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

function secao(inicio,fim){
  const a=html.indexOf(inicio),b=html.indexOf(fim,a+inicio.length);
  assert.ok(a>=0&&b>a,'Trecho do mapa CPC ausente: '+inicio);
  return html.slice(a,b);
}
const funcoes=secao('let companhiasMapaDisponiveis=[];','var cpcEspecializados=');
const areaTipoMapa={value:'COMPANHIA'};
const areaValorMapa={value:'',disabled:false,innerHTML:'',adicionados:[],add(o){this.adicionados.push(o)}};
const contexto={
  modoCpc:true,areaTipoMapa,areaValorMapa,Option:function(text,value){this.text=text;this.value=value},
  cpcTerritorio:{aisc:[{codigo:'AISC 1'}],sisc:[{codigo:'SISC 1'}],setores:[],bairros:[]},
  escHome:v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
};
vm.createContext(contexto);
vm.runInContext(funcoes,contexto);

const ocorrencias=[
  {id:'a',unidade_id:'bope',subunidade_operacional_id:'choque',companhia:'1ª CIA'},
  {id:'b',unidade_id:'bope',subunidade_operacional_id:'canil',companhia:'2ª CIA'},
  {id:'c',unidade_id:'1bpm',companhia:'1ª CIA'},
  {id:'d',unidade_id:'1bpm',companhia:null}
];
assert.equal(contexto.filtrarCompanhiaMapaCpc(ocorrencias).length,4,'Todas deve manter o universo');
areaValorMapa.value='1ª CIA';
assert.deepEqual(Array.from(contexto.filtrarCompanhiaMapaCpc(ocorrencias),x=>x.id),['a','c'],
 'Filtragem precisa considerar o campo companhia, sem confundi-lo com subunidade ou unidade');
areaValorMapa.value='2ª CIA';
assert.deepEqual(Array.from(contexto.filtrarCompanhiaMapaCpc(ocorrencias),x=>x.id),['b']);
areaValorMapa.value='3ª CIA';
assert.equal(contexto.filtrarCompanhiaMapaCpc(ocorrencias).length,0,'Ausência real da companhia não deve exibir outros BOs');
areaTipoMapa.value='SISC';
assert.equal(contexto.filtrarCompanhiaMapaCpc(ocorrencias).length,4,'Filtro por SISC não pode herdar companhia anterior');
areaTipoMapa.value='COMPANHIA';

vm.runInContext("companhiasMapaDisponiveis=['1ª CIA','2ª CIA'];",contexto);
areaValorMapa.value='';
contexto.atualizarAreaValores();
assert.match(areaValorMapa.innerHTML,/1ª CIA/);
assert.match(areaValorMapa.innerHTML,/2ª CIA/);
assert.doesNotMatch(areaValorMapa.innerHTML,/3ª CIA/);
areaValorMapa.value='3ª CIA';
areaValorMapa.adicionados=[];
contexto.atualizarAreaValores();
assert.equal(areaValorMapa.value,'3ª CIA','Ao mudar período, manter seleção mesmo sem registros no novo recorte');
assert.equal(areaValorMapa.adicionados[0].value,'3ª CIA');
assert.match(areaValorMapa.adicionados[0].text,/sem registros neste recorte/);

const trechoMapa=secao('async function carregarMapa(){','// Consulta especializada com paginação:');
assert.match(trechoMapa,/companhiasMapaDisponiveis=\[\.\.\.new Set\(registrosEnriquecidos\.map/);
assert.match(trechoMapa,/dadosMapaAtuais=filtrarCompanhiaMapaCpc\(registrosEnriquecidos\)\.filter/);
assert.match(html,/areaTipoMapa\.onchange=function\(\)\{areaValorMapa\.value='';atualizarAreaValores\(\);carregarMapa\(\)\}/);
assert.doesNotMatch(funcoes,/dadosPorUnidade\(cpcAtual/,'Opções não podem depender do mês atual ao consultar período histórico');

console.log('Mapa CPC: companhia filtra BOs de fato; opções seguem período/escopo; mudança de período não elimina seleção silenciosamente.');
