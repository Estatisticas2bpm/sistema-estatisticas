/* Controlador do Modo TV CPC: carregamento autenticado, ciclo, gráficos e mapa agregados. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const D=()=>window.CpcTvDados,A=()=>window.CpcTvApresentacao,I=()=>window.EstatisticaIndicadores||{};
let db=null,slides=[],slideAtual=0,charts=[],mapa=null,modelo=null,carregando=false,ultimoSucesso=null;
const PROXIMO_MS=23000,ATUALIZAR_MS=300000;
function agora(){return new Date().toLocaleTimeString('pt-BR',{timeZone:'America/Boa_Vista',hour:'2-digit',minute:'2-digit'})}
function relogio(){
 const d=new Date(),op={timeZone:'America/Boa_Vista'};
 $('tvRelogio').textContent=new Intl.DateTimeFormat('pt-BR',{...op,hour:'2-digit',minute:'2-digit'}).format(d);
 $('tvData').textContent=new Intl.DateTimeFormat('pt-BR',{...op,day:'2-digit',month:'long',year:'numeric'}).format(d);
}
function aviso(texto,erro=false){const el=$('tvAviso');el.hidden=!texto;el.textContent=texto||'';el.classList.toggle('erro',erro);}
function limparGraficos(){
 charts.forEach(c=>{try{c.destroy()}catch(_){}});charts=[];
}
function grafico(canvas,config){
 if(!canvas||!config||!window.Chart)return;
 if(!config.labels?.length||!config.values?.some(x=>Number(x)>0)){
  canvas.parentNode.innerHTML='<p class="tvNote">Sem registros para representar neste gráfico.</p>';return;
 }
 const multi=Array.isArray(config.outros),horizontal=!!config.horizontal;
 const datasets=[{label:'Trimestre selecionado',data:config.values,
  backgroundColor:config.type==='line'?'#54d0dc66':'#54d0dca0',borderColor:'#54d0dc',borderWidth:2,
  fill:config.type==='line',tension:.27,pointRadius:3,borderRadius:6}];
 if(multi)datasets.push({label:'Período anterior equivalente',data:config.outros,borderColor:'#deb66b',backgroundColor:'#deb66b7d',borderWidth:2,borderRadius:6});
 const chart=new Chart(canvas,{type:config.type,data:{labels:config.labels,datasets},options:{
  indexAxis:horizontal?'y':'x',responsive:true,maintainAspectRatio:false,animation:{duration:600},
  plugins:{legend:{display:multi,labels:{color:'#cbdce9',font:{size:12}}},tooltip:{enabled:true}},
  scales:{x:{grid:{color:'#ffffff0e'},ticks:{color:'#c2d4e1',font:{size:12},maxRotation:35}},
   y:{beginAtZero:true,grid:{color:'#ffffff12'},ticks:{color:'#c2d4e1',font:{size:12},precision:0}}}
 }});
 charts.push(chart);
}
function pontosGeo(){
 const base=modelo?.atual?.ocorrencias||[];
 return base.filter(x=>Number.isFinite(+x.latitude)&&Number.isFinite(+x.longitude)&&x.latitude!==null&&x.longitude!==null&&+x.latitude>=2&&+x.latitude<=5&&+x.longitude>=-63&&+x.longitude<=-59);
}
function montarMapa(){
 const container=$('miniMapaCpc');
 if(!container||!window.L||!modelo)return;
 if(mapa){try{mapa.remove()}catch(_){}mapa=null;}
 mapa=L.map(container,{zoomControl:false,scrollWheelZoom:false,dragging:false,doubleClickZoom:false,
  boxZoom:false,keyboard:false,touchZoom:false,attributionControl:true}).setView([2.8235,-60.6758],11);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:16,attribution:'&copy; OpenStreetMap'}).addTo(mapa);
 const cores=I().corUnidade||{};
 const byId=new Map(modelo.unidades.map(x=>[String(x.id),x]));
 const points=pontosGeo(),coords=[];
 // Amostragem determinística apenas para a camada visual; totais usam todos os registros.
 const passo=Math.max(1,Math.ceil(points.length/1300));
 for(let n=0;n<points.length;n+=passo){
  const o=points[n],lat=Number(o.latitude),lng=Number(o.longitude),sigla=byId.get(String(o.unidade_id))?.sigla;
  const cor=cores[String(sigla||'').toUpperCase()]||'#54d0dc';
  L.circleMarker([lat,lng],{radius:3.4,color:'#f7fafc',weight:.7,fillColor:cor,fillOpacity:.85,interactive:false}).addTo(mapa);
  coords.push([lat,lng]);
 }
 if(coords.length===1)mapa.setView(coords[0],12);
 else if(coords.length>1)mapa.fitBounds(coords,{padding:[35,35],maxZoom:12});
 setTimeout(()=>{if(mapa)mapa.invalidateSize()},300);
}
function mostrar(i){
 if(!slides.length)return;
 slideAtual=(i+slides.length)%slides.length;
 const els=[...document.querySelectorAll('.tvSlide')];
 els.forEach((el,j)=>{el.classList.toggle('active',j===slideAtual);el.setAttribute('aria-hidden',j===slideAtual?'false':'true')});
 $('tvContador').textContent=(slideAtual+1)+' / '+slides.length;
 $('tvProgresso').style.width=((slideAtual+1)/slides.length*100).toFixed(2)+'%';
 limparGraficos();
 if(mapa&&slideAtual!==slides.findIndex(s=>s.title==='MAPA OPERACIONAL DO CPC')){
  mapa.remove();mapa=null;
 }
 const ativo=els[slideAtual];if(!ativo)return;
 ativo.querySelectorAll('canvas[data-tv-chart]').forEach(canvas=>{
  const conf=slides[slideAtual].graficos[canvas.dataset.tvChart];grafico(canvas,conf);
 });
 if(ativo.querySelector('#miniMapaCpc'))montarMapa();
}
function render(model){
 modelo=model;const previousTitle=slides[slideAtual]?.title;
 slides=A().slides(model);
 if(mapa){mapa.remove();mapa=null;}
 limparGraficos();
 $('tvPeriodo').textContent=model.periodo.titulo+' · '+model.periodo.subtitulo;
 $('tvStage').innerHTML=slides.map((s,i)=>
  '<section class="tvSlide'+(i===0?' active':'')+'" data-slide="'+i+'" aria-hidden="'+(i?'true':'false')+'">'+
   '<div class="tvSlideTitle"><div><h1>'+D().esc(s.title)+'</h1><p>'+D().esc(s.subtitle)+'</p></div>'+
   '<span class="tvTag">'+D().esc(s.tag)+'</span></div><div class="tvContent">'+s.html+'</div></section>').join('');
 $('tvUltimaAtualizacao').textContent='Atualizado às '+agora();
 const old=slides.findIndex(x=>x.title===previousTitle);
 mostrar(old>=0?old:0);
}
async function carregar(){
 if(carregando||!db)return;
 carregando=true;if(!modelo)aviso('Consultando os registros trimestrais das unidades do CPC...');
 try{
  const p=D().periodos(new Date(),$('tvTrimestre').value);
  const data=await D().consultar(db,p);
  render(data);ultimoSucesso=Date.now();aviso('');
 }catch(err){
  console.error('Modo TV CPC:',err);
  aviso(modelo?'Últimos dados válidos mantidos. Nova tentativa automática em até 5 minutos.':'Não foi possível carregar o CPC. Verifique a sessão, a conexão e os indicadores territoriais.',true);
  $('tvUltimaAtualizacao').textContent=ultimoSucesso?'Última atualização válida às '+agora():'Dados indisponíveis';
 }finally{carregando=false}
}
async function iniciar(){
 relogio();setInterval(relogio,1000);
 $('tvAnterior').addEventListener('click',()=>mostrar(slideAtual-1));
 $('tvProximo').addEventListener('click',()=>mostrar(slideAtual+1));
 $('tvTrimestre').addEventListener('change',()=>{modelo=null;carregar()});
 let pausado=false;const pause=$('tvPausar');
 function alternarPausa(){pausado=!pausado;pause.textContent=pausado?'Retomar rotação':'Pausar rotação';pause.setAttribute('aria-pressed',String(pausado))}
 pause.addEventListener('click',alternarPausa);
 document.addEventListener('keydown',ev=>{
  if(ev.target&&['INPUT','SELECT','TEXTAREA'].includes(ev.target.tagName))return;
  if(ev.key==='ArrowRight')mostrar(slideAtual+1);
  if(ev.key==='ArrowLeft')mostrar(slideAtual-1);
  if(ev.code==='Space'){ev.preventDefault();alternarPausa()}
 });
 setInterval(()=>{if(!pausado&&slides.length)mostrar(slideAtual+1)},PROXIMO_MS);
 setInterval(()=>{if(!document.hidden)carregar()},ATUALIZAR_MS);
 const auth=await window.SistemaAuth?.ready;
 if(!auth?.client||auth.contexto?.tipo!=='COMANDO'||String(auth.contexto?.sigla||'').toUpperCase()!=='CPC'||auth.pode('tv')!==true){
  aviso('Acesso permitido somente a perfis autorizados no contexto do CPC.',true);return;
 }
 db=auth.client;await carregar();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>iniciar().catch(e=>aviso(e.message,true)));
else iniciar().catch(e=>aviso(e.message,true));
})();
