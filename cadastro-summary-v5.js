(function(){
  'use strict';

  let fallbackAtual = typeof resumirRelatoPdf === 'function' ? resumirRelatoPdf : null;

  const normalizar = (valor) => String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

  const RUIDOS = [
    /IMPRESSO POR/i,
    /C[ÓO]DIGO VERIFICADOR/i,
    /P[ÁA]GINA\s+\d+/i,
    /ESTE [ÉE] O RELATO/i,
    /ERA O QUE (?:TINHA|HAVIA) A RELATAR/i,
    /NADA MAIS HAVIA A RELATAR/i,
    /USO DE ALGEMAS/i,
    /CIENTE DOS SEUS DIREITOS/i,
    /LEITURA DOS DIREITOS/i,
    /INTEGRIDADE F[ÍI]SICA/i,
    /ESTADO F[ÍI]SICO/i,
    /OFICIAL DE OPERA[CÇ][ÕO]ES/i,
    /COMANDANTE DA GUARNI[CÇ][ÃA]O/i,
    /^\s*(?:VTR|CMT|MOT|SEG)\s*[-:]/i
  ];

  const PADROES = {
    inicio: /(?:GUARNI[CÇ][ÃA]O|EQUIPE|POL[IÍ]CIA|VIATURA).{0,80}(?:ACIONAD|SOLICITAD|INFORMAD|DESLOC)|VIA\s+(?:CIOPS|CICC)|DURANTE\s+(?:PATRULHAMENTO|RONDA|POLICIAMENTO|ABORDAGEM|DILIG[ÊE]NCIA)|COMPARECEU\s+(?:AO|À|A)\s+(?:BATALH[AÃ]O|UNIDADE|BASE)|APRESENTOU-SE|DEPAROU-SE|FOI SOLICITADO|SOLICITOU APOIO|RECEBEU INFORMA[CÇ][ÃA]O/i,
    desenvolvimento: /RELATOU|INFORMOU|DECLAROU|CONSTATOU|VERIFICOU|IDENTIFICOU|LOCALIZOU|ABORDOU|REALIZOU|ENCONTROU|VISUALIZOU|APREENDEU|RECUPEROU|EFETUOU|DILIG[ÊE]NCIA|BUSCA|VISTORIA|AGRED|AMEA[CÇ]|SUBTRAI|FURT|ROUB|DANIFIC|PERTURB|DESACAT|TRAFIC|ENTORPEC|DROGA|ARMA|DISPAR|COLIDI|ATROPEL|ACIDENT|LESION|FUGIU|EVADIU|RESISTIU|DESCUMPRI|INVADI|APODEROU|CONDUZIA|DIRIGIA|SOCORR|SAMU/i,
    final: /CONDUZID|ENCAMINHAD|APRESENTAD|ENTREGUE|DELEGACIA|DISTRITO POLICIAL|DEAM|DDIJ|DICAP|HOSPITAL|HGR|UPA|PRONTO[- ]SOCORRO|RESTITU[IÍ]D|LIBERAD|ORIENTAD|FICOU SOB OS CUIDADOS|FICOU AOS CUIDADOS|FOI ENTREGUE|PROVID[ÊE]NCIAS|ENCERRAD|FINALIZAD|RETORNOU AO PATRULHAMENTO|PERMANECEU NO LOCAL|RECUSOU ATENDIMENTO/i,
    material: /ARMA|REV[ÓO]LVER|PISTOLA|ESPINGARDA|FUZIL|SIMULACRO|MUNI[CÇ][ÃA]O|CARTUCHO|ENTORPEC|MACONHA|COCA[IÍ]NA|CRACK|SKUNK|INV[ÓO]LUCRO|POR[CÇ][ÃA]O|TABLETE|TIJOLO|PAPELOTE|PINO|COMPRIMIDO|VE[IÍ]CULO|MOTOCICLETA|BICICLETA|CELULAR|OBJETO|DINHEIRO/i,
    consequencia: /LES[AÃ]O|FERIMENTO|SANGRAMENTO|FRATURA|ESCORIA[CÇ][ÃA]O|HEMATOMA|DANO|PREJU[IÍ]ZO|FALEC|MORTE|ATINGI|CAUSOU/i
  };

  function limparBruto(relato){
    return String(relato || '')
      .replace(/^\s*RESUMO\s*:\s*/i, '')
      .replace(/^\s*Senhor\(a\),?\s*/i, '')
      .replace(/^\s*Informo que\s*/i, '')
      .replace(/(?:Este [ée] o relato|Era o que tinha|Era o que havia|Diante dos fatos, era o que havia a relatar)\.?/gi, ' ')
      .replace(/^\s*(?:VTR|CMT|MOT|SEG)\s*[-:].*$/gim, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function limparFrase(frase){
    let f = String(frase || '').replace(/\s+/g, ' ').trim();
    f = f
      .replace(/^Informo que\s+/i, '')
      .replace(/^Segundo (?:seu|o) relato,?\s*/i, '')
      .replace(/^Ainda conforme informado[^,]*,?\s*/i, '')
      .replace(/^Conforme relatado[^,]*,?\s*/i, '')
      .replace(/\b(?:CPF|RG|CNH)\s*[:º°-]?\s*[A-Z0-9.\/-]+/gi, '')
      .replace(/\b(?:telefone|celular)\s*[:º°-]?\s*\(?\d{2}\)?[\d\s-]{8,}/gi, '')
      .replace(/\s+([,.;:])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if(f && !/[.!?]$/.test(f)) f += '.';
    return f;
  }

  function segmentar(texto){
    let preparado = String(texto || '')
      .replace(/\s*;\s*/g, '. ')
      .replace(/\s+(?=(?:NO LOCAL|EM SEGUIDA|POSTERIORMENTE|LOGO AP[ÓO]S|AO FINAL|DIANTE DOS FATOS|AP[ÓO]S ISSO|DURANTE AS DILIG[ÊE]NCIAS)\b)/gi, '. ');

    let frases = (preparado.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [preparado])
      .map(x => x.trim())
      .filter(Boolean);

    if(frases.length === 1 && preparado.length > 550){
      frases = preparado
        .split(/\s+(?=(?:NO LOCAL|EM SEGUIDA|POSTERIORMENTE|AO FINAL|DIANTE DOS FATOS|AP[ÓO]S|DURANTE)\b)/i)
        .map(x => x.trim())
        .filter(Boolean);
    }
    return frases;
  }

  function ehRuido(frase){
    return !frase || frase.length < 8 || RUIDOS.some(re => re.test(frase));
  }

  function classificar(frase, indice){
    const texto = limparFrase(frase);
    const n = normalizar(texto);
    const inicio = PADROES.inicio.test(texto) || PADROES.inicio.test(n);
    const final = PADROES.final.test(texto) || PADROES.final.test(n);
    const desenvolvimento = PADROES.desenvolvimento.test(texto) || PADROES.desenvolvimento.test(n);
    const material = PADROES.material.test(texto) || PADROES.material.test(n);
    const consequencia = PADROES.consequencia.test(texto) || PADROES.consequencia.test(n);
    let score = 0;
    if(inicio) score += 4;
    if(desenvolvimento) score += 6;
    if(material) score += 3;
    if(consequencia) score += 3;
    if(final) score += 6;
    if(texto.length >= 35 && texto.length <= 280) score += 2;
    return {indice, texto, inicio, desenvolvimento, material, consequencia, final, score};
  }

  function similaridade(a,b){
    const aa = new Set(normalizar(a).split(' ').filter(x => x.length > 4));
    const bb = new Set(normalizar(b).split(' ').filter(x => x.length > 4));
    if(!aa.size || !bb.size) return 0;
    let iguais = 0;
    aa.forEach(x => { if(bb.has(x)) iguais++; });
    return iguais / Math.min(aa.size, bb.size);
  }

  function limiteFrases(tamanho){
    if(tamanho <= 320) return 3;
    if(tamanho <= 900) return 5;
    return 7;
  }

  function escolherInicio(itens){
    return itens.find(x => x.inicio) || itens[0] || null;
  }

  function escolherFinal(itens, inicio){
    const finais = itens.filter(x => x.final && x.indice !== inicio?.indice);
    if(finais.length) return finais[finais.length - 1];
    if(itens.length > 1) return itens[itens.length - 1];
    return null;
  }

  function escolherDesenvolvimento(itens, inicio, fim, limite){
    const disponiveis = itens.filter(x => x.indice !== inicio?.indice && x.indice !== fim?.indice);
    const relevantes = disponiveis
      .filter(x => x.desenvolvimento || x.material || x.consequencia || x.score >= 4)
      .sort((a,b) => b.score - a.score || a.indice - b.indice);

    const quantidade = Math.max(0, limite - (inicio ? 1 : 0) - (fim ? 1 : 0));
    const selecionados = [];
    for(const item of relevantes){
      if(selecionados.length >= quantidade) break;
      if(selecionados.some(x => similaridade(x.texto, item.texto) > .82)) continue;
      selecionados.push(item);
    }

    if(!selecionados.length && quantidade > 0 && disponiveis.length){
      selecionados.push(...disponiveis.slice(0, quantidade));
    }
    return selecionados.sort((a,b) => a.indice - b.indice);
  }

  function montarResumoExtrativo(bruto){
    const frases = segmentar(bruto).filter(f => !ehRuido(f));
    if(!frases.length) return '';

    const itens = frases.map(classificar);
    const limite = Math.min(limiteFrases(bruto.length), itens.length);
    const inicio = escolherInicio(itens);
    const fim = escolherFinal(itens, inicio);
    const meio = escolherDesenvolvimento(itens, inicio, fim, limite);

    // A organização final é semântica: início -> desenvolvimento -> desfecho.
    // Assim, mesmo um histórico escrito fora de ordem é apresentado na ordem operacional correta.
    const escolhidos = [];
    if(inicio) escolhidos.push(inicio);
    meio.forEach(x => {
      if(!escolhidos.some(y => y.indice === x.indice || similaridade(y.texto,x.texto) > .86)) escolhidos.push(x);
    });
    if(fim && !escolhidos.some(y => y.indice === fim.indice || similaridade(y.texto,fim.texto) > .86)) escolhidos.push(fim);

    return escolhidos.map(x => x.texto).join(' ').replace(/\s+/g,' ').trim();
  }

  function validarCandidato(candidato, bruto){
    const c = String(candidato || '').trim();
    if(!c) return false;
    if(c.length < 20) return false;
    if(/\b(?:INVENTADO|N[ÃA]O INFORMADO PELO RELATO)\b/i.test(c)) return false;
    // Evita aceitar como resumo um texto maior que o próprio histórico, salvo relatos muito curtos.
    if(bruto.length > 180 && c.length > bruto.length * 1.08) return false;
    return true;
  }

  function resumoCronologicoUniversal(relato){
    const bruto = limparBruto(relato);
    if(!bruto) return '';

    let extrativo = montarResumoExtrativo(bruto);
    let apoio = '';
    try {
      if(fallbackAtual && fallbackAtual !== resumoCronologicoUniversal){
        apoio = String(fallbackAtual(bruto) || '').trim();
      }
    } catch (_) {
      apoio = '';
    }

    let resultado = validarCandidato(extrativo, bruto) ? extrativo : (validarCandidato(apoio, bruto) ? apoio : limparFrase(bruto));

    // Se o extrativo ficou excessivamente curto e a versão anterior contém mais fatos,
    // usa a versão anterior apenas como fallback; nenhuma informação nova é acrescentada aqui.
    if(validarCandidato(apoio, bruto) && resultado.length < Math.min(140, bruto.length * .35) && apoio.length > resultado.length){
      resultado = apoio;
    }

    resultado = String(resultado || '')
      .replace(/\s+/g,' ')
      .replace(/\s+([,.;:])/g,'$1')
      .trim();

    // Regra institucional obrigatória: todo resumo final é gravado em caixa alta.
    return resultado.toLocaleUpperCase('pt-BR');
  }

  function instalar(){
    try {
      if(typeof resumirRelatoPdf === 'function' && resumirRelatoPdf !== resumoCronologicoUniversal){
        fallbackAtual = resumirRelatoPdf;
      }
      resumirRelatoPdf = resumoCronologicoUniversal;
      window.melhorarResumoHistorico = resumoCronologicoUniversal;
      console.info('Resumo histórico v5 cronológico universal e em caixa alta ativo.');
    } catch (e) {
      console.warn('Não foi possível ativar o resumo histórico v5:', e);
    }
  }

  instalar();
  // O v4 é carregado dinamicamente pelo v3. Reinstala o v5 após esse carregamento
  // para garantir que esta seja sempre a camada final usada pelo importador de PDF.
  setTimeout(instalar, 100);
  setTimeout(instalar, 500);
  setTimeout(instalar, 1500);
  window.addEventListener('load', instalar, {once:true});
})();
