/*
 * SIE-CPC — origem do acionamento/atendimento a partir do início do relato.
 * Nao usa o cabeçalho "Origem: Órgão" do BO, a unidade de apuração ou
 * o catálogo de origens institucionais do BOPE.
 */
(function(global){
  "use strict";
  const normalizar=valor=>String(valor||"").normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\s+/g," ").trim();
  const OPCOES=Object.freeze([
    {valor:"CICC",rotulo:"CICC — acionamento pelo Centro Integrado"},
    {valor:"PATRULHAMENTO",rotulo:"Patrulhamento"},
    {valor:"ABORDAGEM",rotulo:"Abordagem"},
    {valor:"MISSAO",rotulo:"Missão / ordem de serviço"},
    {valor:"OPERACAO",rotulo:"Operação"},
    {valor:"OUTRA",rotulo:"Outra origem (informar manualmente)"}
  ]);
  const CENTRO="(?:CICC|CENTRO INTEGRADO DE COMANDO E CONTROLE)";
  // Contexto de acionamento RECEPTIVO; "informou ao CICC" não é origem CICC.
  const FONTES=[
    ["CICC",[
      new RegExp("\\b(?:ACIONAD[AO]S?|DESPACHAD[AO]S?|DEMANDAD[AO]S?|SOLICITAD[AO]S?|CHAMAD[AO]S?|INFORMAD[AO]S?|REPASSAD[AO]S?)\\b.{0,90}\\b(?:PELO|PELA|VIA|POR|DO|DA|ATRAVES DO|POR MEIO DO)\\s+(?:RADIO\s+(?:DO|DA)\s+)?"+CENTRO+"\\b","g"),
      new RegExp("\\b(?:VIA|PELO|PELA|POR|ATRAVES DO|POR MEIO DO)\\s+(?:RADIO\\s+(?:DO|DA)\\s+)?"+CENTRO+"\\b.{0,80}\\b(?:ACIONAD|REPASSAD|DESPACHAD|OCORRENCIA|CHAMADO|DESLOCAMENTO)\\w*","g"),
      new RegExp("\\b"+CENTRO+"\\b.{0,80}\\b(?:ACIONOU|DESPACHOU|REPASSOU|SOLICITOU|DEMANDOU)\\b","g"),
      new RegExp("\\b(?:CHAMADO|ACIONAMENTO|DESPACHO|SOLICITACAO|OCORRENCIA)\\b.{0,75}\\b(?:VIA|PELO|DO|ATRAVES DO)\\s+"+CENTRO+"\\b","g")
    ]],
    ["PATRULHAMENTO",[
      /\b(?:DURANTE|EM|NO DECORRER D[OA]|QUANDO EM|AO REALIZAR|REALIZANDO)\s+(?:(?:O|A|UM|UMA)\s+)?(?:PATRULHAMENTO|POLICIAMENTO OSTENSIVO|RONDA(?:S)?)\b/g,
      /\b(?:EQUIPE|GUARNICAO|POLICIAIS)\b.{0,55}\b(?:REALIZAVA|EFETUAVA|REALIZANDO)\s+(?:O\s+)?PATRULHAMENTO\b/g
    ]],
    ["ABORDAGEM",[
      /\b(?:DURANTE|EM|NO DECORRER DE|APOS|AO REALIZAR|REALIZANDO)\s+(?:UMA?\s+)?ABORDAGEM\b/g,
      /\bAO ABORDAR\b/g,
      /\b(?:EQUIPE|GUARNICAO)\s+(?:REALIZOU|EFETUOU|INICIOU)\s+(?:UMA?\s+)?ABORDAGEM\b/g
    ]],
    ["MISSAO",[
      /\b(?:EM CUMPRIMENTO (?:DE|DA|DO|A|A UMA)|CONFORME|MEDIANTE|POR DETERMINACAO D[AO])\s+(?:(?:UMA?|A)\s+)?(?:ORDEM DE )?(?:MISSAO|SERVICO)\b/g,
      /\b(?:DURANTE|EM|NA EXECUCAO D[AE]|PARA CUMPRIR)\s+(?:(?:UMA?|A)\s+)?MISSAO\b/g,
      /\b(?:ORDENS?|DETERMINACOES?)\s+DE\s+MISSAO\b/g
    ]],
    ["OPERACAO",[
      /\b(?:DURANTE|EM|NO CURSO D[AE]|NA EXECUCAO D[AE]|NO CONTEXTO D[AE])\s+(?:(?:UMA?|A)\s+)?OPERACAO\b/g,
      /\bEM CUMPRIMENTO D[AO]\s+PLANO DE OPERACAO\b/g,
      /\b(?:EQUIPE|GUARNICAO)\s+(?:PARTICIPAVA|PARTICIPOU|ATUAVA|ATUOU)\s+D[AE]\s+OPERACAO\b/g,
      /\b(?:DEFLAGRADA|INICIADA)\s+(?:A\s+)?OPERACAO\b/g
    ]]
  ];
  function analisar(relato){
    // A origem deve estar vinculada ao COMEÇO do relato, não a providências,
    // buscas, abordagens ou comunicações ao CICC ocorridas depois.
    const texto=normalizar(relato).slice(0,950);
    const vazio={valor:"",automatico:false,conflito:false,evidencia:"",motivo:"Origem não identificada com segurança no início do relato."};
    if(!texto)return vazio;
    const achados=[];
    for(const [valor,expressoes] of FONTES){
      for(const rx of expressoes){
        rx.lastIndex=0;
        const r=rx.exec(texto);
        if(r)achados.push({valor,posicao:r.index,evidencia:r[0].slice(0,150)});
      }
    }
    if(!achados.length)return vazio;
    achados.sort((a,b)=>a.posicao-b.posicao);
    const primeiro=achados[0];
    const centrais=achados.filter(x=>x.valor==="CICC");
    // Se, durante patrulhamento, o efetivo recebeu chamado do CICC,
    // a origem do acionamento é a central, e não o policiamento rotineiro.
    const escolhido=centrais.length&&centrais[0].posicao<=300
      ? centrais[0] : primeiro;
    // Referências distintas, explícitas e próximas no início podem apontar
    // cenários simultâneos. Operador deve classificar e não assumir.
    const concorrentes=achados.filter(x=>x.valor!==escolhido.valor && Math.abs(x.posicao-escolhido.posicao)<=65);
    if(concorrentes.length && escolhido.valor!=="CICC"){
      return {valor:"",automatico:false,conflito:true,evidencia:escolhido.evidencia,
        motivo:"O início do relato menciona mais de uma possível origem. Confira e selecione manualmente."};
    }
    return {valor:escolhido.valor,automatico:true,conflito:false,evidencia:escolhido.evidencia,
      motivo:"Identificado a partir do início do relato histórico. Confira antes de salvar."};
  }
  global.PdfOrigemAcionamento=Object.freeze({OPCOES,analisar});
})(typeof window!=="undefined"?window:globalThis);
