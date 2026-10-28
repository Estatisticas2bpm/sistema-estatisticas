'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const dashboard=fs.readFileSync(path.join(root,'dashboard-cpc.html'),'utf8');
const modulo=fs.readFileSync(path.join(root,'cpc-indicadores-dashboard.js'),'utf8');
const unidades=[
  {id:'cpc',sigla:'CPC',tipo:'COMANDO',parent_id:null},
  {id:'bope',sigla:'BOPE',nome:'Batalhão de Operações Policiais Especiais',tipo:'BATALHAO',parent_id:'cpc'},
  {id:'canil',sigla:'CANIL',nome:'Canil',tipo:'SUBUNIDADE',parent_id:'bope'},
  {id:'choque',sigla:'CHOQUE',nome:'Choque',tipo:'SUBUNIDADE',parent_id:'bope'},
  {id:'forca',sigla:'FORCA_TATICA',nome:'Força Tática',tipo:'SUBUNIDADE',parent_id:'bope'},
  {id:'gate',sigla:'GATE',nome:'GATE',tipo:'SUBUNIDADE',parent_id:'bope'},
  {id:'1bpm',sigla:'1BPM',nome:'1º Batalhão',tipo:'BATALHAO',parent_id:'cpc'}
];
const sourceStart=modulo.indexOf("    const bope=unidades.find(u=>");
const sourceEnd=modulo.indexOf('    const occ=home?',sourceStart);
assert.ok(sourceStart>0&&sourceEnd>sourceStart,'Fonte de cartões deve existir');
const source=modulo.slice(sourceStart,sourceEnd);
const cartoes=vm.runInNewContext('(function(unidades,selecionada,cpc){'+source+'return visiveis;})');
const siglas=itens=>Array.from(itens,x=>x.sigla);
assert.deepEqual(siglas(cartoes(unidades,null,unidades[0])),['BOPE','CANIL','CHOQUE','FORCA_TATICA','GATE','1BPM'],
  'Visão CPC precisa exibir BOPE e as quatro subunidades em cartões separados');
assert.deepEqual(siglas(cartoes(unidades,unidades[1],unidades[0])),['BOPE','CANIL','CHOQUE','FORCA_TATICA','GATE'],
  'Ao selecionar BOPE, os cartões de suas subunidades continuam disponíveis');
assert.deepEqual(siglas(cartoes(unidades,unidades[3],unidades[0])),['CHOQUE'],
  'Ao selecionar Choque, não deve exibir as outras companhias');

class Opcao {constructor(text,value){this.text=text;this.value=value}}
const select={
  children:[],value:'',
  replaceChildren(...items){this.children=[...items];},
  add(item){this.children.push(item)}
};
const context={
  Option:Opcao,location:{search:'?unidade=choque'},URLSearchParams,
  document:{createElement(tag){assert.equal(tag,'optgroup');return{children:[],label:'',appendChild(item){this.children.push(item)}}}},
  $:id=>{assert.equal(id,'unidade');return select},
  ordenarHierarquiaCpc:()=>[1,2,3,4,5,6].map(i=>({u:unidades[i]})),
  unidadeH:id=>unidades.find(u=>u.id===id),
  sigla:valor=>valor,
  unidadesCarregadas:false
};
vm.createContext(context);
const begin=dashboard.indexOf('function popularUnidades(){');
const end=dashboard.indexOf('function atualizarUrl(){',begin);
assert.ok(begin>0&&end>begin,'Popular unidades precisa existir');
vm.runInContext(dashboard.slice(begin,end),context);
vm.runInContext('popularUnidades()',context);
const grupo=select.children.find(x=>x.label==='BOPE — subunidades operacionais');
assert.ok(grupo,'O filtro precisa destacar subunidades do BOPE em um grupo próprio');
assert.deepEqual(grupo.children.map(x=>x.value),['canil','choque','forca','gate'],
  'Choque, Canil, Força Tática e GATE devem existir como opções individuais');
assert.match(grupo.children.find(x=>x.value==='choque').text,/BOPE \/ CHOQUE/);
assert.equal(select.value,'choque','Filtro por URL deve continuar selecionando Choque');
assert.match(dashboard,/Indicadores estatísticos por unidade e subunidade/);
console.log('CPC: opção Choque aparece no filtro e no quadro de indicadores; BOPE mantém companhia como recorte próprio.');
