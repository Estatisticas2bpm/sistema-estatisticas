/* Dashboard completo do Livro Digital da CIPG.
   Serviços: data_servico; eventos: vinculados ao mesmo serviço, mesmo se data_evento diferir.
   Não exibe comandante, nomes de militares ou textos de saúde/segurança.
 */
(function(){
'use strict';
const nums=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const soma=(arr,key)=>(arr||[]).reduce((n,x)=>n+nums(x[key]),0);
const numBR=v=>nums(v).toLocaleString('pt-BR',{maximumFractionDigits:2});
const str=x=>String(x??'').trim();
const chave=x=>str(x).toLocaleUpperCase('pt-BR');
const txt=(x,padrao='Não informado')=>str(x)||padrao;
const rank=(arr,chaveItem,limit=14)=>{
 const grupos=new Map();
 for(const x of arr){
  const categoria=txt(typeof chaveItem==='function'?chaveItem(x):x[chaveItem]);
  grupos.set(categoria,(grupos.get(categoria)||0)+1);
 }
 return [...grupos].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR')).slice(0,limit);
};
const categoriasSens=({data,key,limite=12,minimo=3})=>{
 const r=rank(data,key,999),ok=[],pequenos=r.filter(x=>x[0]==='Não informado');
 let resto=0;
 for(const [nome,contagem] of r){
  if(nome==='Não informado')continue;
  if(contagem>=minimo&&ok.length<limite)ok.push([nome,contagem]);
  else resto+=contagem;
 }
 if(resto)ok.push(['Outros / poucos registros',resto]);
 if(pequenos.length)ok.push(['Não informado',pequenos[0][1]]);
 return ok;
};
function turnoEvento(hora){
 const s=str(hora).slice(0,5);
 if(!/^\d{2}:\d{2}$/.test(s))return '';
 const [h,m]=s.split(':').map(Number);
 if(h>23||m>59)return '';
 return h*60+m>=480&&h*60+m<1200?'1':'2';
}
function tipoTurno(v){return v==='1'?'1º turno (08h–20h)':v==='2'?'2º turno (20h–08h)':'Não informado'}
const COM_EVENTO=['cipgFiltroEvento','cipgFiltroDesfecho','cipgFiltroEmServico',
 'cipgFiltroCausa','cipgFiltroTurno','cipgFiltroGraduacao','cipgFiltroUnidade',
 'cipgFiltroConducao','cipgFiltroSetor'];
const filtros=['cipgFiltroInstituicao','cipgFiltroTipo','cipgFiltroRegime','cipgFiltroSituacao',
 'cipgFiltroModalidade','cipgFiltroTurnoServico','cipgFiltroSei','cipgFiltroViatura',
 'cipgFiltroAlteracao',...COM_EVENTO];
const conteudo=(s,agulha)=>chave(s).includes(chave(agulha));
function selecionar(servicos,eventos,seletores={}){
 const v=id=>str(seletores[id]);
 const servicosOrigem=(servicos||[]).filter(s=>
  (!v('cipgFiltroInstituicao')||(conteudo(s.posto_codigo,v('cipgFiltroInstituicao'))||conteudo(s.instituicao,v('cipgFiltroInstituicao'))))&&
  (!v('cipgFiltroTipo')||s.tipo_local===v('cipgFiltroTipo'))&&
  (!v('cipgFiltroModalidade')||s.modalidade===v('cipgFiltroModalidade'))&&
  (!v('cipgFiltroRegime')||conteudo(s.regime,v('cipgFiltroRegime')))&&
  (!v('cipgFiltroSituacao')||s.situacao===v('cipgFiltroSituacao'))&&
  (!v('cipgFiltroTurnoServico')||s.turno_cipg===v('cipgFiltroTurnoServico'))&&
  (!v('cipgFiltroSei')||conteudo(s.numero_sei,v('cipgFiltroSei')))&&
  (!v('cipgFiltroViatura')||conteudo(s.viatura,v('cipgFiltroViatura')))&&
  (!v('cipgFiltroAlteracao')||
    (v('cipgFiltroAlteracao')==='PESSOAL'&&s.alteracao_pessoal===true)||
    (v('cipgFiltroAlteracao')==='INSTALACOES'&&s.alteracao_instalacoes===true)||
    (v('cipgFiltroAlteracao')==='MATERIAL'&&s.alteracao_material===true)||
    (v('cipgFiltroAlteracao')==='SEM'&&
     !s.alteracao_pessoal&&!s.alteracao_instalacoes&&!s.alteracao_material))
 );
 const ids=new Set(servicosOrigem.map(s=>s.id));
 const eventosSelecionados=(eventos||[]).filter(e=>ids.has(e.servico_id)&&
  (!v('cipgFiltroEvento')||e.tipo_evento===v('cipgFiltroEvento'))&&
  (!v('cipgFiltroDesfecho')||e.desfecho===v('cipgFiltroDesfecho'))&&
  (!v('cipgFiltroEmServico')||e.em_servico===v('cipgFiltroEmServico'))&&
  (!v('cipgFiltroCausa')||conteudo(e.causa_motivo,v('cipgFiltroCausa')))&&
  (!v('cipgFiltroTurno')||turnoEvento(e.hora_evento)===v('cipgFiltroTurno'))&&
  (!v('cipgFiltroGraduacao')||e.graduacao===v('cipgFiltroGraduacao'))&&
  (!v('cipgFiltroUnidade')||conteudo(e.unidade_militar,v('cipgFiltroUnidade')))&&
  (!v('cipgFiltroConducao')||e.conduzido_por===v('cipgFiltroConducao'))&&
  (!v('cipgFiltroSetor')||conteudo(e.setor_atendimento,v('cipgFiltroSetor')))
 );
 const filtraEvento=COM_EVENTO.some(id=>v(id)!=='');
 const evtServicos=new Set(eventosSelecionados.map(e=>e.servico_id));
 const selecionados=filtraEvento?servicosOrigem.filter(s=>evtServicos.has(s.id)):servicosOrigem;
 const ativos=new Set(selecionados.map(s=>s.id));
 return {servicos:selecionados,eventos:eventosSelecionados.filter(e=>ativos.has(e.servico_id)),
  eventosBase:(eventos||[]).filter(e=>ativos.has(e.servico_id)),filtroEventoAtivo:filtraEvento};
}
function consolidar(a){
 const services=a.servicos||[],events=a.eventos||[],originais=a.eventosBase||events;
 const eventIds=new Set(originais.map(e=>e.servico_id));
 const houve=s=>s.situacao==='COM ALTERACAO'||!!s.alteracao_pessoal||!!s.alteracao_instalacoes||
    !!s.alteracao_material||eventIds.has(s.id);
 const com=services.filter(houve).length,sem=services.length-com;
 const internacoes=events.filter(e=>e.tipo_evento==='ENTRADA DE PM NO HOSPITAL');
 const status=t=>internacoes.filter(e=>e.desfecho===t).length;
 const death=events.filter(e=>e.desfecho==='ÓBITO'||e.tipo_evento==='ÓBITO DE PM').length;
 const eKm=services.filter(s=>s.km_rodados!==null&&s.km_rodados!==undefined&&s.km_rodados!=='');
 const eLitros=services.filter(s=>s.litros_abastecidos!==null&&s.litros_abastecidos!==undefined&&s.litros_abastecidos!=='');
 const ambos=services.filter(s=>s.km_rodados!==null&&s.km_rodados!==undefined&&s.km_rodados!==''&&
 s.litros_abastecidos!==null&&s.litros_abastecidos!==undefined&&s.litros_abastecidos!=='');
 const kmConjunto=soma(ambos,'km_rodados'),litrosConjunto=soma(ambos,'litros_abastecidos');
 const postos=new Set(services.map(s=>chave(s.posto_codigo||s.instituicao)).filter(Boolean));
 const ord=soma(services,'efetivo_ordinario'),svi=soma(services,'efetivo_svi');
 return {
  servicos:services.length,sa:sem,ca:com,pctSa:services.length?100*sem/services.length:null,
  instituicoes:postos.size,postosCatalogados:new Set(services.map(s=>s.posto_codigo).filter(Boolean)).size,
  efetivoOrdinario:ord,efetivoSvi:svi,efetivoTotal:ord+svi,
  efetivoMedio:services.length?(ord+svi)/services.length:null,
  rondas:soma(services,'rondas_realizadas'),saidas:soma(services,'saidas_autorizadas'),
  quilometros:soma(eKm,'km_rodados'),abastecimento:soma(eLitros,'litros_abastecidos'),
  mediaConsumo:kmConjunto>0?100*litrosConjunto/kmConjunto:null,
  kmComRegistro:eKm.length,litrosComRegistro:eLitros.length,
  viaturas:new Set(services.map(s=>chave(s.viatura)).filter(Boolean)).size,
  servicosComViatura:services.filter(s=>str(s.viatura)).length,
  eventos:events.length,servicosComEventos:new Set(events.map(e=>e.servico_id)).size,
  hospital:internacoes.length,emServico:internacoes.filter(e=>e.em_servico==='SIM').length,
  foraServico:internacoes.filter(e=>e.em_servico==='NÃO').length,
  naoInformadoServico:internacoes.filter(e=>!e.em_servico||e.em_servico==='NÃO INFORMADO').length,
  internados:status('INTERNADO'),observacao:status('EM OBSERVAÇÃO'),liberados:status('LIBERADO'),
  transferidos:status('TRANSFERIDO'),emAtendimento:status('EM ATENDIMENTO'),obitos:death,
  alteracaoPessoal:services.filter(s=>s.alteracao_pessoal===true).length,
  alteracaoInstalacoes:services.filter(s=>s.alteracao_instalacoes===true).length,
  alteracaoMaterial:services.filter(s=>s.alteracao_material===true).length,
  anotacoes:services.filter(s=>str(s.outros_solicitacoes)).length,
  passagemRecebeu:services.filter(s=>str(s.recebeu_de)).length,
  passagemPassou:services.filter(s=>str(s.passou_para)).length,
  faltaSei:services.filter(s=>!str(s.numero_sei)).length,
  faltaPosto:services.filter(s=>!str(s.posto_codigo)).length,
  faltaTurno:services.filter(s=>!str(s.turno_cipg)).length,
  faltaGraduacao:events.filter(e=>!str(e.graduacao)).length,
  faltaDataEvento:events.filter(e=>!str(e.data_evento)).length,
  faltaDesfechoHospital:internacoes.filter(e=>!str(e.desfecho)).length,
  relatoriosComAcontecimentoSemEvento:services.filter(s=>s.situacao==='COM ALTERACAO'&&!eventIds.has(s.id)).length
 };
}
function tabelaPorPosto(a){
 const serv=a.servicos||[],ev=a.eventos||[],originais=a.eventosBase||ev;
 const evMap=new Map(),hosp=new Map();
 for(const e of ev){evMap.set(e.servico_id,(evMap.get(e.servico_id)||0)+1);if(e.tipo_evento==='ENTRADA DE PM NO HOSPITAL')hosp.set(e.servico_id,(hosp.get(e.servico_id)||0)+1);}
 const map=new Map(),origIds=new Set(originais.map(x=>x.servico_id));
 for(const s of serv){
  const key=str(s.posto_codigo||s.instituicao)||'Não informado';
  const x=map.get(key)||{posto:key,servicos:0,sa:0,eventos:0,hospital:0,ord:0,svi:0,rondas:0,km:0,litros:0,intercorrencias:0};
  x.servicos++;
  if(s.situacao==='SEM ALTERACAO'&&!origIds.has(s.id)&&!s.alteracao_pessoal&&!s.alteracao_instalacoes&&!s.alteracao_material)x.sa++;
  x.eventos+=evMap.get(s.id)||0;x.hospital+=hosp.get(s.id)||0;
  x.ord+=nums(s.efetivo_ordinario);x.svi+=nums(s.efetivo_svi);
  x.rondas+=nums(s.rondas_realizadas);x.km+=nums(s.km_rodados);x.litros+=nums(s.litros_abastecidos);
  x.intercorrencias+=nums(s.intercorrencias);map.set(key,x);
 }
 return [...map.values()].sort((a,b)=>b.servicos-a.servicos||a.posto.localeCompare(b.posto,'pt-BR'));
}
function tabelaPorMes(a){
 const agrupados=new Map();
 for(const s of a.servicos||[]){
  const k=/^\d{4}-\d{2}/.test(str(s.data_servico))?str(s.data_servico).slice(0,7):'Não informado';
  const x=agrupados.get(k)||{mes:k,servicos:0,ord:0,svi:0,km:0,litros:0,rondas:0,eventos:0};
  x.servicos++;x.ord+=nums(s.efetivo_ordinario);x.svi+=nums(s.efetivo_svi);
  x.km+=nums(s.km_rodados);x.litros+=nums(s.litros_abastecidos);x.rondas+=nums(s.rondas_realizadas);
  agrupados.set(k,x);
 }
 const periodoPorId=new Map((a.servicos||[]).map(s=>[s.id,/^\d{4}-\d{2}/.test(str(s.data_servico))?str(s.data_servico).slice(0,7):'Não informado']));
 for(const e of a.eventos||[]){const p=agrupados.get(periodoPorId.get(e.servico_id));if(p)p.eventos++;}
 return [...agrupados.values()].sort((x,y)=>x.mes.localeCompare(y.mes));
}
function render(dadosA,dadosB,ctx){
 const a=selecionar(dadosA.servicos,dadosA.eventos,ctx.seletores);
 const b=selecionar(dadosB.servicos,dadosB.eventos,ctx.seletores);
 const m=consolidar(a),p=consolidar(b);
 const $=ctx.get,chart=ctx.chart,rows=ctx.rows,esc=ctx.esc;
 const set=(id,value)=>{const el=$(id);if(el)el.textContent=String(value)};
 const n=id=>numBR(m[id]);
 const info=['servicos','hospital','sa','ca','emServico','internados','observacao','liberados','obitos',
   'instituicoes','efetivoOrdinario','efetivoSvi','quilometros','abastecimento','rondas','eventos',
   'efetivoTotal','efetivoMedio','saidas','viaturas','servicosComViatura','alteracaoPessoal',
   'alteracaoInstalacoes','alteracaoMaterial','foraServico','transferidos','emAtendimento',
   'servicosComEventos','anotacoes','postosCatalogados','passagemRecebeu','passagemPassou'];
 const ids={
  servicos:'cipgServicos',hospital:'cipgHospital',sa:'cipgSemAlteracao',ca:'cipgComAlteracao',
  emServico:'cipgEmServico',internados:'cipgInternados',observacao:'cipgObservacao',
  liberados:'cipgLiberados',obitos:'cipgObitos',instituicoes:'cipgInstituicoes',
  efetivoOrdinario:'cipgEfetivoOrd',efetivoSvi:'cipgEfetivoSvi',
  quilometros:'cipgKm',abastecimento:'cipgLitros',rondas:'cipgRondas',
  eventos:'cipgEventosTotal',efetivoTotal:'cipgEfetivoTotal',efetivoMedio:'cipgEfetivoMedio',
  saidas:'cipgSaidas',viaturas:'cipgViaturas',servicosComViatura:'cipgServicosViatura',
  alteracaoPessoal:'cipgAlteracaoPessoal',alteracaoInstalacoes:'cipgAlteracaoInstalacoes',
  alteracaoMaterial:'cipgAlteracaoMaterial',foraServico:'cipgForaServico',
  transferidos:'cipgTransferidos',emAtendimento:'cipgEmAtendimento',
  servicosComEventos:'cipgServicosComEventos',anotacoes:'cipgAnotacoes',
  postosCatalogados:'cipgPostosCatalogados',passagemRecebeu:'cipgPassagemRecebeu',
  passagemPassou:'cipgPassagemPassou'
 };
 for(const field of info)set(ids[field],n(field));
 set('cipgIntercorrencias',numBR(soma(a.servicos,'intercorrencias')));
 set('cipgPctSa',m.pctSa===null?'—':numBR(m.pctSa)+'%');
 set('cipgConsumo',m.mediaConsumo===null?'—':numBR(m.mediaConsumo)+' L/100 km');
 set('cipgRelatoriosComAlteracaoSemEvento',numBR(m.relatoriosComAcontecimentoSemEvento));
 set('cipgServicosVar',ctx.comparar==='nenhum'?'':ctx.variacao(m.servicos,p.servicos)+' vs. comparação');
 const resumo=$('cipgDescricaoPeriodo');
 if(resumo)resumo.textContent=m.servicos+' relatório(s), '+m.eventos+' acontecimento(s), '+
  m.hospital+' entrada(s) hospitalar(es), '+m.efetivoTotal+' empregos de efetivo, '+
  numBR(m.quilometros)+' km e '+numBR(m.abastecimento)+' litro(s). '+
  (a.filtroEventoAtivo?'Filtro de acontecimento ativo: serviços selecionados por eventos correspondentes. ':
   'Serviços S/A também integram a produtividade. ')+
  'O período considera a data do serviço; eventos vinculados podem ter data própria.';
 const charts=[
  ['chartCipgCausas',categoriasSens({data:a.eventos,key:'causa_motivo'}),'bar','Eventos'],
  ['chartCipgDesfechos',categoriasSens({data:a.eventos.filter(e=>e.tipo_evento==='ENTRADA DE PM NO HOSPITAL'),key:'desfecho'}),'doughnut','Entradas hospitalares'],
  ['chartCipgGraduacoes',categoriasSens({data:a.eventos,key:'graduacao'}),'bar','Eventos'],
  ['chartCipgUnidades',categoriasSens({data:a.eventos,key:'unidade_militar'}),'bar','Eventos'],
  ['chartCipgConducoes',categoriasSens({data:a.eventos,key:'conduzido_por'}),'doughnut','Eventos'],
  ['chartCipgSetores',categoriasSens({data:a.eventos,key:'setor_atendimento'}),'bar','Eventos'],
  ['chartCipgTiposEventos',rank(a.eventos,'tipo_evento',12),'doughnut','Eventos'],
  ['chartCipgPostos',rank(a.servicos,s=>s.posto_codigo||s.instituicao,12),'doughnut','Relatórios'],
  ['chartCipgTurnosServico',rank(a.servicos,s=>tipoTurno(s.turno_cipg),3),'doughnut','Relatórios'],
  ['chartCipgModalidade',rank(a.servicos,'modalidade',10),'bar','Relatórios'],
  ['chartCipgRegimes',rank(a.servicos,'regime',10),'bar','Relatórios'],
  ['chartCipgTipoLocal',rank(a.servicos,'tipo_local',3),'doughnut','Relatórios'],
  ['chartCipgTurnosEventos',rank(a.eventos,e=>tipoTurno(turnoEvento(e.hora_evento)),3),'doughnut','Eventos']
 ];
 for(const [id,conteudo,type,label] of charts){
  chart(id,type,conteudo.map(x=>x[0]),conteudo.map(x=>x[1]),label,ctx.cor);
 }
 const dias=rank(a.servicos,s=>str(s.data_servico)||'Não informado',999).sort((x,y)=>x[0].localeCompare(y[0]));
 const serie=tabelaPorMes(a),longo=dias.length>45;
 const pontos=longo?serie.map(x=>[x.mes,x.servicos]):dias;
 chart('chartCipgEvolucao','line',pontos.map(x=>x[0]),pontos.map(x=>x[1]),'Relatórios',ctx.cor);
 chart('chartCipgEvolucaoEfetivo','bar',serie.map(x=>x.mes),serie.map(x=>x.ord+x.svi),'Empregos de efetivo',ctx.cor);
 chart('chartCipgEvolucaoEventos','line',serie.map(x=>x.mes),serie.map(x=>x.eventos),'Eventos',ctx.cor);
 const posto=tabelaPorPosto(a);
 rows('tabCipgInstituicoes',posto.map(x=>'<tr><td>'+esc(x.posto)+'</td><td>'+numBR(x.servicos)+
  '</td><td>'+numBR(x.sa)+'</td><td>'+numBR(x.ord+x.svi)+'</td></tr>').join(''));
 rows('tabCipgPostosDetalhado',posto.map(x=>'<tr>'+[
  x.posto,x.servicos,x.sa,x.eventos,x.hospital,x.ord,x.svi,x.rondas,x.intercorrencias,
  numBR(x.km),numBR(x.litros)
 ].map(v=>'<td>'+esc(String(v))+'</td>').join('')+'</tr>').join(''));
 rows('tabCipgMensal',serie.map(x=>'<tr>'+[
  x.mes,x.servicos,x.eventos,x.ord,x.svi,x.rondas,numBR(x.km),numBR(x.litros)
 ].map(v=>'<td>'+esc(String(v))+'</td>').join('')+'</tr>').join(''));
 const comp=[
 ['Relatórios de serviço','servicos'],['Sem alteração (S/A)','sa'],['Com alteração','ca'],
 ['Postos/instituições distintas','instituicoes'],['Empregos ordinários','efetivoOrdinario'],
 ['Empregos SVI','efetivoSvi'],['Rondas realizadas','rondas'],['Saídas autorizadas','saidas'],
 ['Quilômetros rodados','quilometros'],['Litros abastecidos','abastecimento'],
 ['Acontecimentos','eventos'],['Entradas no hospital','hospital'],['Em serviço (atendimentos)','emServico'],
 ['Internados (entradas hospitalares)','internados'],['Liberados (entradas hospitalares)','liberados'],
 ['Óbitos relatados','obitos']
 ];
 rows('tabCipgComparativo',comp.map(([label,k])=>'<tr><td>'+esc(label)+'</td><td>'+
  numBR(m[k])+'</td><td>'+ (ctx.comparar==='nenhum'?'—':numBR(p[k]))+
  '</td><td>'+(ctx.comparar==='nenhum'?'—':esc(ctx.variacao(m[k],p[k])))+'</td></tr>').join(''));
 const qualidade=[
  ['Relatórios sem número SEI',m.faltaSei],
  ['Relatórios sem posto catalogado',m.faltaPosto],
  ['Relatórios sem turno informado',m.faltaTurno],
  ['Relatórios sem km informado',m.servicos-m.kmComRegistro],
  ['Relatórios sem litros informados',m.servicos-m.litrosComRegistro],
  ['Eventos sem data própria',m.faltaDataEvento],
  ['Eventos sem graduação',m.faltaGraduacao],
  ['Entradas hospitalares sem desfecho',m.faltaDesfechoHospital],
  ['Relatórios com alteração e sem evento vinculado',m.relatoriosComAcontecimentoSemEvento]
 ];
 rows('tabCipgQualidade',qualidade.map(([label,v])=>'<tr><td>'+esc(label)+'</td><td>'+numBR(v)+'</td></tr>').join(''));
 const porId=new Map(a.eventos.map(e=>[e.servico_id,0]));
 for(const e of a.eventos)porId.set(e.servico_id,1+(porId.get(e.servico_id)||0));
 const lista=a.servicos.slice().sort((x,y)=>str(y.data_servico).localeCompare(str(x.data_servico))||
  str(y.numero_sei).localeCompare(str(x.numero_sei))).slice(0,80);
 rows('tabCipgDocumentos',lista.map(x=>'<tr>'+[
  x.data_servico?x.data_servico.split('-').reverse().join('/'):'—',txt(x.numero_sei),
  txt(x.posto_codigo||x.instituicao),tipoTurno(x.turno_cipg),
  x.situacao==='SEM ALTERACAO'?'S/A':'Com alteração',numBR(nums(x.efetivo_ordinario)+nums(x.efetivo_svi)),
  numBR(x.rondas_realizadas),numBR(porId.get(x.id)||0)
 ].map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join(''));
 const docs=$('cipgDocumentosNota');
 if(docs)docs.textContent='Últimos '+lista.length+' de '+a.servicos.length+
  ' relatório(s) do período. Os campos exibidos são referências administrativas, sem dados pessoais.';
 return {atual:a,anterior:b,indicadores:m,comparacao:p};
}
window.CipgDashboard={filtros,selecionar,consolidar,tabelaPorPosto,tabelaPorMes,turnoEvento,
 render,categoriasSens};
})();