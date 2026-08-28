(function(){
  'use strict';

  const normalizar = (valor) => String(valor || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toUpperCase().replace(/\s+/g,' ').trim();

  function capitalizarInicio(texto){
    const t = String(texto || '').trim();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
  }

  function limparFraseV2(frase){
    let f = String(frase || '').replace(/\s+/g,' ').trim();
    f = f.replace(/^RESUMO:\s*/i,'');
    f = f.replace(/^Informo que esta guarni[cç][aã]o foi acionada via CIOPS para atendimento de ocorr[eê]ncia de\s+/i,'');
    f = f.replace(/^Informo que esta guarni[cç][aã]o foi acionada(?: via CIOPS)?\s*/i,'');
    f = f.replace(/^Segundo seu relato,\s*/i,'');
    f = f.replace(/^Ainda conforme informado pela v[ií]tima,\s*/i,'');
    f = f.replace(/^Conforme informado pela v[ií]tima,\s*/i,'');

    // Evita nomes próprios no resumo quando o próprio relato usa fórmulas usuais de identificação.
    f = f.replace(/^No local, foi realizado contato com a senhora [^,.;]{2,80}, a qual relatou/i,'A vítima relatou');
    f = f.replace(/^A senhora [^,.;]{2,80} manifestou interesse/i,'A vítima manifestou interesse');
    f = f.replace(/por seu ex-marido,\s*o senhor,?\s*[^.]+\.?$/i,'pelo ex-marido.');
    f = f.replace(/por seu companheiro,\s*o senhor,?\s*[^.]+\.?$/i,'pelo companheiro.');
    f = f.replace(/ao referido indiv[ií]duo/gi,'ao autor');
    f = f.replace(/o referido indiv[ií]duo/gi,'o autor');
    f = f.replace(/,\s*este teria/gi,', o autor teria');

    // Encurta fórmulas administrativas sem apagar o conteúdo operacional.
    f = f.replace(/ap[oó]s a realiza[cç][aã]o da liga[cç][aã]o para a Pol[ií]cia Militar/gi,'após o acionamento da Polícia Militar');
    f = f.replace(/o autor deixou a resid[eê]ncia,\s*tomando destino ignorado,\s*n[aã]o sendo localizado pela guarni[cç][aã]o nas imedia[cç][oõ]es/gi,'o autor deixou a residência e não foi localizado nas imediações');
    f = f.replace(/o autor deixou o local,\s*tomando destino ignorado,\s*n[aã]o sendo localizado pela guarni[cç][aã]o nas imedia[cç][oõ]es/gi,'o autor deixou o local e não foi localizado nas imediações');
    f = f.replace(/a fim de receber a assist[eê]ncia necess[aá]ria e adotar as medidas legais cab[ií]veis/gi,'para as providências cabíveis');
    f = f.replace(/a fim de serem adotadas? as medidas legais cab[ií]veis/gi,'para as providências cabíveis');
    f = f.replace(/foi conduzida a esta Delegacia de Pol[ií]cia/gi,'foi conduzida à Delegacia de Polícia');
    f = f.replace(/foi conduzido a esta Delegacia de Pol[ií]cia/gi,'foi conduzido à Delegacia de Polícia');

    f = f.replace(/\b(?:CPF|RG|CNH)\s*[:º°-]?\s*[A-Z0-9.\/-]+/gi,'');
    f = f.replace(/\b(?:telefone|celular)\s*[:º°-]?\s*\(?\d{2}\)?[\d\s-]{8,}/gi,'');
    f = f.replace(/\s+([,.;:])/g,'$1').replace(/\s{2,}/g,' ').trim();
    return capitalizarInicio(f);
  }

  const RUIDOS = [
    /USO DE ALGEMAS/i,/ESTADO F[ÍI]SICO/i,/INTEGRIDADE F[ÍI]SICA/i,
    /NADA MAIS HAVIA A RELATAR/i,/ERA O QUE (?:TINHA|HAVIA) A RELATAR/i,
    /IMPRESSO POR/i,/C[ÓO]DIGO VERIFICADOR/i,/CIENTE DOS SEUS DIREITOS/i,
    /LEITURA DOS DIREITOS/i,/DIREITO CONSTITUCIONAL/i,/FOI CONFECCIONADO/i,
    /FOI LAVRADO/i,/FOI PREENCHIDO/i
  ];

  function classificar(original, frase){
    const n = normalizar(frase);
    const o = normalizar(original);
    return {
      fato: /AGRED|AMEAC|SUBTRAI|FURT|ROUB|INVADI|DANIFIC|LESION|DESCUMPR|TRAFIC|DROGA|ENTORPEC|DISPAR|COLIDI|ACIDENT|DESACAT|PERTURB|TENTOU MATAR|MAT[AÁ]-L|VIOLENCIA/.test(n),
      meio: /FACA|FACAO|CANIVETE|ARMA|REVOLVER|PISTOLA|ESPINGARDA|FUZIL|SIMULACRO|PEDRA|TIJOLO|PAU|CACETE|GARRAFA|VEICULO|OBJETO PERFURO|OBJETO CORTANTE/.test(n),
      motivo: /APOS INFORMAR|APOS DISCUS|APOS DESENTEND|POR CIUME|DEVIDO|EM RAZAO|POR NAO ACEIT|POR CONTA|PORQUE|EM VIRTUDE|DESCUMPRIMENTO DE MEDIDA|APOS SER SOLICITADO/.test(n),
      statusAutor: /DEIXOU A RESIDENCIA|DEIXOU O LOCAL|NAO FOI LOCALIZ|NAO LOCALIZADO|EVADIU|FUGIU|TOMOU DESTINO IGNORADO/.test(n),
      desfecho: /CONDUZID|ENCAMINHAD|APRESENTAD|DELEGACIA|DISTRITO POLICIAL|MANIFESTOU INTERESSE EM REPRESENTAR|APREENDID|RECUPERAD|RESTITUID|ORIENTAD|PRESO|PRISAO/.test(n),
      acionamento: /GUARNICAO.*ACIONAD|ACIONADA VIA CIOPS|ATENDIMENTO DE OCORRENCIA/.test(o),
      ruido: RUIDOS.some(re => re.test(original))
    };
  }

  function pontuacaoFato(item){
    return (item.fato ? 6 : 0) + (item.meio ? 4 : 0) + (item.motivo ? 2 : 0) +
      (item.statusAutor ? 1 : 0) - (item.acionamento ? 6 : 0) - (item.ruido ? 10 : 0);
  }

  function resumoRelatoV2(relato){
    let bruto = String(relato || '')
      .replace(/^\s*(?:VTR|CMT|MOT|SEG)\s*-?.*$/gim,' ')
      .replace(/(?:Este [ée] o relato|Era o que tinha|Era o que havia|Diante dos fatos, era o que havia) a relatar?\.?/gi,' ')
      .replace(/Este [ée] o relato\.?/gi,' ')
      .replace(/\s+/g,' ')
      .trim();
    if(!bruto) return '';

    const originais = (bruto.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [bruto])
      .map(x => x.trim()).filter(Boolean);

    const itens = originais.map((original, indice) => {
      const frase = limparFraseV2(original);
      return { original, frase, indice, ...classificar(original, frase) };
    }).filter(item => item.frase.length >= 12 && !item.ruido);

    if(!itens.length) return limparFraseV2(bruto);

    const principal = [...itens]
      .filter(x => x.fato && !x.acionamento)
      .sort((a,b) => pontuacaoFato(b) - pontuacaoFato(a) || a.indice - b.indice)[0]
      || itens.find(x => x.fato)
      || itens[0];

    // Segundo fato relevante: preserva arma/meio, causa ou uma segunda conduta importante.
    const complemento = [...itens]
      .filter(x => x.indice !== principal?.indice && !x.acionamento && (x.meio || x.motivo || x.fato))
      .sort((a,b) => pontuacaoFato(b) - pontuacaoFato(a) || a.indice - b.indice)[0];

    // A situação do autor é tratada como informação obrigatória quando estiver no relato.
    const statusAutor = [...itens]
      .filter(x => x.statusAutor)
      .sort((a,b) => b.indice - a.indice)[0];

    // O desfecho policial/jurídico também é obrigatório quando informado.
    const desfecho = [...itens]
      .filter(x => x.desfecho)
      .sort((a,b) => b.indice - a.indice)[0];

    const escolhidos = [];
    [principal, complemento, statusAutor, desfecho].forEach(item => {
      if(item && !escolhidos.some(x => x.indice === item.indice)) escolhidos.push(item);
    });
    escolhidos.sort((a,b) => a.indice - b.indice);

    // Não corta frases por número de caracteres. Uma informação essencial deve permanecer inteira.
    let resultado = escolhidos.map(x => x.frase).join(' ').replace(/\s+/g,' ').trim();

    // Evita repetição textual muito evidente sem sacrificar conteúdo essencial.
    resultado = resultado
      .replace(/A v[ií]tima relatou ter sido ameaçada[^.]+\.\s+A v[ií]tima relatou ter sido ameaçada/gi, 'A vítima relatou ter sido ameaçada')
      .replace(/\s{2,}/g,' ')
      .trim();

    return resultado;
  }

  try {
    if(typeof resumirRelatoPdf === 'function') {
      resumirRelatoPdf = resumoRelatoV2;
      console.info('Resumo histórico v2 ativo.');
    }
  } catch (e) {
    console.warn('Não foi possível ativar o resumo histórico v2:', e);
  }
})();
