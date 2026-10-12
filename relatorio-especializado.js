/* Relatórios especializados de produtividade — Cavalaria e CIPG.
 * Fontes próprias, datas explícitas, sem converter serviços em BOs.
 */
(function(global){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numero=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:2});
const soma=(rows,k)=>(rows||[]).reduce((s,r)=>s+(Number(r[k])||0),0);
const rank=(rows,k,limite=12)=>{
  const m=new Map();
  for(const r of rows||[]){const v=String(typeof k==='function'?k(r):r[k]||'').trim()||'NÃO INFORMADO';m.set(v,(m.get(v)||0)+1)}
  return [...m.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR')).slice(0,limite);
};
const linha=(titulo,atual,anterior,nota='')=>'<tr><td>'+esc(titulo)+'</td><td class="center">'+numero(atual)+'</td><td class="center">'+numero(anterior)+'</td><td>'+esc(nota)+'</td></tr>';
const tabela=(headers,rows)=>'<table><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.join(''):'<tr><td colspan="'+headers.length+'" class="center">SEM REGISTROS NO PERÍODO</td></tr>')+'</tbody></table>';
function pagina(titulo,conteudo,unidade,ini,fim){
 return '<section class="page"><div class="internal-head">SIE-CPC · '+esc(unidade.nome)+'<br>Período de '+esc(ini)+' a '+esc(fim)+'</div><h2 class="title">'+esc(titulo)+'</h2>'+conteudo+'<div class="footer"></div></section>';
}
function capa(unidade,logo,ini,fim,titulo){
 return '<section class="page cover"><div class="cover-top"><img src="brasao-pmrr.png" alt="Brasão da PMRR"><div>ESTADO DE RORAIMA<br>POLÍCIA MILITAR DE RORAIMA<br>COMANDO DE POLICIAMENTO DA CAPITAL<br>'+esc(unidade.nome).toUpperCase()+'<br>AMAZÔNIA: PATRIMÔNIO DOS BRASILEIROS</div><img src="'+esc(logo)+'" alt="Brasão da unidade" style="width:82px;height:82px;object-fit:contain"></div><div class="cover-title"><h1>'+esc(titulo)+'</h1><h2>'+esc(unidade.sigla)+' · '+esc(ini)+' a '+esc(fim)+'</h2></div><div class="cover-bottom">BOA VISTA · RORAIMA</div><div class="footer"></div></section>';
}
function assinatura(html){return '<div class="signature">Boa Vista/RR · relatório gerado em '+new Date().toLocaleDateString('pt-BR')+'<br><br>'+html+'</div>'}
function publicar(paginas,unidade,ini,fim){
 const el=document.getElementById('document');el.innerHTML=paginas.join('');
 const todas=[...el.querySelectorAll('.page')];
 todas.forEach((p,i)=>{const ft=p.querySelector('.footer');if(ft)ft.textContent='Página '+(i+1)+' de '+todas.length});
 document.title='SIE-CPC - '+unidade.sigla+' - '+ini+' a '+fim;
}
async function consultarCavalaria(db,ini,fim){
 const rows=[],passo=1000;
 for(let p=0;p<200;p++){
   const r=await db.from('cavalaria_servicos_produtividade')
    .select('id,data_servico,tipo_policiamento,contexto_atividade,localidade,bairro,abordagens_pessoas,abordagens_motos,abordagens_carros,rops_produzidos,veiculos_removidos,foragidos_presos,armas_apreendidas')
    .gte('data_servico',ini).lte('data_servico',fim).order('id',{ascending:true}).range(p*passo,(p+1)*passo-1);
   if(r.error)throw r.error;
   const lote=r.data||[];rows.push(...lote);
   if(lote.length<passo)return rows;
 }
 throw Error('Volume de serviços elevado. Reduza o intervalo.');
}
async function cavalaria({db,inicio,fim,intervaloComparado,unidade,assinatura:ass}){
 const el=document.getElementById('document');
 el.innerHTML='<div class="notice">Conferindo registros de produtividade da Cavalaria...</div>';
 try{
   const [a,b]=await Promise.all([consultarCavalaria(db,inicio,fim),consultarCavalaria(db,intervaloComparado[0],intervaloComparado[1])]);
   const k=global.EstatisticaIndicadores.cavalaria(a),ant=global.EstatisticaIndicadores.cavalaria(b);
   const indicadores=[
    ['Serviços registrados',k.servicos,ant.servicos,'Data da execução do serviço'],
    ['Pessoas abordadas',k.pessoasAbordadas,ant.pessoasAbordadas,'Soma de abordagens_pessoas'],
    ['Policiamento montado',k.policiamentoMontado,ant.policiamentoMontado,'Serviços da modalidade montada'],
    ['Eventos e operações',k.eventosOperacoes,ant.eventosOperacoes,'Cada serviço contado uma vez'],
    ['Motocicletas abordadas',soma(a,'abordagens_motos'),soma(b,'abordagens_motos'),'Produtividade do serviço'],
    ['Carros abordados',soma(a,'abordagens_carros'),soma(b,'abordagens_carros'),'Produtividade do serviço'],
    ['ROPs produzidos',soma(a,'rops_produzidos'),soma(b,'rops_produzidos'),'Conforme cadastro da Cavalaria'],
    ['Veículos removidos',soma(a,'veiculos_removidos'),soma(b,'veiculos_removidos'),'Soma informada nos serviços'],
    ['Foragidos presos',soma(a,'foragidos_presos'),soma(b,'foragidos_presos'),'Soma informada nos serviços'],
    ['Armas apreendidas',soma(a,'armas_apreendidas'),soma(b,'armas_apreendidas'),'Soma informada nos serviços']
   ];
   const comparativo=tabela(['INDICADOR','ATUAL','COMPARADO','CRITÉRIO'],indicadores.map(x=>linha(...x)));
   const locais=tabela(['LOCAL DE ATIVIDADE','SERVIÇOS'],rank(a,x=>x.localidade||x.bairro).map(([nome,total])=>'<tr><td>'+esc(nome)+'</td><td>'+numero(total)+'</td></tr>'));
   const modalidades=tabela(['MODALIDADE','SERVIÇOS'],rank(a,'tipo_policiamento').map(([nome,total])=>'<tr><td>'+esc(nome.replaceAll('_',' '))+'</td><td>'+numero(total)+'</td></tr>'));
   const met='<p class="source">Fonte: cavalaria_servicos_produtividade, por data_servico. Período comparado: '+esc(intervaloComparado.join(' a '))+'. Registros de serviços não são somados como ocorrências policiais. Eventos e operações são categorias consolidadas sem dupla contagem por registro.</p>';
   publicar([capa(unidade,'assets/logos/cavalaria-brasao.jpg',inicio,fim,'RELATÓRIO ESTATÍSTICO DE PRODUTIVIDADE DA CAVALARIA'),pagina('1. Indicadores e comparativo de produtividade',comparativo+met,unidade,inicio,fim),pagina('2. Serviços por modalidade e localidade','<h3 class="subtitle">MODALIDADES DE SERVIÇO</h3>'+modalidades+'<h3 class="subtitle">LOCAIS COM MAIS ATIVIDADES</h3>'+locais+met+assinatura(ass),unidade,inicio,fim)],unidade,inicio,fim);
 }catch(e){console.error('Relatório Cavalaria',e);el.innerHTML='<div class="notice">Erro ao gerar relatório da Cavalaria: '+esc(e.message||e)+'</div>'}
}
async function cipg({db,inicio,fim,intervaloComparado,unidade,assinatura:ass}){
 const el=document.getElementById('document');
 el.innerHTML='<div class="notice">Conferindo serviços e eventos no caderno da CIPG...</div>';
 try{
   const [a,b]=await Promise.all([global.CipgHome.consultar(db,inicio,fim),global.CipgHome.consultar(db,intervaloComparado[0],intervaloComparado[1])]);
   const k=global.CipgHome.indicadores(a),ant=global.CipgHome.indicadores(b);
   const indicadores=[
    ['Relatórios de serviço',k.relatoriosServico,ant.relatoriosServico,'Data da prestação do serviço'],
    ['Entradas hospitalares de PM',k.entradasPmHospital,ant.entradasPmHospital,'Eventos vinculados ao serviço'],
    ['Serviços sem alteração',k.servicosSemAlteracao,ant.servicosSemAlteracao,'Situação S/A e nenhum evento vinculado'],
    ['Empregos de efetivo',k.empregosEfetivo,ant.empregosEfetivo,'Ordinário + SVI; não PMs únicos'],
    ['Instituições atendidas',k.instituicoesAtendidas,ant.instituicoesAtendidas,'Instituições distintas por período'],
    ['Rondas realizadas',soma(a.servicos,'rondas_realizadas'),soma(b.servicos,'rondas_realizadas'),'Conforme caderno de serviços'],
    ['Intercorrências informadas',soma(a.servicos,'intercorrencias'),soma(b.servicos,'intercorrencias'),'Somatório por serviço']
   ];
   const comparativo=tabela(['INDICADOR','ATUAL','COMPARADO','CRITÉRIO'],indicadores.map(x=>linha(...x)));
   const locais=tabela(['POSTO / INSTITUIÇÃO','SERVIÇOS'],rank(a.servicos,x=>x.posto_codigo||x.instituicao).map(([nome,total])=>'<tr><td>'+esc(nome)+'</td><td>'+numero(total)+'</td></tr>'));
   const eventos=tabela(['ACONTECIMENTO NO LIVRO DE SERVIÇO','REGISTROS'],rank(a.eventos,'tipo_evento').map(([nome,total])=>'<tr><td>'+esc(nome)+'</td><td>'+numero(total)+'</td></tr>'));
   const met='<p class="source">Fonte: cipg_servicos_guarda e cipg_eventos_guarda, por data_servico e eventos vinculados ao serviço. Período comparado: '+esc(intervaloComparado.join(' a '))+'. Empregos de efetivo não significam policiais únicos; serviços e acontecimentos não são contados como BOs.</p>';
   publicar([capa(unidade,'assets/logos/cipg-brasao.png',inicio,fim,'RELATÓRIO ESTATÍSTICO DE SERVIÇOS DE GUARDA'),pagina('1. Serviços e produtividade no período',comparativo+met,unidade,inicio,fim),pagina('2. Instituições, postos e acontecimentos','<h3 class="subtitle">POSTOS COM MAIS SERVIÇOS</h3>'+locais+'<h3 class="subtitle">EVENTOS REGISTRADOS</h3>'+eventos+met+assinatura(ass),unidade,inicio,fim)],unidade,inicio,fim);
 }catch(e){console.error('Relatório CIPG',e);el.innerHTML='<div class="notice">Erro ao gerar relatório da CIPG: '+esc(e.message||e)+'</div>'}
}
global.RelatorioEspecializado=Object.freeze({cipg,cavalaria});
})(window);
