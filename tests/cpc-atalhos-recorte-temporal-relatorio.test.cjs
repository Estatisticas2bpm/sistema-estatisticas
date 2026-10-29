'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const raiz=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(raiz,'dashboard-cpc.html'),'utf8');
const temporal=fs.readFileSync(path.join(raiz,'analise-temporal.html'),'utf8');
const trecho=(texto,a,b)=>{
  const i=texto.indexOf(a),j=texto.indexOf(b,i+a.length);
  assert.ok(i>=0&&j>i,'Trecho não encontrado: '+a);
  return texto.slice(i,j);
};
const links=['linkMapaTopoCpc','linkMapaCpc','linkTemporalCpc','linkTerritorioCpc','linkRelatorioCpc','cpcAtalhosEscopoAviso'];
const valores={ini:'2026-10-01',fim:'2026-10-28',unidade:'choque',aisc:'AISC 2',sisc:'SISC 1',setor:'2.1',turno:'NOITE',ocorrencia:'APOIO',bairro:'CENTRO',companhia:'1ª CIA'};
const elementos=Object.fromEntries([...Object.keys(valores),...links].map(k=>[k,{value:valores[k]||'',href:'',innerHTML:'',textContent:'',hidden:true}]));
const $=id=>elementos[id]||null;
const unidades={choque:{id:'choque',sigla:'CHOQUE',tipo:'SUBUNIDADE'},bpm:{id:'bpm',sigla:'1BPM',tipo:'BATALHAO'}};
const contexto={
  $,URLSearchParams,unidadeH:id=>unidades[id]||null,
  sigla:x=>x,esc:x=>String(x)
};
vm.createContext(contexto);
vm.runInContext(trecho(html,'function parametrosGlobaisCpc(){','function renderResumo('),contexto);
contexto.atualizarAtalhosCpc();
let rel=new URL(elementos.linkRelatorioCpc.href,'https://example.test');
assert.equal(rel.searchParams.get('unidade'),'choque','O relatório deve conservar Choque');
assert.equal(rel.searchParams.get('ini'),'2026-10-01');
assert.equal(rel.searchParams.get('fim'),'2026-10-28');
assert.equal(rel.searchParams.get('sisc'),null,'Não aplicar SISC silenciosamente a subunidade especializada');
assert.equal(rel.searchParams.get('companhia'),null,'Não aplicar companhia territorial a subunidade especializada');
assert.match(elementos.linkRelatorioCpc.innerHTML,/CHOQUE/);
assert.match(elementos.cpcAtalhosEscopoAviso.textContent,/Relatório: não aplica/);
assert.equal(elementos.cpcAtalhosEscopoAviso.hidden,false,'Aviso precisa estar visível');

const temporalLink=new URL(elementos.linkTemporalCpc.href,'https://example.test');
assert.equal(temporalLink.searchParams.get('unidade'),'choque');
assert.equal(temporalLink.searchParams.get('tipo'),'APOIO');
assert.equal(temporalLink.searchParams.get('bairro'),'CENTRO');
assert.equal(temporalLink.searchParams.get('sisc'),null,'Temporal não deve receber filtros que ignora');

const mapa=new URL(elementos.linkMapaCpc.href,'https://example.test');
assert.equal(mapa.searchParams.get('unidade'),'choque');
assert.equal(mapa.searchParams.get('sisc'),'SISC 1');
assert.equal(mapa.searchParams.get('turno'),'NOITE');
assert.equal(mapa.searchParams.get('companhia'),null);
assert.equal(elementos.linkTerritorioCpc.href,'territorio-cpc.html');

valores.unidade='bpm';
Object.keys(valores).forEach(k=>{elementos[k].value=valores[k]});
contexto.atualizarAtalhosCpc();
rel=new URL(elementos.linkRelatorioCpc.href,'https://example.test');
assert.equal(rel.searchParams.get('unidade'),'bpm');
assert.equal(rel.searchParams.get('sisc'),'SISC 1');
assert.equal(rel.searchParams.get('companhia'),'1ª CIA');

const chamada=trecho(temporal,'async function carregar(){',"$('atualizar').onclick=carregar;");
const rpc=[];
const entradas={ini:{value:'2026-10-01'},fim:{value:'2026-10-28'},loading:{style:{},textContent:''}};
let registros=null;
const pagina={
  $:id=>entradas[id],
  db:{rpc:async(nome,args)=>{rpc.push({nome,args});return {data:[{id:'bo1'}],error:null}}},
  bopeSubTemporal:null,unidadeEntrada:'choque',render:d=>{registros=d}
};
vm.createContext(pagina);vm.runInContext(chamada,pagina);
(async()=>{
  await pagina.carregar();
  assert.equal(rpc.at(-1).nome,'obter_dados_dashboard_territorial','Recorte por Choque exige RPC com IDs operacionais');
  assert.equal(registros.length,1);
  pagina.unidadeEntrada='';
  await pagina.carregar();
  assert.equal(rpc.at(-1).nome,'obter_dados_dashboard','Consulta não filtrada preserva RPC original');
  pagina.bopeSubTemporal={sigla:'CHOQUE'};
  await pagina.carregar();
  assert.equal(rpc.at(-1).nome,'obter_dados_dashboard_territorial','Recorte BOPE operacional também exige RPC territorial');
  console.log('CPC: atalhos mantêm somente filtros suportados e análise temporal de subunidade usa fonte correta.');
})().catch(erro=>{console.error(erro);process.exitCode=1});
