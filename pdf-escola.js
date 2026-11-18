/* SIE — escola do LOCAL DO FATO no PDF (leitura local, conservadora).
 * Não usar endereço de envolvidos, assinatura ou mera menção a alunos.
 */
(function(global){
  "use strict";
  const chave=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\s+/g," ").trim();
  const ehInstituicao=v=>/^(?:ESCOLA|COLEGIO|COL[EÉ]GIO|CRECHE|CEM\b|CENTRO EDUCACIONAL|INSTITUTO DE EDUCACAO|UNIDADE ESCOLAR)\b/i.test(String(v||"").trim());
  function campo(bloco,rotulo){
    const rx=new RegExp("(?:^|\\n)\\s*"+rotulo+"\\s*:\\s*([^\\r\\n]+)","i");
    return String(bloco.match(rx)?.[1]||"").replace(/\s+/g," ").trim();
  }
  function analisar(texto){
    const original=String(texto||"");
    const local=original.match(/(?:^|\n)\s*Local do Fato\b([\s\S]*?)(?=\n\s*Natureza\b|\n\s*ENVOLVIDO\(S\)|$)/i)?.[1]||"";
    const complemento=campo(local,"Complemento");
    const referencia=campo(local,"Ponto\\s+de\\s+Refer[eê]ncia");
    const descricao=campo(local,"Descri[çc][ãa]o\\s+do\\s+Local");
    const descricaoNormal=chave(descricao);
    const escolaNoLocal=/^(?:ESCOLA|COLEGIO|CRECHE|INSTITUICAO DE ENSINO|ESTABELECIMENTO DE ENSINO|UNIDADE ESCOLAR)\b/.test(descricaoNormal);
    if(!escolaNoLocal) return {nome:"",identificado:false,ambiguo:false,motivo:"Local não classificado como escola no PDF."};
    const candidatos=[complemento,referencia].filter(ehInstituicao);
    if(!candidatos.length)return {nome:"",identificado:false,ambiguo:true,motivo:"O documento indica escola, mas não informa nome inequívoco no local do fato."};
    // Diferenças de abreviação não justificam adivinhar nomes distintos.
    const semPrefixo=v=>chave(v).replace(/^(?:COLEGIO|ESCOLA|CENTRO EDUCACIONAL)\s+(?:ESTADUAL\s+)?(?:MILITARIZAD[OA]\s+)?/,"");
    if(candidatos.length>1 && semPrefixo(candidatos[0])!==semPrefixo(candidatos[1]))
      return {nome:"",identificado:false,ambiguo:true,motivo:"Complemento e ponto de referência indicam escolas diferentes. Confirme manualmente."};
    return {nome:candidatos[0].slice(0,180),identificado:true,ambiguo:false,motivo:"Nome extraído do campo Local do Fato; confirme antes de salvar."};
  }
  global.PdfEscola=Object.freeze({analisar});
})(typeof window!=="undefined"?window:globalThis);
