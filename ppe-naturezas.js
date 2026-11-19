/* Natureza e meios empregados são colunas independentes do documento. */
(function(root){
'use strict';
const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
const limite=/^(?:MOTIVA[ÇC][ÃA]O|ENVOLVIDO\(S\)|ENVOLVIDOS|DADOS DOS ENVOLVIDOS|OBJETO\(S\)|RELATO\s*\/\s*HIST[ÓO]RICO|HIST[ÓO]RICO)\s*:?\s*$/i;
const header=/^Natureza\s+Meio\(s\)\s+Empregado\(s\)$/i;
const codigo=/^(\d{1,9})\s*:\s*(.*)$/;
const meiosConhecidos=/^(?:N[ÃA]O HOUVE|N[ÃA]O INFORMADO|SEM MEIO EMPREGADO|ARMA BRANCA|ARMA DE FOGO|VE[IÍ]CULO|OUTRO\(S\)|FOR[ÇC]A F[IÍ]SICA)$/i;
function linhaNatureza(cod,partes,meios){
 const descricao=norm(partes.join(' '));
 if(!/^[0-9]{1,9}$/.test(cod)||descricao.length<3||descricao.length>320||!/[A-ZÀ-Ú]{3}/i.test(descricao))return null;
 if(/(?:CPF|RG|MATR[IÍ]CULA|DATA DE NASCIMENTO|NOME COMPLETO|ENDERE[ÇC]O|TELEFONE)\s*[:\-]/i.test(descricao)||/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(descricao))return null;
 const legal=[...descricao.matchAll(/\(([^()]*(?:ART(?:IGO)?\.?\s*\d|LEI\s+(?:N[º°.]?\s*)?\d|DECRETO[- ]LEI\s+\d|DECRETO\s+\d|C[ÓO]DIGO\s+PENAL)[^()]*)\)/gi)].map(x=>x[1].trim()).join(' | ');
 const m=[...new Set(meios.map(norm).filter(Boolean))];
 return {codigo_ppe:cod,descricao_original:descricao,fundamentacao_legal:legal&&legal.length<=300?legal:null,meios_empregados:m.every(x=>x.length<=160)&&m.length<=20?m:[]};
}
function unir(rows){
 const m=new Map();
 for(const r of rows.filter(Boolean)){
  const k=JSON.stringify([r.codigo_ppe,r.descricao_original,r.fundamentacao_legal]);
  if(m.has(k))m.get(k).meios_empregados=[...new Set([...m.get(k).meios_empregados,...r.meios_empregados])];
  else m.set(k,r);
 }
 return [...m.values()].slice(0,30);
}
// Sem coordenadas, só é seguro separar meios explicitamente isolados ou "Não Houve" no fim da linha.
function extrair(texto,{coluna=false}={}){
 const t=String(texto||'').replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ');
 const h=/(?:^|\n)[ \t]*Natureza[ \t\n]+Meio\(s\)[ \t\n]+Empregado\(s\)[ \t]*(?:\n|(?=\d{1,9}\s*:))/i.exec(t);
 if(!h)return [];
 const linhas=t.slice(h.index+h[0].length).split('\n').map(norm);
 let rows=[],atual=null,fim=false;
 const flush=()=>{if(atual&&!atual.ambiguo)rows.push(linhaNatureza(atual.cod,atual.partes,atual.meios));};
 for(const l of linhas.slice(0,250)){
  if(limite.test(l)){fim=true;break;}
  if(!l)continue;
  const m=l.match(codigo);
  if(m){flush();atual={cod:m[1],partes:[],meios:[],ambiguo:false};}
  if(!atual)continue;
  let parte=m?m[2]:l;
  if(!coluna&&meiosConhecidos.test(parte)){atual.meios.push(parte);continue;}
  if(!coluna){
   const s=parte.match(/\s+(N[ÃA]O HOUVE|N[ÃA]O INFORMADO|SEM MEIO EMPREGADO)$/i);
   if(s){atual.meios.push(s[1]);parte=parte.slice(0,s.index);}
   if(/\bOUTRO\(S\)\s*$/i.test(parte)||/\s(?:ARMA BRANCA|ARMA DE FOGO|VE[IÍ]CULO|FOR[ÇC]A F[IÍ]SICA)$/i.test(parte))atual.ambiguo=true;
  }
  if(parte)atual.partes.push(parte);
 }
 if(!fim)return [];
 flush();return unir(rows);
}
function extrairLayout(paginas){
 if(!Array.isArray(paginas)||!paginas.length)return null;
 const linhas=paginas.flatMap(p=>p.map(l=>l.slice().sort((a,b)=>a.x-b.x)));
 const texto=l=>norm(l.map(i=>i.texto).join(' '));
 const resultado=[];let encontrou=false;
 for(let k=0;k<linhas.length;k++){
  if(!header.test(texto(linhas[k])))continue;
  const n=linhas[k].find(i=>/^Natureza$/i.test(norm(i.texto)));
  const m=linhas[k].find(i=>/^Meio(?:\(s\))?/i.test(norm(i.texto)));
  if(!n||!m||m.x-n.x<50)continue;
  encontrou=true;
  const corte=m.x-8;let atual=null,fim=false;const rows=[];
  const flush=()=>{if(atual&&!atual.ambiguo)rows.push(linhaNatureza(atual.cod,atual.partes,atual.meios));};
  for(let j=k+1;j<linhas.length&&j<k+250;j++){
   const l=linhas[j],t=texto(l);
   if(limite.test(t)){fim=true;k=j;break;}
   if(header.test(t))break;
   const esquerda=l.filter(i=>i.x<corte),direita=l.filter(i=>i.x>=corte);
   const e=texto(esquerda),d=texto(direita),c=e.match(codigo);
   if(c){flush();atual={cod:c[1],partes:[],meios:[],ambiguo:false};}
   if(!atual)continue;
   // Um item PDF único cruzando a coluna não permite atribuição segura.
   if(esquerda.some(i=>Number(i.width)>0&&i.x+Number(i.width)>m.x+8))atual.ambiguo=true;
   const parte=c?c[2]:e;if(parte)atual.partes.push(parte);
   if(d)atual.meios.push(d);
  }
  if(fim){flush();resultado.push(...rows);}
 }
 return encontrou?unir(resultado):null;
}
root.PpeNaturezas=Object.freeze({extrair,extrairLayout});
})(typeof window!=='undefined'?window:globalThis);