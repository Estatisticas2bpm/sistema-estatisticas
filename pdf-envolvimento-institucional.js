/*
 * Leitor conservador de condicao funcional da vitima e do infrator.
 * Nao usar a guarnicao, o cabecalho nem o posto de quem relatou o fato.
 */
(function(global){
"use strict";
const norm=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\s+/g," ").trim();
const CATEGORIAS=Object.freeze([
 ["POLICIAL_RODOVIARIO_FEDERAL","Policial rodoviário federal",/\b(?:POLICIAL RODOVIARI[OA] FEDERAL|AGENTE DA PRF|PRF)\b/],
 ["POLICIAL_FEDERAL","Policial federal",/\b(?:POLICIAL FEDERAL|AGENTE DA POLICIA FEDERAL)\b/],
 ["DELEGADO_POLICIA","Delegado(a) de polícia",/\b(?:DELEGAD[OA] DE POLICIA|DELEGAD[OA] DA POLICIA (?:CIVIL|FEDERAL))\b/],
 ["POLICIAL_CIVIL","Policial civil",/\b(?:POLICIAL CIVIL|AGENTE DA POLICIA CIVIL|ESCRIV[AO] DE POLICIA|INVESTIGADOR(?:A)? DA POLICIA CIVIL)\b/],
 ["POLICIAL_PENAL","Policial penal",/\b(?:POLICIAL PENAL|AGENTE PENITENCIARI[OA])\b/],
 ["POLICIAL_MILITAR","Policial militar",/\b(?:POLICIAL MILITAR|(?:SD|SOLDADO|CB|CABO|SGT|SARGENTO|SUBTENENTE|TEN|TENENTE|CAP|CAPITAO|MAJ|MAJOR|CEL|CORONEL)\s+(?:DA\s+)?PM\b|MEMBRO DA POLICIA MILITAR)\b/],
 ["GUARDA_MUNICIPAL","Guarda municipal",/\b(?:GUARDA (?:CIVIL )?MUNICIPAL|AGENTE DA GUARDA MUNICIPAL|GCM)\b/],
 ["MILITAR_FORCAS_ARMADAS","Militar das Forças Armadas",/\b(?:MILITAR DO EXERCITO|MILITAR DA (?:MARINHA|AERONAUTICA)|MILITAR DAS FORCAS ARMADAS)\b/],
 ["MAGISTRADO","Magistrado(a)",/\b(?:JUIZ(?:A)? DE DIREITO|JUIZ(?:A)? FEDERAL|DESEMBARGADOR(?:A)?|MINISTR[OA] DO (?:STF|STJ|TST|STM)|MAGISTRAD[OA])\b/],
 ["MEMBRO_MINISTERIO_PUBLICO","Membro do Ministério Público",/\b(?:PROMOTOR(?:A)? DE JUSTICA|PROCURADOR(?:A)? DA REPUBLICA|MEMBRO DO MINISTERIO PUBLICO)\b/],
 ["AUTORIDADE_POLITICA_ADMINISTRATIVA","Autoridade política ou administrativa",/\b(?:PREFEIT[OA](?: MUNICIPAL)?|GOVERNADOR(?:A)?|VEREADOR(?:A)?|DEPUTAD[OA](?: ESTADUAL| FEDERAL)?|SENADOR(?:A)?|SECRETARI[OA] DE (?:ESTADO|GOVERNO|MUNICIPIO)|MINISTR[OA] DE ESTADO)\b/],
 ["OUTRO_POLICIAL","Outro tipo de policial",/\bPOLICIAL\b/],
 ["OUTRA_AUTORIDADE","Outra autoridade pública",/\b(?:AUTORIDADE PUBLICA|AUTORIDADE JUDICIARIA|AUTORIDADE POLICIAL)\b/]
].map(([value,label,re])=>Object.freeze({value,label,re})));
const NOMES=Object.freeze(CATEGORIAS.map(x=>({value:x.value,label:x.label})));
const PROF=/(?:POLICIAL\s+(?:RODOVIARI[OA]\s+FEDERAL|FEDERAL|MILITAR|CIVIL|PENAL)|AGENTE\s+PENITENCIARI[OA]|AGENTE\s+DA\s+PRF|DELEGAD[OA]\s+DE\s+POLICIA|GUARDA\s+(?:CIVIL\s+)?MUNICIPAL|MILITAR\s+(?:DO\s+EXERCITO|DA\s+MARINHA|DA\s+AERONAUTICA)|JUIZ(?:A)?\s+DE\s+DIREITO|PROMOTOR(?:A)?\s+DE\s+JUSTICA|PREFEIT[OA]|VEREADOR(?:A)?|DEPUTAD[OA]|GOVERNADOR(?:A)?|AUTORIDADE\s+PUBLICA|(?:SD|CB|SGT|TEN|CAP|MAJ|CEL)\s+PM)/.source;
function categoriaTrecho(texto){const v=norm(texto);return CATEGORIAS.find(c=>c.re.test(v))?.value||"";}
function qualificacoes(bloco){
 const v=norm(String(bloco||"").replace(/\r?\n/g," "));
 const rx=/\b(?:PROFISSAO|CARGO|FUNCAO|OCUPACAO|POSTO|PATENTE|GRADUACAO)\s*:\s*([\s\S]*?)(?=\b(?:NACIONALIDADE|SEXO|IDADE|NASC|ESTADO CIVIL|CPF|RG|TELEFONE|ENDERECO|NOME CIVIL|NOME SOCIAL|FILIACAO|ESCOLARIDADE|DOCUMENTO)\s*:|$)/g;
 return [...v.matchAll(rx)].map(m=>m[1].slice(0,90));
}
function noRelato(pessoa,papel,relato,quantidade){
 const t=norm(relato),nome=norm(pessoa?.nome);
 if(!t)return "";
 if(nome.length>=7){
   let i=t.indexOf(nome);
   const antesRx=new RegExp("(?:^|[\\s,(])("+PROF+")\\s+(?:DE\\s+NOME\\s+)?$");
   const depoisRx=new RegExp("^\\s*(?:,|-)?\\s*(?:(?:QUE\\s+)?(?:E|ERA|FOI)\\s+|DE\\s+PROFISSAO\\s+)?("+PROF+")\\b");
   while(i>=0){
     const antes=t.slice(Math.max(0,i-95),i),depois=t.slice(i+nome.length,i+nome.length+100);
     const tipo=categoriaTrecho(antes.match(antesRx)?.[1]||depois.match(depoisRx)?.[1]);
     if(tipo)return tipo;
     i=t.indexOf(nome,i+nome.length);
   }
 }
 if(quantidade!==1)return "";
 const papelRx=papel==="vitima"?"(?:A|O)\\s+(?:VITIMA|OFENDID[OA])":"(?:O|A)\\s+(?:AUTOR(?:A)?|INFRATOR(?:A)?|SUSPEIT[OA])";
 const re=new RegExp("\\b"+papelRx+"\\s*(?:,|-)?\\s*(?:(?:QUE\\s+)?(?:E|ERA|FOI|TRABALHA\\s+COMO|EXERCE\\s+O\\s+CARGO\\s+DE)\\s+)?("+PROF+")\\b");
 return categoriaTrecho(t.match(re)?.[1]);
}
function analisarPessoa(pessoa,papel,relato,quantidade){
 const qual=qualificacoes(pessoa?.bloco).map(categoriaTrecho).find(Boolean)||"";
 const narr=noRelato(pessoa,papel,relato,quantidade);
 if(qual&&narr&&qual!==narr)return {situacao:"",tipo:"",conflito:true,origem:"Dados divergentes no documento"};
 const tipo=qual||narr;
 return {situacao:tipo?"SIM":"",tipo,conflito:false,origem:qual?"qualificação da pessoa":narr?"relato vinculado à pessoa":""};
}
function analisarPessoas(pessoas,relato){
 const saida={vitimas:[],infratores:[]};
 for(const [papel,chave] of [["vitima","vitimas"],["infrator","infratores"]]){
   const list=Array.isArray(pessoas?.[chave])?pessoas[chave]:[];
   saida[chave]=list.map(p=>analisarPessoa(p,papel,relato,list.length));
 }
 return saida;
}
global.PdfEnvolvimentoInstitucional=Object.freeze({CATEGORIAS:NOMES,analisarPessoa,analisarPessoas,categoriaTrecho});
})(typeof window!=="undefined"?window:globalThis);
