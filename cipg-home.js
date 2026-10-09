(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const rotulos={GUARDA_FIXA:'Guarda fixa',RONDA:'Ronda',REFORCO:'Reforço de guarda',APOIO_OPERACIONAL:'Apoio operacional',OUTRA:'Outra atividade'};
  const somar=(a,k)=>(a||[]).reduce((s,x)=>s+(Number(x[k])||0),0);
  const distintas=a=>new Set((a||[]).map(x=>String(x.instituicao||'').trim().toLocaleUpperCase('pt-BR')).filter(Boolean)).size;
  const numero=v=>Number(v||0).toLocaleString('pt-BR');
  function preparar(){
    document.body.classList.add('modo-cipg');
    $('heroTitulo').textContent='Visão rápida — CIPG';
    $('heroEyebrow').innerHTML='<i class="pulse"></i> Policiamento de Guarda · CIPG';
    const cards=[['total','Serviços de guarda','shield-check'],
      ['conducoes','Instituições atendidas','building-2'],
      ['tcosProduzidos','Rondas realizadas','route'],
      ['veiculosRecuperadosKpi','Intercorrências','clipboard-list']];
    cards.forEach(([id,nome])=>{
      const card=$(id)?.closest('.kpi');
      if(card)card.querySelector('label').textContent=nome;
    });
    $('totalSub').textContent='serviços cadastrados neste mês';
    $('conducoesSub').textContent='instituições distintas no mês';
    $('tcosSub').textContent='rondas registradas nos serviços';
    $('veiculosSub').textContent='situações registradas em serviço';
    $('topOcorrenciasDescricao').textContent='Modalidades dos serviços de guarda';
  }
  async function consultar(db,inicio,fim){
    const rows=[],limite=1000;
    for(let pagina=0;;pagina++){
      const r=await db.from('cipg_servicos_guarda')
       .select('id,data_servico,instituicao,tipo_local,modalidade,rondas_realizadas,intercorrencias')
       .gte('data_servico',inicio).lte('data_servico',fim).order('id',{ascending:true})
       .range(pagina*limite,(pagina+1)*limite-1);
      if(r.error)throw Error('Falha ao consultar serviços da CIPG: '+r.error.message);
      rows.push(...(r.data||[]));
      if((r.data||[]).length<limite)break;
      if(pagina>=200)throw Error('Intervalo muito amplo. Selecione um período menor.');
    }
    return rows;
  }
  function renderizar(atual,anterior,hoje,pc){
    $('total').textContent=numero(atual.length);
    $('conducoes').textContent=numero(distintas(atual));
    $('tcosProduzidos').textContent=numero(somar(atual,'rondas_realizadas'));
    $('veiculosRecuperadosKpi').textContent=numero(somar(atual,'intercorrencias'));
    $('periodoComparativo').textContent='Mês atual × período comparado';
    if(typeof itemComparativo==='function'){
      $('comparativoMes').innerHTML=
        itemComparativo('Serviços de guarda',atual.length,anterior.length,'prod')+
        itemComparativo('Rondas',somar(atual,'rondas_realizadas'),somar(anterior,'rondas_realizadas'),'prod')+
        itemComparativo('Intercorrências',somar(atual,'intercorrencias'),somar(anterior,'intercorrencias'),'crime');
    }
    $('resumoInteligente').textContent='No mês: '+numero(atual.length)+' serviço(s) de guarda, '+
      numero(distintas(atual))+' instituição(ões) atendida(s), '+
      numero(somar(atual,'rondas_realizadas'))+' ronda(s) e '+
      numero(somar(atual,'intercorrencias'))+' intercorrência(s). '+
      'Serviços sem BO também compõem a produtividade; ocorrências policiais são contabilizadas separadamente.';
  }
  function falha(err){
    console.error('Falha na visão CIPG',err);
    for(const id of ['total','conducoes','tcosProduzidos','veiculosRecuperadosKpi'])$(id).textContent='—';
    $('resumoInteligente').textContent='Falha ao consultar os serviços de guarda: '+(err?.message||err);
  }
  window.CipgHome={preparar,consultar,renderizar,falha,rotulos};
})();