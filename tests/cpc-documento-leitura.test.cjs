'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const script=read('cpc-documento-leitura.js'),html=read('dashboard-cpc.html');
const trace=read('cpc-rastreabilidade.js'),list=read('cpc-detalhamento-origem.js');
const w={};vm.runInNewContext(trace,{window:w});
const id='11111111-2222-4333-8444-555555555555',pai='22222222-3333-4333-8444-666666666666';
const linha=w.CpcRastreabilidade.registros('2BPM',[{id,numero_bo:'BO-123',data_ocorrencia:'2026-10-01',ocorrencia:'FURTO',historico_resumido:'Histórico'}],[],null)[0];
assert.equal(linha.registro_id,id);
assert.equal(linha.origem_tabela,'ocorrencias');
const fauna=w.CpcRastreabilidade.registros('CIPA',[],[],{fauna:[{id,ocorrencia_id:pai,numero_tr:'TR-1',quantidade:2}]}).find(x=>x.fonte==='CIPA · fauna');
assert.equal(fauna.origem_tabela,'cipa_fauna');
assert.equal(fauna.ocorrencia_id,pai);
assert.match(list,/data-documento-index/);
assert.match(list,/CpcDocumentoLeitura\?\.fechar\(\)/,'mudar filtros fecha documento do escopo anterior');
assert.match(list,/CpcDocumentoLeitura\?\.abrir\(linha\)/);
for(const idHtml of ['cpcDocumentoLeitura','cpcDocTitulo','cpcDocConteudo','cpcDocVinculo','cpcDocFechar','cpcDocStatus'])assert.match(html,new RegExp('id="'+idHtml+'"'));
assert.match(html,/cpc-documento-leitura\.js\?v=20261014-documento2/);
assert.match(html,/CpcDocumentoLeitura\.configurar\(db\)/);
assert.doesNotMatch(script,/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.remove\(/,'o visualizador nunca altera dados');
assert.match(script,/\.rpc\('obter_ocorrencia_publica'/);
assert.match(script,/\.select\('\*'\)\.eq\('id',id\)\.maybeSingle\(\)/);
assert.match(script,/somente_leitura_operacional===true/);
const ids=['cpcDocumentoLeitura','cpcDocFechar','cpcDocTitulo','cpcDocIdentificacao','cpcDocConteudo','cpcDocVinculo','cpcDocStatus'];
const els=Object.fromEntries(ids.map(id=>[id,{id,hidden:true,innerHTML:'',textContent:'',classList:{toggle(){}},handlers:{},
  addEventListener(t,cb){this.handlers[t]=cb},focus(){doc.activeElement=this},isConnected:true}]));
const doc={getElementById:id=>els[id]||null,addEventListener(){},activeElement:{isConnected:true,focus(){}}};
let rpcCalls=0,selectCalls=0;
const db={
  rpc:async(name,args)=>{rpcCalls++;assert.equal(name,'obter_ocorrencia_publica');assert.equal(args.p_id,id);
    return {data:{id,numero_bo:'BO-123',historico_resumido:'RELATO <script>alert(1)</script>',observacao:'Pessoas presentes',veiculos_recuperados:1},error:null}},
  from:tabela=>{selectCalls++;assert.equal(tabela,'cipa_fauna');return {
    select(cols){assert.equal(cols,'*');return this},eq(k,v){assert.equal(k,'id');assert.equal(v,id);return this},
    async maybeSingle(){return {data:{id,ocorrencia_id:pai,numero_tr:'TR-1',nome_comum:'Arara',quantidade:2},error:null}}
  }}
};
w.SistemaAuth={enabled:true,ready:Promise.resolve(),contexto:{tipo:'COMANDO',somente_leitura_operacional:true},
  temModulo:()=>true,pode:()=>true};
vm.runInNewContext(script,{window:w,document:doc,console});
const viewer=w.CpcDocumentoLeitura;viewer.configurar(db);
(async()=>{
  await viewer.abrir(linha);
  assert.equal(rpcCalls,1);
  assert.equal(els.cpcDocumentoLeitura.hidden,false);
  assert.match(els.cpcDocConteudo.innerHTML,/RELATO &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(els.cpcDocConteudo.innerHTML,/<script>/);
  assert.match(els.cpcDocConteudo.innerHTML,/Pessoas presentes/);
  assert.match(els.cpcDocConteudo.innerHTML,/PDF original somente poderá ser aberto/);
  assert.equal(els.cpcDocVinculo.hidden,true);
  viewer.fechar();
  assert.equal(els.cpcDocumentoLeitura.hidden,true);

  await viewer.abrir({...fauna,registro_id:id});
  assert.equal(selectCalls,1);
  assert.equal(els.cpcDocVinculo.hidden,false);
  assert.match(els.cpcDocConteudo.innerHTML,/Arara/);
  viewer.fechar();

  w.SistemaAuth.contexto={tipo:'OPERACIONAL',somente_leitura_operacional:false};
  await viewer.abrir(linha);
  assert.equal(rpcCalls,1,'sem contexto CPC não consulta o banco');
  assert.match(els.cpcDocStatus.textContent,/Não foi possível abrir/);
  viewer.fechar();

  w.SistemaAuth.contexto={tipo:'COMANDO',somente_leitura_operacional:true};
  await viewer.abrir({origem_tabela:'perfis_usuarios',registro_id:id});
  assert.equal(rpcCalls,1,'tabela fora da lista não é consultada');
  assert.equal(selectCalls,1);
  viewer.fechar();
  await viewer.abrir({origem_tabela:'ocorrencias',registro_id:'not-a-uuid'});
  assert.equal(rpcCalls,1,'id inválido não consulta o banco');
  viewer.fechar();
  console.log('PASS: visualizador CPC, origem rastreável, histórico escapado, RLS/COMANDO, tabelas permitidas, sem escrita.');
})().catch(e=>{console.error(e);process.exitCode=1});
