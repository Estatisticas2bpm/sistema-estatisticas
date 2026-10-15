/* Resumo mínimo, acessível e escapado de ocorrências / abordagens no mapa inicial. */
(function(global){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 function dataBR(v){
  const s=String(v||'').trim();
  const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m?m[3]+'/'+m[2]+'/'+m[1]:s;
 }
 function horario(v){
  const m=String(v||'').trim().match(/^(\d{1,2}:\d{2})/);
  return m?m[1]:'';
 }
 function linha(rotulo,valor){
  if(!String(valor??'').trim())return '';
  return '<div class="sieMapaResumoLinha"><span>'+esc(rotulo)+'</span><strong>'+esc(valor)+'</strong></div>';
 }
 function ocorrencia(x){
  const nome=String(x.ocorrencia||x.crime||'Ocorrência policial').trim();
  const quando=[dataBR(x.data_ocorrencia),horario(x.hora_inicial)].filter(Boolean).join(' · ');
  return '<div class="sieMapaResumo"><div class="sieMapaResumoNatureza">'+esc(nome)+'</div>'+
   linha('BO',x.numero_bo||'Não informado')+
   linha('Data / hora inicial',quando||'Não informado')+
   linha('Comandante',x.comandante||'Não informado')+'</div>';
 }
 function abordagem(x){
  const modalidade=String(x.tipo_abordagem||'').toUpperCase();
  const nome=modalidade==='A_PE'?'Abordagem a pé':modalidade==='MOTO'?'Abordagem de motocicleta':modalidade==='VEICULO'?'Abordagem de veículo':'Abordagem do GIRO';
  let quando='';
  if(x.registrado_em){
   const d=new Date(x.registrado_em);
   if(Number.isFinite(d.getTime()))quando=d.toLocaleString('pt-BR',{timeZone:'America/Boa_Vista',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
  }
  const qtd=Number(x.quantidade_pessoas);
  const pessoas=Number.isFinite(qtd)&&qtd>=0?qtd+' pessoa(s)':'Não informada';
  return '<div class="sieMapaResumo"><div class="sieMapaResumoNatureza">'+esc(nome)+'</div>'+
   linha('Pessoas abordadas',pessoas)+
   linha('Data / hora',quando||'Não informado')+
   linha('Local',x.bairro||x.endereco||x.municipio||'Local GPS')+'</div>';
 }
 global.MapaResumoHome=Object.freeze({ocorrencia,abordagem,dataBR,horario});
})(window);
