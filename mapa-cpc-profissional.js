/* SIE-CPC — simbologia cartográfica de inteligência estatística.
 * Compartilhada pelo mapa resumido e mapa analítico; não modifica registros.
 * Leaflet.markercluster é opcional: sem ele, o agrupamento degrada para pontos.
 */
(function(global){
  'use strict';
  const C=()=>global.EstatisticaIndicadores||{};
  const sigla=v=>{
    const n=String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    return n&&n!=='NULL'?n:'OUTRAS';
  };
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const nome=v=>{
    const s=sigla(v);
    return ({'1BPM':'1º BPM','2BPM':'2º BPM','CAVALARIA':'Cavalaria','OUTRAS':'Não informada'})[s]||s;
  };
  const cor=v=>(C().corUnidade||{})[sigla(v)]||'#64748b';
  const brasao=v=>(C().brasaoUnidade||{})[sigla(v)]||'';
  const abreviacao=v=>({'1BPM':'1','2BPM':'2','BOPE':'BP','CAVALARIA':'CV','CIPA':'CA','CIPG':'CG','CIPTUR':'CT','GIRO':'GI'})[sigla(v)]||'•';
  function iconePonto(L,v,zoom){
    const detalhado=zoom>=16,s=abreviacao(v),diametro=detalhado?22:12;
    return L.divIcon({
      className:'sieCpcPin',
      html:'<span class="sieCpcDot'+(detalhado?' detalhado':'')+'" style="--unit-color:'+cor(v)+'" aria-hidden="true">'+(detalhado?esc(s):'')+'</span>',
      iconSize:[diametro,diametro],iconAnchor:[diametro/2,diametro/2],popupAnchor:[0,-diametro/2]
    });
  }
  function cabecalhoPopup(v){
    const logo=brasao(v);
    return '<div class="sieCpcPopupHeader"><div class="sieCpcPopupLogo" style="--unit-color:'+cor(v)+'">'+
      (logo?'<img src="'+esc(logo)+'" alt="" onerror="this.remove()">':'')+
      '<span>'+esc(abreviacao(v))+'</span></div><div><small>Unidade responsável</small><strong>'+esc(nome(v))+'</strong></div></div>';
  }
  function popup(v,conteudo){
    return '<div class="sieCpcPopup">'+cabecalhoPopup(v)+'<div class="sieCpcPopupDados">'+String(conteudo||'')+'</div></div>';
  }
  function criarMarcador(L,registro,conteudo,zoom,opcoes){
    const latitude=Number(registro.latitude),longitude=Number(registro.longitude),unidade=sigla(registro.unidade_sigla);
    const marcador=L.marker([latitude,longitude],{
      icon:iconePonto(L,unidade,zoom),title:nome(unidade)+' · ocorrência',
      unidadeSieCpc:unidade
    }).bindPopup(popup(unidade,conteudo),{maxWidth:320});
    const hover=opcoes?.popupAoPassar===true &&
      (typeof global.matchMedia!=='function'||global.matchMedia('(hover: hover) and (pointer: fine)').matches);
    if(hover){
      // Somente o mapa inicial solicita abertura por hover; a cartografia completa mantém o clique.
      marcador.on('mouseover',()=>marcador.openPopup());
      marcador.on('mouseout',()=>marcador.closePopup());
    }else if(typeof marcador.bindTooltip==='function'){
      marcador.bindTooltip(nome(unidade),{direction:'top',opacity:.95});
    }
    return marcador;
  }
  function contagens(registros){
    const result={};
    for(const row of registros||[]){const k=sigla(row.unidade_sigla);result[k]=(result[k]||0)+1}
    return result;
  }
  function agrupador(L){
    if(typeof L.markerClusterGroup!=='function')return {camada:L.layerGroup(),disponivel:false};
    const layer=L.markerClusterGroup({
      showCoverageOnHover:false,
      spiderfyOnMaxZoom:true,
      zoomToBoundsOnClick:true,
      removeOutsideVisibleBounds:true,
      maxClusterRadius:46,
      iconCreateFunction:cluster=>{
        const marcadores=cluster.getAllChildMarkers(),counts={};
        for(const marker of marcadores){const u=sigla(marker.options.unidadeSieCpc);counts[u]=(counts[u]||0)+1}
        const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]),misto=entries.length!==1;
        const dominante=entries[0]?.[0]||'OUTRAS';
        const n=cluster.getChildCount(),diametro=n>=100?42:n>=20?37:33;
        const color=misto?'#334155':cor(dominante);
        const aria=misto?n+' ocorrências de '+entries.length+' unidades':n+' ocorrências · '+nome(dominante);
        return L.divIcon({
          className:'sieCpcCluster',
          html:'<span class="sieCpcClusterBubble'+(misto?' misto':'')+'" style="--cluster-color:'+color+'" title="'+esc(aria)+'">'+n+'</span>',
          iconSize:[diametro,diametro],iconAnchor:[diametro/2,diametro/2]
        });
      }
    });
    return {camada:layer,disponivel:true};
  }
  function legenda(registros,opcoes){
    const opts=opcoes||{},ocorrencias=registros||[],abordagens=Number(opts.abordagens||0);
    const total=ocorrencias.length;
    if(opts.visual==='calor'){
      return '<div class="sieCpcLegendaTit">Densidade de registros</div>'+
        '<div class="sieCpcEscalaCalor" aria-label="Baixa a alta densidade"></div>'+
        '<div class="sieCpcEscalaRotulos"><span>Menor</span><span>Maior</span></div>'+
        '<small>'+total.toLocaleString('pt-BR')+' ocorrência(s) georreferenciada(s)'+(abordagens?' · '+abordagens+' abordagem(ns) GIRO':'')+'</small>';
    }
    const counts=contagens(ocorrencias),cores=C().corUnidade||{};
    const rows=Object.keys(cores).map(k=>{
      const n=counts[k]||0;
      return '<button type="button" class="sieCpcLegendaUnidade" data-sie-unidade="'+esc(k)+'" title="Filtrar pelo '+esc(nome(k))+'">'+
        '<i style="background:'+cores[k]+'"></i><span>'+esc(nome(k))+'</span><b>'+n.toLocaleString('pt-BR')+'</b></button>';
    }).join('');
    const outras=counts.OUTRAS||0;
    return '<div class="sieCpcLegendaTit">Unidades responsáveis <small>('+total+')</small></div>'+
      '<div class="sieCpcLegendaLinhas">'+rows+(outras?'<div class="sieCpcLegendaUnidade"><i style="background:#64748b"></i><span>Não informada</span><b>'+outras+'</b></div>':'')+'</div>'+
      '<small>'+ (opts.visual==='agrupado'?'Clique nos grupos para aproximar · ': 'Clique em um ponto para identificar · ')+
      'brasão no detalhamento'+(abordagens?' · '+abordagens+' abordagem(ns) GIRO':'')+'</small>';
  }
  function exportarVisao(mapa,ocorrencias,abordagens,prefixo){
    const bounds=mapa.getBounds(),linhas=[];
    const dentro=x=>Number.isFinite(Number(x.latitude))&&Number.isFinite(Number(x.longitude))&&bounds.contains([Number(x.latitude),Number(x.longitude)]);
    for(const x of ocorrencias||[])if(dentro(x)){
      linhas.push(['OCORRÊNCIA',nome(x.unidade_sigla),x.ocorrencia||x.crime||'',x.data_ocorrencia||'',x.bairro||'',x.endereco||'',x.numero_bo||'',Number(x.latitude).toFixed(6),Number(x.longitude).toFixed(6)]);
    }
    for(const x of abordagens||[])if(dentro(x)){
      linhas.push(['ABORDAGEM GIRO','GIRO',x.tipo_abordagem||'Abordagem',x.registrado_em||'',x.bairro||'',x.endereco||'', '',Number(x.latitude).toFixed(6),Number(x.longitude).toFixed(6)]);
    }
    const safe=value=>{
      let s=String(value??'').replace(/\r|\n/g,' ');
      if(/^[=+@\-\t]/.test(s))s="'"+s;
      return '"'+s.replace(/"/g,'""')+'"';
    };
    const header=['Tipo de registro','Unidade responsável','Natureza / tipo','Data / hora','Bairro','Endereço','Número do BO','Latitude','Longitude'];
    const csv='\uFEFF'+[header,...linhas].map(row=>row.map(safe).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=(prefixo||'sie-cpc-mapa')+'-'+new Date().toISOString().slice(0,10)+'.csv';
    document.body.appendChild(a);a.click();a.remove();
    // URL temporária é liberada após o download iniciar; navegador faz limpeza da aba.
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    return linhas.length;
  }
  global.MapaCpcProfissional=Object.freeze({sigla,nome,cor,brasao,abreviacao,iconePonto,cabecalhoPopup,popup,criarMarcador,contagens,agrupador,legenda,exportarVisao});
})(window);
