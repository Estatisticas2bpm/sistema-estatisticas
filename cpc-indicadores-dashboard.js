/* Indicadores específicos da Central Executiva do CPC.
 * Somente leitura; respeita RLS e não mistura serviços com BOs.
 * Os filtros de natureza/território das ocorrências não alteram estatísticas
 * especializadas que não possuem essas dimensões.
 */
(function(global){
  'use strict';
  let versao=0;
  const evidenciasAtuais=new Map();
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
      GIRO:['giro_abordagens','id,unidade_id,registrado_em,quantidade_pessoas,tipo_abordagem,bairro','registrado_em'],
      CAVALARIA:['cavalaria_servicos_produtividade','id,unidade_id,data_servico,tipo_policiamento,contexto_atividade,abordagens_pessoas,numero_documento,localidade,bairro','data_servico'],
      CIPTUR:['ciptur_autos_infracao','id,unidade_id,data_infracao,houve_remocao,tipo_veiculo_removido,codigo_infracao','data_infracao']
    };
    const s=specs[tipo];
    if(!s)throw Error('Fonte desconhecida');
    const a=tipo==='GIRO'?ini+'T00:00:00-04:00':ini;
    const b=tipo==='GIRO'?fim+'T23:59:59.999-04:00':fim;
    return listar(db,s[0],s[1],s[2],a,b);
  }
  // Série temporal independente por tipo de produtividade; não soma medidas distintas.
  function serieEspecializada(tipo,fonte,inicio,fim){
    if(!fonte||fonte.status!=='ok')return null;
    const spec={
      CIPA:{rows:fonte.data?.fauna||[],data:'data_registro',rotulo:'Animais registrados',quantidade:'quantidade'},
      CIPG:{rows:fonte.data?.servicos||[],data:'data_servico',rotulo:'Serviços prestados'},
      GIRO:{rows:fonte.data||[],data:'registrado_em',rotulo:'Abordagens'},
      CAVALARIA:{rows:fonte.data||[],data:'data_servico',rotulo:'Serviços realizados'},
      CIPTUR:{rows:fonte.data||[],data:'data_infracao',rotulo:'Autos de infração'}
    }[tipo];
    if(!spec)return null;
    const inicioData=new Date(inicio+'T12:00:00Z'),fimData=new Date(fim+'T12:00:00Z');
    if(Number.isNaN(inicioData.getTime())||Number.isNaN(fimData.getTime())||fimData<inicioData)return null;
    const dias=Math.round((fimData-inicioData)/86400000)+1,porMes=dias>45;
    const counts=new Map();
    const chaveData=valor=>{
      if(!valor)return null;
      if(tipo==='GIRO'){
        const d=new Date(valor);
        if(Number.isNaN(d.getTime()))return null;
        return new Date(d.getTime()-4*3600000).toISOString().slice(0,10);
      }
      return String(valor).slice(0,10);
    };
    (spec.rows||[]).forEach(item=>{
      const dia=chaveData(item[spec.data]);
      if(!dia||dia<inicio||dia>fim)return;
      const chave=porMes?dia.slice(0,7):dia;
      counts.set(chave,(counts.get(chave)||0)+(spec.quantidade?(Number(item[spec.quantidade])||0):1));
    });
    const series=[];
    if(!porMes){
      for(let d=new Date(inicioData);d<=fimData;d.setUTCDate(d.getUTCDate()+1)){
        const dia=d.toISOString().slice(0,10);
        series.push({data:dia,valor:counts.get(dia)||0});
      }
    }else{
      const primeiro=new Date(Date.UTC(inicioData.getUTCFullYear(),inicioData.getUTCMonth(),1));
      for(let d=primeiro;d<=fimData;d.setUTCMonth(d.getUTCMonth()+1)){
        const mes=d.toISOString().slice(0,7);
        series.push({data:mes,valor:counts.get(mes)||0});
      }
    }
    return {rotulo:spec.rotulo,agrupamento:porMes?'mês':'dia',series};
  }
  function desenharSerie(serie){
    if(!serie)return '';
    const max=Math.max(1,...serie.series.map(p=>p.valor));
    const total=serie.series.reduce((a,p)=>a+p.valor,0);
    return '<div class="cpcMiniSerie"><strong>'+esc(serie.rotulo)+' — evolução por '+serie.agrupamento+'</strong>'+
      '<div class="cpcMiniBars" role="img" aria-label="'+esc(serie.rotulo+': '+total+' no período')+'">'+
      serie.series.map((p,i)=>'<span style="height:'+Math.max(4,Math.round(p.valor/max*100))+'%" title="'+esc(p.data+' · '+numero(p.valor))+'"></span>').join('')+
      '</div><small>'+numero(total)+' no período · barras demonstram distribuição, não comparação entre unidades</small></div>';
  }
  function exportarEvidencias(sigla,periodo){
    const linhas=evidenciasAtuais.get(sigla)||[];
    if(!linhas.length)return;
    const csv=global.CpcRastreabilidade.csv(linhas);
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');
    link.href=url;
    link.download='sie-cpc-origem-'+String(sigla||'unidade').toLowerCase()+'-'+periodo.replaceAll('-','')+'.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function renderizarTrilha(sigla,linhas,periodo,parcial){
    evidenciasAtuais.set(sigla,linhas);
    const previa=linhas.slice(0,30);
    const detalhe=previa.length?'<div class="cpcOrigemScroll"><table class="cpcOrigemTabela"><thead><tr>'+
      '<th>Data</th><th>Fonte</th><th>Documento / ID</th><th>Registro</th><th>Medida</th></tr></thead><tbody>'+
      previa.map(x=>'<tr><td>'+esc(x.data)+'</td><td>'+esc(x.fonte)+'</td>'+
        '<td title="'+esc(x.referencia)+'">'+esc(x.referencia)+'</td><td>'+esc(x.descricao)+'</td>'+
        '<td>'+esc(x.quantidade)+' '+esc(x.unidade)+'</td></tr>').join('')+
      '</tbody></table></div>':'<p class="cpcOrigemNota">Nenhum registro de origem disponível para este recorte.</p>';
    return '<details class="cpcOrigem"><summary>Conferir registros de origem ('+linhas.length+')</summary>'+
      (parcial?'<p class="cpcSpecialWarning">Uma consulta especializada falhou. A trilha está incompleta; não interprete registros ausentes como zero.</p>':'')+
      '<p class="cpcOrigemNota">Fonte, referência documental e data usada. O período e a unidade são aplicados; filtros criminais e territoriais do quadro principal não se aplicam a este detalhamento.</p>'+
      detalhe+
      (linhas.length>30?'<p class="cpcOrigemNota">Exibindo 30 de '+linhas.length+'. Use a exportação para conferir todos.</p>':'')+
      (linhas.length?'<button class="cpcOrigemExportar" type="button" data-export-origem="'+esc(sigla)+'">Exportar origem (CSV)</button>':'')+
      '</details>';
  }
  function renderizarPainel(unidades,home,extras,unidadeSelecionada,inicio,fim){
    const destino=$('cpcIndicadoresEspecificos');
    if(!destino)return;
    const cpc=unidades.find(u=>String(u.sigla).toUpperCase()==='CPC');
    const selecionada=unidades.find(u=>String(u.id)===String(unidadeSelecionada));
    const visiveis=selecionada?[selecionada]:unidades.filter(u=>String(u.parent_id)===String(cpc?.id));
    const occ=home?.ocorrencias||[],tcos=home?.tcos||[];
    evidenciasAtuais.clear();
    if(!visiveis.length){destino.innerHTML='<p class="empty">Nenhuma unidade disponível para este filtro.</p>';return}
    destino.innerHTML=visiveis.map(u=>{
      const ids=idsDescendentes(u.id,unidades),filtrar=rows=>(rows||[]).filter(x=>ids.has(String(x.unidade_id)));
      const sigla=String(u.sigla||'').toUpperCase();
      let extra=extras[sigla]||{status:'carregando'};
      if(extra.status==='ok'&&Array.isArray(extra.data)){
        extra={status:'ok',data:filtrar(extra.data)};
      }else if(extra.status==='ok'&&sigla==='CIPG'&&extra.data?.servicos){
        const servicos=filtrar(extra.data.servicos);
        const servicosIds=new Set(servicos.map(x=>String(x.id)));
        extra={status:'ok',data:{servicos,eventos:(extra.data.eventos||[]).filter(x=>servicosIds.has(String(x.servico_id)))}};
      }
      const linhasOcorrencias=filtrar(occ),linhasTcos=filtrar(tcos);
      const cards=global.EstatisticaIndicadores.cards(sigla,linhasOcorrencias,linhasTcos,extra);
      const err=extra.status==='erro'&&['CIPA','CIPG','GIRO','CAVALARIA','CIPTUR'].includes(sigla);
      const linhas=global.CpcRastreabilidade.registros(sigla,linhasOcorrencias,linhasTcos,extra.status==='ok'?extra.data:null);
      return '<article class="cpcSpecialCard"><h3>'+esc(nome(sigla))+'</h3><p>'+esc(u.nome||'')+'</p><div class="cpcSpecialValues">'+
        cards.map(k=>'<div title="'+esc(k.fonte||'')+'"><strong>'+esc(global.EstatisticaIndicadores.formatar(k))+'</strong><span>'+esc(k.rotulo)+'</span></div>').join('')+
        '</div>'+desenharSerie(serieEspecializada(sigla,extra,inicio,fim))+
        (err?'<small class="cpcSpecialWarning">Dados especializados indisponíveis. Consulte a unidade/permissões.</small>':'')+
        renderizarTrilha(sigla,linhas,inicio,err)+'</article>';
    }).join('');
    destino.querySelectorAll('[data-export-origem]').forEach(botao=>{
      botao.addEventListener('click',e=>{
        e.preventDefault();
        exportarEvidencias(botao.dataset.exportOrigem,inicio);
      });
    });
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
    renderizarPainel(unidades,home.data,extras,args.p_unidade_id,args.data_inicio,args.data_fim);
    const texto=$('cpcIndicadoresNota');
    if(texto)texto.textContent='Período: '+args.data_inicio+' a '+args.data_fim+'. Valores de serviços, abordagens e fiscalizações utilizam suas próprias datas e fontes, sem serem somados às ocorrências. Filtros de natureza, turno, companhia e área das ocorrências não se aplicam automaticamente aos registros especializados.';
  }
  global.CpcIndicadoresDashboard=Object.freeze({carregar,serieEspecializada,renderizarPainel});
})(window);
