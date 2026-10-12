/* Visão mensal especializada da CIPA. Consultas por data do documento,
   não por data do registro no banco. Evita somar embargo do auto ao termo. */
(function(){
  const $=id=>document.getElementById(id);
  const soma=(reg,k)=>(reg||[]).reduce((s,x)=>s+(Number(x[k])||0),0);
  const numero=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:2});
  const dinheiro=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  function preparar(){
    document.body.classList.add('modo-cipa');
    $('heroEyebrow').innerHTML='<i class="pulse"></i> Painel estatístico ambiental da CIPA';
    $('heroTitulo').textContent='Panorama Estatístico da CIPA';
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
    $('totalSub').textContent='PPEs/BOs por data da ocorrência';
    $('conducoesSub').textContent='animais por data do registro';
    $('tcosSub').textContent='hectares por data do termo de embargo';
    $('veiculosSub').textContent='valor por data do auto de infração';
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
  // Contrato estatístico reutilizável: mesma apuração no painel da unidade e no CPC.
  // Valores brutos; a formatação monetária ou de hectares pertence à interface.
  function indicadores(ocorrencias,registros){
    const r=registros||{};
    return {
      ocorrencias:(ocorrencias||[]).length,
      animais:soma(r.fauna,'quantidade'),
      areaEmbargadaHa:soma(r.embargos,'area_embargada_ha'),
      valorMultas:soma(r.autos,'valor_multa'),
      termosEmbargo:(r.embargos||[]).length,
      autosInfracao:(r.autos||[]).length
    };
  }
  function renderizar(d,dAnt,atual,anterior,hoje,pc){
    const k=indicadores(d,atual),kAnt=indicadores(dAnt,anterior);
    const animais=k.animais,animaisAnt=kAnt.animais;
    const area=k.areaEmbargadaHa,areaAnt=kAnt.areaEmbargadaHa;
    const multas=k.valorMultas,multasAnt=kAnt.valorMultas;
    $('total').textContent=k.ocorrencias;
    $('conducoes').textContent=numero(animais);
    $('tcosProduzidos').textContent=numero(area);
    $('veiculosRecuperadosKpi').textContent=dinheiro(multas);
    $('tcosSub').textContent=k.termosEmbargo+' termo(s) pela data do embargo';
    $('veiculosSub').textContent=k.autosInfracao+' auto(s) pela data da autuação';
    $('periodoComparativo').textContent='1º a '+hoje.getDate()+' de '+nomeMes(hoje).toLowerCase()+
      ' de '+hoje.getFullYear()+' × 1º a '+pc[1].getDate()+' de '+nomeMes(pc[1]).toLowerCase()+' de '+pc[1].getFullYear();
    $('comparativoMes').innerHTML=
      itemComparativo('Ocorrências',k.ocorrencias,kAnt.ocorrencias,'crime')+
      itemComparativo('Animais',animais,animaisAnt,'prod')+
      itemComparativo('Área embargada (ha)',area,areaAnt,'prod')+
      itemComparativo('Multas (R$)',multas,multasAnt,'prod');
    $('resumoInteligente').textContent='No período, '+k.ocorrencias+' ocorrência(s), '+numero(animais)+
      ' animal(is) registrado(s), '+numero(area)+' ha em termos de embargo e '+
      dinheiro(multas)+' em multas aplicadas. Área embargada não representa necessariamente área desmatada.';
  }
  function falha(erro){
    console.error('Indicadores da CIPA',erro);
    ['conducoes','tcosProduzidos','veiculosRecuperadosKpi'].forEach(id=>$(id).textContent='—');
    $('resumoInteligente').textContent='Não foi possível carregar os indicadores ambientais: '+(erro.message||erro);
  }
  window.CipaHome={preparar,consultar,indicadores,renderizar,falha};
})();
