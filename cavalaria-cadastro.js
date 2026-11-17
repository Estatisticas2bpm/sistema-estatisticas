/* SIE-CPC — cadastro unificado da Cavalaria.
 * A modalidade de atividade é distinta da ocorrência policial;
 * não existe contagem de abordagens neste módulo.
 */
(function(global){
"use strict";
const TIPOS=Object.freeze({
 VISITA_EDUCATIVA_ESCOLAR:"Visita educativa escolar",
 VISITA_TECNICA_VETERINARIA:"Visita técnica / veterinária",
 POLICIAMENTO_MONTADO:"Policiamento montado",
 POLICIAMENTO_MOTORIZADO:"Policiamento motorizado",
 POLICIAMENTO_COMUNITARIO:"Policiamento comunitário",
 POLICIAMENTO_EVENTOS:"Policiamento em eventos",
 OPERACAO:"Operação",
 ACAO_SOCIAL:"Ação social",
 REPRESENTACAO_INSTITUCIONAL:"Representação institucional",
 OUTRA_ATIVIDADE:"Outra atividade documentada"
});
const MARCADOR="ATIVIDADE OPERACIONAL CAVALARIA";
const $=id=>document.getElementById(id);
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\s+/g," ").trim();
const isDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v);
function dataIso(valor){
 const partes=String(valor||"").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
 if(!partes)return "";
 const iso=partes[3]+"-"+partes[2]+"-"+partes[1];
 const date=new Date(iso+"T12:00:00Z");
 return isDate(iso)&&!Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===iso?iso:"";
}
function extrairUnico(texto,exp){
 const achados=[...String(texto||"").matchAll(exp)].map(x=>String(x[1]||"").trim().replace(/[.;:,]+$/,""));
 return [...new Set(achados)].length===1?achados[0]:"";
}
function analisarPdf(texto){
 const t=String(texto||"");
 const upper=norm(t);
 let modalidade="",confirmar=true;
 const pistas=[
  ["VISITA_EDUCATIVA_ESCOLAR",/(?:VISITA\s+(?:EDUCATIVA\s+)?(?:[ÀA]|NA|EM)\s+(?:ESCOLA|COLEGIO)|VISITA\s+ESCOLAR|VISITA\s+EDUCATIVA\s+ESCOLAR)/],
  ["VISITA_TECNICA_VETERINARIA",/(?:VISITA\s+TECNICA|AULA\s+PRATICA|ATIVIDADE\s+ACADEMICA).{0,90}(?:VETERINARIA|SOLIPEDES|EQUINOS)/],
  ["ACAO_SOCIAL",/\bACAO SOCIAL\b/],
  ["POLICIAMENTO_MONTADO",/\bPOLICIAMENTO MONTADO\b/],
  ["POLICIAMENTO_MOTORIZADO",/\bPOLICIAMENTO MOTORIZADO\b/],
  ["POLICIAMENTO_COMUNITARIO",/\bPOLICIAMENTO COMUNITARIO\b/],
  ["POLICIAMENTO_EVENTOS",/\bPOLICIAMENTO (?:EM |DE )?EVENTOS?\b/],
  ["REPRESENTACAO_INSTITUCIONAL",/\bREPRESENTACAO INSTITUCIONAL\b/]
 ].filter(([_,regex])=>regex.test(upper.slice(0,9000)));
 if(pistas.length===1)modalidade=pistas[0][0];
 // Categorias detectadas são sugestões, nunca classificação definitiva.
 const pelotoes=[];
 if(/\b(?:1[º°ª]?|PRIMEIRO)\s*(?:PELOT[AÃ]O|PEL\b)/i.test(upper) || /\b(?:PELOT[AÃ]O|PEL)\s*(?:N[Oº°]\.?\s*)?(?:1\b|PRIMEIRO\b)/i.test(upper))pelotoes.push("1_PELOTAO");
 if(/\b(?:2[º°ª]?|SEGUNDO)\s*(?:PELOT[AÃ]O|PEL\b)/i.test(upper) || /\b(?:PELOT[AÃ]O|PEL)\s*(?:N[Oº°]\.?\s*)?(?:2\b|SEGUNDO\b)/i.test(upper))pelotoes.push("2_PELOTAO");
 const pelotao=pelotoes.length===1?pelotoes[0]:"";
 const dataElaboracao=dataIso(
  extrairUnico(t,/(?:Data\s*(?:\/\s*Hora)?\s*(?:In[ií]cio\s+do\s+Registro|da\s+Elabora[çc][ãa]o|de\s+Emiss[ãa]o)(?:\s+do\s+PPE)?|PPE\s+elaborado\s+em)\s*:?\s*(\d{2}\/\d{2}\/20\d{2})/gim)
 );
 const vtr=extrairUnico(t,/(?:^|\n)\s*(?:VTR|VIATURA)\s*(?:N[º°.]?\s*)?[:\-]?\s*([A-Z0-9]{2,12}(?:[-/][A-Z0-9]{1,10})?)(?:\s|$)/gim);
 const comandante=extrairUnico(t,/(?:^|\n)\s*(?:COMANDANTE(?:\s+DA\s+(?:VTR|GUARNI[ÇC][ÃA]O|EQUIPE|MONTADA))?|CMT(?:\s+DA\s+(?:VTR|GUARNI[ÇC][ÃA]O))?)\s*[:\-]\s*([A-ZÁ-Ú][^\n\r]{3,75})/gim);
 const instituicao=extrairUnico(t,/(?:^|\n)\s*(?:INSTITUI[ÇC][ÃA]O\s+VISITADA|UNIDADE\s+VISITADA|LOCAL\s+DA\s+VISITA)\s*:\s*([^\n\r]{4,120})/gim);
 return {tipoAtividade:modalidade,pelotao,dataElaboracao,vtr,comandante,instituicao,confirmar};
}
function iniciar(){
 if(global.SIE_CADASTRO_SIGLA!=="CAVALARIA"||!$("cavClasse"))return;
 const classe=$("cavClasse"),categoria=$("cavTipoAtividade"),pelotao=$("cavPelotao"),instituicao=$("cavInstituicao"),dataPpe=$("cavDataPpe"),status=$("cavPdfStatus");
 const tipo=$("ocorrencia"),subtipo=$("crime");
 let atividadeAnterior="",sugestaoAnterior=null;
 const tipoBloco=tipo?.closest(".campo"),subtipoBloco=subtipo?.closest(".campo");
 function ehAtividade(){return classe.value==="ATIVIDADE";}
 function ajustar(){
   const atividade=ehAtividade();
   $("cavCategoriaWrap").hidden=!atividade;
   categoria.required=atividade;
   if(tipoBloco)tipoBloco.hidden=atividade;
   if(subtipoBloco)subtipoBloco.hidden=atividade;
   if(atividade){
     if(tipo.value!==MARCADOR && tipo.value.trim())atividadeAnterior=tipo.value;
     tipo.value=MARCADOR;subtipo.value="";
   }else if(tipo.value===MARCADOR){
     tipo.value=atividadeAnterior!==MARCADOR?atividadeAnterior:"";
   }
   status.textContent=atividade
     ?"Atividade informativa: será contabilizada na produtividade da Cavalaria, não como ocorrência policial. Confira a categoria e os demais campos."
     :"Ocorrência policial: escolha a natureza válida do BO. Visitas e serviços comuns não devem ser classificados como crimes.";
 }
 classe.addEventListener("change",ajustar);
 function aplicarPdf(dados){
   // Reimportação nunca reaproveita classificação, pelotão ou instituição de outro arquivo.
   const d=dados?.cavalaria||{};
   sugestaoAnterior=d;
   categoria.value="";
   pelotao.value=d.pelotao||"";
   dataPpe.value=d.dataElaboracao||"";
   instituicao.value=d.instituicao||"";
   classe.value="";
   atividadeAnterior=tipo.value||"";
   ajustar();
   if(d.tipoAtividade)status.textContent="Sugestão do PDF: "+TIPOS[d.tipoAtividade]+". Confirme selecionando Atividade operacional e a categoria correspondente.";
   if(d.tipoAtividade&&TIPOS[d.tipoAtividade])categoria.value=d.tipoAtividade;
   if(!$("vtr")?.value.trim()&&d.vtr)$("vtr").value=d.vtr;
   if(!$("comandante")?.value.trim()&&d.comandante)$("comandante").value=d.comandante;
 }
 function carregarEdicao(x){
   classe.value=x?.cavalaria_classe_registro||"";
   categoria.value=x?.cavalaria_tipo_atividade||"";
   pelotao.value=x?.cavalaria_pelotao||"";
   dataPpe.value=x?.cavalaria_data_elaboracao_ppe||"";
   instituicao.value=x?.cavalaria_instituicao||"";
   if(!x?.cavalaria_classe_registro)status.textContent="Registro histórico sem classificação específica da Cavalaria. Confirme o tipo documental antes de editar.";
   atividadeAnterior=x?.ocorrencia===MARCADOR?"":String(x?.ocorrencia||"");
   ajustar();
 }
 function validar(){
   const ativo=classe.value;
   if(!["ATIVIDADE","OCORRENCIA"].includes(ativo))return {ok:false,campo:"cavClasse",mensagem:"Escolha Atividade operacional/informativa ou Ocorrência policial."};
   if(!["1_PELOTAO","2_PELOTAO"].includes(pelotao.value))return {ok:false,campo:"cavPelotao",mensagem:"Selecione o 1º ou o 2º Pelotão da Cavalaria."};
   if(ativo==="ATIVIDADE"&&!TIPOS[categoria.value])return {ok:false,campo:"cavTipoAtividade",mensagem:"Selecione uma categoria padronizada da atividade."};
   if(dataPpe.value && !isDate(dataPpe.value))return {ok:false,campo:"cavDataPpe",mensagem:"Revise a data de elaboração do PPE."};
   if(ativo==="OCORRENCIA"&&tipo.value===MARCADOR)return {ok:false,campo:"ocorrencia",mensagem:"Selecione uma natureza policial válida."};
   return {ok:true};
 }
 function camposRegistro(){
   const classeVal=classe.value||null;
   return {
     cavalaria_classe_registro:classeVal,
     cavalaria_tipo_atividade:classeVal==="ATIVIDADE"?categoria.value||null:null,
     cavalaria_esquadrao:"1_ESQUADRAO",
     cavalaria_pelotao:pelotao.value||null,
     cavalaria_data_elaboracao_ppe:dataPpe.value||null,
     cavalaria_instituicao:instituicao.value.trim()||null
   };
 }
 ajustar();
 global.CavalariaCadastro=Object.freeze({ehAtividade,validar,camposRegistro,carregarEdicao,aplicarPdf,analisarPdf});
}
global.CavalariaPdf=Object.freeze({analisar:analisarPdf,TIPOS,MARCADOR});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar,{once:true});
else iniciar();
})(typeof window!=="undefined"?window:globalThis);