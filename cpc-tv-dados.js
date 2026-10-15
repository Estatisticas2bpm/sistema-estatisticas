/* SIE-CPC | fontes e agregação trimestral do Modo TV. Sem credenciais próprias ou contagem cruzada de documentos. */
(function(global){
'use strict';
const TZ='America/Boa_Vista',MAX_PAGINAS=200;
const clean=v=>String(v??'').trim(),normalize=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const esc=v=>clean(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
const num=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:1});
const currency=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:2});
const sum=(a,k)=>(a||[]).reduce((n,x)=>n+(Number(x?.[k])||0),0);
const iso=d=>d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');
const utc=(y,m,d)=>new Date(Date.UTC(y,m,d));
function hojeBoaVista(date=new Date()){
 const partes=new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const p=Object.fromEntries(partes.map(x=>[x.type,x.value]));
 return utc(+p.year,+p.month-1,+p.day);
}
function periodos(date=new Date(),selecao='atual'){
 const hoje=hojeBoaVista(date),ano=hoje.getUTCFullYear(),inicioMes=Math.floor(hoje.getUTCMonth()/3)*3;
 let ini=utc(ano,inicioMes,1),fim=hoje;
 if(selecao==='encerrado'){ini=utc(ano,inicioMes-3,1);fim=utc(ano,inicioMes,0);}
 const dias=Math.round((fim-ini)/86400000)+1;
 const limiteAnterior=utc(ini.getUTCFullYear(),ini.getUTCMonth(),0);
 const antIni=utc(ini.getUTCFullYear(),ini.getUTCMonth()-3,1);
 const antFim=new Date(Math.min(+utc(antIni.getUTCFullYear(),antIni.getUTCMonth(),dias),+limiteAnterior));
 const anoIni=utc(ini.getUTCFullYear()-1,ini.getUTCMonth(),1);
 const anoLim=utc(anoIni.getUTCFullYear(),anoIni.getUTCMonth()+3,0);
 const anoFim=new Date(Math.min(+utc(anoIni.getUTCFullYear(),anoIni.getUTCMonth(),dias),+anoLim));
 const trimestre=Math.floor(ini.getUTCMonth()/3)+1;
 return {inicio:iso(ini),fim:iso(fim),antInicio:iso(antIni),antFim:iso(antFim),anoInicio:iso(anoIni),anoFim:iso(anoFim),dias,
   titulo:trimestre+'º trimestre de '+ini.getUTCFullYear()+(selecao==='encerrado'?' · encerrado':' · em andamento'),
   subtitulo:iso(ini).split('-').reverse().join('/')+' a '+iso(fim).split('-').reverse().join('/'),fuso:TZ};
}
function countRank(rows,fn,max=6){
 const m=new Map();
 (rows||[]).forEach(x=>{const v=clean(fn(x));if(!v||['NI','N/I','NAO INFORMADO','NÃO INFORMADO','NULL','UNDEFINED'].includes(normalize(v)))return;m.set(v,(m.get(v)||0)+1)});
 return [...m.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR')).slice(0,max);
}
function groupSum(rows,fn,field,max=6){
 const m=new Map();
 (rows||[]).forEach(x=>{const k=clean(fn(x));if(!k)return;m.set(k,(m.get(k)||0)+(+x[field]||0))});
 return [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,max);
}
function weekSeries(rows,field){
 const m=new Map();
 (rows||[]).forEach(x=>{
  const raw=clean(x[field]);const date=raw.slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
  const d=new Date(date+'T12:00:00Z');if(Number.isNaN(+d))return;
  const day=d.getUTCDay();d.setUTCDate(d.getUTCDate()-((day+6)%7));
  const key=iso(d);m.set(key,(m.get(key)||0)+1);
 });
 return [...m].sort((a,b)=>a[0].localeCompare(b[0]));
}
function descendants(unidades){
 const map=new Map();(unidades||[]).forEach(u=>map.set(String(u.id),u));
 return map;
}
function unidadeReg(unidades,row){return unidades.get(String(row?.unidade_id||''));}
function scope(rows,ids){return (rows||[]).filter(x=>ids.has(String(x.unidade_id)));}
async function rpc(db,nome,p){
 const r=await db.rpc(nome,p);if(r.error)throw Error(nome+': '+r.error.message);return r.data;
}
async function pagina(db,tabela,campos,data,inicio,fim,ids=null){
 const linhas=[];for(let p=0;p<MAX_PAGINAS;p++){
  const q=db.from(tabela).select(campos).gte(data,inicio).lte(data,fim).order('id',{ascending:true}).range(p*1000,p*1000+999);
  const r=await q;if(r.error)throw Error(tabela+': '+r.error.message);
  const lote=r.data||[];linhas.push(...(ids?scope(lote,ids):lote));
  if(lote.length<1000)return linhas;
 }
 throw Error(tabela+': limite de paginação excedido.');
}
async function especializados(db,p,unidades){
 const idsBy=sigla=>{
  const us=[...unidades.values()],base=us.filter(u=>normalize(u.sigla)===sigla).map(u=>String(u.id));
  const ids=new Set(base);let changed=true;
  while(changed){changed=false;for(const u of us)if(ids.has(String(u.parent_id))&&!ids.has(String(u.id))){ids.add(String(u.id));changed=true;}}
  return ids;
 };
 const specs={
  GIRO:()=>pagina(db,'giro_abordagens','id,unidade_id,registrado_em,tipo_abordagem,quantidade_pessoas,bairro', 'registrado_em',p.inicio+'T00:00:00-04:00',p.fim+'T23:59:59.999-04:00',idsBy('GIRO')),
  CIPTUR:()=>pagina(db,'ciptur_autos_infracao','id,unidade_id,data_infracao,houve_remocao,tipo_veiculo_removido,gravidade_snapshot,descricao_snapshot','data_infracao',p.inicio,p.fim,idsBy('CIPTUR')),
  CAVALARIA:()=>pagina(db,'cavalaria_servicos_produtividade','id,unidade_id,data_servico,tipo_policiamento,contexto_atividade,abordagens_pessoas,abordagens_motos,abordagens_carros,foragidos_presos,armas_apreendidas','data_servico',p.inicio,p.fim,idsBy('CAVALARIA')),
  CIPA:async()=>{
   const a=await global.CipaHome.consultar(db,p.inicio,p.fim);
   // O mesmo contrato da página inicial CPC respeita as políticas das tabelas ambientais.
   const notif=await pagina(db,'cipa_autos_notificacao','id,data_notificacao,numero','data_notificacao',p.inicio,p.fim).catch(e=>({erro:e.message}));
   return {...a,notificacoes:notif};
  },
  CIPG:async()=>global.CipgHome.consultar(db,p.inicio,p.fim)
 };
 const names=Object.keys(specs);
 const result=await Promise.all(names.map(async nome=>{
  if(![...unidades.values()].some(u=>normalize(u.sigla)===nome))return [nome,{status:'indisponivel',mensagem:'Unidade fora do escopo'}];
  try{return[nome,{status:'ok',data:await specs[nome]()}]}
  catch(e){console.warn('Modo TV '+nome+':',e.message);return[nome,{status:'erro',mensagem:'Consulta indisponível'}]}
 }));
 return Object.fromEntries(result);
}
async function consultar(db,p){
 // Mesmas consultas e critérios do Dashboard Completo; unidade autorizada via guard + RLS.
 const home=await rpc(db,'obter_home_cpc_territorial',{data_inicio:p.inicio,data_fim:p.fim});
 if(home?.autorizado!==true)throw Error(home?.erro||'Contexto CPC não autorizado');
 const unidades=descendants(home.unidades||[]);
 const ids=new Set([...unidades.keys()]);
 if(!ids.size)throw Error('Nenhuma unidade CPC disponível na sessão');
 const windows=[
  [p.inicio,p.fim],[p.antInicio,p.antFim],[p.anoInicio,p.anoFim]
 ];
 const result=[];
 for(const [inicio,fim] of windows){
  // Pares concorrentes, janelas sequenciais para evitar excesso de carga no banco.
  const [oc,tco]=await Promise.all([
   rpc(db,'obter_dados_dashboard_territorial',{data_inicio:inicio,data_fim:fim}),
   rpc(db,'obter_tcos_dashboard_territorial',{data_inicio:inicio,data_fim:fim})
  ]);
  if(!Array.isArray(oc)||!Array.isArray(tco))throw Error('Contrato territorial não retornou listas válidas');
  result.push({ocorrencias:scope(oc,ids),tcos:scope(tco,ids)});
 }
 const spec=await especializados(db,p,unidades);
 return {periodo:p,unidades:[...unidades.values()],atual:result[0],anterior:result[1],anoAnterior:result[2],especializados:spec};
}
function metrics(data){
 const a=data?.ocorrencias||[],t=data?.tcos||[];
 return {ocorrencias:a.length,tcos:t.length,conducoes:sum(a,'conducoes_operacionais'),
  recuperados:sum(a,'veiculos_recuperados'),foragidos:sum(a,'foragidos'),
  armas:sum(a,'quantidade_armas'),orientacoes:sum(a,'orientacoes'),
  atendidas:a.filter(x=>normalize(x.status_atendimento)==='ATENDIDA').length};
}
function formatDiff(a,b){
 if(b===0)return a===0?'Sem variação':'Sem base anterior';
 const p=(a-b)*100/b;return (p>0?'+':'')+p.toFixed(1).replace('.',',')+'%';
}
global.CpcTvDados=Object.freeze({esc,num,currency,sum,normalize,periodos,countRank,groupSum,weekSeries,pagina,consultar,metrics,formatDiff});
})(window);
