/* PPe — leitura conservadora da seção Natureza; sem análise do relato ou de pessoas. */
(function(root){
'use strict';
const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
function extrair(texto){
 const t=String(texto||'').replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ');
 // A tabela tem cabeçalho conhecido. Sem delimitador final, a extração é descartada.
 const h=/(?:^|\n)[ \t]*Natureza[ \t\n]+Meio\(s\)[ \t\n]+Empregado\(s\)[ \t]*(?:\n|(?=\d{1,9}\s*:))/i.exec(t);
 if(!h)return [];
 const resto=t.slice(h.index+h[0].length);
 const fim=/(?:^|\n)[ \t]*(?:ENVOLVIDO\(S\)|ENVOLVIDOS|DADOS DOS ENVOLVIDOS|OBJETO\(S\)|RELATO\s*\/\s*HIST[ÓO]RICO|HIST[ÓO]RICO)[ \t]*(?:\n|$|:)/i.exec(resto);
 if(!fim||fim.index>12000)return [];
 const bloco=resto.slice(0,fim.index);
 // Códigos somente no início da linha, conforme o texto do PDF.js.
 const matches=[...bloco.matchAll(/^[ \t]*(\d{1,9})[ \t]*:[ \t]*/gm)];
 if(!matches.length||matches.length>30)return [];
 const rows=[];
 for(let i=0;i<matches.length;i++){
  const m=matches[i],raw=bloco.slice(m.index+m[0].length,i+1<matches.length?matches[i+1].index:bloco.length);
  // A coluna de meios empregados frequentemente contém "Não Houve".
  // Outros valores não reconhecidos tornam a linha ambígua: não catalogar.
  const partes=raw.split('\n').map(x=>x.trim()).filter(Boolean);
  const limpar=x=>x.replace(/\s+(?:N[ÃA]O HOUVE|N[ÃA]O INFORMADO|SEM MEIO EMPREGADO)\s*$/i,'').trim();
  const linhas=partes.filter(x=>!/^(?:N[ÃA]O HOUVE|N[ÃA]O INFORMADO|SEM MEIO EMPREGADO)$/i.test(x)).map(limpar);
  const descricao=norm(linhas.join(' '));
  if(descricao.length<3||descricao.length>320||!/[A-ZÀ-Ú]{3}/i.test(descricao))continue;
  if(/(?:CPF|RG|MATR[IÍ]CULA|DATA DE NASCIMENTO|NOME COMPLETO|ENDERE[ÇC]O|TELEFONE)\s*[:\-]/i.test(descricao)||/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(descricao))continue;
  // O fundamento fica separado, sem apagar a nomenclatura integral.
  const legal=descricao.match(/\(([^()]*(?:ART(?:IGO)?\.?\s*\d|LEI\s+(?:N[º°.]?\s*)?\d|DECRETO\s+\d|C[ÓO]DIGO\s+PENAL)[^()]*)\)\s*$/i);
  rows.push({codigo_ppe:m[1],descricao_original:descricao,fundamentacao_legal:legal?legal[1].trim():null});
 }
 return rows.filter((x,i,a)=>a.findIndex(y=>y.codigo_ppe===x.codigo_ppe&&y.descricao_original===x.descricao_original&&y.fundamentacao_legal===x.fundamentacao_legal)===i);
}
root.PpeNaturezas=Object.freeze({extrair});
})(typeof window!=='undefined'?window:globalThis);