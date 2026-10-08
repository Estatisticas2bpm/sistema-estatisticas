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
    const bruto=String(texto||'').replace(/\u00a0/g,' ');
    const inicio=/\bORDEM\s+DE\s+(MISS[ÃA]O|SERVI[ÇC]O)\b/gi;
    const candidatos=[...bruto.matchAll(inicio)];
    if(!candidatos.length)return {tipo:'',numero:'',referencia:''};

    const escolhas=candidatos.map((item,indice)=>{
      // A identificação formal pode estar quebrada entre duas linhas do PPE.
      // Limitar o trecho ao próximo documento impede misturar duas ordens.
      const limite=Math.min(item.index+320,candidatos[indice+1]?.index??bruto.length);
      const trecho=bruto.slice(item.index,limite)
        .split(/\b(?:RELATO\/HIST[ÓO]RICO|ASSINATURAS|AUTO DE INFRA[ÇC][ÃA]O|TERMO DE EMBARGO)\b/i)[0]
        .replace(/[\t ]+/g,' ').replace(/\s*\n\s*/g,' ').trim();
      // A referência preserva a grafia do PPE: 42/2026PMRR/... não é
      // silenciosamente reescrito para 42/2026/PMRR/...
      const referenciaNumerica=/\b(\d{1,12}\s*\/\s*20\d{2})(?:((?:\s*\/?\s*)(?:PMRR|QCG|CPC|CIPA|P\d+[A-Z0-9]*)(?:\s*\/\s*[A-Z0-9-]{1,20}){0,12}))?/i;
      const marcador=/(?:N[º°o.]|N[ÚU]MERO)\s*[:.-]?\s*/i;
      const comMarcador=marcador.exec(trecho);
      const depois=comMarcador?trecho.slice(comMarcador.index+comMarcador[0].length):trecho;
      const numeroEncontrado=referenciaNumerica.exec(depois);
      let referencia='',numero='';
      if(numeroEncontrado){
        const fim=(comMarcador?comMarcador.index+comMarcador[0].length:0)+numeroEncontrado.index+numeroEncontrado[0].length;
        referencia=trecho.slice(0,fim).replace(/\s+/g,' ').trim();
        numero=numeroEncontrado[1].replace(/\s+/g,'');
      }
      const tipo=/MISS[ÃA]O/i.test(item[1])?'ORDEM DE MISSÃO':'ORDEM DE SERVIÇO';
      const pontos=(numero?10:0)+(/\bPMRR\b/i.test(referencia)?3:0)+(/\bQCG\b/i.test(referencia)?3:0)
        +(referencia.includes('CIPA')?2:0)+(comMarcador?1:0);
      return {tipo,numero,referencia,pontos};
    });
    escolhas.sort((a,b)=>b.pontos-a.pontos);
    const escolhido=escolhas[0];
    return {tipo:escolhido.tipo,numero:escolhido.numero,referencia:escolhido.referencia};
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
