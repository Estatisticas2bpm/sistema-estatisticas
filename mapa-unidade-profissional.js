/* SIE-CPC — cartografia temática compartilhada com os mapas das unidades.
 * Usar somente posições reais recebidas de consultas autorizadas.
 * CPC permanece com cores por unidade; mapas individuais usam natureza/atividade.
 */
(function(global){
  'use strict';
  const base=()=>global.MapaCpcProfissional;
  const normalizar=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
  const categorias={
    ROUBO:{nome:'Roubo',cor:'#dc2626',abreviacao:'R'},
    FURTO:{nome:'Furto',cor:'#e49a16',abreviacao:'F'},
    VIOLENCIA:{nome:'Violência doméstica',cor:'#8b5cf6',abreviacao:'V'},
    TRANSITO:{nome:'Trânsito',cor:'#2563eb',abreviacao:'T'},
    DROGAS:{nome:'Drogas',cor:'#159968',abreviacao:'D'},
    AMBIENTAL:{nome:'Ação ambiental',cor:'#15803d',abreviacao:'A'},
    FISCALIZACAO:{nome:'Fiscalização ambiental',cor:'#166534',abreviacao:'F'},
    FAUNA:{nome:'Fauna / animais',cor:'#4d7c0f',abreviacao:'A'},
    EMBARGO:{nome:'Embargo',cor:'#b45309',abreviacao:'E'},
    ABORDAGEM_MOTO:{nome:'Abordagem em moto',cor:'#dc2626',abreviacao:'M'},
    ABORDAGEM_PE:{nome:'Abordagem a pé',cor:'#c026d3',abreviacao:'P'},
    ABORDAGEM_VEICULO:{nome:'Abordagem a veículo',cor:'#ea580c',abreviacao:'V'},
    ABORDAGEM_OUTRA:{nome:'Outras abordagens',cor:'#be185d',abreviacao:'A'},
    SERVICO:{nome:'Serviço / atividade',cor:'#a16207',abreviacao:'S'},
    GUARDA:{nome:'Guarda / serviço',cor:'#64748b',abreviacao:'G'},
    OUTRAS:{nome:'Outras ocorrências',cor:'#64748b',abreviacao:'•'}
  };
  function classificarOcorrencia(registro,unidade){
    const tipo=normalizar(registro?.ocorrencia||registro?.crime||registro?.natureza);
    const sigla=normalizar(unidade||registro?.unidade_sigla).replace(/[^A-Z0-9]/g,'');
    const acao=normalizar(registro?.cipa_area_tipo||registro?.tipo_acao_ambiental);
    let codigo='OUTRAS';
    if(sigla==='CIPA'){
      if(/EMBARG/.test(acao+' '+tipo))codigo='EMBARGO';
      else if(/FAUNA|ANIMAL|SILVESTRE/.test(acao+' '+tipo))codigo='FAUNA';
      else if(/FISCAL|AUTO DE INFRACAO|MULTA/.test(acao+' '+tipo))codigo='FISCALIZACAO';
      else if(/AMBIENT|DESMATAMENTO|QUEIMADA|FLORA|POLUICAO|GARIMPO/.test(acao+' '+tipo))codigo='AMBIENTAL';
    }
    if(codigo==='OUTRAS'){
      if(tipo.includes('ROUBO'))codigo='ROUBO';
      else if(tipo.includes('FURTO'))codigo='FURTO';
      else if(tipo.includes('VIOLENCIA DOMESTICA')||tipo.includes('MARIA DA PENHA'))codigo='VIOLENCIA';
      else if(tipo.includes('TRANSITO')||tipo.includes('ACIDENTE')||tipo.includes('SINISTRO'))codigo='TRANSITO';
      else if(tipo.includes('DROGA')||tipo.includes('ENTORPECENTE')||tipo.includes('TRAFICO'))codigo='DROGAS';
    }
    return {codigo,...categorias[codigo]};
  }
  function classificarAbordagem(registro){
    const t=normalizar(registro?.tipo_abordagem);
    const codigo=t==='MOTO'?'ABORDAGEM_MOTO':t==='A_PE'?'ABORDAGEM_PE':t==='VEICULO'?'ABORDAGEM_VEICULO':'ABORDAGEM_OUTRA';
    return {codigo,...categorias[codigo]};
  }
  function temaAtivo(registro,tipo,unidade){
    return tipo==='abordagem'?classificarAbordagem(registro):classificarOcorrencia(registro,unidade);
  }
  function icone(L,tema,zoom){
    const grande=zoom>=16,tamanho=grande?22:12;
    return L.divIcon({className:'sieCpcPin sieUnidadePin',
      html:'<span class="sieCpcDot'+(grande?' detalhado':'')+'" style="--unit-color:'+tema.cor+'" aria-hidden="true">'+(grande?esc(tema.abreviacao):'')+'</span>',
      iconSize:[tamanho,tamanho],iconAnchor:[tamanho/2,tamanho/2],popupAnchor:[0,-tamanho/2]
    });
  }
  function criarMarcador(L,registro,conteudo,zoom,tipo,unidade){
    const tema=temaAtivo(registro,tipo,unidade);
    const m=L.marker([Number(registro.latitude),Number(registro.longitude)],{
      icon:icone(L,tema,zoom),
      title:tema.nome,
      sieCategoria:tema.codigo
    });
    const tituloUnidade=unidade||registro.unidade_sigla||'';
    const header=base()?.cabecalhoPopup?base().cabecalhoPopup(tituloUnidade):'';
    const mensagem=header+'<div class="sieCpcPopupDados"><div class="sieUnidadeTipo" style="--tipo-cor:'+tema.cor+'"><i></i><b>'+esc(tema.nome)+'</b></div>'+conteudo+'</div>';
    m.bindPopup('<div class="sieCpcPopup">'+mensagem+'</div>',{maxWidth:320});
    if(typeof m.bindTooltip==='function')m.bindTooltip(tema.nome,{direction:'top',opacity:.95});
    return m;
  }
  function agregador(L){
    if(typeof L.markerClusterGroup!=='function')return {camada:L.layerGroup(),disponivel:false};
    const layer=L.markerClusterGroup({
      showCoverageOnHover:false,
      zoomToBoundsOnClick:true,
      spiderfyOnMaxZoom:true,
      removeOutsideVisibleBounds:true,
      maxClusterRadius:46,
      iconCreateFunction:function(cluster){
        const resumo=new Map();
        cluster.getAllChildMarkers().forEach(marker=>{
          const cod=marker.options.sieCategoria||'OUTRAS';
          resumo.set(cod,(resumo.get(cod)||0)+1);
        });
        const tipos=[...resumo.entries()].sort((a,b)=>b[1]-a[1]);
        const n=cluster.getChildCount(),misto=tipos.length!==1;
        const c=tipos[0]?.[0],cor=misto?'#334155':categorias[c]?.cor||'#64748b';
        const tamanho=n>=100?42:n>=20?37:33;
        return L.divIcon({className:'sieCpcCluster',
          html:'<span class="sieCpcClusterBubble'+(misto?' misto':'')+'" style="--cluster-color:'+cor+'" title="'+n+' registros · '+tipos.length+' categorias">'+n+'</span>',
          iconSize:[tamanho,tamanho],iconAnchor:[tamanho/2,tamanho/2]
        });
      }
    });
    return {camada:layer,disponivel:true};
  }
  function legenda(ocorrencias,abordagens,modo,unidade){
    const o=ocorrencias||[],a=abordagens||[];
    const total=o.length+a.length;
    if(modo==='calor'){
      return '<div class="sieCpcLegendaTit">Densidade espacial</div>'+
        '<div class="sieCpcEscalaCalor" aria-label="Intensidade de concentração geográfica"></div>'+
        '<div class="sieCpcEscalaRotulos"><span>Baixa</span><span>Alta</span></div>'+
        '<small>'+total.toLocaleString('pt-BR')+' registro(s) georreferenciado(s)</small>';
    }
    const contagem=new Map();
    o.forEach(x=>{const k=classificarOcorrencia(x,unidade).codigo;contagem.set(k,(contagem.get(k)||0)+1)});
    a.forEach(x=>{const k=classificarAbordagem(x).codigo;contagem.set(k,(contagem.get(k)||0)+1)});
    const html=[...contagem.entries()].sort((x,y)=>y[1]-x[1]||x[0].localeCompare(y[0],'pt-BR')).map(([cod,n])=>{
      const c=categorias[cod]||categorias.OUTRAS;
      return '<div class="sieCpcLegendaUnidade" title="'+esc(c.nome)+'"><i style="background:'+c.cor+'"></i><span>'+esc(c.nome)+'</span><b>'+n+'</b></div>';
    }).join('');
    return '<div class="sieCpcLegendaTit">Naturezas / atividades <small>('+total+')</small></div>'+
      '<div class="sieCpcLegendaLinhas">'+(html||'<small>Nenhum registro com coordenadas</small>')+'</div>'+
      '<small>'+(modo==='agrupado'?'Clique nos grupos para detalhar · ':'Clique no ponto para detalhar · ')+
      'brasão no popup</small>';
  }
  global.MapaUnidadeProfissional=Object.freeze({
    categorias,classificarOcorrencia,classificarAbordagem,icone,criarMarcador,agregador,legenda,temaAtivo
  });
})(window);
