'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.join(__dirname,'..');
const home=fs.readFileSync(path.join(base,'index.html'),'utf8');
const dashboard=fs.readFileSync(path.join(base,'dashboard-cpc.html'),'utf8');
const extrair=(src,ini,fim)=>{
  const i=src.indexOf(ini),j=src.indexOf(fim,i+ini.length);
  assert.ok(i>=0&&j>i,'Trecho ausente: '+ini);
  return src.slice(i,j);
};
const bairros=[
  {id:'santa',nome:'SANTA TERESA'},
  {id:'canaa',nome:'CANAÃ'},
  {id:'centro',nome:'CENTRO'}
];
const aliases=[
  {bairro_id:'santa',alias_chave:'SANTA TEREZA'},
  {bairro_id:'santa',alias_chave:'SANTA TERESA'},
  {bairro_id:'canaa',alias_chave:'NOVA CANAA'},
  {bairro_id:'centro',alias_chave:'CENTRO'}
];
const selector={value:'',innerHTML:'',disabled:false};
const homeContext={
  modoCpc:true,areaTipoMapa:{value:'BAIRRO'},areaValorMapa:selector,
  cpcTerritorio:{bairros,aliases},
  escHome:v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;')
};
vm.createContext(homeContext);
vm.runInContext(extrair(home,'function atualizarAreaValores(){','function filtrarCompanhiaMapaCpc('),homeContext);
homeContext.atualizarAreaValores();
assert.match(selector.innerHTML,/<option value="SANTA TERESA">SANTA TERESA<\/option>/);
assert.match(selector.innerHTML,/<option value="CANAÃ">CANAÃ<\/option>/);
assert.doesNotMatch(selector.innerHTML,/SANTA TEREZA|NOVA CANAA|\(/);
assert.equal((selector.innerHTML.match(/>SANTA TERESA<\/option>/g)||[]).length,1,
 'Cada bairro deve aparecer uma única vez no seletor');
homeContext.areaTipoMapa.value='AISC';
homeContext.cpcTerritorio.aisc=[{codigo:'AISC OESTE'}];
homeContext.atualizarAreaValores();
assert.match(selector.innerHTML,/AISC OESTE/,'Demais filtros permanecem íntegros');

const sugestoes={children:[],replaceChildren(...ch){this.children=ch;}};
const controls={cpcBairrosSugestoes:sugestoes,aisc:{value:'',innerHTML:''},
  sisc:{value:'',innerHTML:''},setor:{value:'',innerHTML:''}};
const dashContext={
  catalogoTerritorial:{bairros,aliases,aisc:[],sisc:[],setores:[]},
  $:id=>controls[id],esc:x=>x,
  document:{createElement(tag){assert.equal(tag,'option');return {value:''}}}
};
vm.createContext(dashContext);
vm.runInContext(extrair(dashboard,'function popularTerritorio(){','function popularUnidades(){'),dashContext);
dashContext.popularTerritorio();
assert.deepEqual(sugestoes.children.map(o=>o.value),['SANTA TERESA','CANAÃ','CENTRO']);
assert.equal(sugestoes.children.filter(o=>o.value==='SANTA TERESA').length,1);
assert.ok(sugestoes.children.every(o=>!Object.prototype.hasOwnProperty.call(o,'label')),
 'Sugestões devem evitar o duplo rótulo value/label em diferentes navegadores');
assert.match(home,/function bairrosEquivalentesCpc/,'Aliases continuam reconhecidos no mapa');
assert.match(dashboard,/catalogoTerritorial/,'Catálogo territorial continua disponível para análises');
console.log('CPC: bairros exibidos uma única vez, sem nomes entre parênteses; aliases continuam no filtro.');
