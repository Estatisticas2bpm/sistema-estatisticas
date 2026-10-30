'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','mapa-criminal.html'),'utf8');
const trecho=(inicio,fim)=>{
 const i=html.indexOf(inicio),j=html.indexOf(fim,i+inicio.length);
 assert.ok(i>=0&&j>i,'Trecho ausente '+inicio);return html.slice(i,j);
};
const campos=Object.fromEntries(['tipo','bairro','turno','unidade','aisc','sisc','setor','batalhaoTerritorial','companhiaBo'].map(k=>[k,{value:''}]));
const bo=[
 {id:'bope-leste',unidade_id:'bope',unidade_territorial_id:'bpm1',cia_unidade_apuracao:'2ª CIA',aisc:'AISC LESTE',sisc:'SISC 1',setor:'1.1',bairro:'CENTRO',ocorrencia:'FURTO'},
 {id:'bpm2-leste',unidade_id:'bpm2',unidade_territorial_id:'bpm1',cia_unidade_apuracao:'1ª CIA',aisc:'AISC LESTE',sisc:'SISC 1',setor:'1.1',bairro:'CENTRO',ocorrencia:'ROUBO'},
 {id:'bpm2-oeste',unidade_id:'bpm2',unidade_territorial_id:'bpm2',cia_unidade_apuracao:'3ª CIA',aisc:'AISC OESTE',sisc:'SISC 4',setor:'4.1',bairro:'SANTA TERESA',ocorrencia:'FURTO'}
];
const abordagens=[
 {id:'giro-leste',unidade_id:'giro',bairro:'CENTRO'},
 {id:'giro-oeste',unidade_id:'giro',bairro:'SANTA TEREZA'}
];
const ctx={
 $:k=>campos[k],base:bo,baseAbordagens:abordagens,categoriaRapida:'',
 chave:v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase(),
 coordValida:()=>true,cat:()=>['FURTO','#000'],
 bairroCorrespondeMapa:(a,p,o)=>!p||String(a||o).toUpperCase()===String(p).toUpperCase(),
 dadosTerritoriaisAbordagem:v=>String(v).toUpperCase().includes('TEREZ')?
  {aisc:'AISC OESTE',sisc:'SISC 4',setor:'4.1',batalhao_territorial_id:'bpm2'}:
  {aisc:'AISC LESTE',sisc:'SISC 1',setor:'1.1',batalhao_territorial_id:'bpm1'}
};
vm.createContext(ctx);
vm.runInContext(trecho('function filtrarOcorrencias(){','function rotuloTipoAbordagem('),ctx);
const ids=f=>Array.from(f(),o=>o.id);
campos.batalhaoTerritorial.value='bpm1';
assert.deepEqual(ids(ctx.filtrarOcorrencias),['bope-leste','bpm2-leste'],
 'Filtro territorial deve trazer todos os BOs da área, independentemente da unidade que atendeu');
assert.deepEqual(ids(ctx.filtrarAbordagens),['giro-leste'],
 'Abordagens GIRO devem respeitar o batalhão da área classificado pelo bairro');
campos.unidade.value='bpm2';
assert.deepEqual(ids(ctx.filtrarOcorrencias),['bpm2-leste'],
 'Unidade que registrou e batalhão territorial são dimensões diferentes');
campos.unidade.value='';
campos.batalhaoTerritorial.value='';
campos.companhiaBo.value='2ª CIA';
assert.deepEqual(ids(ctx.filtrarOcorrencias),['bope-leste']);
assert.deepEqual(ids(ctx.filtrarAbordagens),[],
 'Não atribuir companhia de BO a abordagens GIRO sem esse campo');
campos.companhiaBo.value='';
campos.setor.value='4.1';
assert.deepEqual(ids(ctx.filtrarOcorrencias),['bpm2-oeste'],
 '4.1 é setor oficial, não subsetor inferido');
assert.deepEqual(ids(ctx.filtrarAbordagens),['giro-oeste']);
campos.setor.value='';

assert.match(html,/Batalhão responsável pela área<select id="batalhaoTerritorial"/);
assert.match(html,/Companhia informada no BO<select id="companhiaBo"/);
assert.match(html,/Setor \(ex\.: 4\.1\)<select id="setor"/);
assert.match(html,/list="bairrosMapaSugestoes"/);
assert.match(html,/const batalhoes=\[\.\.\.new Map\(\(catalogoTerritorial\.aisc\|\|\[\]\)/);
assert.match(html,/batalhao_territorial_id:aisc\?\.unidade_id\|\|null/);
assert.match(html,/popularCompanhiasBo\(\);aplicarParametrosEntrada\(\)/);
assert.match(html,/AISC, SISC e Setor/);
assert.match(html,/não equivale a uma delimitação territorial homologada/);
assert.match(html,/function popularCompanhiasBo\(\)/);
assert.match(html,/chave\(x\.cia_unidade_apuracao\)===cia/);
console.log('Mapa CPC: unidade atuante e batalhão territorial independentes, companhia do BO isolada e setor 4.1 oficial.');
