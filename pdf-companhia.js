/* Extração documental conservadora da CIA informada em "Unidade de Apuração".
 * Não interpreta área territorial, unidade que atendeu, logradouro ou histórico.
 * Uso local no navegador; não envia texto do PDF a serviços externos.
 */
(function(global){
  'use strict';
  function extrair(texto){
    const fonte=String(texto||'');
    const cabecalho=fonte.split(/\b(?:RELATO\/HIST[ÓO]RICO|HIST[ÓO]RICO DOS FATOS|NARRATIVA DOS FATOS)\b/i)[0].slice(0,18000);
    const marcador=/\bUnidade\s+de\s+Apura[çc][ãa]o\s*:?\s*/gi;
    const candidatos=[],fontes=[];
    let m;
    while((m=marcador.exec(cabecalho))){
      if(fontes.length>=15)break;
      // PDF.js pode colocar o rótulo e o valor na mesma linha ou em linhas distintas.
      const prox=cabecalho.slice(marcador.lastIndex,marcador.lastIndex+220);
      const linhas=prox.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
      if(!linhas.length)continue;
      let valor=linhas[0];
      // Se a primeira linha for só um prefixo institucional, permitir a linha seguinte.
      if(linhas[1]&&(/^(?:POL[ÍI]CIA MILITAR(?: DE RORAIMA)?|PMRR|PM\/RR|PM)$/i.test(valor)||!/(?:CIA|COMPANHIA)\b/i.test(valor)))
        valor+=' '+linhas[1];
      valor=valor.split(/\b(?:Data\/Hora|Data do Fato|Local do Fato|Natureza|Meio\(s\)|Envolvido\(s\)|Registrado em|Unidade de Atendimento|Unidade de Registro|N[º°]\s*BO|BOLETIM DE OCORR[ÊE]NCIA)\b/i)[0]
        .replace(/\s+/g,' ').trim().slice(0,180);
      if(!valor)continue;
      fontes.push(valor);
      const comp=[];
      const padraoNumero=/(?:^|[^a-z\d])([1-9]\d?)\s*[ªº°aA]?\s*(?:CIA\.?|COMPANHIA)\b/gi;
      const padraoReverso=/\b(?:CIA\.?|COMPANHIA)\s*(?:N[º°]\s*)?([1-9]\d?)\b/gi;
      for(const re of [padraoNumero,padraoReverso]){
        let hit;
        while((hit=re.exec(valor)))comp.push(Number(hit[1]));
      }
      const nums=[...new Set(comp)];
      if(nums.length>1)return {companhia:'',unidadeApuracao:valor,ambigua:true};
      if(nums.length===1)candidatos.push(nums[0]);
    }
    const diferentes=[...new Set(candidatos)];
    return {
      companhia:diferentes.length===1?diferentes[0]+'ª CIA':'',
      unidadeApuracao:fontes[0]||'',
      ambigua:diferentes.length>1
    };
  }
  global.PdfCompanhia=Object.freeze({extrair});
})(window);
