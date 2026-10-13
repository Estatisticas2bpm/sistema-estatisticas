/* SIE-CPC — extrato de auditoria reproduzível, a partir do escopo já autorizado.
 * Nenhum registro é alterado. Campos pessoais não são exportados.
 */
(function(global){
'use strict';
const texto=x=>String(x??'').trim();
const prioridades={alta:0,media:1,baixa:2};
const colunas=['Prioridade','Unidade (ID)','Registro (ID)','Número BO','Data da ocorrência','Natureza','Bairro','Tipo da pendência','Descrição da divergência','Situação'];
function linhas(pendencias,filtro){
 return (pendencias||[]).filter(p=>!filtro||p.nivel===filtro).map(p=>({
  nivel:texto(p.nivel),
  unidadeId:texto(p.o?.unidade_id),
  registroId:texto(p.o?.id),
  bo:texto(p.o?.numero_bo),
  data:texto(p.o?.data_ocorrencia),
  natureza:texto(p.o?.ocorrencia||p.o?.crime),
  bairro:texto(p.o?.bairro),
  tipo:texto(p.tipo),
  descricao:texto(p.texto),
  situacao:'PENDENTE DE CONFERÊNCIA DOCUMENTAL'
 })).sort((a,b)=>(prioridades[a.nivel]??9)-(prioridades[b.nivel]??9)||
  b.data.localeCompare(a.data)||a.unidadeId.localeCompare(b.unidadeId)||
  a.bo.localeCompare(b.bo)||a.registroId.localeCompare(b.registroId)||a.tipo.localeCompare(b.tipo));
}
function csv(linhasAuditoria,meta){
  const seguro=v=>{
   let t=texto(v).replace(/[\r\n]+/g,' ');
   if(/^[\s]*[=+@\-]/.test(t))t="'"+t;
   return '"'+t.replace(/"/g,'""')+'"';
  };
  const m=meta||{};
  const cabecalho=[
   ['SIE-CPC','Auditoria de integridade — dados sujeitos à conferência humana'],
   ['Período inicial',m.inicio||''],['Período final',m.fim||''],
   ['Fonte da consulta',m.fonte||''],['Escopo','Conforme sessão autenticada e permissões RLS'],
   ['Nota','Ocorrências repetidas são SUSPEITAS, não duplicidades confirmadas'],
   []
  ];
  const valores=(linhasAuditoria||[]).map(x=>[
   x.nivel,x.unidadeId,x.registroId,x.bo,x.data,x.natureza,x.bairro,x.tipo,x.descricao,x.situacao
  ]);
  return '\uFEFF'+[...cabecalho,colunas,...valores].map(l=>l.map(seguro).join(';')).join('\r\n');
}
global.AuditoriaCsv=Object.freeze({linhas,csv,colunas});
})(window);
