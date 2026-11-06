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
    return {informado,policial};
  }
  function classificarOcorrencia(ocorrencia){
    const meta=metaOcorrencia(ocorrencia);
    const vitima=verificarPapel(meta,"vitima");
    const infrator=verificarPapel(meta,"infrator");
    const origem=String(ocorrencia?.origem_acionamento||"").toUpperCase().trim();
    return {
      origem:ORIGENS.some(o=>o.valor===origem&&origem!=="NAO_INFORMADA")?origem:"NAO_INFORMADA",
      vitimaPolicial:vitima.policial,
      infratorPolicial:infrator.policial,
      envolvePolicial:vitima.policial||infrator.policial,
      classificacaoFuncionalInformada:vitima.informado||infrator.informado
    };
  }
  function resumir(registros){
    const vistos=new Set(),contagem=Object.fromEntries(ORIGENS.map(o=>[o.valor,0]));
    const grupos=Object.fromEntries(ORIGENS.map(o=>[o.valor,[]]));
    const policiais=[],vitimas=[],infratores=[];
    let total=0,classificados=0;
    (Array.isArray(registros)?registros:[]).forEach((registro,indice)=>{
      if(!registro||typeof registro!=="object")return;
      const chave=registro.id?String(registro.id):"sem-id-"+indice;
      if(vistos.has(chave))return;
      vistos.add(chave);total++;
      const r=classificarOcorrencia(registro);
      contagem[r.origem]++;
      grupos[r.origem].push(registro);
      if(r.classificacaoFuncionalInformada)classificados++;
      if(r.envolvePolicial)policiais.push(registro);
      if(r.vitimaPolicial)vitimas.push(registro);
      if(r.infratorPolicial)infratores.push(registro);
    });
    return {
      total,origens:contagem,grupos,
      origemInformada:total-contagem.NAO_INFORMADA,
      policiais:{total:policiais.length,vitimas:vitimas.length,infratores:infratores.length,classificados,semClassificacao:total-classificados},
      ocorrenciasPoliciais:policiais,ocorrenciasVitimasPoliciais:vitimas,ocorrenciasInfratoresPoliciais:infratores
    };
  }
  global.SIEIndicadoresEnvolvimento=Object.freeze({ORIGENS,POLICIAIS,metaOcorrencia,classificarOcorrencia,resumir});
})(typeof window!=="undefined"?window:globalThis);
