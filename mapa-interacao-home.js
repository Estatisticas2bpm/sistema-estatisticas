/* SIE-CPC — comportamento de interação exclusivo do mapa da página inicial.
 * Navegar pela página não deve disparar zoom: o operador ativa o mapa com um clique.
 */
(function(global){
  'use strict';
  function instalar(mapa,opcoes){
    if(!mapa||typeof mapa.getContainer!=='function')throw new Error('Mapa Leaflet indisponível.');
    const container=mapa.getContainer();
    const dica=opcoes?.dica||null;
    let ativo=false;
    function atualizar(){
      container.classList.toggle('sieMapaAtivo',ativo);
      if(dica)dica.textContent=ativo
        ? 'Mapa ativo · use a roda do mouse para zoom e arraste para navegar · Esc ou clique fora para sair'
        : 'Clique no mapa para ativar o zoom e o arraste · rolagem da página liberada';
    }
    function ativar(){
      if(ativo)return;
      ativo=true;
      mapa.dragging.enable();
      mapa.scrollWheelZoom.enable();
      atualizar();
    }
    function desativar(){
      if(!ativo)return;
      ativo=false;
      mapa.scrollWheelZoom.disable();
      mapa.dragging.disable();
      atualizar();
    }
    mapa.dragging.disable();
    mapa.scrollWheelZoom.disable();
    container.addEventListener('click',ativar);
    global.document.addEventListener('pointerdown',evento=>{
      if(ativo&&!container.contains(evento.target))desativar();
    });
    global.document.addEventListener('keydown',evento=>{
      if(evento.key==='Escape')desativar();
    });
    atualizar();
    return Object.freeze({ativar,desativar,estaAtivo:()=>ativo});
  }
  global.MapaInteracaoHome=Object.freeze({instalar});
})(window);
