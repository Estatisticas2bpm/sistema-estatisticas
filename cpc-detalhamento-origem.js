/* Detalhamento documental em largura ampla do Dashboard CPC.
 * Opera sobre os registros já autorizados e carregados pelo contrato estatístico;
 * não realiza consultas adicionais nem altera o banco de dados.
 */
(function(global){
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalizar=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
const displayName=s=>String(s||'').replace(/^(\d+)BPM$/i,(_,n)=>n+'º BPM');
const documentos=new Map();
const tamanhoPagina=12;
let atual='',pagina=0,termo='',fonte='',iniciado=false;
function linhasAtuais(){
  const todos=documentos.get(atual)?.linhas||[];
  const t=normalizar(termo);
  return todos.filter(x=>(!fonte||x.fonte===fonte)&&(!t||[
    x.data,x.fonte,x.referencia,x.descricao,x.quantidade,x.unidade,x.criterio
  ].some(v=>normalizar(v).includes(t))));
}
function valorMedida(x){
  if(x.quantidade===''||x.quantidade==null)return '—';
  const n=Number(x.quantidade);
  if(!Number.isFinite(n))return esc(x.quantidade)+' '+esc(x.unidade);
  if(x.unidade==='R$')return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  return esc(n.toLocaleString('pt-BR',{maximumFractionDigits:2}))+(x.unidade?' '+esc(x.unidade):'');
}
function montar(){
  const d=documentos.get(atual);
  if(!d)return;
  const filtradas=linhasAtuais(),totalPaginas=Math.max(1,Math.ceil(filtradas.length/tamanhoPagina));
  pagina=Math.min(Math.max(0,pagina),totalPaginas-1);
  const part=filtradas.slice(pagina*tamanhoPagina,(pagina+1)*tamanhoPagina);
  $('cpcOrigemCorpo').innerHTML=part.map(x=>
    '<tr><td>'+esc(x.data)+'</td><td>'+esc(x.fonte)+'</td>'+
    '<td class="cpcOrigemReferencia">'+esc(x.referencia)+'</td>'+
    '<td>'+esc(x.descricao)+'</td><td class="cpcOrigemMedida">'+valorMedida(x)+'</td>'+
    '<td>'+esc(x.criterio)+'</td></tr>'
  ).join('')||'<tr><td colspan="6" class="cpcOrigemSemResultados">Nenhum registro corresponde à pesquisa.</td></tr>';
  $('cpcOrigemQuantidade').textContent=filtradas.length+' registro(s) no filtro · '+d.linhas.length+' registro(s) de origem';
  $('cpcOrigemPagina').textContent='Página '+(pagina+1)+' de '+totalPaginas;
  $('cpcOrigemAnterior').disabled=pagina===0;
  $('cpcOrigemProximo').disabled=pagina===totalPaginas-1;
  $('cpcOrigemExportar').disabled=!filtradas.length;
}
function abrir(sigla){
  if(!documentos.has(sigla))return;
  inicializar();
  atual=sigla;pagina=0;termo='';fonte='';
  const d=documentos.get(sigla);
  const painel=$('cpcDetalhamentoOrigem');
  $('cpcOrigemTitulo').textContent='Registros de origem — '+displayName(sigla);
  $('cpcOrigemPeriodo').textContent='Período: '+d.inicio+' a '+d.fim+
    ' · as fontes especializadas utilizam suas próprias datas de referência.';
  const aviso=$('cpcOrigemAlerta');
  aviso.hidden=!d.parcial;
  aviso.textContent=d.parcial?'A consulta de uma fonte especializada falhou. A trilha está incompleta; não interprete dados ausentes como zero.':'';
  $('cpcOrigemBusca').value='';
  const fontes=[...new Set(d.linhas.map(x=>x.fonte).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  $('cpcOrigemFonte').innerHTML='<option value="">Todas as fontes</option>'+
    fontes.map(f=>'<option value="'+esc(f)+'">'+esc(f)+'</option>').join('');
  painel.hidden=false;
  montar();
  painel.scrollIntoView?.({behavior:'smooth',block:'start'});
}
function fechar(){
  const painel=$('cpcDetalhamentoOrigem');
  if(painel)painel.hidden=true;
  atual='';pagina=0;termo='';fonte='';
}
function registrar(sigla,linhas,parcial,inicio,fim){
  documentos.set(String(sigla),{
    linhas:Array.isArray(linhas)?linhas:[],parcial:!!parcial,inicio:String(inicio||''),fim:String(fim||'')
  });
}
function reiniciar(){
  documentos.clear();
  fechar();
}
function exportar(){
  if(!atual)return;
  const filtradas=linhasAtuais();
  if(!filtradas.length)return;
  const d=documentos.get(atual);
  const csv=global.CpcRastreabilidade.csv(filtradas);
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');
  link.href=url;
  link.download='sie-cpc-origem-'+atual.toLowerCase()+'-'+d.inicio.replaceAll('-','')+'-a-'+d.fim.replaceAll('-','')+'.csv';
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function inicializar(){
  if(iniciado)return;
  if(!$('cpcDetalhamentoOrigem'))return;
  iniciado=true;
  $('cpcOrigemFechar').addEventListener('click',fechar);
  $('cpcOrigemBusca').addEventListener('input',e=>{
    termo=e.target.value;pagina=0;montar();
  });
  $('cpcOrigemFonte').addEventListener('change',e=>{
    fonte=e.target.value;pagina=0;montar();
  });
  $('cpcOrigemAnterior').addEventListener('click',()=>{
    if(pagina>0){pagina--;montar()}
  });
  $('cpcOrigemProximo').addEventListener('click',()=>{
    if(pagina+1<Math.ceil(linhasAtuais().length/tamanhoPagina)){pagina++;montar()}
  });
  $('cpcOrigemExportar').addEventListener('click',exportar);
}
global.CpcDetalhamentoOrigem=Object.freeze({abrir,fechar,registrar,reiniciar,linhasAtuais,valorMedida});
})(window);
