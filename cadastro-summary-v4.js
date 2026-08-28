(function(){
  'use strict';

  const fallback = typeof resumirRelatoPdf === 'function' ? resumirRelatoPdf : null;
  const norm = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
  const cap = (v) => { const t=String(v||'').trim(); return t ? t[0].toUpperCase()+t.slice(1) : ''; };

  const RUIDO = [
    /IMPRESSO POR/i,/C[ÓO]DIGO VERIFICADOR/i,/P[ÁA]GINA\s+\d+/i,/ESTE [ÉE] O RELATO/i,
    /ERA O QUE (?:TINHA|HAVIA) A RELATAR/i,/USO DE ALGEMAS/i,/INTEGRIDADE F[ÍI]SICA/i,
    /ESTADO F[ÍI]SICO/i,/CIENTE DOS SEUS DIREITOS/i,/LEITURA DOS DIREITOS/i,
    /\bVTR\s*[-:]/i,/\bCMT\s*[-:]/i,/\bMOT\s*[-:]/i,/\bSEG\s*[-:]/i,
    /OFICIAL DE OPERA[CÇ][ÕO]ES/i,/COMANDANTE DA GUARNI[CÇ][ÃA]O/i
  ];

  const PADROES = {
    contexto: /AP[ÓO]S\s+(?:UM\s+)?(?:DESENTENDIMENTO|DISCUSS[AÃ]O|BRIGA)|EM RAZ[AÃ]O DE|POR CONTA DE|DEVIDO A|MOTIVAD[OA] POR|AP[ÓO]S SER PROVOCAD|POR CI[ÚU]ME|POR N[AÃ]O ACEITAR|DESCUMPRIMENTO DE MEDIDA/i,
    fato: /AGRED|AMEA[CÇ]|ARREMESS|DESFER|SUBTRAI|FURT|ROUB|INVADI|DANIFIC|QUEBROU|COLIDI|ATROPEL|DISPAR|ESFAQUE|GOLPE|EMPURR|CHUT|SOC|TENTOU MATAR|MATOU|ESTUPR|TRAFIC|VENDEU|PORTAVA|POSSU[IÍ]A|CONDUZIA|DIRIGIA|DESCUMPRI|DESACAT|PERTURB|LESION|APODEROU/i,
    meio: /FACA|FAC[AÃ]O|CANIVETE|ARMA DE FOGO|REV[ÓO]LVER|PISTOLA|ESPINGARDA|FUZIL|SIMULACRO|PEDRA|TIJOLO|CADEIRA|GARRAFA|PAU|CACETE|VE[ÍI]CULO|MOTOCICLETA|CARRO|OBJETO PERFURO|OBJETO CORTANTE/i,
    consequencia: /LES[AÃ]O|FERIMENTO|SANGRAMENTO|FRATURA|DANO|PREJU[ÍI]ZO|ATINGI|CAUSANDO|FALEC|MORTE|QUEIMAD|ESCORIA[CÇ][ÃA]O|HEMATOMA/i,
    statusAutor: /FUGIU|EVADIU|DEIXOU O LOCAL|DEIXOU A RESID[ÊE]NCIA|TOMOU DESTINO IGNORADO|N[AÃ]O FOI LOCALIZ|N[AÃ]O SENDO LOCALIZ|FOI LOCALIZAD|FOI PRESO|RECEBEU VOZ DE PRIS[AÃ]O/i,
    vitima: /V[ÍI]TIMA|LESIONAD|FERID|PRIMEIROS SOCORROS|ATENDIMENTO M[ÉE]DICO|PRONTO[- ]SOCORRO|HOSPITAL|UPA|SAMU|CURATIVO/i,
    desfecho: /CONDUZID|ENCAMINHAD|APRESENTAD|DELEGACIA|DISTRITO POLICIAL|DDIJ|DEAM|DICAP|APREENDID|RECUPERAD|RESTITU[IÍ]D|ORIENTAD|LIBERAD|REPRESENTAR|PROVID[ÊE]NCIAS CAB[ÍI]VEIS/i
  };

  function limparBruto(relato){
    return String(relato || '')
      .replace(/^\s*Senhor\(a\),?\s*/i,'')
      .replace(/^\s*Informo que\s*/i,'')
      .replace(/(?:Este [ée] o relato|Era o que tinha|Era o que havia|Diante dos fatos, era o que havia a relatar)\.?/gi,' ')
      .replace(/^\s*(?:VTR|CMT|MOT|SEG)\s*[-:].*$/gim,' ')
      .replace(/\s+/g,' ').trim();
  }

  function semRuido(frase){
    const f=String(frase||'').trim();
    return f.length>=10 && !RUIDO.some(r=>r.test(f));
  }

  function substituirIdentificacoes(frase){
    let f=String(frase||'');
    f=f.replace(/\[PESSOA ENVOLVIDA\]/gi,'');
    f=f.replace(/\b(?:Sr\.?|Sra\.?|Senhor|Senhora)\s*,?\s*/gi,'');
    f=f.replace(/\b(?:CEL|TEN CEL|MAJ|CAP|1[º°]?\s*TEN|2[º°]?\s*TEN|SUBTEN|1[º°]?\s*SGT|2[º°]?\s*SGT|3[º°]?\s*SGT|CB|SD)\s+(?:PM|BM)?\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]+){0,4}\b/g,'');
    f=f.replace(/\s{2,}/g,' ').replace(/\s+([,.;:])/g,'$1').trim();
    return f;
  }

  function abstrairAtores(frase){
    let f=substituirIdentificacoes(frase);
    f=f.replace(/\bo aluno\s*,?\s*de\s+(\d{1,2})\s+anos/gi,'um adolescente de $1 anos');
    f=f.replace(/\bo menor\s*,?\s*de\s+(\d{1,2})\s+anos/gi,'um adolescente de $1 anos');
    f=f.replace(/\b(?:o )?colega\s*,?\s*tamb[eé]m\s+de\s+(\d{1,2})\s+anos/gi,'outro aluno da mesma idade');
    f=f.replace(/\b(?:o )?colega\s*,?\s*de\s+(\d{1,2})\s+anos/gi,'outro aluno de $1 anos');
    f=f.replace(/\bo aluno\s+(?=,|que|ap[oó]s|permaneceu|foi|estava)/gi,'o autor');
    f=f.replace(/\bo menor\s+(?=,|que|ap[oó]s|permaneceu|foi|estava)/gi,'o autor');
    f=f.replace(/\ba solicitante\b/gi,'a vítima');
    f=f.replace(/\ba ofendida\b/gi,'a vítima');
    f=f.replace(/\bo referido indiv[ií]duo\b/gi,'o autor');
    f=f.replace(/\bo suspeito\b/gi,'o autor');
    f=f.replace(/\bo acusado\b/gi,'o autor');
    return f.replace(/\s{2,}/g,' ').trim();
  }

  function removerScaffolding(frase){
    let f=abstrairAtores(frase);
    f=f.replace(/^Conforme informa[cç][õo]es iniciais[^,]*,\s*/i,'');
    f=f.replace(/^Conforme relatado[^,]*,\s*/i,'');
    f=f.replace(/^Segundo (?:seu|o) relato,?\s*/i,'');
    f=f.replace(/^Ainda conforme informado[^,]*,\s*/i,'');
    f=f.replace(/^No local,?\s*(?:foi realizado contato[^,]*,?\s*)?/i,'');
    f=f.replace(/^Ao chegarmos ao local,?\s*/i,'');
    f=f.replace(/^Ap[oó]s a guarni[cç][aã]o tomar conhecimento dos fatos,?\s*/i,'');
    f=f.replace(/^Diante dos fatos,?\s*/i,'');
    f=f.replace(/^Informo que\s*/i,'');
    f=f.replace(/\ba fim de (?:receber [^,.]+ e )?adotar as medidas legais cab[ií]veis/gi,'para as providências cabíveis');
    f=f.replace(/\bpara conhecimento dos fatos e ado[cç][aã]o das provid[eê]ncias cab[ií]veis/gi,'para as providências cabíveis');
    return cap(f.replace(/\s{2,}/g,' ').trim());
  }

  function classificar(frase, indice){
    const n=norm(frase);
    const flags={};
    let total=0;
    for(const [papel,re] of Object.entries(PADROES)){
      flags[papel]=re.test(frase) || re.test(n);
      if(flags[papel]) total += ({contexto:2,fato:7,meio:3,consequencia:4,statusAutor:5,vitima:3,desfecho:6}[papel]||1);
    }
    if(/GUARNI[CÇ][ÃA]O.*ACIONAD|CENTRAL CICC|VIA CIOPS|SOLICITANTE/i.test(frase) && !flags.fato) total-=5;
    return {frase,indice,total,...flags};
  }

  function pontuarDuplicidade(a,b){
    const aa=new Set(norm(a).split(' ').filter(x=>x.length>4));
    const bb=new Set(norm(b).split(' ').filter(x=>x.length>4));
    if(!aa.size||!bb.size) return 0;
    let comum=0; aa.forEach(x=>{if(bb.has(x))comum++;});
    return comum/Math.min(aa.size,bb.size);
  }

  function selecionar(itens){
    const escolhidos=[];
    const incluir=(item)=>{
      if(!item || escolhidos.some(x=>x.indice===item.indice)) return;
      if(escolhidos.some(x=>pontuarDuplicidade(x.frase,item.frase)>.78)) return;
      escolhidos.push(item);
    };

    const principal=[...itens].filter(x=>x.fato).sort((a,b)=>b.total-a.total||a.indice-b.indice)[0]
      || [...itens].sort((a,b)=>b.total-a.total||a.indice-b.indice)[0];

    const contexto=[...itens].filter(x=>x.contexto && x.indice!==principal?.indice).sort((a,b)=>b.total-a.total||a.indice-b.indice)[0];
    incluir(contexto);
    incluir(principal);

    const complemento=[...itens].filter(x=>x.indice!==principal?.indice && (x.meio||x.consequencia) && (x.fato||x.total>=5))
      .sort((a,b)=>b.total-a.total||a.indice-b.indice)[0];
    incluir(complemento);

    incluir([...itens].filter(x=>x.statusAutor).sort((a,b)=>b.indice-a.indice)[0]);
    incluir([...itens].filter(x=>x.vitima && x.indice!==principal?.indice).sort((a,b)=>b.indice-a.indice)[0]);
    incluir([...itens].filter(x=>x.desfecho).sort((a,b)=>b.indice-a.indice)[0]);

    return escolhidos.sort((a,b)=>a.indice-b.indice);
  }

  function compactar(frase){
    let f=removerScaffolding(frase);
    f=f.replace(/,?\s*o qual exerce[^.]+/gi,'');
    f=f.replace(/,?\s*que acompanhou os procedimentos[^.]+/gi,'');
    f=f.replace(/,?\s*que permanecia acompanhando[^.]+/gi,'');
    f=f.replace(/,?\s*incluindo a apresenta[cç][aã]o/gi,', com apresentação');
    f=f.replace(/para avalia[cç][aã]o m[eé]dica especializada e verifica[cç][aã]o da necessidade de sutura no ferimento/gi,'para atendimento médico');
    f=f.replace(/na VTR do Corpo de Bombeiros/gi,'');
    f=f.replace(/juntamente com[^,.]+(?:,|\.)/gi,'');
    f=f.replace(/\s{2,}/g,' ').replace(/\s+([,.;:])/g,'$1').trim();
    if(f && !/[.!?]$/.test(f)) f+='.';
    return f;
  }

  function fundirSaidas(frases){
    const arr=frases.map(compactar).filter(Boolean);
    if(!arr.length) return '';

    let texto=arr.join(' ');
    texto=texto.replace(/A v[ií]tima recebeu primeiros atendimentos[^.]*\.\s*A v[ií]tima[^.]*foi (?:levada|encaminhada) ao ([^.]+)\./i,
      'A vítima recebeu primeiros socorros e foi levada ao $1.');
    texto=texto.replace(/O autor permaneceu acompanhado de sua (?:m[aã]e|respons[aá]vel)[^.]*\.\s*O autor[^.]*foi conduzido/i,
      'O autor, acompanhado de sua responsável, foi conduzido');
    texto=texto.replace(/\s{2,}/g,' ').trim();

    const sentencas=(texto.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[]).map(s=>s.trim()).filter(Boolean);
    const unicas=[];
    for(const s of sentencas){
      if(!unicas.some(u=>pontuarDuplicidade(u,s)>.8)) unicas.push(s);
    }
    return unicas.slice(0,4).join(' ');
  }

  function qualidadeResumo(texto, bruto){
    const t=String(texto||'').trim();
    if(!t) return -999;
    const n=norm(t);
    let score=0;
    const sentencas=(t.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[]).length;
    if(sentencas>=1 && sentencas<=4) score+=4;
    if(t.length>=80 && t.length<=520) score+=4;
    if(PADROES.fato.test(t)||PADROES.fato.test(n)) score+=7;
    if(PADROES.meio.test(t)||PADROES.meio.test(n)) score+=3;
    if(PADROES.consequencia.test(t)||PADROES.consequencia.test(n)) score+=3;
    if(PADROES.statusAutor.test(t)||PADROES.statusAutor.test(n)) score+=4;
    if(PADROES.desfecho.test(t)||PADROES.desfecho.test(n)) score+=5;
    if(PADROES.vitima.test(t)||PADROES.vitima.test(n)) score+=2;
    if(/GUARNI[CÇ][ÃA]O.*ACIONAD|VIA CIOPS|CENTRAL CICC|MANTIVEMOS CONTATO|FOI REALIZADO CONTATO/i.test(t)) score-=8;
    if(/OFICIAL DE OPERA[CÇ][ÕO]ES|DIRETOR DA ESCOLA|REPRESENTANTE DO COL[ÉE]GIO/i.test(t)) score-=5;
    if(/\[PESSOA ENVOLVIDA\]/i.test(t)) score-=5;
    if(/\b(?:CEL|MAJ|CAP|TEN|SGT|CB|SD)\b/i.test(t)) score-=4;
    if(bruto && t.length > bruto.length*.62) score-=6;
    if(t.length>700) score-=8;
    return score;
  }

  function higienizarResultado(resultado){
    return String(resultado||'')
      .replace(/\[PESSOA ENVOLVIDA\]/gi,'')
      .replace(/\s{2,}/g,' ')
      .replace(/\s+([,.;:])/g,'$1')
      .trim();
  }

  function resumoGeral(relato){
    const bruto=limparBruto(relato);
    if(!bruto) return '';

    const apoio = fallback ? higienizarResultado(fallback(bruto)) : '';
    const frases=(bruto.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[bruto])
      .map(x=>x.trim()).filter(semRuido);
    if(!frases.length) return apoio || bruto;

    const itens=frases.map((f,i)=>classificar(f,i)).filter(x=>x.total>0 || x.fato || x.desfecho || x.statusAutor);
    if(!itens.length) return apoio || bruto;

    const selecionados=selecionar(itens);
    const candidato=higienizarResultado(fundirSaidas(selecionados.map(x=>x.frase)));
    if(!candidato || candidato.length<35) return apoio || candidato || bruto;

    if(apoio){
      const qc=qualidadeResumo(candidato,bruto);
      const qa=qualidadeResumo(apoio,bruto);
      if(qa >= qc+2) return apoio;
    }
    return candidato;
  }

  try{
    if(typeof resumirRelatoPdf === 'function'){
      resumirRelatoPdf=resumoGeral;
      console.info('Resumo histórico v4 geral por papéis semânticos ativo.');
    }
  }catch(e){
    console.warn('Não foi possível ativar o resumo histórico v4:',e);
  }
})();
