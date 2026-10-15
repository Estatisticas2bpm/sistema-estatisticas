/* SIE-CPC — narrativa visual: resultados distintos por tipo de atuação, sem exposição de pessoas. */
(function(global){
'use strict';
const D=()=>global.CpcTvDados, I=()=>global.EstatisticaIndicadores||{};
const E=v=>D().esc(v),N=v=>D().num(v),C=v=>D().currency(v),sum=(a,k)=>D().sum(a,k);
const norm=v=>D().normalize(v),rank=(a,f,k)=>D().countRank(a,f,k);
const status=s=>s?.status==='ok';
const cards=(items,cols=4)=>'<div class="tvGrid'+(cols===4?'':' unitGrid')+'">'+items.join('')+'</div>';
function metric(t,v,desc='',color='var(--cyan)'){
 return '<div class="tvMetric" style="--accent:'+color+'"><label>'+E(t)+'</label><strong>'+ (v===null||v===undefined?'—':E(typeof v==='number'?N(v):v))+'</strong><small>'+E(desc)+'</small></div>';
}
function rankHtml(list){
 if(!list?.length)return '<p class="tvNote">Sem registros no período.</p>';
 const max=Math.max(1,...list.map(x=>+x[1]||0));
 return '<div class="tvRank">'+list.map(([name,v])=>
  '<div class="tvRankLine"><span class="name" title="'+E(name)+'">'+E(name)+'</span><span class="track"><i class="fill" style="width:'+Math.max(2,(+v||0)*100/max)+'%"></i></span><strong>'+N(v)+'</strong></div>').join('')+'</div>';
}
const card=(title,body)=>'<div class="tvCard"><h2>'+E(title)+'</h2>'+body+'</div>';
const box=(text)=>'<div class="tvNoteBox">'+E(text)+'</div>';
const chart=(key,subtitle='')=>'<div class="tvChart"><canvas data-tv-chart="'+E(key)+'" aria-label="'+E(subtitle||key)+'"></canvas></div>';
const short=s=>String(s||'').replace(/^([12])BPM$/,'$1º BPM').replace('FORCA_TATICA','FORÇA TÁTICA');
function unitHierarchy(unidades){
 const byId=new Map(unidades.map(x=>[String(x.id),x]));
 function parentOf(x,ancestor){let u=x,seen=new Set();while(u&&!seen.has(String(u.id))){if(String(u.id)===String(ancestor.id))return true;seen.add(String(u.id));u=byId.get(String(u.parent_id))}return false}
 return {byId,parentOf};
}
function unitRows(model,u){
 const h=unitHierarchy(model.unidades);
 return model.atual.ocorrencias.filter(x=>{
  const origin=h.byId.get(String(x.unidade_id));return !!origin&&h.parentOf(origin,u);
 });
}
function metricUnit(model,u){
 const sigla=norm(u.sigla),e=model.especializados[sigla];
 if(sigla==='GIRO')return status(e)?[e.data.length,'abordagens registradas']:null;
 if(sigla==='CIPTUR')return status(e)?[e.data.length,'autos de infração']:null;
 if(sigla==='CAVALARIA')return status(e)?[e.data.length,'serviços realizados']:null;
 if(sigla==='CIPG')return status(e)?[e.data.servicos.length,'relatórios de serviço']:null;
 if(sigla==='CIPA')return status(e)?[e.data.autos.length,'autos ambientais']:null;
 return [unitRows(model,u).length,'ocorrências registradas'];
}
function unitLogo(sigla){
 const path=I().brasaoUnidade?.[norm(sigla)];
 return path?'<img src="'+E(path)+'" alt="" onerror="this.style.display=\'none\'">':'';
}
function unitHtml(model){
 const {byId}=unitHierarchy(model.unidades);
 const main=model.unidades.filter(x=>!byId.has(String(x.parent_id)));
 return '<div class="tvUnits">'+main.map(u=>{
  const k=metricUnit(model,u);
  return '<div class="tvUnit">'+unitLogo(u.sigla)+'<div><div class="sigla">'+E(short(u.sigla))+
  '</div><div class="indicador">'+(k?'<strong>'+N(k[0])+'</strong> '+E(k[1]):'Dados especializados indisponíveis')+'</div></div></div>';
 }).join('')+'</div>';
}
function weekLabel(key){return key.slice(8,10)+'/'+key.slice(5,7)}
function slide(title,subtitle,tag,html,graficos={},options={}){
 return {title,subtitle,tag,html,graficos,...options};
}
function chartDef(type,labels,values,opt={}){return {type,labels,values,...opt}}
function slides(model){
 const p=model.periodo,a=model.atual.ocorrencias,t=model.atual.tcos,prev=model.anterior.ocorrencias,antAno=model.anoAnterior.ocorrencias;
 const metr=D().metrics(model.atual),anterior=D().metrics(model.anterior),ano=D().metrics(model.anoAnterior);
 const ex=model.especializados,sp=k=>ex[k],val=(k,f)=>status(sp(k))?f(sp(k).data):null;
 const categoria=x=>x.ocorrencia||x.crime||'Não informado';
 const tipos=rank(a,categoria,7),bairros=rank(a,x=>x.bairro,7),semana=D().weekSeries(a,'data_ocorrencia');
 const dias=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'],porDia=Array(7).fill(0);
 a.forEach(x=>{const d=new Date(String(x.data_ocorrencia||'')+'T12:00:00Z');if(Number.isFinite(+d))porDia[d.getUTCDay()]++});
 const unidades=model.unidades;
 const hier=unitHierarchy(unidades);
 const unitSigla=x=>hier.byId.get(String(x.unidade_id))?.sigla||x.unidade_sigla||'Outras';
 const resumoUnidades=rank(a,unitSigla,12);
 const bairroTop=bairros[0],tipoTop=tipos[0];
 const main=[];
 const resumo='Indicadores extraídos dos registros autorizados do CPC; documentos, ocorrências, serviços, autos e abordagens possuem contagens distintas.';
 main.push(slide('CPC EM AÇÃO','Presença, proteção e resultados','ABERTURA INSTITUCIONAL',
  '<div class="tvHero"><div><h2>CPC <span>EM AÇÃO</span></h2><p>Comando de Policiamento da Capital<br>Presença, proteção e resultados.</p>'+
  box(p.titulo+' · '+p.subtitulo)+'</div><div class="tvHeroPanel"><span class="tvHeroBig">'+N(metr.ocorrencias)+'</span><p>ocorrências registradas no período</p><span class="tvHeroBig">'+N(unidades.filter(u=>!hier.byId.has(String(u.parent_id))).length)+'</span><p>unidades principais sob coordenação</p></div></div>'));
 main.push(slide('CPC EM NÚMEROS','Visão integrada das atuações registradas','PANORAMA TRIMESTRAL',
  cards([
   metric('Ocorrências policiais',metr.ocorrencias,'BOs e demais registros policiais'),
   metric('Atendidas',metr.atendidas,'situação de atendimento informada','var(--green)'),
   metric('Conduções',metr.conducoes,'conduções estatísticas'),
   metric('TCOs',metr.tcos,'termos circunstanciados','var(--gold)'),
   metric('Veículos recuperados',metr.recuperados,'informados nos registros'),
   metric('Foragidos registrados',metr.foragidos,'quantidades informadas','var(--gold)'),
   metric('Abordagens GIRO',val('GIRO',x=>x.length),'registros de abordagens'),
   metric('Pessoas abordadas GIRO',val('GIRO',x=>sum(x,'quantidade_pessoas')),'não são ocorrências policiais','var(--green)')
  ])+box(resumo)));
 main.push(slide('AS UNIDADES DO CPC','Unidades operacionais e especialidades sob a mesma coordenação','ATUAÇÃO INTEGRADA',
  unitHtml(model)+box('Cada unidade é apresentada por um indicador coerente com sua missão. Não são somadas atividades diferentes.')));
 const batalhoes=unidades.filter(x=>['1BPM','2BPM'].includes(norm(x.sigla)));
 const bpmCount=batalhoes.map(u=>[short(u.sigla),unitRows(model,u).length]);
 const cia=rank(a.filter(x=>batalhoes.some(u=>unitRows(model,u).some(z=>z.id===x.id))),x=>x.companhia,6);
 main.push(slide('POLICIAMENTO TERRITORIAL','1º BPM, 2º BPM e companhias territoriais','PRESENÇA NOS BAIRROS',
  '<div class="tvColumns"><div class="tvCard"><h2>Ocorrências por batalhão</h2>'+chart('bpm')+'</div>'+
  card('Distribuição por companhia',rankHtml(cia))+'</div>'+
  cards(batalhoes.map(u=>metric(short(u.sigla),unitRows(model,u).length,'ocorrências atribuídas à unidade')),2),
  {bpm:chartDef('bar',bpmCount.map(x=>x[0]),bpmCount.map(x=>x[1]),{horizontal:true})}));
 main.push(slide('INTELIGÊNCIA CRIMINAL','Distribuição territorial e evolução dos registros','ANÁLISE DESCRITIVA',
  '<div class="tvColumns c3">'+card('Naturezas mais registradas',rankHtml(tipos))+
  card('Bairros com mais registros',rankHtml(bairros))+
  '<div class="tvCard"><h2>Evolução semanal</h2>'+chart('semanas')+'</div></div>'+
  box('Volumes de registros não medem, isoladamente, a incidência real de crimes ou a eficácia policial.'),
  {semanas:chartDef('line',semana.map(x=>weekLabel(x[0])),semana.map(x=>x[1]))}));
 const bope=unidades.find(x=>norm(x.sigla)==='BOPE'),bopeRows=bope?unitRows(model,bope):[];
 const bopeSub=rank(bopeRows,x=>x.subunidade_operacional_sigla||(['FORCA_TATICA','CHOQUE','CANIL','GATE'].includes(norm(unitSigla(x)))?unitSigla(x):'BOPE — sem subunidade indicada'),7);
 main.push(slide('BOPE E OPERAÇÕES ESPECIALIZADAS','Força Tática, Choque, Canil e GATE, quando identificados','CAPACIDADE ESPECIALIZADA',
  '<div class="tvColumns cWide"><div class="tvCard"><h2>Registros por subunidade</h2>'+chart('bope')+'</div>'+
  card('Distribuição validada',rankHtml(bopeSub))+'</div>'+
  cards([metric('Ocorrências do BOPE',bopeRows.length,'total consolidado, sem contar duas vezes'),metric('Subunidades com registros',bopeSub.filter(x=>!x[0].startsWith('BOPE —')).length,'subunidades identificadas')],2),
  {bope:chartDef('bar',bopeSub.map(x=>short(x[0])),bopeSub.map(x=>x[1]),{horizontal:true})}));
 const giro=sp('GIRO');
 const giroRows=status(giro)?giro.data:[];
 const giroTipos=rank(giroRows,x=>({A_PE:'Abordagem a pé',MOTO:'Motocicleta',VEICULO:'Veículo'}[x.tipo_abordagem]||'Outra'),6);
 const giroWeek=D().weekSeries(giroRows,'registrado_em');
 main.push(slide('GIRO — INTERVENÇÃO RÁPIDA','Policiamento ostensivo motorizado e abordagens preventivas','PRESENÇA E PREVENÇÃO',
  cards([metric('Abordagens',status(giro)?giroRows.length:null,'registros individuais'),
         metric('Pessoas abordadas',status(giro)?sum(giroRows,'quantidade_pessoas'):null,'quantidade de pessoas'),
         metric('Bairros com abordagem',status(giro)?new Set(giroRows.map(x=>norm(x.bairro)).filter(Boolean)).size:null,'áreas informadas')],2)+
  '<div class="tvColumns">'+card('Modalidades',rankHtml(giroTipos))+'<div class="tvCard"><h2>Evolução semanal</h2>'+chart('giro')+'</div></div>',
  {giro:chartDef('line',giroWeek.map(x=>weekLabel(x[0])),giroWeek.map(x=>x[1]))},{omit:status(giro)&&!giroRows.length}));
 const ai=sp('CIPTUR'),aiRows=status(ai)?ai.data:[],rem=aiRows.filter(x=>x.houve_remocao===true);
 const grav=rank(aiRows,x=>x.gravidade_snapshot||'Não informada',6);
 main.push(slide('CIPTUR — SEGURANÇA VIÁRIA','Fiscalização urbana e rodoviária; TOR quando identificado','FISCALIZAÇÃO DE TRÂNSITO',
  cards([metric('Autos de infração',status(ai)?aiRows.length:null,'registros administrativos'),
   metric('Autos com remoção',status(ai)?rem.length:null,'não representa total de veículos'),
   metric('Remoção — carro',status(ai)?rem.filter(x=>norm(x.tipo_veiculo_removido)==='CARRO').length:null,'autos registrados'),
   metric('Remoção — moto',status(ai)?rem.filter(x=>norm(x.tipo_veiculo_removido)==='MOTO').length:null,'autos registrados')])+
  '<div class="tvColumns"><div class="tvCard"><h2>Classificação da infração</h2>'+chart('ciptur')+'</div>'+
  card('Principais classificações',rankHtml(grav))+'</div>',
  {ciptur:chartDef('bar',grav.map(x=>x[0]),grav.map(x=>x[1]),{horizontal:true})},{omit:status(ai)&&!aiRows.length}));
 const cipa=sp('CIPA'),amb=status(cipa)?cipa.data:null;
 const autos=amb?.autos||[],embargos=amb?.embargos||[],fauna=amb?.fauna||[];
 const infra=rank(autos,x=>x.descricao_infracao||'Não informada',5);
 const notif=Array.isArray(amb?.notificacoes)?amb.notificacoes.length:null;
 main.push(slide('CIPA — PROTEÇÃO AMBIENTAL','Ações administrativas, embargos e fauna registrada','PATRIMÔNIO NATURAL',
  cards([metric('Autos de infração',amb?autos.length:null,'data da autuação'),
         metric('Termos de embargo',amb?embargos.length:null,'data do embargo'),
         metric('Área embargada',amb?N(sum(embargos,'area_embargada_ha'))+' ha':null,'área em termos de embargo','var(--green)'),
         metric('Animais registrados',amb?sum(fauna,'quantidade'):null,'registros de fauna'),
         metric('Notificações',amb?notif:null,amb?.notificacoes?.erro?'Consulta indisponível':'notificações administrativas'),
         metric('Valor nominal de multas',amb?C(sum(autos,'valor_multa')):null,'não representa arrecadação','var(--gold)')],2)+
  '<div class="tvColumns"><div class="tvCard"><h2>Naturezas de infração ambiental</h2>'+chart('cipa')+'</div>'+
  card('Infrações com descrição',rankHtml(infra))+'</div>',
  {cipa:chartDef('bar',infra.map(x=>x[0]),infra.map(x=>x[1]),{horizontal:true})},{omit:amb&&!autos.length&&!embargos.length&&!fauna.length&&!notif}));
 const cav=sp('CAVALARIA'),serv=status(cav)?cav.data:[],modo=rank(serv,x=>x.tipo_policiamento||'Outro serviço',7);
 main.push(slide('CAVALARIA — PRESENÇA E PROXIMIDADE','Policiamento montado, serviços e apoio à comunidade','POLICIAMENTO MONTADO',
  cards([metric('Serviços realizados',status(cav)?serv.length:null,'registros de produtividade'),
         metric('Pessoas abordadas',status(cav)?sum(serv,'abordagens_pessoas'):null,'somatório informado'),
         metric('Motocicletas abordadas',status(cav)?sum(serv,'abordagens_motos'):null,'somatório informado'),
         metric('Carros abordados',status(cav)?sum(serv,'abordagens_carros'):null,'somatório informado')])+
  '<div class="tvColumns"><div class="tvCard"><h2>Modalidades de serviço</h2>'+chart('cav')+'</div>'+
  card('Tipos de policiamento',rankHtml(modo))+'</div>',
  {cav:chartDef('bar',modo.map(x=>x[0]),modo.map(x=>x[1]),{horizontal:true})},{omit:status(cav)&&!serv.length}));
 const cipg=sp('CIPG'),srv=status(cipg)?cipg.data.servicos:[],evt=status(cipg)?cipg.data.eventos:[];
 const cipgModa=rank(srv,x=>x.modalidade||'Não informada',6);
 main.push(slide('CIPG — PROTEÇÃO INSTITUCIONAL','Guarda, rondas e manutenção de presença institucional','SERVIÇO DE GUARDA',
  cards([metric('Relatórios de serviço',status(cipg)?srv.length:null,'relatórios do caderno digital'),
         metric('Rondas realizadas',status(cipg)?sum(srv,'rondas_realizadas'):null,'rondas reportadas'),
         metric('Acontecimentos',status(cipg)?evt.length:null,'eventos vinculados aos serviços'),
         metric('Instituições atendidas',status(cipg)?new Set(srv.map(x=>norm(x.instituicao)).filter(Boolean)).size:null,'instituições distintas')])+
  '<div class="tvColumns"><div class="tvCard"><h2>Modalidades de guarda</h2>'+chart('cipg')+'</div>'+
  card('Tipos de serviços',rankHtml(cipgModa))+'</div>',
  {cipg:chartDef('bar',cipgModa.map(x=>x[0]),cipgModa.map(x=>x[1]),{horizontal:true})},{omit:status(cipg)&&!srv.length}));
 main.push(slide('MAPA OPERACIONAL DO CPC','Distribuição dos registros com geolocalização autorizada','VISÃO TERRITORIAL',
  '<div class="tvColumns cWide"><div class="tvCard"><h2>Registros georreferenciados por unidade</h2><div id="miniMapaCpc" role="img" aria-label="Mapa de pontos georreferenciados agregados do CPC"></div></div>'+
  card('Unidades de origem',rankHtml(resumoUnidades))+'</div>'+
  box('Visualização restrita ao contexto CPC, sem nomes de pessoas ou endereços detalhados. Mapa exibido com enquadramento automático.')));
 const comparacoes=[['Ocorrências',metr.ocorrencias,anterior.ocorrencias,ano.ocorrencias],
 ['TCOs',metr.tcos,anterior.tcos,ano.tcos],['Conduções',metr.conducoes,anterior.conducoes,ano.conducoes],
 ['Veículos recuperados',metr.recuperados,anterior.recuperados,ano.recuperados],
 ['Registros atendidos',metr.atendidas,anterior.atendidas,ano.atendidas]];
 const compareTable='<table class="tvCompare"><thead><tr><th>Indicador</th><th>Atual</th><th>Trimestre anterior¹</th><th>Ano anterior¹</th></tr></thead><tbody>'+
  comparacoes.map(x=>'<tr><td>'+E(x[0])+'</td><td>'+N(x[1])+'</td><td>'+N(x[2])+' <small>('+E(D().formatDiff(x[1],x[2]))+')</small></td>'+
  '<td>'+N(x[3])+' <small>('+E(D().formatDiff(x[1],x[3]))+')</small></td></tr>').join('')+'</tbody></table>';
 main.push(slide('EVOLUÇÃO TRIMESTRAL','Comparações dos volumes de registros em intervalos equivalentes','TRANSPARÊNCIA E RESULTADOS',
  '<div class="tvColumns cWide"><div class="tvCard"><h2>Comparativo de registros</h2>'+chart('comp')+'</div>'+
  card('Indicadores comparados',compareTable)+'</div>'+
  box('¹ Comparações com a mesma quantidade de dias do trimestre exibido. A variação é de registros estatísticos; não constitui prova isolada de mudança na criminalidade.'),
  {comp:chartDef('bar',['Ocorrências','TCOs','Conduções','Veículos recuperados'],[metr.ocorrencias,metr.tcos,metr.conducoes,metr.recuperados],
    {outros:[anterior.ocorrencias,anterior.tcos,anterior.conducoes,anterior.recuperados]})}));
 main.push(slide('CPC — SERVIR E PROTEGER','Comando de Policiamento da Capital · PMRR','ENCERRAMENTO',
  '<div class="tvHero"><div><h2>PROTEÇÃO <span>EM TODA A CAPITAL</span></h2><p>Policiamento ostensivo, proteção institucional, fiscalização, operações especializadas e preservação ambiental.</p>'+
  box(p.titulo+' · '+p.subtitulo)+'</div><div class="tvHeroPanel"><p class="tvHeroBig">'+N(metr.ocorrencias)+'</p><p>ocorrências registradas</p><p>Estatísticas oficiais extraídas dos registros disponíveis no SIE-CPC.</p></div></div>'));
 return main.filter(x=>!x.omit);
}
global.CpcTvApresentacao=Object.freeze({slides,metric,rankHtml,chartDef});
})(window);
