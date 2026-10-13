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
  // O registro completo fica disponível em um painel separado, não dentro do cartão.
  function renderizarTrilha(sigla,linhas,inicio,fim,parcial){
    global.CpcDetalhamentoOrigem.registrar(sigla,linhas,parcial,inicio,fim);
    return '<button type="button" class="cpcOrigemAbrir" data-abrir-origem="'+esc(sigla)+'"'+
      ' aria-label="Conferir '+linhas.length+' registros de origem de '+esc(nome(sigla))+'">'+
      'Conferir registros de origem <span class="cpcOrigemContagem">'+linhas.length+'</span>'+
      ' <span aria-hidden="true">↗</span></button>';
  }
  function renderizarPainel(unidades,home,extras,unidadeSelecionada,inicio,fim){
    const destino=$('cpcIndicadoresEspecificos');
    if(!destino)return;
    const cpc=unidades.find(u=>String(u.sigla).toUpperCase()==='CPC');
    const selecionada=unidades.find(u=>String(u.id)===String(unidadeSelecionada));
    const visiveis=selecionada?[selecionada]:unidades.filter(u=>String(u.parent_id)===String(cpc?.id));
    const occ=home?.ocorrencias||[],tcos=home?.tcos||[];
    global.CpcDetalhamentoOrigem.reiniciar();
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
        cards.map(k=>'<button type="button" class="cpcIndicadorAbrir" data-abrir-indicador="'+esc(k.rotulo)+'" data-unidade-indicador="'+esc(sigla)+'" title="'+esc((k.fonte||'')+' · Abrir registros relacionados, somente leitura')+'" aria-label="Conferir registros relacionados a '+esc(k.rotulo)+' de '+esc(nome(sigla))+'"'+(k.valor==null?' disabled':'')+'><strong>'+esc(global.EstatisticaIndicadores.formatar(k))+'</strong><span>'+esc(k.rotulo)+'</span></button>').join('')+
        '</div>'+desenharSerie(serieEspecializada(sigla,extra,inicio,fim))+
        (err?'<small class="cpcSpecialWarning">Dados especializados indisponíveis. Consulte a unidade/permissões.</small>':'')+
        renderizarTrilha(sigla,linhas,inicio,fim,err)+'</article>';
    }).join('');
    destino.querySelectorAll('[data-abrir-indicador]').forEach(botao=>{
      botao.addEventListener('click',()=>global.CpcDetalhamentoOrigem.abrir(botao.dataset.unidadeIndicador,botao.dataset.abrirIndicador));
    });
    destino.querySelectorAll('[data-abrir-origem]').forEach(botao=>{
      botao.addEventListener('click',()=>global.CpcDetalhamentoOrigem.abrir(botao.dataset.abrirOrigem));
    });
  }
  function falhaEscopo(destino,nota,args,erro){
    const mensagem=String(erro?.message||erro||'');
    const codigo=String(erro?.code||'').slice(0,24);
    const timeout=/timeout|time.?out|57014/i.test(mensagem+' '+codigo);
    const naoAutorizado=/acesso restrito|sem autoriza|não autorizado/i.test(mensagem);
    const descricao=timeout
      ?'A consulta do escopo estatístico do CPC excedeu o tempo limite.'
      :naoAutorizado
        ?'O perfil atual não possui autorização para consultar os indicadores por unidade.'
        :'Não foi possível consultar o escopo estatístico do CPC.';
    destino.innerHTML='<p class="empty" role="alert">'+esc(descricao)+
      (codigo?' (código '+esc(codigo)+')':'')+
      ' Os indicadores por unidade não foram carregados para o período solicitado.</p>';
    if(nota)nota.textContent='Período solicitado: '+args.data_inicio+' a '+args.data_fim+
      '. Consulta especializada não concluída. Nenhum resultado de outro período foi reutilizado.';
    console.error('Falha no escopo estatístico CPC:',erro);
  }
  async function carregar(db,args,unidades){
    const estaVersao=++versao;
    const destino=$('cpcIndicadoresEspecificos');
    if(!destino)return;
    const nota=$('cpcIndicadoresNota');
    if(nota)nota.textContent='Período solicitado: '+args.data_inicio+' a '+args.data_fim+
      '. Consultando indicadores específicos por unidade...';
    global.CpcDetalhamentoOrigem.reiniciar();
    destino.innerHTML='<p class="empty">Consultando indicadores por unidade...</p>';
    const especializadas=['CIPA','CIPG','GIRO','CAVALARIA','CIPTUR'];
    const homePromise=db.rpc('obter_home_cpc_territorial',{data_inicio:args.data_inicio,data_fim:args.data_fim});
    const pedidos=especializadas.map(async tipo=>{
      try{return {tipo,status:'ok',data:await consultar(db,tipo,args.data_inicio,args.data_fim)}}
      catch(e){console.error('Indicador executivo CPC '+tipo,e);return {tipo,status:'erro'}}
    });
    let home,resultados;
    try{
      [home, ...resultados]=await Promise.all([homePromise,...pedidos]);
    }catch(e){
      if(estaVersao===versao)falhaEscopo(destino,nota,args,e);
      return;
    }
    if(estaVersao!==versao)return;
    if(home?.error||!home?.data?.autorizado){
      falhaEscopo(destino,nota,args,home?.error||home?.data?.erro||'Resposta sem autorização.');
      return;
    }
    const extras={};
    resultados.forEach(x=>{extras[x.tipo]=x});
    renderizarPainel(unidades,home.data,extras,args.p_unidade_id,args.data_inicio,args.data_fim);
    if(nota)nota.textContent='Período: '+args.data_inicio+' a '+args.data_fim+'. Valores de serviços, abordagens e fiscalizações utilizam suas próprias datas e fontes, sem serem somados às ocorrências. Filtros de natureza, turno, companhia e área das ocorrências não se aplicam automaticamente aos registros especializados.';
  }
  global.CpcIndicadoresDashboard=Object.freeze({carregar,serieEspecializada,renderizarPainel});
})(window);
