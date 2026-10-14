/* SIE-CPC — Visualizador documental do comando, exclusivamente leitura.
 * Reutiliza RPC invoker e SELECT com RLS; não cria links de edição ou anexos fictícios.
 */
(function(global){
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||''));
const tabelas=Object.freeze({
  ocorrencias:'Boletim de ocorrência / cadastro policial',
  tcos:'Termo circunstanciado de ocorrência',
  cipa_fauna:'CIPA · registro de fauna',
  cipa_termos_embargo:'CIPA · termo de embargo',
  cipa_autos_infracao:'CIPA · auto de infração ambiental',
  cipg_servicos_guarda:'CIPG · relatório de serviço',
  cipg_eventos_guarda:'CIPG · evento de guarda',
  cavalaria_servicos_produtividade:'Cavalaria · serviço de policiamento',
  ciptur_autos_infracao:'CIPTUR · auto de infração',
  giro_abordagens:'GIRO · registro de abordagem'
});
const rotulos=Object.freeze({
  numero_bo:'Número do BO',numero_tco:'Número do TCO',tipo_registro:'Tipo de registro',
  data_ocorrencia:'Data da ocorrência',hora_inicial:'Hora inicial',hora_final:'Hora final',
  ocorrencia:'Natureza da ocorrência',crime:'Crime',historico_resumido:'Relato / histórico resumido',
  detalhes:'Detalhes registrados',observacao:'Observações',observacao_final:'Observações finais',
  endereco:'Endereço',endereco_formatado:'Endereço formatado',bairro:'Bairro',municipio:'Município',
  vtr:'Viatura',comandante:'Comandante',componente_2:'Integrante 2',componente_3:'Integrante 3',
  componente_4:'Integrante 4',numero_conduzidos:'Pessoas conduzidas',conducoes_operacionais:'Conduções',
  veiculos_recuperados:'Veículos recuperados',materialidade:'Materialidade',
  natureza_itens:'Naturezas',naturezas_itens:'Naturezas detalhadas',crimes_itens:'Crimes detalhados',
  data_tco:'Data do TCO',data_registro:'Data do registro',numero_tr:'Número do termo de fauna',
  nome_comum:'Nome comum',nome_cientifico:'Nome científico',quantidade:'Quantidade',
  procedimento:'Procedimento',destinacao:'Destinação',data_embargo:'Data do embargo',
  area_embargada_ha:'Área embargada (ha)',data_autuacao:'Data da autuação',
  valor_multa:'Valor da multa (R$)',descricao_infracao:'Descrição da infração',
  data_servico:'Data do serviço',numero_sei:'Número SEI',documento_referencia:'Documento de referência',
  intercorrencias:'Intercorrências',situacao:'Situação',efetivo_ordinario:'Efetivo ordinário',
  efetivo_svi:'Efetivo SVI',tipo_evento:'Tipo de evento',data_evento:'Data do evento',
  observacoes:'Observações',data_infracao:'Data da infração',codigo_infracao:'Código da infração',
  descricao_snapshot:'Descrição da infração',valor_snapshot:'Valor registrado (R$)',
  registrado_em:'Data e hora do registro',tipo_abordagem:'Tipo de abordagem',
  quantidade_pessoas:'Pessoas abordadas',pessoas:'Pessoas registradas'
});
const tecnicos=new Set(['id','unidade_id','criado_por','atualizado_por','sync_id','sync_version','sync_origin',
  'sync_status','sync_error','last_synced_at','updated_at','criado_em','atualizado_em']);
const prioridade=['numero_bo','numero_tco','numero','documento_referencia','numero_sei','data_ocorrencia','data_tco',
  'data_servico','data_registro','data_embargo','data_autuacao','data_infracao','registrado_em',
  'ocorrencia','crime','tipo_evento','tipo_policiamento','tipo_abordagem','situacao',
  'municipio','bairro','endereco','vtr','comandante'];
const historicos=new Set(['historico_resumido','detalhes','observacao','observacao_final','intercorrencias','observacoes',
  'alteracao_pessoal','alteracao_instalacoes','alteracao_material','outros_solicitacoes']);
