/* Visão mensal especializada da CIPA. Consultas por data do documento,
   não por data do registro no banco. Evita somar embargo do auto ao termo. */
(function(){
  const $=id=>document.getElementById(id);
  const soma=(reg,k)=>(reg||[]).reduce((s,x)=>s+(Number(x[k])||0),0);
  const numero=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:2});
  const dinheiro=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  function preparar(){
    document.body.classList.add('modo-cipa');
    $('heroEyebrow').innerHTML='<i class="pulse"></i> Painel ambiental da CIPA';
    $('heroTitulo').textContent='Visão rápida — CIPA';
    const cards=[
      ['total','Total de ocorrências','📋'],
      ['conducoes','Animais envolvidos','🦜'],
      ['tcosProduzidos','Área embargada (ha)','🌿'],
      ['veiculosRecuperadosKpi','Multas aplicadas (R$)','⚖']
    ];
    cards.forEach(([id,label,icone])=>{
      const c=$(id).closest('.kpi');
      c.querySelector('label').textContent=label;
      c.querySelector('.kpiIcon').textContent=icone;
    });
    $('totalSub').textContent='PPEs/BOs do mês';
    $('conducoesSub').textContent='quantidade de animais registrados';
    $('tcosSub').textContent='hectares em termos de embargo';
    $('veiculosSub').textContent='valor dos autos de infração';
    $('topOcorrenciasDescricao').textContent='Principais naturezas das ocorrências da CIPA';
  }
  async function consultar(db,ini,fim){
    const specs=[
      ['cipa_fauna','data_registro','quantidade'],
      ['cipa_termos_embargo','data_embargo','area_embargada_ha'],
      ['cipa_autos_infracao','data_autuacao','valor_multa']
    ];
    const resultados=await Promise.all(specs.map(async ([tabela,data,campo])=>{
      const linhas=[],passo=1000;
      for(let offset=0;;offset+=passo){
        const r=await db.from(tabela).select('id,'+campo).gte(data,ini).lte(data,fim)
          .order('id',{ascending:true}).range(offset,offset+passo-1);
        if(r.error)throw Error(tabela+': '+r.error.message);
        const lote=r.data||[];
        linhas.push(...lote);
        if(lote.length<passo)break;
        if(offset>200000)throw Error('Intervalo muito amplo; selecione um período menor.');
      }
      return linhas;
    }));
    return {fauna:resultados[0],embargos:resultados[1],autos:resultados[2]};
  }
  function renderizar(d,dAnt,atual,anterior,hoje,pc){
    const animais=soma(atual.fauna,'quantidade'),animaisAnt=soma(anterior.fauna,'quantidade');
    const area=soma(atual.embargos,'area_embargada_ha'),areaAnt=soma(anterior.embargos,'area_embargada_ha');
    const multas=soma(atual.autos,'valor_multa'),multasAnt=soma(anterior.autos,'valor_multa');
    $('total').textContent=(d||[]).length;
    $('conducoes').textContent=numero(animais);
    $('tcosProduzidos').textContent=numero(area);
    $('veiculosRecuperadosKpi').textContent=dinheiro(multas);
    $('tcosSub').textContent=atual.embargos.length+' termo(s) de embargo no mês';
    $('veiculosSub').textContent=atual.autos.length+' auto(s) de infração no mês';
    $('periodoComparativo').textContent='1º a '+hoje.getDate()+' de '+nomeMes(hoje).toLowerCase()+
      ' × 1º a '+pc[1].getDate()+' de '+nomeMes(pc[1]).toLowerCase();
    $('comparativoMes').innerHTML=
      itemComparativo('Ocorrências',(d||[]).length,(dAnt||[]).length,'crime')+
      itemComparativo('Animais',animais,animaisAnt,'prod')+
      itemComparativo('Área embargada (ha)',area,areaAnt,'prod')+
      itemComparativo('Multas (R$)',multas,multasAnt,'prod');
    $('resumoInteligente').textContent='No período, '+(d||[]).length+' ocorrência(s), '+numero(animais)+
      ' animal(is) registrado(s), '+numero(area)+' ha em termos de embargo e '+
      dinheiro(multas)+' em multas aplicadas. Área embargada não representa necessariamente área desmatada.';
  }
  function falha(erro){
    console.error('Indicadores da CIPA',erro);
    ['conducoes','tcosProduzidos','veiculosRecuperadosKpi'].forEach(id=>$(id).textContent='—');
    $('resumoInteligente').textContent='Não foi possível carregar os indicadores ambientais: '+(erro.message||erro);
  }
  window.CipaHome={preparar,consultar,renderizar,falha};
})();
