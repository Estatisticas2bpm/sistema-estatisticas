(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const rotulos={GUARDA_FIXA:'Guarda fixa',RONDA:'Ronda',REFORCO:'Reforço de guarda',APOIO_OPERACIONAL:'Apoio operacional',OUTRA:'Outra atividade'};
  const somar=(a,k)=>(a||[]).reduce((s,x)=>s+(Number(x[k])||0),0);
  const distintas=a=>new Set((a||[]).map(x=>String(x.instituicao||'').trim().toLocaleUpperCase('pt-BR')).filter(Boolean)).size;
  const numero=v=>Number(v||0).toLocaleString('pt-BR');
  const totalEfetivo=rows=>somar(rows,'efetivo_ordinario')+somar(rows,'efetivo_svi');
  const hospital=events=>(events||[]).filter(x=>x.tipo_evento==='ENTRADA DE PM NO HOSPITAL').length;
  const semAlteracao=(services,events)=>{
    const ids=new Set((events||[]).map(x=>x.servico_id));
    return (services||[]).filter(s=>s.situacao==='SEM ALTERACAO'&&!ids.has(s.id)).length;
  };
  async function lerEventos(db,servicos){
    const ids=[...new Set((servicos||[]).map(x=>x.id).filter(Boolean))],todos=[],passo=1000,maxPaginas=200;
    for(let i=0;i<ids.length;i+=150){
      const grupo=ids.slice(i,i+150);
      for(let pagina=0;pagina<maxPaginas;pagina++){
        const r=await db.from('cipg_eventos_guarda')
          .select('id,servico_id,tipo_evento')
          .in('servico_id',grupo)
          .order('id',{ascending:true})
          .range(pagina*passo,(pagina+1)*passo-1);
        if(r.error)throw Error('Falha ao consultar os eventos do livro de serviço: '+r.error.message);
        const lote=r.data||[];
        todos.push(...lote);
        if(lote.length<passo)break;
        if(pagina===maxPaginas-1)throw Error('Muitos eventos no período; selecione um intervalo menor.');
      }
    }
    return todos;
  }
  function preparar(){
    document.body.classList.add('modo-cipg');
    const linkDashboard=document.querySelector('a[href^="dashboard.html"]');
    if(linkDashboard)linkDashboard.href='dashboard.html?v=20261009-cipg-banner1';
    $('heroTitulo').textContent='Panorama Estatístico da CIPG';
    $('heroEyebrow').innerHTML='<i class="pulse"></i> Estatística de Guarda · CIPG';
    const cards=[['total','Relatórios de serviço','shield-check'],
      ['conducoes','Entradas de PM no hospital','heart-pulse'],
      ['tcosProduzidos','Serviços sem alteração','clipboard-check'],
      ['veiculosRecuperadosKpi','Efetivo empregado','users']];
    cards.forEach(([id,nome])=>{
      const card=$(id)?.closest('.kpi');
      if(card)card.querySelector('label').textContent=nome;
    });
    $('totalSub').textContent='inclusive relatórios sem alteração (S/A)';
    $('conducoesSub').textContent='entradas registradas no livro de serviço';
    $('tcosSub').textContent='relatórios identificados como S/A';
    $('veiculosSub').textContent='ordinário + SVI (postos/serviços, não PMs únicos)';
    $('topOcorrenciasDescricao').textContent='Acontecimentos registrados pela CIPG';
    $('topOcorrenciasTitulo').textContent='Top 5 eventos do livro de serviço';
    $('topBairrosTitulo').textContent='Postos com mais relatórios';
    $('topBairrosDescricao').textContent='Serviços registrados por posto no mês';
  }
  async function consultar(db,inicio,fim){
    const rows=[],limite=1000;
    for(let pagina=0;;pagina++){
      const r=await db.from('cipg_servicos_guarda')
       .select('id,data_servico,instituicao,posto_codigo,tipo_local,modalidade,situacao,efetivo_ordinario,efetivo_svi,rondas_realizadas,intercorrencias')
       .gte('data_servico',inicio).lte('data_servico',fim).order('id',{ascending:true})
       .range(pagina*limite,(pagina+1)*limite-1);
      if(r.error)throw Error('Falha ao consultar serviços da CIPG: '+r.error.message);
      rows.push(...(r.data||[]));
      if((r.data||[]).length<limite)break;
      if(pagina>=200)throw Error('Intervalo muito amplo. Selecione um período menor.');
    }
    const eventos=await lerEventos(db,rows);
    return {servicos:rows,eventos};
  }
  // Contrato estatístico reutilizável no CPC, sem confundir eventos e serviços com BOs.
  function indicadores(registros){
    const r=registros||{},a=r.servicos||[],eventos=r.eventos||[];
    return {
      relatoriosServico:a.length,
      entradasPmHospital:hospital(eventos),
      servicosSemAlteracao:semAlteracao(a,eventos),
      empregosEfetivo:totalEfetivo(a),
      instituicoesAtendidas:distintas(a)
    };
  }
  function renderizar(atual,anterior,hoje,pc){
    const k=indicadores(atual),kAnt=indicadores(anterior);
    $('total').textContent=numero(k.relatoriosServico);
    $('conducoes').textContent=numero(k.entradasPmHospital);
    $('tcosProduzidos').textContent=numero(k.servicosSemAlteracao);
    $('veiculosRecuperadosKpi').textContent=numero(k.empregosEfetivo);
    $('periodoComparativo').textContent='1º a '+hoje.getDate()+' de '+nomeMes(hoje).toLowerCase()+' de '+hoje.getFullYear()+' × 1º a '+pc[1].getDate()+' de '+nomeMes(pc[1]).toLowerCase()+' de '+pc[1].getFullYear();
    if(typeof itemComparativo==='function'){
      $('comparativoMes').innerHTML=
        itemComparativo('Relatórios de serviço',k.relatoriosServico,kAnt.relatoriosServico,'prod')+
        itemComparativo('Entradas hospitalares',k.entradasPmHospital,kAnt.entradasPmHospital,'prod')+
        itemComparativo('Sem alteração (S/A)',k.servicosSemAlteracao,kAnt.servicosSemAlteracao,'prod')+
        itemComparativo('Efetivo empregado',k.empregosEfetivo,kAnt.empregosEfetivo,'prod');
    }
    $('resumoInteligente').textContent='No mês: '+numero(k.relatoriosServico)+' relatório(s) de serviço, '+
      numero(k.entradasPmHospital)+' entrada(s) hospitalar(es) de PM registrada(s), '+
      numero(k.servicosSemAlteracao)+' serviço(s) sem alteração, '+
      numero(k.empregosEfetivo)+' empregos de efetivo (ordinário + SVI) e '+
      numero(k.instituicoesAtendidas)+' instituição(ões) atendida(s). '+
      'Eventos do livro de serviço não são somados às ocorrências policiais do CPC.';
  }
  function falha(err){
    console.error('Falha na visão CIPG',err);
    for(const id of ['total','conducoes','tcosProduzidos','veiculosRecuperadosKpi'])$(id).textContent='—';
    $('resumoInteligente').textContent='Falha ao consultar os serviços de guarda: '+(err?.message||err);
  }
  window.CipgHome={preparar,consultar,indicadores,renderizar,falha,rotulos};
})();
