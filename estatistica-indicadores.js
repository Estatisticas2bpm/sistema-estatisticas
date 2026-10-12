/* Núcleo de indicadores especializados do SIE-CPC.
 * Não consulta dados nem altera permissões. Recebe conjuntos já autorizados
 * e aplica os mesmos critérios na visão individual e no consolidado.
 */
(function(global){
  'use strict';
  const soma=(rows,campo)=>(rows||[]).reduce((total,r)=>total+(Number(r?.[campo])||0),0);
  const corUnidade={
    '1BPM':'#2563eb','2BPM':'#ea580c','BOPE':'#7c3aed',
    'CAVALARIA':'#a16207','CIPA':'#15803d','CIPG':'#64748b',
    'CIPTUR':'#0891b2','GIRO':'#dc2626'
  };
  const brasaoUnidade={
    '1BPM':'assets/logos/1bpm-brasao.jpg',
    '2BPM':'logo-2bpm-novo.png',
    'BOPE':'assets/logos/bope-brasao.png',
    'CAVALARIA':'assets/logos/cavalaria-brasao.jpg',
    'CIPA':'assets/logos/cipa-brasao-relatorio.jpg',
    'CIPG':'assets/logos/cipg-brasao.png',
    'CIPTUR':'assets/logos/ciptur-escudo-v2.png',
    'GIRO':'assets/logos/giro-brasao.svg'
  };
  const numero=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:2});
  const moeda=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  function giro(abordagens){
    const a=abordagens||[];
    return {abordagens:a.length,pessoasAbordadas:soma(a,'quantidade_pessoas')};
  }
  function cavalaria(servicos){
    const s=servicos||[];
    return {
      servicos:s.length,
      pessoasAbordadas:soma(s,'abordagens_pessoas'),
      policiamentoMontado:s.filter(x=>x.tipo_policiamento==='POLICIAMENTO_MONTADO').length,
      eventosOperacoes:s.filter(x=>x.contexto_atividade==='EVENTO'||x.tipo_policiamento==='POLICIAMENTO_OPERACOES').length
    };
  }
  function ciptur(autos){
    const a=autos||[],comRemocao=a.filter(x=>x.houve_remocao===true);
    return {
      autosInfracao:a.length,
      autosComRemocao:comRemocao.length,
      autosRemocaoCarro:comRemocao.filter(x=>x.tipo_veiculo_removido==='CARRO').length,
      autosRemocaoMoto:comRemocao.filter(x=>x.tipo_veiculo_removido==='MOTO').length
    };
  }
  function cards(sigla,ocorrencias,tcos,especial){
    const o=ocorrencias||[],t=tcos||[];
    const nome=String(sigla||'').trim().toUpperCase().replace(/º\s*/g,'');
    const base=[
      {rotulo:'Ocorrências',valor:o.length,fonte:'Registros policiais · data da ocorrência'},
      {rotulo:'Conduções',valor:soma(o,'conducoes_operacionais'),fonte:'Registros policiais · conduções estatísticas'},
      {rotulo:'TCOs',valor:t.length,fonte:'Termos circunstanciados'},
      {rotulo:'Veículos recuperados',valor:soma(o,'veiculos_recuperados'),fonte:'Registros policiais'}
    ];
    const disponivel=especial?.status==='ok',d=disponivel?especial.data:null;
    const v=valor=>disponivel?valor:null;
    if(nome==='CIPA'){
      const k=disponivel&&global.CipaHome?.indicadores?global.CipaHome.indicadores(o,d):null;
      return [
        base[0],
        {rotulo:'Animais envolvidos',valor:v(k?.animais),fonte:'CIPA · data do registro da fauna'},
        {rotulo:'Área embargada (ha)',valor:v(k?.areaEmbargadaHa),fonte:'CIPA · data do termo de embargo'},
        {rotulo:'Multas aplicadas (R$)',valor:v(k?.valorMultas),formato:'moeda',fonte:'CIPA · data do auto de infração'}
      ];
    }
    if(nome==='CIPG'){
      const k=disponivel&&global.CipgHome?.indicadores?global.CipgHome.indicadores(d):null;
      return [
        {rotulo:'Relatórios de serviço',valor:v(k?.relatoriosServico),fonte:'CIPG · data do serviço'},
        {rotulo:'Entradas de PM no hospital',valor:v(k?.entradasPmHospital),fonte:'CIPG · eventos vinculados ao serviço'},
        {rotulo:'Serviços sem alteração',valor:v(k?.servicosSemAlteracao),fonte:'CIPG · sem evento vinculado'},
        {rotulo:'Empregos de efetivo',valor:v(k?.empregosEfetivo),fonte:'CIPG · ordinário + SVI; não são PMs únicos'}
      ];
    }
    if(nome==='CAVALARIA'){
      const k=disponivel?cavalaria(d):null;
      return [
        {rotulo:'Serviços realizados',valor:v(k?.servicos),fonte:'Cavalaria · data do serviço'},
        {rotulo:'Pessoas abordadas',valor:v(k?.pessoasAbordadas),fonte:'Cavalaria · produtividade dos serviços'},
        {rotulo:'Policiamento montado',valor:v(k?.policiamentoMontado),fonte:'Cavalaria · modalidade do serviço'},
        {rotulo:'Eventos / operações',valor:v(k?.eventosOperacoes),fonte:'Cavalaria · contexto ou modalidade'}
      ];
    }
    if(nome==='CIPTUR'){
      const k=disponivel?ciptur(d):null;
      return [
        base[0],base[1],
        {rotulo:'Autos de infração',valor:v(k?.autosInfracao),fonte:'CIPTUR · data da infração'},
        {rotulo:'Autos com remoção',valor:v(k?.autosComRemocao),fonte:'CIPTUR · autos sinalizados, não veículos únicos'}
      ];
    }
    if(nome==='GIRO'){
      const k=disponivel?giro(d):null;
      return [
        base[0],base[1],
        {rotulo:'Abordagens',valor:v(k?.abordagens),fonte:'GIRO · data/hora do registro em Roraima'},
        {rotulo:'Pessoas abordadas',valor:v(k?.pessoasAbordadas),fonte:'GIRO · soma de pessoas por abordagem'}
      ];
    }
    return base;
  }
  const formatar=(item)=>item.valor===null||item.valor===undefined||!Number.isFinite(Number(item.valor))
    ?'—':item.formato==='moeda'?moeda(item.valor):numero(item.valor);
  global.EstatisticaIndicadores=Object.freeze({giro,cavalaria,ciptur,cards,formatar,corUnidade,brasaoUnidade});
})(window);
