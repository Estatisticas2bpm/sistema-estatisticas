/* SIE-CPC — seletor compacto de naturezas para o mapa da página inicial.
 * O select original continua sendo a fonte do valor aplicado às RPCs.
 */
(function(global){
  'use strict';
  function instalar(select){
    if(!select)return;
    if(select.dataset.sieFiltroTipos==='1'){
      select.dispatchEvent(new Event('sie-tipos-atualizados'));
      return;
    }
    const botao=document.createElement('button');
    botao.type='button';
    botao.className='sieTipoBotao';
    botao.setAttribute('aria-label','Selecionar tipo de ocorrência');
    botao.setAttribute('aria-haspopup','dialog');
    botao.setAttribute('aria-expanded','false');
    select.insertAdjacentElement('afterend',botao);
    const painel=document.createElement('div');
    painel.id='sieTipoMapaPainel';
    painel.className='sieTipoPainel';
    painel.setAttribute('role','dialog');
    painel.setAttribute('aria-label','Filtrar tipo de ocorrência');
    painel.hidden=true;
    const titulo=document.createElement('label');
    titulo.textContent='Pesquisar tipo de ocorrência';
    titulo.setAttribute('for','sieTipoMapaBusca');
    const busca=document.createElement('input');
    busca.type='search';
    busca.id='sieTipoMapaBusca';
    busca.placeholder='Digite o nome ou parte dele';
    busca.autocomplete='off';
    const lista=document.createElement('div');
    lista.className='sieTipoLista';
    lista.setAttribute('role','group');
    lista.setAttribute('aria-label','Tipos disponíveis');
    const mensagem=document.createElement('small');
    mensagem.className='sieTipoMensagem';
    painel.append(titulo,busca,lista,mensagem);
    document.body.appendChild(painel);
    const css=document.createElement('style');
    css.textContent=[
      '.mapFilters .sieTipoBotao{display:inline-flex;align-items:center;justify-content:space-between;gap:10px;min-height:38px;min-width:190px;max-width:min(260px,100%);padding:9px 12px;border:1px solid #d5e0ea;border-radius:10px;background:#fff;color:#16263a;font:600 12px Inter,Segoe UI,Arial,sans-serif;text-align:left;cursor:pointer}',
      '.sieTipoBotao span{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;min-width:0}',
      '.sieTipoBotao::after{content:"▾";flex:none;color:#426682}',
      '.sieTipoBotao:focus-visible,.sieTipoOpcao:focus-visible{outline:2px solid #1878b3;outline-offset:2px}',
      '.sieTipoPainel{position:fixed;z-index:30000;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;padding:12px;background:#fff;border:1px solid #a7bed0;border-radius:12px;box-shadow:0 14px 35px #09223e42;color:#142c42;overflow:hidden}',
      '.sieTipoPainel[hidden]{display:none!important}',
      '.sieTipoPainel label{font:800 12px Inter,Segoe UI,Arial,sans-serif}',
      '.sieTipoPainel input{box-sizing:border-box;width:100%;min-height:40px;border:1px solid #c4d4df;border-radius:8px;padding:9px 11px;font:13px Inter,Segoe UI,Arial,sans-serif;color:#142c42;background:#fff}',
      '.sieTipoLista{min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;border:1px solid #e2e9ef;border-radius:8px}',
      '.sieTipoOpcao{box-sizing:border-box;display:block;width:100%;padding:10px 12px;border:0;border-bottom:1px solid #edf1f5;background:#fff;text-align:left;color:#1b3b55;font:600 12px/1.55 Inter,Segoe UI,Arial,sans-serif;white-space:normal;overflow-wrap:anywhere;cursor:pointer}',
      '.sieTipoOpcao:hover,.sieTipoOpcao[aria-current="true"]{background:#eaf4fb;color:#064f7d}',
      '.sieTipoMensagem{color:#637b8f;font:11px Inter,Segoe UI,Arial,sans-serif}',
      '@media(max-width:600px){.mapFilters .sieTipoBotao{min-width:0;width:100%;max-width:100%}.sieTipoPainel{border-radius:10px}}'
    ].join('\n');
    document.head.appendChild(css);
    select.hidden=true;
    select.dataset.sieFiltroTipos='1';
    let aberto=false,visiveis=[];
    const normalizar=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    const sincronizar=()=>{
      const rotulo=select.selectedOptions?.[0]?.textContent||'Todos os tipos de ocorrência';
      const span=document.createElement('span');
      span.textContent=rotulo;
      botao.replaceChildren(span);
      botao.title=rotulo;
      if(aberto)renderizar();
    };
    function renderizar(){
      const termo=normalizar(busca.value);
      const opcoes=Array.from(select.options);
      visiveis=opcoes.filter(o=>normalizar(o.textContent).includes(termo));
      const fragmento=document.createDocumentFragment();
      visiveis.slice(0,180).forEach(opcao=>{
        const item=document.createElement('button');
        item.type='button';
        item.className='sieTipoOpcao';
        item.textContent=opcao.textContent;
        item.dataset.valor=opcao.value;
        item.setAttribute('aria-current',String(opcao.value===select.value));
        fragmento.appendChild(item);
      });
      lista.replaceChildren(fragmento);
      mensagem.textContent=visiveis.length===0?'Nenhuma ocorrência encontrada.':
        visiveis.length>180?'Exibindo 180 de '+visiveis.length+'. Digite para refinar a busca.':
        visiveis.length+' opção(ões) disponível(is).';
    }
    function posicionar(){
      if(!aberto)return;
      const r=botao.getBoundingClientRect(),largura=Math.min(430,window.innerWidth-24);
      const esquerda=Math.max(12,Math.min(r.left,window.innerWidth-largura-12));
      const abaixo=window.innerHeight-r.bottom-12,acima=r.top-12;
      const usarAcima=abaixo<260&&acima>abaixo;
      const disponivel=usarAcima?acima:abaixo;
      const altura=Math.max(120,Math.min(340,disponivel-6));
      painel.style.width=largura+'px';
      painel.style.maxHeight=altura+'px';
      painel.style.left=esquerda+'px';
      painel.style.top=(usarAcima?Math.max(8,r.top-altura-6):Math.min(window.innerHeight-altura-8,r.bottom+6))+'px';
    }
    function fechar(retornarFoco=false){
      if(!aberto)return;
      aberto=false;
      painel.hidden=true;
      botao.setAttribute('aria-expanded','false');
      if(retornarFoco)botao.focus();
    }
    function abrir(){
      aberto=true;
      painel.hidden=false;
      botao.setAttribute('aria-expanded','true');
      busca.value='';
      sincronizar();
      posicionar();
      busca.focus();
    }
    botao.addEventListener('click',()=>aberto?fechar():abrir());
    busca.addEventListener('input',renderizar);
    lista.addEventListener('click',e=>{
      const item=e.target.closest('.sieTipoOpcao');
      if(!item)return;
      select.value=item.dataset.valor;
      fechar(true);
      sincronizar();
      select.dispatchEvent(new Event('change',{bubbles:true}));
    });
    busca.addEventListener('keydown',e=>{
      if(e.key==='Enter'&&visiveis.length){
        e.preventDefault();
        select.value=visiveis[0].value;
        fechar(true);
        sincronizar();
        select.dispatchEvent(new Event('change',{bubbles:true}));
      }
    });
    painel.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.stopPropagation();fechar(true);}
    });
    document.addEventListener('pointerdown',e=>{
      if(aberto&&!painel.contains(e.target)&&!botao.contains(e.target))fechar();
    });
    global.addEventListener('resize',posicionar);
    global.addEventListener('scroll',e=>{
      if(aberto&&!painel.contains(e.target))posicionar();
    },true);
    select.addEventListener('change',sincronizar);
    select.addEventListener('sie-tipos-atualizados',sincronizar);
    sincronizar();
  }
  global.SieFiltroTiposMapa=Object.freeze({instalar});
})(window);
