const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const relatorio=fs.readFileSync(path.join(root,'relatorio.html'),'utf8');
const mapa=fs.readFileSync(path.join(root,'mapa-criminal.html'),'utf8');
const temporal=fs.readFileSync(path.join(root,'analise-temporal.html'),'utf8');
const inicio=relatorio.indexOf('function filtrarTerritorio(base){');
const fim=relatorio.indexOf('\nfunction page(',inicio);
assert.ok(inicio>=0&&fim>inicio,'Filtro do relatório deve continuar disponível');
const filtro=relatorio.slice(inicio,fim);
let selecionada=null,bope=false,sub='',sisc='',companhia='';
const sandbox={
  unidadeSelecionadaRelCpc:()=>selecionada,
  ehBopeRel:()=>bope,
  $:()=>({value:sub}),
  get sisc(){return {value:sisc}},
  get companhia(){return {value:companhia}}
};
const filtrar=vm.runInNewContext('('+filtro+')',sandbox);
const registros=[
  {id:'1',unidade_id:'bope',subunidade_operacional_id:'choque',subunidade_operacional_sigla:'CHOQUE',sisc:'SISC 1',companhia:''},
  {id:'2',unidade_id:'bope',subunidade_operacional_id:'canil',subunidade_operacional_sigla:'CANIL',sisc:'SISC 5',companhia:'2ª CIA'},
  {id:'3',unidade_id:'bope',subunidade_operacional_id:'forca',subunidade_operacional_sigla:'FORCA_TATICA',sisc:'SISC 4',companhia:'1ª CIA'},
  {id:'4',unidade_id:'1bpm',subunidade_operacional_id:null,sisc:'SISC 2',companhia:''}
];
selecionada={id:'bope',tipo:'BATALHAO'};bope=true;
assert.deepEqual(Array.from(filtrar(registros),x=>x.id),['1','2','3'],'BOPE consolidado deve incluir subunidades sem duplicação');
selecionada={id:'choque',tipo:'SUBUNIDADE'};bope=false;
assert.deepEqual(Array.from(filtrar(registros),x=>x.id),['1'],'Choque depende de subunidade_operacional_id');
selecionada={id:'canil',tipo:'SUBUNIDADE'};
assert.deepEqual(Array.from(filtrar(registros),x=>x.id),['2'],'Canil depende de subunidade_operacional_id');
selecionada={id:'forca',tipo:'SUBUNIDADE'};
assert.deepEqual(Array.from(filtrar(registros),x=>x.id),['3'],'Força Tática depende de subunidade_operacional_id');
selecionada={id:'gate',tipo:'SUBUNIDADE'};
assert.equal(filtrar(registros).length,0,'GATE sem registros no período não pode receber registros de outros');
selecionada={id:'choque',tipo:'SUBUNIDADE'};sisc='SISC 1';
assert.deepEqual(Array.from(filtrar(registros),x=>x.id),['1'],'SISC 1 deve ser filtrável e independente de companhia');
sisc='';selecionada={id:'bope',tipo:'BATALHAO'};bope=true;sub='CHOQUE';
assert.deepEqual(Array.from(filtrar(registros),x=>x.id),['1'],'BOPE com opção operacional Choque');
selecionada={id:'canil',tipo:'SUBUNIDADE'};bope=false;
assert.deepEqual(Array.from(filtrar(registros),x=>x.id),['2'],'Filtro operacional da seleção BOPE anterior não pode contaminar Canil');
selecionada={id:'1bpm',tipo:'BATALHAO'};sub='';
assert.deepEqual(Array.from(filtrar(registros),x=>x.id),['4'],'Unidade ordinária mantém seleção pelo unidade_id');
assert.ok(relatorio.includes('<option>SISC 1</option><option>SISC 2</option><option>SISC 3</option>'));
assert.ok(relatorio.includes("select('id,sigla,nome,tipo,parent_id')"));
assert.ok(mapa.includes("String(x.subunidade_operacional_id||'')===u"));
assert.ok(temporal.includes("String(x.subunidade_operacional_id||'')===unidadeEntrada"));
console.log('Auditoria de filtros: BOPE, subunidades, SISC, mapa e análise temporal validados em cenários de contrato.');