let cliente=null,versao=0,anteriorFoco=null,ativo=null,iniciado=false;
function tituloCampo(chave){
  return rotulos[chave]||chave.replaceAll('_',' ').replace(/^\w/,c=>c.toUpperCase());
}
function valor(v){
  if(v===null||v===undefined||v==='')return 'Não informado';
  if(typeof v==='boolean')return v?'Sim':'Não';
  if(typeof v==='object')return JSON.stringify(v,null,2);
  return String(v);
}
function campo(k,v){
  const formato=typeof v==='object'&&v!==null||String(v??'').includes('\n');
  return '<div class="cpcDocCampo"><dt>'+esc(tituloCampo(k))+'</dt><dd'+(formato?' class="cpcDocMultilinha"':'')+'>'+esc(valor(v))+'</dd></div>';
}
function campos(registro,selecionar){
  return Object.entries(registro||{}).filter(([k,v])=>!tecnicos.has(k)&&!k.startsWith('sync_')&&selecionar(k,v)&&v!==null&&v!=='')
    .sort(([a],[b])=>{const ia=prioridade.indexOf(a),ib=prioridade.indexOf(b);return (ia<0?999:ia)-(ib<0?999:ib)||a.localeCompare(b,'pt-BR')})
    .map(([k,v])=>campo(k,v)).join('');
}
function grupo(nome,html){
  return html?'<section class="cpcDocGrupo"><h4>'+esc(nome)+'</h4><dl>'+html+'</dl></section>':'';
}
function autorizado(){
  const a=global.SistemaAuth;
  return a?.enabled===true&&a.contexto?.tipo==='COMANDO'&&a.contexto?.somente_leitura_operacional===true&&
    a.temModulo?.('PAINEL_CPC')===true&&a.pode?.('dashboard')===true;
}
function mostrar(mensagem,erro=false){
  const el=$('cpcDocStatus');
  if(el){el.textContent=mensagem;el.classList.toggle('cpcDocErro',erro)}
}
function iniciar(){
  if(iniciado||!$('cpcDocumentoLeitura'))return;
  iniciado=true;
  $('cpcDocFechar').addEventListener('click',fechar);
  $('cpcDocumentoLeitura').addEventListener('click',e=>{if(e.target.id==='cpcDocumentoLeitura')fechar()});
  document.addEventListener('keydown',e=>{
    if($('cpcDocumentoLeitura')?.hidden)return;
    if(e.key==='Escape'){e.preventDefault();fechar();return}
    if(e.key!=='Tab')return;
    const foco=[...$('cpcDocumentoLeitura').querySelectorAll('button:not([disabled]),a[href]')].filter(x=>!x.hidden);
    if(!foco.length)return;
    const primeiro=foco[0],ultimo=foco[foco.length-1];
    if(e.shiftKey&&document.activeElement===primeiro){e.preventDefault();ultimo.focus()}
    else if(!e.shiftKey&&document.activeElement===ultimo){e.preventDefault();primeiro.focus()}
  });
  $('cpcDocVinculo').addEventListener('click',()=>{
    const x=ativo;if(!x)return;
    const id=x.ocorrencia_id||x.servico_id;
    if(!uuid(id))return;
    abrir({registro_id:id,origem_tabela:x.ocorrencia_id?'ocorrencias':'cipg_servicos_guarda',referencia:id});
  });
}
function fechar(){
  ++versao;
  const el=$('cpcDocumentoLeitura');
  if(el){if(typeof el.close==='function'&&el.open)el.close();el.hidden=true}
  ativo=null;
  if(anteriorFoco?.isConnected)anteriorFoco.focus();
}
async function buscar(linha){
  const tabela=linha.origem_tabela,id=linha.registro_id;
  if(tabela==='ocorrencias')return cliente.rpc('obter_ocorrencia_publica',{p_id:id});
  return cliente.from(tabela).select('*').eq('id',id).maybeSingle();
}
async function abrir(linha){
  iniciar();
  if(!$('cpcDocumentoLeitura'))return;
  const tabela=String(linha?.origem_tabela||''),id=String(linha?.registro_id||'');
  const token=++versao;
  if($('cpcDocumentoLeitura').hidden)anteriorFoco=document.activeElement;
  ativo=null;
  $('cpcDocumentoLeitura').hidden=false;
  if(typeof $('cpcDocumentoLeitura').showModal==='function'&&!$('cpcDocumentoLeitura').open)$('cpcDocumentoLeitura').showModal();
  $('cpcDocFechar').focus();
  $('cpcDocTitulo').textContent=tabelas[tabela]||'Registro documental';
  $('cpcDocIdentificacao').textContent=String(linha?.referencia||id||'');
  $('cpcDocConteudo').innerHTML='';
  $('cpcDocVinculo').hidden=true;
  mostrar('Consultando o registro com as permissões do usuário...');
  try{
    if(!uuid(id)||!Object.hasOwn(tabelas,tabela))throw Error('Identificador documental indisponível.');
    if(!cliente)throw Error('Consulta não inicializada.');
    if(global.SistemaAuth?.ready)await global.SistemaAuth.ready;
    if(!autorizado())throw Error('O visualizador exige contexto CPC somente leitura.');
    const r=await buscar({origem_tabela:tabela,registro_id:id});
    if(token!==versao)return;
    if(r.error)throw r.error;
    if(!r.data)throw Error('Registro não encontrado ou acesso não autorizado.');
    const doc=r.data;
    if(doc.id!==id)throw Error('Identificador de origem não corresponde ao registro.');
    ativo={...linha,ocorrencia_id:doc.ocorrencia_id||linha.ocorrencia_id,
      servico_id:doc.servico_id||linha.servico_id};
    const resumo=campos(doc,k=>!historicos.has(k));
    const historico=campos(doc,k=>historicos.has(k));
    $('cpcDocConteudo').innerHTML=grupo('Informações cadastradas',resumo)+grupo('Relato, histórico e observações',historico)+
      '<p class="cpcDocNota">Este visualizador mostra os dados salvos no SIE-CPC. O PDF original somente poderá ser aberto quando houver arquivo efetivamente armazenado e acesso autorizado. Nenhum PDF é presumido a partir do número do BO.</p>';
    const vinculo=ativo.ocorrencia_id||ativo.servico_id;
    if(uuid(vinculo)&&vinculo!==id){
      $('cpcDocVinculo').hidden=false;
      $('cpcDocVinculo').textContent=linha.ocorrencia_id?'Abrir BO vinculado (somente leitura)':'Abrir serviço vinculado (somente leitura)';
    }
    mostrar('Documento carregado para consulta. Inclusão, edição e exclusão não estão disponíveis.');
  }catch(e){
    if(token!==versao)return;
    console.error('Falha ao consultar documento CPC',e);
    mostrar('Não foi possível abrir o documento. Verifique o vínculo, a autorização e a disponibilidade do registro.',true);
  }
}
function configurar(db){cliente=db}
global.CpcDocumentoLeitura=Object.freeze({configurar,abrir,fechar,autorizado});
})(window);
