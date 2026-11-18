/* CIPG — Caderno Digital. Código automático; serviço e eventos salvos em uma transação.
 * Sem upload, BO, ROP, tático ou captura de prontuário.
 * Base funcional: 04_SIEPOM_CIPG.xlsx, abas SERVICOS / OCORRENCIAS_2026 / POSTOS.
 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const hoje=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const valor=id=>String($(id)?.value||'').trim();
const opcao=(value,label)=>'<option value="'+esc(value)+'">'+esc(label||value)+'</option>';
const grupos={
 tipos:['ENTRADA DE PM NO HOSPITAL','ALTA / SAÍDA DE PM DO HOSPITAL','DESACATO','AMEAÇA','ÓBITO DE PM','ALTERAÇÃO NO POSTO','FUGA / EVASÃO','TUMULTO','APOIO PRESTADO','OUTROS'],
 graduacoes:['CEL','TEN CEL','MAJ','CAP','1º TEN','2º TEN','ASP OF','ST','1º SGT','2º SGT','3º SGT','CB','SD','CIVIL','OUTRO'],
 emServico:['SIM','NÃO','NÃO INFORMADO'],
 causas:['ACIDENTE DE TRÂNSITO','ATROPELAMENTO','PAF — ARMA DE FOGO','ARMA BRANCA','AGRESSÃO FÍSICA','INFARTO / PROBLEMA CARDÍACO','AVC','MAL SÚBITO','SURTO / CRISE PSIQUIÁTRICA','QUEDA','OUTRA DOENÇA','OUTROS'],
 conducao:['SAMU','VIATURA PM','CORPO DE BOMBEIROS','MEIOS PRÓPRIOS','OUTROS','NÃO INFORMADO'],
 desfechos:['EM ATENDIMENTO','EM OBSERVAÇÃO','INTERNADO','LIBERADO','TRANSFERIDO','ÓBITO']
};
let sessao,servicoSalvoId=null,eventCounter=0,loading=false,solicitacaoId=null,payloadPendente=null;
const status=(mensagem,erro=false)=>{
 const el=$('status');el.textContent=mensagem;el.className='status'+(erro?' erro':' ok');
};
function turno(hora){
 if(!/^\d{2}:\d{2}$/.test(String(hora||'')))return '';
 const [h,m]=hora.split(':').map(Number);
 if(h>23||m>59)return '';
 return (h*60+m>=480&&h*60+m<1200)?'1º turno (08h–20h)':'2º turno (20h–08h)';
}
function intCampo(id){const s=valor(id);const v=s===''?0:Number(s);if(!Number.isInteger(v)||v<0||v>10000)throw Error('Quantidade inválida: '+$(id).dataset.label);return v}
function numeroOpcional(id){
 if(valor(id)==='')return null;
 const n=Number(valor(id));if(!Number.isFinite(n)||n<0)throw Error('Número inválido em '+$(id).dataset.label);
 return n;
}
function autenticado(){
 const sigla=String(sessao?.contexto?.sigla||sessao?.perfil?.unidades?.sigla||'').toUpperCase();
 const perfil=String(sessao?.perfil?.perfil||'').toUpperCase();
 return sigla==='CIPG'&&sessao?.temModulo?.('PRODUTIVIDADE_CIPG')===true
 &&(perfil==='CADERNO_CIPG'&&sessao?.pode?.('caderno_cipg')===true
 || ['ADMIN','ESTATISTICA','OPERADOR'].includes(perfil)&&sessao?.pode?.('cadastro')!==false);
}
function tipoSelect(lista){return opcao('','Não informado')+lista.map(x=>opcao(x)).join('')}
function campoEvento(nome,label,conteudo){return '<label class="field"><span>'+esc(label)+'</span>'+conteudo+'</label>'}
function valorEvento(no,key){return no.querySelector('[data-col="'+key+'"]')?.value?.trim()||''}
function itemEvento(){
 const nr=++eventCounter;
 return '<article class="evento" data-evento="'+nr+'"><div class="evento-head"><b>Militar / acontecimento <span class="evento-num">'+nr+'</span></b>'+
 '<button type="button" data-remove="'+nr+'" class="btn-subtle">Remover</button></div>'+
 '<div class="fieldgrid">'+
 campoEvento('tipo','Tipo de acontecimento *','<select data-col="tipo_evento" required>'+opcao('','Selecione o acontecimento')+grupos.tipos.map(x=>opcao(x)).join('')+'</select>')+
 campoEvento('data','Data do fato','<input data-col="data_evento" type="date" value="'+esc(valor('dia'))+'">')+
 campoEvento('hora','Hora do fato','<input data-col="hora_evento" type="time">')+
 campoEvento('turno','Turno calculado','<output data-turno class="output">Informe a hora</output>')+
 campoEvento('descricao','Descrição administrativa','<textarea data-col="descricao_evento" maxlength="500" placeholder="Descreva apenas o fato, sem dados sensíveis"></textarea>')+
 campoEvento('acionamento','Houve acionamento de viatura de outra unidade?','<select data-col="acionou_viatura">'+opcao('','Não informado')+opcao('SIM','Sim')+opcao('NAO','Não')+'</select>')+
 campoEvento('unidadeAcionada','Unidade acionada (se conhecida)','<input data-col="unidade_acionada" maxlength="120" disabled>')+
 campoEvento('ppe','Nº PPE, quando houver (opcional)','<input data-col="numero_ppe" maxlength="120">')+
 '<div class="wide"><details data-detalhes><summary>Dados do militar e atendimento (quando houver)</summary><div class="fieldgrid">'+
 campoEvento('graduacao','Graduação','<select data-col="graduacao">'+tipoSelect(grupos.graduacoes)+'</select>')+
 campoEvento('unidade','Unidade do militar','<input data-col="unidade_militar" maxlength="120" placeholder="Ex.: 1º BPM">')+
 campoEvento('em_servico','Estava em serviço?','<select data-col="em_servico">'+tipoSelect(grupos.emServico)+'</select>')+
 campoEvento('causa','Causa / motivo','<select data-col="causa_motivo">'+tipoSelect(grupos.causas)+'</select>')+
 campoEvento('conducao','Conduzido por','<select data-col="conduzido_por">'+tipoSelect(grupos.conducao)+'</select>')+
 campoEvento('setor','Setor de atendimento','<input data-col="setor_atendimento" maxlength="120" placeholder="Se constar no relato">')+
 campoEvento('desfecho','Desfecho','<select data-col="desfecho">'+tipoSelect(grupos.desfechos)+'</select>')+
 campoEvento('apoio','Apoio / acompanhamento','<input data-col="apoio_acompanhamento" maxlength="160" placeholder="Apenas resumo administrativo, sem nomes">')+
 '</div></details></div></div><p class="helper">Não informar nome do militar, lesões, diagnóstico ou dados clínicos.</p></article>';
}
function linhasEventos(){return [...document.querySelectorAll('#listaEventos .evento')]}
function situacao(){
 const temEventos=valor('houveEvento')==='SIM';
 const alteracoes=['alteracaoPessoal','alteracaoInstalacoes','alteracaoMaterial'].some(k=>valor(k)==='SIM');
 $('situacao').value=temEventos||alteracoes?'COM ALTERACAO':'SEM ALTERACAO';
 $('eventosWrap').hidden=!temEventos;
 $('contagemEventos').textContent=String(linhasEventos().length);
 $('totalEventos').value=String(linhasEventos().length);
}
function atualizarEfetivo(){
  const a=Number(valor('efetivoOrdinario'))||0,b=Number(valor('efetivoSvi'))||0;
  $('efetivoTotal').value=String(Math.max(0,a)+Math.max(0,b));
}
function atualizarKm(){
 const a=valor('kmInicial'),b=valor('kmFinal');
 const completo=a!==''&&b!=='',valido=completo&&Number(a)>=0&&Number(b)>=Number(a);
 $('kmRodados').readOnly=true;
 $('kmRodados').value=valido?(Number(b)-Number(a)).toFixed(2):'';
 $('kmAjuda').textContent=completo&&!valido?'Km final não pode ser menor que Km inicial.':'Distância calculada automaticamente com os dois hodômetros.';
}
function atualizarAlteracoes(){
 for(const id of ['alteracaoPessoal','alteracaoInstalacoes','alteracaoMaterial']){
  const visivel=valor(id)==='SIM';$(id+'Wrap').hidden=!visivel;$(id+'Descricao').disabled=!visivel;
  if(!visivel)$(id+'Descricao').value='';
 }
 situacao();
}
async function carregarPostos(){
 const r=await sessao.client.from('cipg_postos').select('codigo,nome,tipo_local,ativo').eq('ativo',true).order('codigo');
 if(r.error)throw Error('Falha ao consultar postos: '+r.error.message);
 const postos=r.data||[];
 $('posto').innerHTML=opcao('','Selecione o posto')+postos.map(x=>opcao(x.codigo,x.codigo+' — '+x.nome)).join('');
 const mapa=Object.fromEntries(postos.map(x=>[x.codigo,x]));
 $('posto').addEventListener('change',()=>{$('tipoLocal').value=mapa[valor('posto')]?.tipo_local||'OUTRO'});
}
async function carregarEfetivo(){
 const r=await sessao.client.rpc('cipg_listar_efetivo_caderno');
 if(r.error)throw Error('Falha ao consultar militares: '+r.error.message);
 for(const id of ['comandante','recebeuDe','passouPara'])
  $(id).innerHTML=opcao('','Não informado')+(r.data||[]).map(x=>opcao(x.id,x.nome)).join('');
}
function documentoServico(){
 if(!valor('posto'))throw Error('Selecione um posto de serviço cadastrado.');
 if(!valor('dia'))throw Error('Informe a data do serviço.');
 if(!valor('turnoServico'))throw Error('Selecione o 1º ou 2º turno da CIPG.');

 if(valor('houveEvento')==='SIM'&&!linhasEventos().length)throw Error('Adicione pelo menos um acontecimento ou selecione “Não” em “Houve acontecimento?”.');
 if(valor('kmInicial')!==''&&valor('kmFinal')!==''&&Number(valor('kmFinal'))<Number(valor('kmInicial')))throw Error('Km final deve ser maior ou igual ao inicial.');
 return {
  unidade_id:sessao.contexto.unidade_id,
  data_servico:valor('dia'),
  posto_codigo:valor('posto'),
  instituicao:valor('instituicao')||null,
  tipo_local:valor('tipoLocal'),
  modalidade:valor('modalidade'),
  regime:valor('regime')||null,
  turno_cipg:valor('turnoServico'),
  comandante_id:valor('comandante')||null,
  recebeu_de_id:valor('recebeuDe')||null,
  passou_para_id:valor('passouPara')||null,
  efetivo_ordinario:intCampo('efetivoOrdinario'),
  efetivo_svi:intCampo('efetivoSvi'),
  viatura:valor('viatura')||null,
  km_inicial:numeroOpcional('kmInicial'),
  km_final:numeroOpcional('kmFinal'),
  km_rodados:numeroOpcional('kmRodados'),
  litros_abastecidos:numeroOpcional('litros'),
  rondas_realizadas:0,
  saidas_autorizadas:valor('saidas')===''?null:intCampo('saidas'),
  alteracao_pessoal:valor('alteracaoPessoal')==='SIM',
  alteracao_instalacoes:valor('alteracaoInstalacoes')==='SIM',
  alteracao_material:valor('alteracaoMaterial')==='SIM',
  descricao_alteracao_pessoal:valor('alteracaoPessoalDescricao')||null,
  descricao_alteracao_instalacoes:valor('alteracaoInstalacoesDescricao')||null,
  descricao_alteracao_material:valor('alteracaoMaterialDescricao')||null,
  outros_solicitacoes:valor('outrosSolicitacoes')||null,
  situacao:$('situacao').value,
  intercorrencias:linhasEventos().length
 };
}
function eventoDeTela(el,servicoId){
 const reg={servico_id:servicoId,tipo_evento:valorEvento(el,'tipo_evento')};
 for(const key of ['data_evento','hora_evento','graduacao','unidade_militar','em_servico','causa_motivo','conduzido_por','setor_atendimento','desfecho','apoio_acompanhamento','descricao_evento','numero_ppe']){
  reg[key]=valorEvento(el,key)||null;
 }
 reg.acionou_viatura=valorEvento(el,'acionou_viatura')==='SIM'?true:valorEvento(el,'acionou_viatura')==='NAO'?false:null;
 reg.unidade_acionada=reg.acionou_viatura?valorEvento(el,'unidade_acionada')||null:null;
 return reg;
}
async function salvar(evt){
 evt.preventDefault();
 if(!autenticado()||loading||!$('form').reportValidity())return;
 loading=true;$('salvar').disabled=true;
 try{
  const payload=documentoServico(),eventos=linhasEventos().map(el=>eventoDeTela(el,null));
  const assinatura=JSON.stringify([payload,eventos]);
  if(payloadPendente&&payloadPendente!==assinatura)throw Error('Há uma tentativa de envio pendente. Confira os últimos relatórios e repita o envio original antes de iniciar outro.');
  solicitacaoId=solicitacaoId||crypto.randomUUID();
  payloadPendente=assinatura;
  const r=await sessao.client.rpc('cipg_salvar_relatorio',{p_id:solicitacaoId,p_servico:payload,p_eventos:eventos});
  if(r.error){
   if(r.error.code&&/^(22|23|P0|42)/.test(r.error.code)){solicitacaoId=null;payloadPendente=null;}
   throw r.error;
  }
  if(!r.data?.codigo_relatorio)throw Error('Não foi possível confirmar o código do relatório. Repita o mesmo envio.');
  const codigo=r.data.codigo_relatorio;
  solicitacaoId=null;payloadPendente=null;servicoSalvoId=null;
  $('form').reset();$('dia').value=hoje();$('listaEventos').innerHTML='';eventCounter=0;
  for(const d of $('form').querySelectorAll('details'))d.open=false;
  atualizarAlteracoes();atualizarKm();atualizarEfetivo();
  const el=$('recibo');el.hidden=false;el.textContent='Registro concluído: '+codigo+'. Formulário pronto para novo serviço.';
  status('Relatório '+codigo+' salvo com sucesso.');await listar();
 }catch(e){status('Não foi possível confirmar o salvamento: '+(e.message||e),true);}
 finally{loading=false;$('salvar').disabled=false;}
}
async function listar(){
 const r=await sessao.client.from('cipg_servicos_guarda')
  .select('id,data_servico,codigo_relatorio,numero_sei,posto_codigo,instituicao,situacao,efetivo_ordinario,efetivo_svi')
  .eq('unidade_id',sessao.contexto.unidade_id).order('data_servico',{ascending:false}).limit(15);
 const host=$('recentes');
 if(r.error){host.textContent='Não foi possível consultar os últimos serviços: '+r.error.message;return}
 if(!r.data?.length){host.textContent='Nenhum relatório lançado ainda. Registre o primeiro serviço acima.';return}
 host.innerHTML=r.data.map(x=>'<article class="recent-card"><b>'+esc(x.codigo_relatorio||x.numero_sei||'Não informado')+'</b>'+
  '<span>'+esc(x.data_servico?.split('-').reverse().join('/')||'')+' · '+esc(x.posto_codigo||x.instituicao)+'</span>'+
  '<span>'+esc(x.situacao==='SEM ALTERACAO'?'Sem alteração (S/A)':'Com alteração')+' · Efetivo '+(Number(x.efetivo_ordinario)||0)+' ordinário + '+(Number(x.efetivo_svi)||0)+' SVI</span>'+
  '</article>').join('');
}
function ligarEventos(){
 $('houveEvento').addEventListener('change',()=>{
  if(valor('houveEvento')==='NAO'&&linhasEventos().length){
   if(servicoSalvoId){
    $('houveEvento').value='SIM';
    status('O relatório já está salvo. Conclua os acontecimentos pendentes antes de mudar a situação.',true);
    return;
   }
   if(!window.confirm('Descartar os acontecimentos preenchidos e marcar o relatório sem acontecimentos?')){
    $('houveEvento').value='SIM';
    return;
   }
   $('listaEventos').innerHTML='';
   eventCounter=0;
  }
  if(valor('houveEvento')==='SIM'&&!linhasEventos().length)$('listaEventos').insertAdjacentHTML('beforeend',itemEvento());
  situacao();
 });
 for(const id of ['alteracaoPessoal','alteracaoInstalacoes','alteracaoMaterial'])$(id).addEventListener('change',atualizarAlteracoes);
 $('adicionarEvento').addEventListener('click',()=>{$('listaEventos').insertAdjacentHTML('beforeend',itemEvento());situacao()});
 $('listaEventos').addEventListener('click',e=>{
  const b=e.target.closest('[data-remove]');if(!b)return;
  const card=b.closest('[data-evento]');
  if(card?.dataset.gravado==='sim')return status('O acontecimento já salvo não pode ser excluído neste formulário. Solicite correção ao setor de estatística.',true);
  card?.remove();situacao();
 });
 $('listaEventos').addEventListener('change',e=>{
  if(e.target.dataset.col==='acionou_viatura'){const el=e.target.closest('[data-evento]').querySelector('[data-col="unidade_acionada"]');el.disabled=e.target.value!=='SIM';if(el.disabled)el.value='';return;}
  if(e.target.dataset.col!=='tipo_evento')return;
  const detalhes=e.target.closest('[data-evento]')?.querySelector('[data-detalhes]');
  if(detalhes)detalhes.open=/HOSPITAL|ÓBITO DE PM/.test(e.target.value);
 });
 $('listaEventos').addEventListener('input',e=>{
  if(e.target.dataset.col!=='hora_evento')return;
  const card=e.target.closest('[data-evento]');
  card.querySelector('[data-turno]').textContent=turno(e.target.value)||'Informe a hora';
 });
 $('efetivoOrdinario').addEventListener('input',atualizarEfetivo);
 $('efetivoSvi').addEventListener('input',atualizarEfetivo);
 $('kmInicial').addEventListener('input',atualizarKm);
 $('kmFinal').addEventListener('input',atualizarKm);
 $('form').addEventListener('submit',salvar);
 $('limpar').addEventListener('click',()=>{
  if(loading||payloadPendente){status('Conclua ou confirme o envio pendente antes de limpar.',true);return}
  $('form').reset();$('listaEventos').innerHTML='';eventCounter=0;$('dia').value=hoje();atualizarAlteracoes();atualizarKm();atualizarEfetivo();$('recibo').hidden=true;status('Formulário pronto para o próximo serviço.');
 });
}
async function iniciar(){
 try{
  sessao=window.SistemaAuth?.ready?await window.SistemaAuth.ready:window.SistemaAuth;
  if(!sessao||!autenticado()){window.location.replace('index.html?erro=sem-permissao');return}
  $('dia').value=hoje();$('dia').max=hoje();ligarEventos();situacao();atualizarEfetivo();
  await Promise.all([carregarPostos(),carregarEfetivo()]);atualizarAlteracoes();atualizarKm();await listar();
  status('Pronto para registrar o livro de serviço. O relatório é feito manualmente, sem PDF.');
 }catch(e){status('Não foi possível carregar o caderno: '+(e.message||e),true)}
}
window.CipgCaderno={iniciar,turno,documentoServico};
})();