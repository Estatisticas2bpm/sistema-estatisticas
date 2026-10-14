/* SIE-CPC — Análises do Dashboard Completo incorporadas ao Painel Geral.
 * Consultas exclusivamente de leitura, lazy-load, RLS via RPC SECURITY INVOKER.
 * Dados pessoais de vítimas/infratores são usados somente para contagens agregadas.
 */
(function(global){
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').trim();
const chave=v=>norm(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const ni=v=>!chave(v)||['NI','N/I','N','NA','NAO INFORMADO'].includes(chave(v));
const num=v=>Number(v)||0;
const inteiro=v=>Math.max(0,num(v));
const fmt=v=>num(v).toLocaleString('pt-BR',{maximumFractionDigits:2});
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||''));
const dataBr=v=>String(v||'').slice(0,10).split('-').reverse().join('/');
let db=null,config=null,versao=0,carregou=false,iniciado=false,linhas=[],grupos=[],indicadores=[];
function hierarquiaIds(id,unidades){
  if(!id)return null;
  const ids=new Set(),fila=[String(id)];
  while(fila.length){
    const x=fila.shift();
    if(ids.has(x))continue;
    ids.add(x);
    (unidades||[]).filter(u=>String(u.parent_id||'')===x).forEach(u=>fila.push(String(u.id)));
  }
  return ids;
}
function contem(a,b){return chave(a).includes(chave(b))}
function filtro(o,a,ids){
  if(ids&&!ids.has(String(o.unidade_id||'')))return false;
  if(a.p_aisc&&chave(o.aisc)!==chave(a.p_aisc))return false;
  if(a.p_sisc&&chave(o.sisc)!==chave(a.p_sisc))return false;
  if(a.p_setor&&chave(o.setor)!==chave(a.p_setor))return false;
  if(a.p_companhia&&chave(o.companhia)!==chave(a.p_companhia))return false;
  if(a.p_turno&&chave(o.turno)!==chave(a.p_turno))return false;
  if(a.p_bairro&&!contem(o.bairro,a.p_bairro))return false;
  if(a.p_ocorrencia){
    const nomes=[o.ocorrencia,o.crime,...(Array.isArray(o.naturezas_itens)?o.naturezas_itens.map(x=>typeof x==='string'?x:x.nome||x.natureza||''):[])];
    if(!nomes.some(x=>contem(x,a.p_ocorrencia)))return false;
  }
  return true;
}
function pessoas(o,tipo){
  const prefixo=tipo==='Vítimas'?'vitima':'infrator';
  const encontrados=[];
  const direto={sexo:o[prefixo+'_sexo'],nacionalidade:o[prefixo+'_nacionalidade'],idade:o[prefixo+'_idade']};
  if([direto.sexo,direto.nacionalidade,direto.idade].some(x=>!ni(x)))encontrados.push(direto);
  const texto=String(o.observacao_final||''),marca='[[PESSOAS_ENVOLVIDAS]]',pos=texto.indexOf(marca);
  if(pos>=0){
    try{
      const dados=JSON.parse(texto.slice(pos+marca.length));
      const chaveP=tipo==='Vítimas'?'vitimas':'infratores';
      if(Array.isArray(dados[chaveP]))dados[chaveP].forEach(p=>{
        if(p&&[p.sexo,p.nacionalidade,p.idade].some(x=>!ni(x)))encontrados.push(p);
      });
    }catch(_){}
  }
  return encontrados;
}
function sexo(v){
  const k=chave(v);
  return k==='M'||k==='MASCULINO'?'Masculino':k==='F'||k==='FEMININO'?'Feminino':ni(v)?'Não informado':'Outro';
}
function nacionalidade(v){
  const k=chave(v);
  if(['BR','BRASILEIRO','BRASILEIRA','BR - BRASILEIRA','BR — BRASILEIRA'].includes(k))return 'Brasileira';
  if(['VE','VENEZUELANO','VENEZUELANA','VE - VENEZUELANA','VE — VENEZUELANA'].includes(k))return 'Venezuelana';
  return ni(v)?'Não informada':norm(v);
}
function faixa(v){
  if(ni(v))return 'Não informada';
  const n=Number(v);
  if(!Number.isInteger(n)||n<0||n>120)return 'Não informada';
  return n<12?'0–11 anos':n<18?'12–17 anos':n<30?'18–29 anos':n<45?'30–44 anos':n<60?'45–59 anos':'60 anos ou mais';
}
function sumarizar(registros){
  const out={total:registros.length,conducoes:0,veiculos:0,armas:0,municoes:0,drogas:0,foragidos:0,bens:0};
  registros.forEach(o=>{
    out.conducoes+=inteiro(o.conducoes_operacionais);
    out.veiculos+=inteiro(o.veiculos_recuperados);
    out.foragidos+=inteiro(o.foragidos);
    const itens=(campo,legado)=>Array.isArray(o[campo])&&o[campo].length?o[campo].reduce((s,i)=>s+inteiro(i.quantidade),0):inteiro(o[legado]);
    out.armas+=itens('armas_itens','quantidade_armas');
    out.municoes+=itens('municoes_itens','quantidade_municoes');
    if((Array.isArray(o.entorpecentes_itens)&&o.entorpecentes_itens.some(i=>inteiro(i.quantidade)>0))||
      ['maconha','cocaina','pasta_base','crack','skank'].some(k=>inteiro(o[k])>0)||chave(o.entorpecentes)==='SIM')out.drogas++;
    (Array.isArray(o.bens_subtraidos)?o.bens_subtraidos:[]).forEach(b=>out.bens+=Math.max(1,inteiro(b.quantidade)));
  });
  return out;
}
function ranking(registros,extrair){
  const map=new Map();
  registros.forEach(o=>{
    const valor=extrair(o);
    if(ni(valor))return;
    const k=norm(valor);
    map.set(k,(map.get(k)||0)+1);
  });
  return [...map].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR'));
}
function gerarGrupos(registros){
  const linhas=[],map=new Map();
  const adicionar=(nome,o,quantidade=1,descricao='')=>{
    if(!uuid(o.id)||quantidade<=0)return;
    const k=nome+'|'+o.id;
    const atual=map.get(k);
    if(atual){atual.quantidade+=quantidade;return}
    const linha={fonte:'BO / ocorrência',data:dataBr(o.data_ocorrencia),referencia:norm(o.numero_bo)||String(o.id),
      descricao:descricao||norm(o.ocorrencia)||'Ocorrência',quantidade,unidade:'',criterio:'data_ocorrencia',
      indicadores:[nome],registro_id:o.id,origem_tabela:'ocorrencias'};
    map.set(k,linha);linhas.push(linha);
  };
  const soma=new Map();
  const somar=(nome,o,q=1,desc='')=>{if(q<=0)return;soma.set(nome,(soma.get(nome)||0)+q);adicionar(nome,o,q,desc)};
  registros.forEach(o=>{
    if(!uuid(o.id))return;
    const nome=norm(o.comandante);
    if(!ni(nome))somar('Comandante · '+nome,o);
    const medidas=[
      ['Conduções operacionais',inteiro(o.conducoes_operacionais)],
      ['Veículos recuperados',inteiro(o.veiculos_recuperados)],
      ['Foragidos localizados',inteiro(o.foragidos)]
    ];
    medidas.forEach(([k,q])=>somar(k,o,q));
    const itens=(campo,legado)=>Array.isArray(o[campo])&&o[campo].length?o[campo].reduce((s,i)=>s+inteiro(i.quantidade),0):inteiro(o[legado]);
    somar('Armas registradas',o,itens('armas_itens','quantidade_armas'));
    somar('Munições registradas',o,itens('municoes_itens','quantidade_municoes'));
    const drogas=(Array.isArray(o.entorpecentes_itens)&&o.entorpecentes_itens.some(i=>inteiro(i.quantidade)>0))||
      ['maconha','cocaina','pasta_base','crack','skank'].some(k=>inteiro(o[k])>0)||chave(o.entorpecentes)==='SIM';
    if(drogas)somar('Ocorrências com entorpecentes',o);
    (Array.isArray(o.bens_subtraidos)?o.bens_subtraidos:[]).forEach(b=>{
      const cat=ni(b.categoria)?'Não informada':norm(b.categoria);
      somar('Bens subtraídos · '+cat,o,Math.max(1,inteiro(b.quantidade)),norm(b.descricao)||norm(o.ocorrencia));
    });
    ['Infratores','Vítimas'].forEach(tipo=>{
      pessoas(o,tipo).forEach(p=>{
        somar(tipo+' · Sexo · '+sexo(p.sexo),o);
        somar(tipo+' · Nacionalidade · '+nacionalidade(p.nacionalidade),o);
        somar(tipo+' · Idade · '+faixa(p.idade),o);
      });
    });
  });
  return {linhas,totais:soma};
}
function tabelaRanking(id,pares,prefixo,limite=10){
  const el=$(id);
  if(!el)return;
  el.innerHTML=pares.length?pares.slice(0,limite).map(([nome,q],i)=>
    '<button type="button" class="cpcAnaliseLinha" data-analise-indicador="'+esc(prefixo+nome)+'">'+
    '<span class="cpcAnalisePos">'+(i+1)+'º</span><span class="cpcAnaliseNome">'+esc(nome)+'</span>'+
    '<strong>'+fmt(q)+'</strong></button>').join(''):'<p class="empty">Sem registros informados no período.</p>';
}
function pares(totais,prefixo){
  return [...totais].filter(([k])=>k.startsWith(prefixo)).map(([k,v])=>[k.slice(prefixo.length),v])
    .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR'));
}
function cards(totais){
  const spec=[['Conduções operacionais','Conduções operacionais'],['Veículos recuperados','Veículos recuperados'],
    ['Foragidos localizados','Foragidos localizados'],['Armas registradas','Armas registradas'],
    ['Munições registradas','Munições registradas'],['Ocorrências com entorpecentes','Ocorrências com entorpecentes']];
  $('cpcAnaliseProdutividade').innerHTML=spec.map(([rotulo,k])=>
    '<button type="button" class="cpcAnaliseCartao" data-analise-indicador="'+esc(k)+'"><small>'+esc(rotulo)+'</small>'+
    '<strong>'+fmt(totais.get(k)||0)+'</strong><span>Consultar BOs de origem ↗</span></button>').join('');
}
function render(registros,escopo,esperado){
  linhas=registros;
  const calculado=sumarizar(registros),dados=gerarGrupos(registros);
  grupos=dados.linhas;indicadores=[...dados.totais];
  cards(dados.totais);
  tabelaRanking('cpcAnaliseComandantes',pares(dados.totais,'Comandante · '),'Comandante · ');
  tabelaRanking('cpcAnaliseBens',pares(dados.totais,'Bens subtraídos · '),'Bens subtraídos · ');
  ['Infratores','Vítimas'].forEach(tipo=>{
    const id=tipo==='Infratores'?'Infratores':'Vitimas';
    tabelaRanking('cpcAnalise'+id+'Sexo',pares(dados.totais,tipo+' · Sexo · '),tipo+' · Sexo · ');
    tabelaRanking('cpcAnalise'+id+'Nacionalidade',pares(dados.totais,tipo+' · Nacionalidade · '),tipo+' · Nacionalidade · ');
    tabelaRanking('cpcAnalise'+id+'Idade',pares(dados.totais,tipo+' · Idade · '),tipo+' · Idade · ');
  });
  $('cpcAnaliseEscopo').textContent=escopo;
  $('cpcAnaliseTotal').textContent=fmt(calculado.total);
  $('cpcAnaliseStatus').textContent='Análise detalhada de '+fmt(calculado.total)+' BO(s) autorizados, com as mesmas datas e filtros selecionados. Os indicadores de pessoas representam pessoas registradas; os de materiais representam quantidades, não documentos.';
  const alerta=$('cpcAnaliseConferencia');
  alerta.hidden=esperado===null||esperado===calculado.total;
  alerta.textContent=alerta.hidden?'':'Atenção: a consulta detalhada retornou '+fmt(calculado.total)+' BO(s), enquanto o resumo executivo apresenta '+fmt(esperado)+'. Os contratos de filtros podem ter critérios distintos; não trate os dois números como equivalentes até a conferência.';
  global.CpcDetalhamentoOrigem?.registrar('ANALISE',grupos,false,config.args.data_inicio,config.args.data_fim);
  $('cpcAnaliseConteudo').hidden=false;
}
function resetar(){
  ++versao;carregou=false;linhas=[];grupos=[];indicadores=[];
  const conteudo=$('cpcAnaliseConteudo'),status=$('cpcAnaliseStatus'),botao=$('cpcAnaliseCarregar');
  if(conteudo)conteudo.hidden=true;
  if(status)status.textContent='Aplique os filtros e clique em “Carregar análise detalhada”.';
  if(botao){botao.disabled=false;botao.textContent='Carregar análise detalhada'}
  const a=$('cpcAnaliseConferencia');if(a)a.hidden=true;
}
function configurar(cliente,args,unidades,esperado){
  db=cliente;config={args:{...args},unidades:[...(unidades||[])],esperado:Number.isFinite(Number(esperado))?Number(esperado):null};
  resetar();
}
async function carregar(){
  if(!db||!config)return;
  const v=++versao,botao=$('cpcAnaliseCarregar'),a=config.args;
  if(!global.CpcDocumentoLeitura?.autorizado()){
    $('cpcAnaliseStatus').textContent='A análise detalhada exige acesso autenticado ao CPC, somente leitura.';return;
  }
  botao.disabled=true;botao.textContent='Consultando...';
  $('cpcAnaliseStatus').textContent='Buscando ocorrências autorizadas para análise. Isso pode levar mais tempo em períodos anuais.';
  try{
    const r=await db.rpc('obter_dados_dashboard_territorial',{data_inicio:a.data_inicio,data_fim:a.data_fim});
    if(v!==versao)return;
    if(r.error)throw r.error;
    if(!Array.isArray(r.data))throw Error('O banco não retornou uma lista válida de ocorrências.');
    const ids=hierarquiaIds(a.p_unidade_id,config.unidades);
    const filtrados=r.data.filter(o=>filtro(o,a,ids));
    const selecionada=config.unidades.find(u=>String(u.id)===String(a.p_unidade_id));
    render(filtrados,(selecionada?.sigla||'Todas as unidades')+' · '+dataBr(a.data_inicio)+' a '+dataBr(a.data_fim),config.esperado);
    carregou=true;
  }catch(e){
    if(v!==versao)return;
    console.error('Análise integrada CPC indisponível:',e);
    $('cpcAnaliseStatus').textContent='Não foi possível carregar a análise detalhada: '+(e?.message||'falha de consulta')+'. Os resultados anteriores foram ocultados.';
    $('cpcAnaliseConteudo').hidden=true;
  }finally{
    if(v===versao){botao.disabled=false;botao.textContent='Recarregar análise detalhada'}
  }
}
function iniciar(){
  if(iniciado)return;iniciado=true;
  $('cpcAnaliseCarregar')?.addEventListener('click',carregar);
  $('cpcAnaliseIntegrada')?.addEventListener('click',e=>{
    const botao=e.target.closest('[data-analise-indicador]');
    if(!botao||!carregou||!config)return;
    const indicador=botao.dataset.analiseIndicador;
    if(!indicadores.some(([k])=>k===indicador))return;
    global.CpcDetalhamentoOrigem?.registrar('ANALISE',grupos,false,config.args.data_inicio,config.args.data_fim);
    global.CpcDetalhamentoOrigem?.abrir('ANALISE',indicador);
  });
}
global.CpcAnaliseIntegrada=Object.freeze({iniciar,configurar,carregar,resetar,filtro,hierarquiaIds,pessoas,sumarizar,gerarGrupos});
})(window);
