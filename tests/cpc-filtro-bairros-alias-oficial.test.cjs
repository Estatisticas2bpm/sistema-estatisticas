'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const completo=fs.readFileSync(path.join(root,'mapa-criminal.html'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261029082000_bairros_alias_mapa_cpc.sql'),'utf8');
const codigo=(html,inicio,fim)=>{
  const a=html.indexOf(inicio),b=html.indexOf(fim,a+inicio.length);
  assert.ok(a>=0&&b>a,'Trecho ausente '+inicio);
  return html.slice(a,b);
};
// Identificadores de teste: o contrato real é que cada par compartilha o mesmo bairro_id.
const bairros=[
  {id:'teresa',nome:'SANTA TERESA',setor_id:'setor6'},
  {id:'canaa',nome:'CANAÃ',setor_id:'setor5'},
  {id:'outro',nome:'SANTA LUZIA',setor_id:'setor3'}
];
const aliases=[
  {alias_chave:'SANTA TERESA',bairro_id:'teresa'},
  {alias_chave:'SANTA TEREZA',bairro_id:'teresa'},
  {alias_chave:'CANAÃ'.normalize('NFD').replace(/[\u0300-\u036f]/g,''),bairro_id:'canaa'},
  {alias_chave:'NOVA CANAA',bairro_id:'canaa'},
  {alias_chave:'SANTA LUZIA',bairro_id:'outro'}
];
const catalogo={aliases,bairros,
  setores:[{id:'setor6',codigo:'6.1',sisc_id:'sisc6'},{id:'setor5',codigo:'5.1',sisc_id:'sisc5'},{id:'setor3',codigo:'3.1',sisc_id:'sisc3'}],
  sisc:[{id:'sisc6',codigo:'SISC 6',aisc_id:'oeste'},{id:'sisc5',codigo:'SISC 5',aisc_id:'oeste'},{id:'sisc3',codigo:'SISC 3',aisc_id:'leste'}],
  aisc:[{id:'oeste',codigo:'AISC OESTE'},{id:'leste',codigo:'AISC LESTE'}]
};
const homeContext={
  cpcTerritorio:catalogo,areaTipoMapa:{value:'BAIRRO'},areaValorMapa:{value:'SANTA TERESA'}
};
vm.createContext(homeContext);
vm.runInContext(codigo(index,'function normalizarBairroCpc(valor){','function categoriaMapa('),homeContext);
assert.equal(homeContext.idBairroCpc('SANTA TEREZA'),'teresa');
assert.equal(homeContext.idBairroCpc('Santa Teresa'),'teresa');
assert.equal(homeContext.bairrosEquivalentesCpc('SANTA TEREZA','SANTA TERESA'),true);
assert.equal(homeContext.bairrosEquivalentesCpc('NOVA CANAÃ','CANAÃ'),true);
assert.equal(homeContext.bairrosEquivalentesCpc('SANTA LUZIA','SANTA TERESA'),false);
assert.deepEqual(Array.from(homeContext.filtrarTerritorioAbordagensCpc([
  {id:1,bairro:'SANTA TEREZA'},{id:2,bairro:'SANTA TERESA'},
  {id:3,bairro:'SANTA LUZIA'}]),x=>x.id),[1,2]);
homeContext.areaTipoMapa.value='SISC';homeContext.areaValorMapa.value='SISC 6';
assert.deepEqual(Array.from(homeContext.filtrarTerritorioAbordagensCpc([
  {id:1,bairro:'SANTA TEREZA'},{id:2,bairro:'SANTA LUZIA'}]),x=>x.id),[1]);

const mpContext={
  catalogoTerritorial:catalogo,
  chave:v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase(),
};
vm.createContext(mpContext);
vm.runInContext(codigo(completo,'function chaveBairroMapa(valor){','async function consultarAbordagensCompletas('),mpContext);
assert.equal(mpContext.bairroIdMapa('SANTA TERESA'),'teresa');
assert.equal(mpContext.bairroCorrespondeMapa('SANTA TEREZA','SANTA TERESA'),true);
assert.equal(mpContext.bairroCorrespondeMapa('SANTA TERESA','SANTA TEREZA'),true);
assert.equal(mpContext.bairroCorrespondeMapa('SANTA LUZIA','SANTA TERESA'),false);
assert.equal(mpContext.bairroCorrespondeMapa('NOVA CANAÃ','CANAÃ'),true);
assert.equal(mpContext.bairroCorrespondeMapa('BAIRRO NÃO CADASTRADO','BAIRRO NÃO CADASTRADO'),true);
assert.equal(mpContext.dadosTerritoriaisAbordagem('SANTA TEREZA').sisc,'SISC 6');

const inputs={tipo:{value:''},bairro:{value:'Santa Teresa'},turno:{value:''},unidade:{value:''},
  aisc:{value:''},sisc:{value:''},setor:{value:''}};
mpContext.$=id=>inputs[id];
mpContext.coordValida=()=>true;
mpContext.cat=()=>['OUTRAS','#999'];
mpContext.categoriaRapida='';
mpContext.base=[
  {id:'santa-terez',bairro:'SANTA TEREZA',territorio_bairro:'SANTA TERESA'},
  {id:'santa-luz',bairro:'SANTA LUZIA',territorio_bairro:'SANTA LUZIA'}
];
mpContext.baseAbordagens=[
  {id:'giro-terez',bairro:'SANTA TEREZA'},
  {id:'giro-luz',bairro:'SANTA LUZIA'}
];
vm.runInContext(codigo(completo,'function filtrarOcorrencias(){','function rotuloTipoAbordagem('),mpContext);
assert.deepEqual(Array.from(mpContext.filtrarOcorrencias(),x=>x.id),['santa-terez']);
assert.deepEqual(Array.from(mpContext.filtrarAbordagens(),x=>x.id),['giro-terez']);
inputs.bairro.value='Santa Tereza';
assert.deepEqual(Array.from(mpContext.filtrarOcorrencias(),x=>x.id),['santa-terez']);
inputs.bairro.value='Santa Luzia';
assert.deepEqual(Array.from(mpContext.filtrarOcorrencias(),x=>x.id),['santa-luz']);

assert.match(migration,/t\.info->>'bairro_id'=public\.territorio_por_bairro\(p_bairro\)->>'bairro_id'/);
assert.match(migration,/'aliases',coalesce\(\(/);
assert.match(migration,/public\.territorio_cpc_bairro_aliases al/);
assert.doesNotMatch(migration,/SECURITY DEFINER/i);
assert.match(index,/variantes\.join\(', '\)/);
console.log('Mapa CPC: aliases territoriais vinculam Santa Tereza/Teresa e Nova Canaã/Canaã, sem confundir outros bairros.');
