const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261013021500_otimizar_home_cpc_territorial_anual.sql'),'utf8');
const js=fs.readFileSync(path.join(root,'cpc-indicadores-dashboard.js'),'utf8');
const html=fs.readFileSync(path.join(root,'dashboard-cpc.html'),'utf8');

assert.match(sql,/create or replace function public\.obter_home_cpc_territorial/i);
assert.match(sql,/with raiz as materialized/i);
assert.match(sql,/base as materialized/i);
assert.match(sql,/mapa as materialized/i);
assert.match(sql,/select distinct item->>'bairro' bairro from base/);
assert.match(sql,/left join mapa t on t\.bairro=x\.item->>'bairro'/);
assert.doesNotMatch(sql,/left join lateral\s*\(select public\.territorio_por_bairro/i);
assert.match(sql,/public\.obter_home_cpc\(data_inicio,data_fim\)/);
assert.match(sql,/public\.obter_catalogo_territorial_cpc\(\)/);
assert.match(html,/cpc-indicadores-dashboard\.js\?v=20261013-indicadores1/);

const elements={
  cpcIndicadoresEspecificos:{innerHTML:''},
  cpcIndicadoresNota:{textContent:''}
};
const errors=[];
const box={
  window:{
    CipaHome:{consultar:async()=>({fauna:[],autos:[],embargos:[]})},
    CipgHome:{consultar:async()=>({servicos:[],eventos:[]})},
    CpcDetalhamentoOrigem:{reiniciar:()=>{}}
  },
  document:{getElementById:id=>elements[id]||null},
  console:{error:(...args)=>errors.push(args)}
};
vm.runInNewContext(js,box);
const carregar=box.window.CpcIndicadoresDashboard.carregar;
const args=(ini,fim)=>({data_inicio:ini,data_fim:fim,p_unidade_id:null});
const success={data:{autorizado:true,ocorrencias:[],tcos:[]},error:null};
const makeDb=rpc=>({
  rpc,
  from:()=>({
    select(){return this;},gte(){return this;},lte(){return this;},
    order(){return this;},range:async()=>({data:[],error:null})
  })
});
(async()=>{
  const db=makeDb(async()=>success);
  await carregar(db,args('2026-10-12','2026-10-12'),[]);
  assert.match(elements.cpcIndicadoresNota.textContent,/2026-10-12 a 2026-10-12/);

  await carregar(db,args('2026-01-01','2026-10-12'),[]);
  assert.match(elements.cpcIndicadoresNota.textContent,/2026-01-01 a 2026-10-12/);
  assert.doesNotMatch(elements.cpcIndicadoresNota.textContent,/2026-10-12 a 2026-10-12/);

  const timeout=makeDb(async()=>({data:null,error:{code:'57014',message:'canceling statement due to statement timeout'}}));
  await carregar(timeout,args('2026-01-01','2026-10-12'),[]);
  assert.match(elements.cpcIndicadoresEspecificos.innerHTML,/tempo limite/);
  assert.match(elements.cpcIndicadoresEspecificos.innerHTML,/57014/);
  assert.match(elements.cpcIndicadoresNota.textContent,/2026-01-01 a 2026-10-12/);
  assert.match(elements.cpcIndicadoresNota.textContent,/Nenhum resultado de outro período foi reutilizado/);

  const unauthorized=makeDb(async()=>({data:{autorizado:false,erro:'Acesso restrito ao contexto de uma unidade do tipo COMANDO.'},error:null}));
  await carregar(unauthorized,args('2026-02-01','2026-02-28'),[]);
  assert.match(elements.cpcIndicadoresEspecificos.innerHTML,/não possui autorização/);
  assert.match(elements.cpcIndicadoresNota.textContent,/2026-02-01 a 2026-02-28/);

  const rejected=makeDb(async()=>{throw Error('Falha de rede')});
  await carregar(rejected,args('2026-03-01','2026-03-31'),[]);
  assert.match(elements.cpcIndicadoresEspecificos.innerHTML,/Não foi possível consultar/);
  assert.match(elements.cpcIndicadoresNota.textContent,/2026-03-01 a 2026-03-31/);

  const pending=[];
  const concurrent=makeDb(()=>new Promise(resolve=>pending.push(resolve)));
  const first=carregar(concurrent,args('2026-01-01','2026-01-31'),[]);
  const second=carregar(concurrent,args('2026-01-01','2026-10-12'),[]);
  pending[1](success);
  await second;
  pending[0]({data:null,error:{code:'57014',message:'timeout'}});
  await first;
  assert.match(elements.cpcIndicadoresNota.textContent,/2026-01-01 a 2026-10-12/);
  assert.doesNotMatch(elements.cpcIndicadoresEspecificos.innerHTML,/tempo limite/);
  assert.ok(errors.length>=3);
  console.log('PASS: escopo CPC anual, cache territorial, período correto, timeout, autorização, rede e concorrência.');
})().catch(e=>{console.error(e);process.exitCode=1});
