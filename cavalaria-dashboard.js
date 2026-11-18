/* Cavalaria — painel baseado exclusivamente nos registros do cadastro unificado.
 * Não apresenta, soma ou estimula abordagens.
 */
(function(global){
"use strict";
const CATEGORIAS=Object.freeze({
 VISITA_EDUCATIVA_ESCOLAR:"Visita educativa escolar",
 VISITA_TECNICA_VETERINARIA:"Visita técnica / veterinária",
 POLICIAMENTO_MONTADO:"Policiamento montado",
 POLICIAMENTO_MOTORIZADO:"Policiamento motorizado",
 POLICIAMENTO_COMUNITARIO:"Policiamento comunitário",
 POLICIAMENTO_EVENTOS:"Policiamento em eventos",
 OPERACAO:"Operação",
 ACAO_SOCIAL:"Ação social",
 REPRESENTACAO_INSTITUCIONAL:"Representação institucional",
 OUTRA_ATIVIDADE:"Outra atividade"
});
function resumir(dados){
 const registros=Array.isArray(dados)?dados:[];
 const atividades=registros.filter(x=>x.cavalaria_classe_registro==="ATIVIDADE");
 const ocorrencias=registros.filter(x=>x.cavalaria_classe_registro==="OCORRENCIA");
 const legados=registros.filter(x=>!x.cavalaria_classe_registro);
 const pelotao=cod=>[...atividades,...ocorrencias].filter(x=>x.cavalaria_pelotao===cod);
 const tipo=cod=>atividades.filter(x=>x.cavalaria_tipo_atividade===cod);
 return {atividades,ocorrencias,legados,pelotao,tipo};
}
function render(params){
 const {registros,anteriores,get,chart,rows,esc,drillNumero,abrirDetalhes,rankNaturezas,naturezasOcorrencia,rank,soma,variacao,comparar,cores}=params;
 const r=resumir(registros),ant=resumir(anteriores);
 const a=r.atividades,pol=r.ocorrencias,conhecidos=[...a,...pol];
 const set=(id,value)=>{const el=get(id);if(el)el.textContent=String(value)};
 get('cavServicos').innerHTML=drillNumero(a.length,'Atividades operacionais da Cavalaria',a);
 set('cavServicosVariacao',comparar==='nenhum'?'':variacao(a.length,ant.atividades.length)+' em relação ao período comparado');
 get('cavOcorrenciasPoliciais').innerHTML=drillNumero(pol.length,'Ocorrências policiais da Cavalaria',pol);
 get('cavLegados').innerHTML=drillNumero(r.legados.length,'Registros históricos sem modalidade confirmada',r.legados);
 set('cavMontado',r.tipo('POLICIAMENTO_MONTADO').length);
 set('cavMotorizado',r.tipo('POLICIAMENTO_MOTORIZADO').length);
 set('cavComunitario',r.tipo('POLICIAMENTO_COMUNITARIO').length);
 set('cavEventos',r.tipo('POLICIAMENTO_EVENTOS').length+r.tipo('OPERACAO').length);
 set('cavVisitasEscolas',r.tipo('VISITA_EDUCATIVA_ESCOLAR').length);
 set('cavVisitasTecnicas',r.tipo('VISITA_TECNICA_VETERINARIA').length);
 set('cavAcoesSociais',r.tipo('ACAO_SOCIAL').length);
 get('cavPelotao1').innerHTML=drillNumero(r.pelotao('1_PELOTAO').length,'1º Pelotão — Cavalaria',r.pelotao('1_PELOTAO'));
 get('cavPelotao2').innerHTML=drillNumero(r.pelotao('2_PELOTAO').length,'2º Pelotão — Cavalaria',r.pelotao('2_PELOTAO'));
 const cats=Object.entries(CATEGORIAS).filter(([cod])=>r.tipo(cod).length>0);
 chart('chartCavModalidades','bar',cats.map(x=>x[1]),cats.map(x=>r.tipo(x[0]).length),
  'Atividades',cores.teal,i=>{
   const cod=cats[i]?.[0];if(cod)abrirDetalhes('Cavalaria — '+CATEGORIAS[cod],r.tipo(cod));
  });
 const pelotoes=[['1º Pelotão','1_PELOTAO'],['2º Pelotão','2_PELOTAO']];
 chart('chartCavContextos','bar',pelotoes.map(x=>x[0]),pelotoes.map(x=>r.pelotao(x[1]).length),
  'Registros por pelotão',cores.blue,i=>{
   const cod=pelotoes[i]?.[1];if(cod)abrirDetalhes('Cavalaria — '+pelotoes[i][0],r.pelotao(cod));
  });
 const dias={};
 a.forEach(x=>{const d=String(x.data_ocorrencia||'').slice(0,10);if(d)dias[d]=(dias[d]||0)+1;});
 const evolucao=Object.entries(dias).sort((x,y)=>x[0].localeCompare(y[0]));
 chart('chartCavEvolucao','line',evolucao.map(x=>x[0].slice(8,10)+'/'+x[0].slice(5,7)),
  evolucao.map(x=>x[1]),'Atividades',cores.green);
 const n=v=>String(v||'').trim().toUpperCase();
 const local=x=>x.cavalaria_instituicao||x.escola_nome||x.bairro||'Local não informado';
 const locais=rank(a,local,25);
 rows('tabCavLocais',locais.length?locais.map(([nome,qtd])=>{
   const grupo=a.filter(x=>n(local(x))===n(nome));
   return '<tr><td>'+esc(nome)+'</td><td>'+drillNumero(qtd,'Atividades — '+nome,grupo)+'</td></tr>';
 }).join(''):'<tr><td colspan="2">Nenhuma atividade registrada no período.</td></tr>');
 for(const [id,campo] of [['tabCavComandantes','comandante'],['tabCavViaturas','vtr']]){
   const dados=rank(conhecidos,campo,25);
   rows(id,dados.length?dados.map(([nome,qtd])=>{
     const grupo=conhecidos.filter(x=>n(x[campo])===n(nome));
     return '<tr><td>'+esc(nome)+'</td><td>'+drillNumero(qtd,'Cavalaria — '+nome,grupo)+'</td></tr>';
   }).join(''):'<tr><td colspan="2">Sem dados no período.</td></tr>');
 }
 const natureza=rankNaturezas(pol,25);
 rows('tabCavOcorrencias',natureza.length?natureza.map(([nome,qtd])=>{
   const grupo=pol.filter(x=>naturezasOcorrencia(x).includes(nome));
   return '<tr><td>'+esc(nome)+'</td><td>'+drillNumero(qtd,'Ocorrências policiais — '+nome,grupo)+'</td></tr>';
 }).join(''):'<tr><td colspan="2">Nenhuma ocorrência policial classificada.</td></tr>');
 set('cavNota',r.legados.length
  ?r.legados.length+' registro(s) anteriores sem classificação da modalidade. Confira o documento antes de reclassificar. Não há registro de abordagens neste módulo.'
  :'Os registros de atividades são separados dos BOs policiais. Não há registro de abordagens neste módulo.');
}
global.CavalariaDashboard=Object.freeze({CATEGORIAS,resumir,render});
})(typeof window!=="undefined"?window:globalThis);