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
    const ids=servicos.map(x=>x.id),todos=[];
    for(let i=0;i<ids.length;i+=150){
      const r=await db.from('cipg_eventos_guarda')
        .select('id,servico_id,tipo_evento')
        .in('servico_id',ids.slice(i,i+150));
      if(r.error)throw Error('Falha ao consultar os eventos do livro de serviço: '+r.error.message);
      todos.push(...(r.data||[]));
    }
    return todos;
  }
  function preparar(){
    document.body.classList.add('modo-cipg');
    $('heroTitulo').textContent='Visão rápida — CIPG';
    $('heroEyebrow').innerHTML='<i class="pulse"></i> Policiamento de Guarda · CIPG';
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
  function renderizar(atual,anterior,hoje,pc){
    const a=atual.servicos||[],b=anterior.servicos||[],
      ea=atual.eventos||[],eb=anterior.eventos||[];
    $('total').textContent=numero(a.length);
    $('conducoes').textContent=numero(hospital(ea));
    $('tcosProduzidos').textContent=numero(semAlteracao(a,ea));
    $('veiculosRecuperadosKpi').textContent=numero(totalEfetivo(a));
    $('periodoComparativo').textContent='Mês atual × período comparado';
    if(typeof itemComparativo==='function'){
      $('comparativoMes').innerHTML=
        itemComparativo('Relatórios de serviço',a.length,b.length,'prod')+
        itemComparativo('Entradas hospitalares',hospital(ea),hospital(eb),'prod')+
        itemComparativo('Sem alteração (S/A)',semAlteracao(a,ea),semAlteracao(b,eb),'prod')+
        itemComparativo('Efetivo empregado',totalEfetivo(a),totalEfetivo(b),'prod');
    }
    $('resumoInteligente').textContent='No mês: '+numero(a.length)+' relatório(s) de serviço, '+
      numero(hospital(ea))+' atendimento(s) hospitalar(es) de PM(s), '+
      numero(semAlteracao(a,ea))+' serviço(s) sem alteração, '+
      numero(totalEfetivo(a))+' empregos de efetivo (ordinário + SVI) e '+
      numero(distintas(a))+' instituição(ões) atendida(s). '+
      'Eventos do livro de serviço não são somados às ocorrências policiais do CPC.';
  }
  function falha(err){
    console.error('Falha na visão CIPG',err);
    for(const id of ['total','conducoes','tcosProduzidos','veiculosRecuperadosKpi'])$(id).textContent='—';
    $('resumoInteligente').textContent='Falha ao consultar os serviços de guarda: '+(err?.message||err);
  }
  window.CipgHome={preparar,consultar,renderizar,falha,rotulos};
})();