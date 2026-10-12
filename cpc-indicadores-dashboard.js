/* Indicadores específicos da Central Executiva do CPC.
 * Somente leitura; respeita RLS e não mistura serviços com BOs.
 * Os filtros de natureza/território das ocorrências não alteram estatísticas
 * especializadas que não possuem essas dimensões.
 */
(function(global){
  'use strict';
  let versao=0;
  const $=id=>document.getElementById(id);
  const numero=val=>Number(val||0).toLocaleString('pt-BR');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nome=v=>String(v||'').replace(/^(\d+)BPM$/i,(_,n)=>n+'º BPM');
  function idsDescendentes(id,unidades){
    const encontrados=new Set(),fila=[String(id)];
    while(fila.length){
      const x=fila.shift();
      if(encontrados.has(x))continue;
      encontrados.add(x);
      unidades.filter(u=>String(u.parent_id||'')===x).forEach(u=>fila.push(String(u.id)));
    }
    return encontrados;
  }
  async function listar(db,tabela,campos,campoData,inicio,fim){
    const tudo=[],passo=1000;
    for(let pagina=0;pagina<200;pagina++){
      const r=await db.from(tabela).select(campos)
        .gte(campoData,inicio).lte(campoData,fim)
        .order('id',{ascending:true}).range(pagina*passo,(pagina+1)*passo-1);
      if(r.error)throw r.error;
      const lote=r.data||[];tudo.push(...lote);
      if(lote.length<passo)return tudo;
    }
    throw Error('Muitos registros para o intervalo; selecione um período menor.');
  }
  async function consultar(db,tipo,ini,fim){
    if(tipo==='CIPA')return global.CipaHome.consultar(db,ini,fim);
    if(tipo==='CIPG')return global.CipgHome.consultar(db,ini,fim);
    const specs={
      GIRO:['giro_abordagens','id,unidade_id,quantidade_pessoas','registrado_em'],
      CAVALARIA:['cavalaria_servicos_produtividade','id,unidade_id,tipo_policiamento,contexto_atividade,abordagens_pessoas','data_servico'],
      CIPTUR:['ciptur_autos_infracao','id,unidade_id,houve_remocao,tipo_veiculo_removido','data_infracao']
    };
    const s=specs[tipo];
    if(!s)throw Error('Fonte desconhecida');
    const a=tipo==='GIRO'?ini+'T00:00:00-04:00':ini;
    const b=tipo==='GIRO'?fim+'T23:59:59.999-04:00':fim;
    return listar(db,s[0],s[1],s[2],a,b);
  }
  function renderizarPainel(unidades,home,extras,unidadeSelecionada){
    const destino=$('cpcIndicadoresEspecificos');
    if(!destino)return;
    const cpc=unidades.find(u=>String(u.sigla).toUpperCase()==='CPC');
    const selecionada=unidades.find(u=>String(u.id)===String(unidadeSelecionada));
    const visiveis=selecionada?[selecionada]:unidades.filter(u=>String(u.parent_id)===String(cpc?.id));
    const occ=home?.ocorrencias||[],tcos=home?.tcos||[];
    if(!visiveis.length){destino.innerHTML='<p class="empty">Nenhuma unidade disponível para este filtro.</p>';return}
    destino.innerHTML=visiveis.map(u=>{
      const ids=idsDescendentes(u.id,unidades),filtrar=rows=>(rows||[]).filter(x=>ids.has(String(x.unidade_id)));
      const sigla=String(u.sigla||'').toUpperCase();
      let extra=extras[sigla]||{status:'carregando'};
      if(extra.status==='ok'&&Array.isArray(extra.data)){
        extra={status:'ok',data:filtrar(extra.data)};
      }
      const cards=global.EstatisticaIndicadores.cards(sigla,filtrar(occ),filtrar(tcos),extra);
      const err=extra.status==='erro'&&['CIPA','CIPG','GIRO','CAVALARIA','CIPTUR'].includes(sigla);
      return '<article class="cpcSpecialCard"><h3>'+esc(nome(sigla))+'</h3><p>'+esc(u.nome||'')+'</p><div class="cpcSpecialValues">'+
        cards.map(k=>'<div title="'+esc(k.fonte||'')+'"><strong>'+esc(global.EstatisticaIndicadores.formatar(k))+'</strong><span>'+esc(k.rotulo)+'</span></div>').join('')+
        '</div>'+(err?'<small class="cpcSpecialWarning">Dados especializados indisponíveis. Consulte a unidade/permissões.</small>':'')+'</article>';
    }).join('');
  }
  async function carregar(db,args,unidades){
    const estaVersao=++versao;
    const destino=$('cpcIndicadoresEspecificos');
    if(!destino)return;
    destino.innerHTML='<p class="empty">Consultando indicadores por unidade...</p>';
    const especializadas=['CIPA','CIPG','GIRO','CAVALARIA','CIPTUR'];
    const homePromise=db.rpc('obter_home_cpc_territorial',{data_inicio:args.data_inicio,data_fim:args.data_fim});
    const pedidos=especializadas.map(async tipo=>{
      try{return {tipo,status:'ok',data:await consultar(db,tipo,args.data_inicio,args.data_fim)}}
      catch(e){console.error('Indicador executivo CPC '+tipo,e);return {tipo,status:'erro'}}
    });
    const [home, ...resultados]=await Promise.all([homePromise,...pedidos]);
    if(estaVersao!==versao)return;
    if(home.error||!home.data?.autorizado){
      destino.innerHTML='<p class="empty">Não foi possível consultar o escopo estatístico do CPC.</p>';
      return;
    }
    const extras={};
    resultados.forEach(x=>{extras[x.tipo]=x});
    renderizarPainel(unidades,home.data,extras,args.p_unidade_id);
    const texto=$('cpcIndicadoresNota');
    if(texto)texto.textContent='Período: '+args.data_inicio+' a '+args.data_fim+'. Valores de serviços, abordagens e fiscalizações utilizam suas próprias datas e fontes, sem serem somados às ocorrências. Filtros de natureza, turno, companhia e área das ocorrências não se aplicam automaticamente aos registros especializados.';
  }
  global.CpcIndicadoresDashboard=Object.freeze({carregar});
})(window);
