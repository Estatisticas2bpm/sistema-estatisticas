/* SIE-CPC: transcrição normalizada do relato do PDF, sem resumir o conteúdo.
 * Remove apenas elementos de impressão/paginação e um bloco terminal
 * de identificação da guarnição, quando inequivocamente separado do relato.
 */
(function(global){
  'use strict';

  const linhasDeImpressao = [
    /^IMPRESSO\s+POR\s*:/i,
    /^DATA\s+DE\s+IMPRESS[ÃA]O\s*:/i,
    /^GOVERNO\s+DO\s+ESTADO\s+DE\s+RORAIMA\s*$/i,
    /^POL[ÍI]CIA\s+MILITAR\s*$/i,
    /^\d{1,2}\s*[ªº°aA]?\s*COMPANHIA\s+DO\s+\d{1,2}\s*[ºª°]?\s*BATALH[ÃA]O\b/i,
    /^BOLETIM\s+DE\s+OCORR[ÊE]NCIA\b/i,
    /^N[º°]\s*:\s*\d+\s*\/\s*20\d{2}\s*$/i,
    /^PPE\s*-\s*PROCEDIMENTOS\s+POLICIAIS\b/i,
    /^P[ÁA]GINA\s+\d+\s+DE\s+\d+\s*$/i
  ];
  const linhaGuarnicao = /^(?:VTR|VIATURA|CMT|COMANDANTE|MOT|MOTORISTA|P[1-4]|PTR[1-4]|PATRULHEIRO(?:\s+[1-4])?|SEG)\s*(?::|\-|\s)\s*\S/i;

  function extrair(texto){
    const fonte=String(texto||'').replace(/\r\n?/g,'\n');
    const abertura=/(?:^|\n)[ \t]*RELATO\s*\/\s*HIST[ÓO]RICO[ \t]*:?[ \t]*(?=\n|$)/i.exec(fonte);
    if(!abertura)return '';
    const restante=fonte.slice(abertura.index+abertura[0].length);
    const fechamento=/(?:^|\n)[ \t]*ASSINATURAS?\b/i.exec(restante);
    const bloco=(fechamento?restante.slice(0,fechamento.index):restante);
    let linhas=bloco.split('\n').map(x=>x.replace(/[\t ]+/g,' ').trim())
      .filter(x=>x&&!linhasDeImpressao.some(p=>p.test(x)));

    // Identificação de equipe costuma vir ao fim do texto, após o relato.
    // Exige ao menos duas linhas distintas, para não apagar menções no relato.
    let fim=linhas.length,quantidade=0;
    while(fim>0 && linhaGuarnicao.test(linhas[fim-1])){fim--;quantidade++;}
    if(quantidade>=2)linhas=linhas.slice(0,fim);

    let unificado='';
    for(const linha of linhas){
      if(!unificado)unificado=linha;
      else if(unificado.endsWith('-')&&/^[a-zà-ÿ]/.test(linha))unificado+=linha;
      else unificado+=' '+linha;
    }
    return unificado.replace(/\s+/g,' ').trim().toLocaleUpperCase('pt-BR');
  }

  global.PdfHistorico=Object.freeze({extrair});
})(window);
