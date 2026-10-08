/* Regras da CIPA extraídas da planilha operacional de julho/2026.
 * A origem (CICC, BIOMA etc.) é diferente da ordem que motivou a atuação.
 * A descrição do BO tem prioridade sobre uma suposição baseada no relato.
 */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.CipaRegrasPpe=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  function normalizar(s){
    return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^A-Za-z0-9]+/g,' ').replace(/\s+/g,' ').trim().toUpperCase();
  }
  function documentoDaMissao(texto){
    const bruto=String(texto||'');
    // Ignora número de AI, TCO e termo de embargo: somente ordem de missão/serviço.
    const match=bruto.match(/\bORDEM\s+DE\s+(MISS[ÃA]O|SERVI[ÇC]O)\b[^\n]{0,200}/i);
    if(!match)return {tipo:'',numero:'',referencia:''};
    const tipo=/MISS[ÃA]O/i.test(match[1])?'ORDEM DE MISSÃO':'ORDEM DE SERVIÇO';
    const referencia=match[0]
      .split(/\bOPERA[ÇC][ÃA]O\s+BIOMA\b|\bDESLOCOU-SE\b|\bCOM\s+O\s+OBJETIVO\b/i)[0]
      .replace(/\s+/g,' ').replace(/[;,.\s]+$/,'').trim();
    const num=referencia.match(/(?:N[º°o.]*\s*|N[ÚU]MERO\s*)?(\d{1,10}\s*\/\s*20\d{2})/i)
      || referencia.match(/(?:N[º°o.]*\s*|N[ÚU]MERO\s*)(\d{3,12})(?!\d)/i);
    return {tipo,numero:num?num[1].replace(/\s+/g,''):'',referencia};
  }
  function origemDaAtuacao(texto,doc){
    const bruto=String(texto||'');
    if(/\bOPERA[ÇC][ÃA]O\s+BIOMA\b|\bBIOMA\s*\/\s*AMAZ[ÔO]NIA\b/i.test(bruto))return 'BIOMA';
    if(/\bCICC\b|\bCENTRO INTEGRADO DE COMANDO E CONTROLE\b/i.test(bruto))return 'CICC';
    if(/\bPATRULHAMENTO\b/i.test(bruto))return 'PATRULHAMENTO';
    return doc?.tipo||'';
  }
  const alias=[
    ['MAUS-TRATOS',/\bMAUS?\s*TRATOS?\b|\bABUSO OU MAUS TRATOS\b/],
    ['PERTURBAÇÃO DO TRABALHO OU SOSSEGO ALHEIOS',/\bPERTUR?BA[CÇ][AÃ]O\b.*\bSOSSEGO\b/],
    ['RESGATE DE ANIMAL',/\bRESGATE\b.*\bANIMAL\b/],
    ['SALVAMENTO TERRESTRE',/\bSALVAMENTO\b.*\bTERRESTRE\b/],
    ['OMISSÃO DE CAUTELA DE ANIMAL',/\bOMISS[AÃ]O\b.*\bCAUTELA\b.*\bANIMAL\b/],
    ['POLUIÇÃO SONORA',/\bPOLUI[CÇ][AÃ]O\b.*\bSONORA\b/],
    ['EXTRAÇÃO DE MINERAIS',/\bEXTRA[CÇ][AÃ]O\b.*\bMINERAIS\b|\bEXTRAIR\b.*\bMINERAIS?\b/],
    ['NOTIFICAÇÃO DE DESMATAMENTO',/\bNOTIFICA[CÇ][AÃ]O\b.*\bDESMATAMENTO\b/],
    ['NOTIFICAÇÃO DE EMBARGO',/\bNOTIFICA[CÇ][AÃ]O\b.*\bEMBARGO\b/],
    ['QUEBRA DE EMBARGO',/\bQUEBRA\b.*\bEMBARGO\b/],
    ['PATRULHAMENTO FLUVIAL',/\bPATRULHAMENTO\b.*\bFLUVIAL\b/],
    ['PATRULHAMENTO PREVENTIVO',/\bPATRULHAMENTO\b.*\bPREVENTIVO\b/],
    ['EDUCAÇÃO AMBIENTAL',/\bEDUCA[CÇ][AÃ]O\b.*\bAMBIENTAL\b/],
    ['SINISTRO DE TRÂNSITO',/\bSINISTRO\b.*\bTRANSITO\b/],
    ['MARIA DA PENHA / VIOLÊNCIA DOMÉSTICA',/\bMARIA DA PENHA\b|\bVIOLENCIA DOMESTICA\b/],
    ['CONFLITOS DIVERSOS / MEDIAÇÃO',/\bCONFLITOS DIVERSOS\b/],
    ['DESMATAMENTO',/\bDESMATAMENTO\b|\bDESMATAR\b|\bDESTRUIR\b.*\bFLORESTAS?\b/],
    ['AÇÃO SOCIAL',/\bA[CÇ][AÃ]O\b.*\bSOCIAL\b/],
    ['USO DO FOGO',/\bUSO\b.*\bFOGO\b/]
  ].map(([nome,re])=>[nome,new RegExp(re.source,'i')]);
  function naturezaDoPpe(texto,catalogo){
    const bruto=String(texto||'');
    const match=bruto.match(/\bNatureza\s+Meio\(s\)\s+Empregado\(s\)([\s\S]{0,1200}?)(?=\bENVOLVIDO\(S\)|\bOBJETO\(S\)\s+ENVOLVIDO\(S\)|\bRELATO\/HIST[ÓO]RICO\b)/i);
    const bloco=match?match[1]:'';
    if(!bloco)return null;
    const alvo=normalizar(bloco);
    // Só aplicar correspondência quando a natureza estiver explicitamente indicada
    // no campo próprio do BO; nunca extrair nomes de local como BR-174 como crime.
    const achado=alias.find(([,re])=>re.test(alvo));
    if(!achado)return null;
    const nome=achado[0];
    const tipo=(catalogo||[]).find(item=>normalizar(item.nome||item)===normalizar(nome));
    return tipo||null;
  }
  function extrair(texto,catalogo){
    const documento=documentoDaMissao(texto);
    return {origem:origemDaAtuacao(texto,documento),documento,natureza:naturezaDoPpe(texto,catalogo)};
  }
  return {normalizar,documentoDaMissao,origemDaAtuacao,naturezaDoPpe,extrair};
});
