const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'dashboard-cpc.html'),'utf8');
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261013012000_otimizar_painel_cpc_anual.sql'),'utf8');
assert.match(sql,/territorios as materialized\s*\(/i);
assert.equal(sql.split('left join territorios t on t.bairro=o.bairro').length-1,2,'ocorrências e TCOs devem compartilhar cache');
assert.doesNotMatch(sql,/left join lateral\s*\(select public\.territorio_por_bairro/i);
for(const param of ['data_inicio','data_fim','p_unidade_id','p_aisc','p_sisc','p_setor','p_ocorrencia','p_bairro','p_companhia','p_turno']){
  assert.match(sql,new RegExp('\\b'+param+'\\b'),'filtro mantido: '+param);
}
assert.match(html,/cpcConsultaSemResultado > :not\(:first-child\)\{display:none\}/);
assert.match(html,/id="status"[^>]*aria-live="polite"/);
assert.match(html,/if\(versao!==versaoConsultaCpc\)return/);

const source=html.slice(html.indexOf('let versaoConsultaCpc=0;'),html.indexOf('\nfunction periodo(tipo)'));
assert.ok(source.startsWith('let versaoConsultaCpc=0;')&&source.includes('async function carregar()'));
const ids=['ini','fim','unidade','aisc','sisc','setor','ocorrencia','bairro','companhia','turno','loading','status','heroPeriod','cpcIndicadoresEspecificos'];
function classList(){const set=new Set();return {add:x=>set.add(x),remove:x=>set.delete(x),contains:x=>set.has(x)}}
const elements=Object.fromEntries(ids.map(id=>[id,{value:'',textContent:'',style:{},classList:classList()}]));
elements.ini.value='2026-10-01';elements.fim.value='2026-10-12';
const main={classList:classList()};
const pending=[],rendered=[],calls=[];
const context={
  db:{},
  window:{SistemaAuth:{ready:Promise.resolve()},CpcIndicadoresDashboard:{carregar:()=>Promise.resolve()}},
  document:{querySelector:()=>main},
  $:id=>elements[id],
  br:s=>s,
  n:x=>Number(x)||0,
  hierarquiaUnidades:[],
  popularUnidades:()=>{},
  render:d=>rendered.push(d.periodo.inicio),
  consultarGiroCpcPaginado:async()=>({data:[],error:null}),
  consultarCavalariaCpcPaginado:async()=>({data:[],error:null}),
  consultarAtividadesDocumentadasCpc:async()=>({data:[],error:null}),
  consultarPainelCpc:args=>{calls.push({...args});return new Promise(resolve=>pending.push({args,resolve}))},
  console:{error:()=>{}}
};
vm.runInNewContext(source+'\nthis.carregar=carregar;',context);
function result(p){return {data:{autorizado:true,periodo:{inicio:p.args.data_inicio,fim:p.args.data_fim},resumo:{total_ocorrencias:p.args.data_inicio==='2026-01-01'?3598:88}},error:null}}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  const a=context.carregar();await tick();
  elements.ini.value='2026-01-01';
  const b=context.carregar();await tick();
  assert.equal(calls.length,2);
  assert.equal(calls[0].data_inicio,'2026-10-01');
  assert.equal(calls[1].data_inicio,'2026-01-01');
  pending[1].resolve(result(pending[1]));await b;
  pending[0].resolve(result(pending[0]));await a;
  assert.deepEqual(rendered,['2026-01-01'],'resposta antiga não substitui período anual');
  assert.equal(main.classList.contains('cpcConsultaSemResultado'),false);
  assert.match(elements.status.textContent,/3\.598/);

  elements.ini.value='2026-02-01';
  const erro=context.carregar();await tick();
  pending[2].resolve({data:null,error:{message:'canceling statement due to statement timeout'}});await erro;
  assert.equal(main.classList.contains('cpcConsultaSemResultado'),true,'não mostrar números antigos após erro');
  assert.match(elements.status.textContent,/timeout/);
  assert.match(elements.status.textContent,/resultados do período anterior foram ocultados/i);

  elements.ini.value='2026-01-01';elements.fim.value='2026-10-12';
  const campos={unidade:'uuid-da-unidade',aisc:'AISC 1',sisc:'SISC 1',setor:'1.1',ocorrencia:'SINISTRO',bairro:'CENTRO',companhia:'1ª CIA',turno:'NOITE'};
  for(const [id,valor] of Object.entries(campos))elements[id].value=valor;
  const combinado=context.carregar();await tick();
  assert.equal(calls.length,4);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[3])),{
    data_inicio:'2026-01-01',data_fim:'2026-10-12',
    p_unidade_id:'uuid-da-unidade',p_aisc:'AISC 1',p_sisc:'SISC 1',p_setor:'1.1',
    p_ocorrencia:'SINISTRO',p_bairro:'CENTRO',p_companhia:'1ª CIA',p_turno:'NOITE'
  },'todos os dez filtros devem ser transmitidos integralmente à RPC');
  pending[3].resolve(result(pending[3]));await combinado;
  assert.equal(main.classList.contains('cpcConsultaSemResultado'),false);
  for(const id of Object.keys(campos))elements[id].value='';
  elements.ini.value='2026-12-01';elements.fim.value='2026-01-01';
  await context.carregar();
  assert.equal(calls.length,4,'datas inválidas não consultam o banco');
  assert.match(elements.status.textContent,/Período inválido/);
  console.log('PASS: filtro anual CPC, concorrência, timeout, intervalo inválido e cache territorial.');
})().catch(e=>{console.error(e);process.exitCode=1});
