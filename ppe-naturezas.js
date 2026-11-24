/* Natureza e meios empregados são colunas independentes do documento. */
(function(root){
'use strict';
const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
const limite=/^(?:MOTIVA[ÇC][ÃA]O(?:\s*:\s*.*)?|ENVOLVIDO\(S\)|ENVOLVIDOS|DADOS DOS ENVOLVIDOS|OBJETO\(S\)|RELATO\s*\/\s*HIST[ÓO]RICO|HIST[ÓO]RICO)\s*:?\s*$/i;
const header=/^Natureza\s+Meio\(s\)\s+Empregado\(s\)$/i;
const codigo=/^(\d{1,9})\s*:\s*(.*)$/;
const meiosConhecidos=/^(?:N[ÃA]O HOUVE|N[ÃA]O INFORMADO|SEM MEIO EMPREGADO|ARMA BRANCA|ARMA DE FOGO|VE[IÍ]CULO|OUTRO\(S\)|FOR[ÇC]A F[IÍ]SICA|OBJETO CONTUNDENTE)$/i;
const legalGrupo=/\b(?:ART(?:IGO)?\.?\s*\d|LEI\s+(?:N[º°.]?\s*)?\d|DECRETO[- ]LEI\s+\d|DECRETO\s+\d|C[ÓO]DIGO\s+PENAL)/i;
const grupos=descricao=>[...descricao.matchAll(/\(([^()]*)\)/g)];
const chave=s=>norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()
 .replace(/[–—]/g,'-').replace(/[º°]/g,'O').replace(/ *- */g,'-');
function linhaNatureza(cod,partes,meios){
 const descricao=norm(partes.join(' '));
 if((cod!==null&&!/^[0-9]{1,9}$/.test(cod))||descricao.length<3||descricao.length>320||!/[A-ZÀ-Ú]{3}/i.test(descricao))return null;
 if(/(?:CPF|RG|MATR[IÍ]CULA|DATA DE NASCIMENTO|NOME COMPLETO|ENDERE[ÇC]O|TELEFONE)\s*[:\-]/i.test(descricao)||/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(descricao))return null;
 const legal=grupos(descricao).filter(x=>legalGrupo.test(x[1])).map(x=>x[1].trim()).join(' | ');
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
function temSecao(texto){return /\bNatureza[\s\u00a0]+Meio\(s\)[\s\u00a0]+Empregado\(s\)/i.test(String(texto||''));}
function extrair(texto){
 const t=String(texto||'').replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ');
 const h=/(?:^|\n)[ \t]*Natureza[ \t\n]+Meio\(s\)[ \t\n]+Empregado\(s\)[ \t]*(?:\n|(?=\d{1,9}\s*:))/i.exec(t);
 if(!h)return [];
 const linhas=t.slice(h.index+h[0].length).split('\n').map(norm);
 let rows=[],atual=null,fim=false;
 const flush=()=>{if(atual&&!atual.ambiguo&&(atual.cod||atual.meios.length))rows.push(linhaNatureza(atual.cod,atual.partes,atual.meios));};
 for(const l of linhas.slice(0,250)){
  if(limite.test(l)){fim=true;break;}
  if(!l)continue;
  const m=l.match(codigo);
  if(m){flush();atual={cod:m[1],partes:[],meios:[],ambiguo:false};}
  if(!atual&&!meiosConhecidos.test(l))atual={cod:null,partes:[],meios:[],ambiguo:false};
  if(!atual)continue;
  let parte=m?m[2]:l;
  if(meiosConhecidos.test(parte)){atual.meios.push(parte);continue;}
  if(!m&&atual.meios.length){flush();atual={cod:null,partes:[],meios:[],ambiguo:false};}
  {
   const s=parte.match(/\s+(N[ÃA]O HOUVE|N[ÃA]O INFORMADO|SEM MEIO EMPREGADO)$/i);
   if(s){atual.meios.push(s[1]);parte=parte.slice(0,s.index);}
   if(/\bOUTRO\(S\)\s*$/i.test(parte)||/\s(?:ARMA BRANCA|ARMA DE FOGO|VE[IÍ]CULO|FOR[ÇC]A F[IÍ]SICA|OBJETO CONTUNDENTE)$/i.test(parte))atual.ambiguo=true;
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
  const flush=()=>{if(atual&&!atual.ambiguo&&(atual.cod||atual.meios.length))rows.push(linhaNatureza(atual.cod,atual.partes,atual.meios));};
  for(let j=k+1;j<linhas.length&&j<k+250;j++){
   const l=linhas[j],t=texto(l);
   if(limite.test(t)){fim=true;k=j;break;}
   if(header.test(t))break;
   const esquerda=l.filter(i=>i.x<corte),direita=l.filter(i=>i.x>=corte);
   const e=texto(esquerda),d=texto(direita),c=e.match(codigo);
   if(c){flush();atual={cod:c[1],partes:[],meios:[],ambiguo:false};}
   else if(e&&(!atual||(atual.meios.length&&meiosConhecidos.test(d)))){
    flush();atual={cod:null,partes:[],meios:[],ambiguo:false};
   }
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

// A RPC identifica o vínculo documental. O frontend só usa uma opção
// retornada pelo catálogo atual, ou um subtipo institucional comprovado.
function classificar(item,catalogos,resultado){
 if(!item||!resultado||!['DISPONIVEL','INDISPONIVEL'].includes(resultado.situacao))return null;
 const tipos=catalogos?.tipos||[], subs=catalogos?.subtipos||[];
 const direto=resultado.tipo_id==null?null:tipos.find(t=>String(t.id)===String(resultado.tipo_id))||null;
 const descricao=norm(item.descricao_original), lei=chave(item.fundamentacao_legal);
 const cod=String(item.codigo_ppe||'');
 const gruposDoc=grupos(descricao);
 const semLei=norm(gruposDoc.filter(m=>legalGrupo.test(m[1])).reverse()
   .reduce((texto,m)=>texto.slice(0,m.index)+texto.slice(m.index+m[0].length),descricao));
 const possibilidades=[];
 for(const st of subs){
  const partes=norm(st.nome).match(/^(\d{1,9})\s*:\s*(.+)$/);
  if(!partes||!cod||partes[1]!==cod||chave(st.fundamento_legal)!==lei)continue;
  const pai=tipos.find(t=>String(t.id)===String(st.tipo_id)&&!t.ppe_descricao_original);
  if(!pai)continue;
  const nomePai=chave(pai.nome);
  const contexto=grupos(semLei).find(m=>chave(m[1])===nomePai);
  if(!contexto)continue;
  const semContexto=norm(semLei.slice(0,contexto.index)+semLei.slice(contexto.index+contexto[0].length));
  if(chave(partes[2])===chave(semContexto))possibilidades.push({tipo:pai,subtipo:st});
 }
 if(possibilidades.length===1)return {...possibilidades[0],direto};
 if(possibilidades.length>1)return null;
 if(direto)return {tipo:direto,subtipo:null,direto};
 // Não atribuir a outro subtipo quando a natureza documental está bloqueada.
 return null;
}
root.PpeNaturezas=Object.freeze({extrair,extrairLayout,temSecao,classificar});
})(typeof window!=='undefined'?window:globalThis);
