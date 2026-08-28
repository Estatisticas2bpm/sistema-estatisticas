(function(){
  'use strict';

  const resumoAnterior = typeof resumirRelatoPdf === 'function' ? resumirRelatoPdf : null;
  const norm = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
  const textoLimpo = (v) => String(v || '').replace(/\s+/g,' ').trim();

  function idadesAdolescentes(texto){
    return [...String(texto || '').matchAll(/\b(?:tamb[eé]m\s+)?de\s+(\d{1,2})\s+anos\b/gi)]
      .map(m=>Number(m[1]))
      .filter(n=>n>=10 && n<=17);
  }

  function destinoSaude(texto){
    return /PRONTO[- ]SOCORRO|HOSPITAL|UPA|UNIDADE DE SA[ÚU]DE/i.test(texto);
  }

  function resumoAgressaoEscolar(relato){
    const n = norm(relato);
    if(!/(COLEGIO|ESCOLA|SALA DE AULA|UNIDADE ESCOLAR)/.test(n)) return null;
    if(!/(BRIGA|AGRESS|LESAO|ARREMESS|CADEIRA|SOCO|CHUTE|EMPURR)/.test(n)) return null;

    const idades = idadesAdolescentes(relato);
    const idadeAutor = idades[0] || null;
    const idadeVitima = idades[1] || idadeAutor;
    const mesmaIdade = idadeAutor && idadeVitima && idadeAutor === idadeVitima;

    let contexto = 'Após desentendimento em ambiente escolar';
    if(/SALA DE AULA|INTERIOR DA SALA/i.test(relato)) contexto = 'Após desentendimento em sala de aula';

    let autor = 'um aluno';
    if(idadeAutor) autor = `um adolescente de ${idadeAutor} anos`;

    let vitima = 'outro aluno';
    if(mesmaIdade) vitima = 'outro aluno da mesma idade';
    else if(idadeVitima) vitima = `outro aluno de ${idadeVitima} anos`;

    let acao = '';
    if(/ARREMESS(?:OU|ANDO)[^.!?]{0,100}?CADEIRA/i.test(relato)) {
      acao = `${autor} arremessou uma cadeira contra ${vitima}`;
    } else if(/DESFER(?:IU|INDO)[^.!?]{0,80}?SOCO/i.test(relato)) {
      acao = `${autor} desferiu socos contra ${vitima}`;
    } else if(/AGRED(?:IU|INDO|IDO)/i.test(relato)) {
      acao = `${autor} agrediu ${vitima}`;
    } else {
      acao = `${autor} entrou em confronto físico com ${vitima}`;
    }

    let consequencia = '';
    if(/REGI[AÃ]O DA CABE[CÇ]A|ATINGINDO-O NA CABE[CÇ]A|ATINGIU[^.!?]{0,60}?CABE[CÇ]A/i.test(relato)) consequencia = 'atingindo-o na cabeça';
    else if(/LES[AÃ]O[^.!?]{0,80}?CABE[CÇ]A/i.test(relato)) consequencia = 'causando lesão na cabeça';
    else if(/LES[AÃ]O|FERIMENTO/i.test(relato)) consequencia = 'causando lesão';

    let primeira = `${contexto}, ${acao}`;
    if(consequencia) primeira += `, ${consequencia}`;
    primeira += '.';

    const desfechos = [];
    if(/PRIMEIR(?:OS|O) (?:ATENDIMENTO|SOCORRO)|CURATIVO/i.test(relato)) desfechos.push('A vítima recebeu primeiros socorros');
    if(destinoSaude(relato)) {
      if(desfechos.length) desfechos[0] += ' e foi levada ao pronto-socorro';
      else desfechos.push('A vítima foi levada ao pronto-socorro');
    }

    const foiDdij = /DELEGACIA DA INF[AÂ]NCIA E JUVENTUDE|\bDDIJ\b/i.test(relato);
    const autorConduzido = /(?:MENOR|ALUNO|ADOLESCENTE)[^.!?]{0,220}?CONDUZID[OA]S?[^.!?]{0,160}?(?:DELEGACIA DA INF[AÂ]NCIA E JUVENTUDE|DDIJ)/i.test(relato)
      || /CONDUZID[OA]S?[^.!?]{0,200}?(?:DELEGACIA DA INF[AÂ]NCIA E JUVENTUDE|DDIJ)/i.test(relato);
    const responsavelJunto = /ACOMPANHAD[OA] DE (?:SUA|SEU) (?:M[AÃ]E|PAI|RESPONS[AÁ]VEL)|ACOMPANHAD[OA] DE SUA RESPONS[AÁ]VEL|RESPONS[AÁ]VEL LEGAL/i.test(relato);

    if(autorConduzido && foiDdij) {
      if(responsavelJunto) desfechos.push('o autor e sua responsável foram conduzidos à DDIJ');
      else desfechos.push('o autor foi conduzido à DDIJ');
    }

    let segunda = '';
    if(desfechos.length){
      segunda = desfechos[0];
      if(desfechos.length > 1) segunda += `, enquanto ${desfechos.slice(1).join(' e ')}`;
      segunda += '.';
    }

    return `${primeira}${segunda ? ' '+segunda : ''}`;
  }

  function resumoViolenciaDomestica(relato){
    const n = norm(relato);
    if(!/(VIOLENCIA DOMESTICA|COMPANHEIR|EX-MARID|EX MARID|EX-COMPANHEIR)/.test(n)) return null;
    if(!/(AMEAC|AGRED|LESION|FACA|ARMA)/.test(n)) return null;

    const fatos = [];
    if(/AGRED/.test(n) && /AMEAC/.test(n)) fatos.push('A vítima relatou ter sido agredida e ameaçada');
    else if(/AGRED/.test(n)) fatos.push('A vítima relatou ter sido agredida');
    else if(/AMEAC/.test(n)) fatos.push('A vítima relatou ter sido ameaçada');

    if(/AMEAC.*(?:MATAR|MORTE)|PROFERI.*AMEAC.*MORTE/.test(n)) {
      fatos[0] = fatos[0]?.replace('ameaçada','ameaçada de morte') || 'A vítima relatou ter sido ameaçada de morte';
    }

    if(/FACA/.test(n)) fatos.push('o autor utilizou ou se apoderou de uma faca durante a ameaça');
    else if(/ARMA DE FOGO|REVOLVER|PISTOLA/.test(n)) fatos.push('o autor estava de posse de arma de fogo');

    let primeira = fatos.length ? fatos[0] : 'Foi relatada ocorrência de violência doméstica';
    if(fatos[1]) primeira += `, sendo que ${fatos[1]}`;
    primeira += '.';

    const partes = [];
    if(/DEIXOU A RESIDENCIA|DEIXOU O LOCAL|EVADIU|FUGIU/.test(n)) {
      partes.push(/NAO FOI LOCALIZ|NAO SENDO LOCALIZ/.test(n) ? 'Antes da chegada ou abordagem policial, o autor deixou o local e não foi localizado nas imediações' : 'O autor deixou o local antes da abordagem policial');
    } else if(/NAO FOI LOCALIZ|NAO SENDO LOCALIZ/.test(n)) partes.push('O autor não foi localizado');

    if(/MANIFESTOU INTERESSE EM REPRESENTAR/.test(n)) partes.push('a vítima manifestou interesse em representar');
    if(/CONDUZID[AAO].{0,80}DELEGACIA|ENCAMINHAD[AAO].{0,80}DELEGACIA/.test(n)) partes.push('foi conduzida à Delegacia de Polícia para as providências cabíveis');

    let segunda = '';
    if(partes.length){
      segunda = partes[0];
      if(partes.length > 1) segunda += `; ${partes.slice(1).join(' e ')}`;
      segunda += '.';
    }
    return `${primeira}${segunda ? ' '+segunda : ''}`;
  }

  function resumoSemantico(relato){
    const bruto = textoLimpo(relato)
      .replace(/^Senhor\(a\),?\s*/i,'')
      .replace(/^Informo que\s*/i,'')
      .replace(/\b(?:VTR|CMT|MOT|SEG)\s*-?[^.!?]*$/gim,' ')
      .trim();
    if(!bruto) return '';

    const especializado = resumoAgressaoEscolar(bruto) || resumoViolenciaDomestica(bruto);
    if(especializado) return especializado.replace(/\s+/g,' ').trim();

    return resumoAnterior ? resumoAnterior(bruto) : bruto;
  }

  try {
    if(typeof resumirRelatoPdf === 'function') {
      resumirRelatoPdf = resumoSemantico;
      console.info('Resumo histórico v3 semântico ativo.');
    }
  } catch (e) {
    console.warn('Não foi possível ativar o resumo histórico v3:', e);
  }
})();
