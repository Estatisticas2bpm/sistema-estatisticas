'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'dashboard-cpc.html'),'utf8');
const cadastro=fs.readFileSync(path.join(root,'produtividade-cpc.html'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261029143000_cpc_atividades_documentadas.sql'),'utf8');
function trecho(inicio,fim){
 const a=html.indexOf(inicio),b=html.indexOf(fim,a+inicio.length);
 assert.ok(a>=0&&b>a,'Bloco ausente '+inicio);
 return html.slice(a,b);
}
const unidades=[
 {id:'cpc',sigla:'CPC',tipo:'COMANDO'},
 {id:'bope',sigla:'BOPE',tipo:'BATALHAO',parent_id:'cpc'},
 {id:'choque',sigla:'CHOQUE',tipo:'SUBUNIDADE',parent_id:'bope'},
 {id:'canil',sigla:'CANIL',tipo:'SUBUNIDADE',parent_id:'bope'},
 {id:'bpm',sigla:'2BPM',tipo:'BATALHAO',parent_id:'cpc'}
];
const arvore=id=>{const ids=new Set([id]);let n=0;while(n++<10){for(const u of unidades){if(ids.has(u.parent_id))ids.add(u.id)}}return [...ids];};
const ctx={unidadeH:id=>unidades.find(x=>x.id===id),idsDescH:arvore,Set};
vm.createContext(ctx);
vm.runInContext(trecho('function filtrarAtividadesCpc(','function renderAbordagensGiroCpc(){'),ctx);
const reg=[
 {id:'op1',unidade_id:'bope',subunidade_id:'choque',tipo:'OPERACAO',situacao:'VALIDADO'},
 {id:'op2',unidade_id:'bope',subunidade_id:'canil',tipo:'OPERACAO',situacao:'VALIDADO'},
 {id:'ap1',unidade_id:'bope',subunidade_id:'choque',tipo:'APRESENTACAO',situacao:'VALIDADO'},
 {id:'ap2',unidade_id:'bpm',subunidade_id:null,tipo:'APRESENTACAO',situacao:'PENDENTE'},
 {id:'ap3',unidade_id:'bpm',subunidade_id:null,tipo:'APRESENTACAO',situacao:'CANCELADO'}
];
let x=ctx.indicadoresAtividadesDocumentadasCpc(reg,'');
assert.equal(x.operacoes,2);assert.equal(x.apresentacoes,1);
x=ctx.indicadoresAtividadesDocumentadasCpc(reg,'bope');
assert.equal(x.operacoes,2,'A contagem BOPE não duplica registros das subunidades');
assert.equal(x.apresentacoes,1);
x=ctx.indicadoresAtividadesDocumentadasCpc(reg,'choque');
assert.equal(x.operacoes,1,'Recorte Choque não inclui Canil');
assert.equal(x.apresentacoes,1);
x=ctx.indicadoresAtividadesDocumentadasCpc(reg,'canil');
assert.equal(x.operacoes,1);assert.equal(x.apresentacoes,null);
x=ctx.indicadoresAtividadesDocumentadasCpc(reg,'bpm');
assert.equal(x.operacoes,null);assert.equal(x.apresentacoes,null,'Pendentes e cancelados NÃO são produtividade');
x=ctx.indicadoresAtividadesDocumentadasCpc(null,'bope');
assert.equal(x.origemIndisponivel,true);
assert.equal(x.operacoes,null);

assert.match(html,/.from\('cpc_atividades_documentadas'\)/);
assert.match(html,/\.eq\('situacao','VALIDADO'\)/);
assert.match(html,/\.gte\('data_atividade',inicio\)\.lte\('data_atividade',fim\)/);
assert.match(html,/atividadesDocumentadasCpc=ad\.error\?null:\(ad\.data\|\|\[\]\)/);
assert.match(html,/id="kOperacoesDocumentadas"/);
assert.match(html,/id="kApresentacoesDocumentadas"/);
assert.match(html,/href="produtividade-cpc\.html"/);
assert.match(cadastro,/situacao:'PENDENTE'/);
assert.match(cadastro,/\.update\(\{situacao\}\)/);
assert.match(cadastro,/\.eq\('unidade_id',usuarioUnidadeId\)/);
assert.match(cadastro,/Somente atividades <strong>validadas<\/strong>/);
assert.match(migration,/alter table public\.cpc_atividades_documentadas enable row level security/i);
assert.match(migration,/unidade_id=any\(private\.unidades_acessiveis_atual\(\)\)/);
assert.match(migration,/unidade_id=private\.unidade_atual\(\)/);
assert.match(migration,/private\.pode_administrar_dados\(\)/);
assert.match(migration,/situacao='PENDENTE'/);
assert.match(migration,/from public\.unidades u where u\.id=new\.subunidade_id/);
assert.match(migration,/before insert or update/);
assert.match(migration,/create unique index if not exists cpc_atividades_documentadas_evento_uniq/);
assert.doesNotMatch(migration,/SECURITY DEFINER/i);
assert.doesNotMatch(migration,/create policy[\s\S]*?for delete to authenticated/i);
console.log('CPC: somente atividades validadas/documentadas entram no painel, com RLS, deduplicação e isolamento das subunidades.');
