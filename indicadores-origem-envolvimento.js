/* SIE-CPC — estatísticas de origem do atendimento e participação funcional.
 * Contabiliza BOs únicos, não pessoas, e somente classificações estruturadas.
 * Não deduz profissão de trechos livres do histórico nem da guarnição.
 */
(function(global){
  "use strict";
  const MARCADOR="[[PESSOAS_ENVOLVIDAS]]";
  const ORIGENS=Object.freeze([
    {valor:"CICC",rotulo:"CICC"},
    {valor:"PATRULHAMENTO",rotulo:"Patrulhamento"},
    {valor:"ABORDAGEM",rotulo:"Abordagem"},
    {valor:"MISSAO",rotulo:"Missão"},
    {valor:"OPERACAO",rotulo:"Operação"},
    {valor:"OUTRA",rotulo:"Outra"},
    {valor:"NAO_INFORMADA",rotulo:"Não informada"}
  ]);
  const POLICIAIS=new Set([
    "POLICIAL_MILITAR","POLICIAL_CIVIL","POLICIAL_FEDERAL",
    "POLICIAL_RODOVIARIO_FEDERAL","POLICIAL_PENAL",
    "DELEGADO_POLICIA","OUTRO_POLICIAL"
  ]);
  const AUTORIDADES=new Set(["MAGISTRADO","MEMBRO_MINISTERIO_PUBLICO","AUTORIDADE_POLITICA_ADMINISTRATIVA","OUTRA_AUTORIDADE"]);
  function metaOcorrencia(ocorrencia){
    const texto=String(ocorrencia?.observacao_final||"");
    const pos=texto.lastIndexOf(MARCADOR);
    if(pos<0)return null;
    try{
      const data=JSON.parse(texto.slice(pos+MARCADOR.length));
      return data&&typeof data==="object"&&!Array.isArray(data)?data:null;
    }catch(_){return null}
  }
  function verificarPapel(meta,papel){
    const pessoas=[];
    if(meta?.institucionaisPrincipais&&typeof meta.institucionaisPrincipais==="object")
      pessoas.push(meta.institucionaisPrincipais[papel]);
    const key=papel==="vitima"?"vitimas":"infratores";
    if(Array.isArray(meta?.[key]))
      meta[key].forEach(item=>pessoas.push(item?.institucional));
    const informado=pessoas.some(x=>x&&(x.situacao==="SIM"||x.situacao==="NAO"));
    const policial=pessoas.some(x=>x?.situacao==="SIM"&&POLICIAIS.has(String(x.tipo||"").toUpperCase()));
    const autoridade=pessoas.some(x=>x?.situacao==="SIM"&&AUTORIDADES.has(String(x.tipo||"").toUpperCase()));
    return {informado,policial,autoridade};
  }
  function classificarOcorrencia(ocorrencia){
    const meta=metaOcorrencia(ocorrencia);
    // Indicadores funcionais começam nos novos cadastros de 06/11/2026,
    // independentemente da data do fato. Não reclassificar BOs legados.
    const criado=String(ocorrencia?.criado_em||"");
    const elegivelFuncional=criado!=="" && Date.parse(criado)>=Date.parse("2026-11-06T04:00:00.000Z");
    const vazio={informado:false,policial:false,autoridade:false};
    const vitima=elegivelFuncional?verificarPapel(meta,"vitima"):vazio;
    const infrator=elegivelFuncional?verificarPapel(meta,"infrator"):vazio;
    const origem=String(ocorrencia?.origem_acionamento||"").toUpperCase().trim();
    return {
      origem:ORIGENS.some(o=>o.valor===origem&&origem!=="NAO_INFORMADA")?origem:"NAO_INFORMADA",
      elegivelFuncional,
      vitimaPolicial:vitima.policial,
      infratorPolicial:infrator.policial,
      envolvePolicial:vitima.policial||infrator.policial,
      vitimaAutoridade:vitima.autoridade,
      infratorAutoridade:infrator.autoridade,
      envolveAutoridade:vitima.autoridade||infrator.autoridade,
      classificacaoFuncionalInformada:vitima.informado||infrator.informado
    };
  }
  function resumir(registros){
    const vistos=new Set(),contagem=Object.fromEntries(ORIGENS.map(o=>[o.valor,0]));
    const grupos=Object.fromEntries(ORIGENS.map(o=>[o.valor,[]]));
    const policiais=[],vitimas=[],infratores=[],autoridades=[],autoridadesVitimas=[],autoridadesInfratores=[];
    let total=0,classificados=0,elegiveis=0;
    (Array.isArray(registros)?registros:[]).forEach((registro,indice)=>{
      if(!registro||typeof registro!=="object")return;
      const chave=registro.id?String(registro.id):"sem-id-"+indice;
      if(vistos.has(chave))return;
      vistos.add(chave);total++;
      const r=classificarOcorrencia(registro);
      contagem[r.origem]++;
      grupos[r.origem].push(registro);
      if(r.elegivelFuncional)elegiveis++;
      if(r.classificacaoFuncionalInformada)classificados++;
      if(r.envolvePolicial)policiais.push(registro);
      if(r.vitimaPolicial)vitimas.push(registro);
      if(r.infratorPolicial)infratores.push(registro);
      if(r.envolveAutoridade)autoridades.push(registro);
      if(r.vitimaAutoridade)autoridadesVitimas.push(registro);
      if(r.infratorAutoridade)autoridadesInfratores.push(registro);
    });
    return {
      total,origens:contagem,grupos,
      origemInformada:total-contagem.NAO_INFORMADA,
      policiais:{total:policiais.length,vitimas:vitimas.length,infratores:infratores.length,classificados,novosCadastros:elegiveis,semClassificacao:elegiveis-classificados},
      ocorrenciasPoliciais:policiais,ocorrenciasVitimasPoliciais:vitimas,ocorrenciasInfratoresPoliciais:infratores,
      autoridades:{total:autoridades.length,vitimas:autoridadesVitimas.length,infratores:autoridadesInfratores.length},
      ocorrenciasAutoridades:autoridades,ocorrenciasVitimasAutoridades:autoridadesVitimas,ocorrenciasInfratoresAutoridades:autoridadesInfratores
    };
  }
  global.SIEIndicadoresEnvolvimento=Object.freeze({ORIGENS,POLICIAIS,metaOcorrencia,classificarOcorrencia,resumir});
})(typeof window!=="undefined"?window:globalThis);
