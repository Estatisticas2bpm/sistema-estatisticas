/* SIE-CPC: transcrição integral do RELATO/HISTÓRICO.
 * A limpeza é deliberadamente conservadora: remove apenas artefatos
 * administrativos reconhecíveis e nunca resume ou reescreve a narrativa.
 */
(function(global){
  'use strict';

  const linhasDeImpressao = [
    /^IMPRESSO\s+POR\s*:/i,
    /^DATA\s+DE\s+IMPRESS[ÃA]O\s*:/i,
    /^GOVERNO\s+DO\s+ESTADO\s+DE\s+RORAIMA\s*$/i,
    /^POL[ÍI]CIA\s+MILITAR(?:\s+DO\s+ESTADO\s+DE\s+RORAIMA)?(?:\s*-\s*BOA\s+VISTA\s*-\s*RR)?\s*$/i,
    /^\d{1,2}\s*[ªº°aA]?\s*COMPANHIA\s+DO\s+\d{1,2}\s*[ºª°]?\s*BATALH[ÃA]O\b/i,
    /^BOLETIM\s+DE\s+OCORR[ÊE]NCIA\b/i,
    /^N[º°]\s*:\s*\d+\s*\/\s*20\d{2}\s*$/i,
    /^PPE\s*-\s*PROCEDIMENTOS\s+POLICIAIS\b/i,
    /^P[ÁA]GINA\s+\d+\s+DE\s+\d+\s*$/i,
    /^PP\s*PG\.?\s*\d+\s*\/\s*\d+\s*$/i,
    /^C[ÓO]DIGO\s+VERIFICADOR(?:\s*\(MAC\))?\s*:/i,
    /^C[ÓO]DIGO\s+CRC\s*:/i
  ];
  const inicioSecao=/(?:^|\n)[ \t]*RELATO\s*(?:\/|-)?\s*HIST[ÓO]RICO\b[ \t]*:?[ \t]*/i;
  const fimSecao=/(?:^|\n)[ \t]*(?:ASSINATURAS?|IDENTIFICA[ÇC][ÃA]O\s+DOS\s+RESPONS[ÁA]VEIS)\b/i;
  const papelGuarnicao=/\b(?:CMT|CMD|COMANDANTE|MOT|MOTORISTA|PTR\s*[1-4]?|P[1-4]|PATRULHEIRO(?:\s+[1-4])?|SEG)\s*(?::|-)/gi;

  function limparArtefatosConcatenados(valor){
    return String(valor||'')
      .replace(/C[ÓO]DIGO\s+VERIFICADOR(?:\s*\(MAC\))?\s*:\s*[A-Z0-9-]+\s*(?:-\s*)?/gi,' ')
      .replace(/C[ÓO]DIGO\s+CRC\s*:\s*\d+/gi,' ')
      .replace(/PP\s*PG\.?\s*\d+\s*\/\s*\d+/gi,' ')
      .replace(/P[ÁA]GINA\s+\d+\s+DE\s+\d+/gi,' ')
      .replace(/POL[ÍI]CIA\s+MILITAR\s+DO\s+ESTADO\s+DE\s+RORAIMA\s*-\s*BOA\s+VISTA\s*-\s*RR/gi,' ')
      .replace(/GOVERNO\s+DO\s+ESTADO\s+DE\s+RORAIMA/gi,' ')
      .replace(/PPE\s*-\s*PROCEDIMENTOS\s+POLICIAIS(?:\s+ELETR[ÔO]NICOS)?/gi,' ');
  }

  function cortarBlocoTerminalGuarnicao(valor){
    const texto=String(valor||'');
    const candidatos=[];
    const regex=/(?:^|\n|[.!?]\s+)(?:VTR|VIATURA)\s*(?:PM\s*)?(?:N[º°]\s*)?(?:-|:)?\s*(?:TOR\s*)?\d{2,5}\b/gi;
    let achado;
    while((achado=regex.exec(texto)))candidatos.push(achado.index+(achado[0].match(/(?:VTR|VIATURA)/i)?.index||0));
    for(let i=candidatos.length-1;i>=0;i--){
      const indice=candidatos[i];
      const cauda=texto.slice(indice);
      const papeis=new Set();
      let papel;
      papelGuarnicao.lastIndex=0;
      while((papel=papelGuarnicao.exec(cauda)))papeis.add(papel[0].replace(/[^A-Z0-9]/gi,'').toUpperCase());
      // Só é administrativo quando há VTR e ao menos dois papéis distintos.
      // Uma frase legítima como "a VTR 235 chegou" permanece intacta.
      if(papeis.size>=2 && cauda.length<=900)return texto.slice(0,indice).trim();
    }
    return texto;
  }

  function normalizarLinhas(bloco){
    const preparado=limparArtefatosConcatenados(bloco).replace(/\r\n?/g,'\n');
    const linhas=preparado.split('\n').map(x=>x.replace(/[\t ]+/g,' ').trim())
      .filter(x=>x&&!linhasDeImpressao.some(p=>p.test(x)));
    let unificado='';
    for(const linha of linhas){
      if(!unificado)unificado=linha;
      else if(unificado.endsWith('-')&&/^[a-zà-ÿ]/.test(linha)){
        // Pronomes enclíticos mantêm o hífen ("encontrava-se"); nas demais
        // quebras tipográficas a palavra é recomposta ("poli-\ncial").
        unificado=/^(?:se|lhe|lhes|me|te|nos|vos)\b/i.test(linha)?unificado+linha:unificado.slice(0,-1)+linha;
      }
      else unificado+=' '+linha;
    }
    return cortarBlocoTerminalGuarnicao(unificado)
      .replace(/\s+/g,' ')
      .trim()
      .toLocaleUpperCase('pt-BR');
  }

  function analisar(texto){
    const fonte=String(texto||'').replace(/\r\n?/g,'\n');
    const abertura=inicioSecao.exec(fonte);
    if(!abertura)return {texto:'',inicioEncontrado:false,fimEncontrado:false,necessitaConferencia:true,motivo:'Seção RELATO/HISTÓRICO não encontrada.'};
    const restante=fonte.slice(abertura.index+abertura[0].length);
    const fechamento=fimSecao.exec(restante);
    const bloco=fechamento?restante.slice(0,fechamento.index):restante;
    const resultado=normalizarLinhas(bloco);
    return {
      texto:resultado,
      inicioEncontrado:true,
      fimEncontrado:Boolean(fechamento),
      necessitaConferencia:!fechamento||!resultado,
      motivo:!resultado?'A seção narrativa está vazia.':!fechamento?'Fim da seção narrativa não identificado; confira o texto extraído.':''
    };
  }

  function extrair(texto){return analisar(texto).texto;}

  global.PdfHistorico=Object.freeze({extrair,analisar,limparArtefatosConcatenados});
})(window);
