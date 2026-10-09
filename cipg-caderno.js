/* CIPG — Caderno Digital. Um serviço por Nº SEI; eventos adicionais no mesmo lançamento.
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
 tipos:['ENTRADA DE PM NO HOSPITAL','ÓBITO DE PM','ALTERAÇÃO NO POSTO','FUGA / EVASÃO','TUMULTO','APOIO PRESTADO','OUTROS'],
 graduacoes:['CEL','TEN CEL','MAJ','CAP','1º TEN','2º TEN','ASP OF','ST','1º SGT','2º SGT','3º SGT','CB','SD','CIVIL','OUTRO'],
 emServico:['SIM','NÃO','NÃO INFORMADO'],
 causas:['ACIDENTE DE TRÂNSITO','ATROPELAMENTO','PAF — ARMA DE FOGO','ARMA BRANCA','AGRESSÃO FÍSICA','INFARTO / PROBLEMA CARDÍACO','AVC','MAL SÚBITO','SURTO / CRISE PSIQUIÁTRICA','QUEDA','OUTRA DOENÇA','OUTROS'],
 conducao:['SAMU','VIATURA PM','CORPO DE BOMBEIROS','MEIOS PRÓPRIOS','OUTROS','NÃO INFORMADO'],
 desfechos:['EM ATENDIMENTO','EM OBSERVAÇÃO','INTERNADO','LIBERADO','TRANSFERIDO','ÓBITO']
};
let sessao,servicoSalvoId=null,eventCounter=0,loading=false;
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
 return sigla==='CIPG'&&['ADMIN','ESTATISTICA','OPERADOR'].includes(perfil)
 &&sessao?.pode?.('cadastro')!==false
 &&sessao?.temModulo?.('PRODUTIVIDADE_CIPG')===true;
}
function tipoSelect(lista){return opcao('','Não informado')+lista.map(x=>opcao(x)).join('')}
function campoEvento(nome,label,conteudo){return '<label class="field"><span>'+esc(label)+'</span>'+conteudo+'</label>'}
function valorEvento(no,key){return no.querySelector('[data-col="'+key+'"]')?.value?.trim()||''}
function itemEvento(){
 const nr=++eventCounter;
 return '<article class="evento" data-evento="'+nr+'"><div class="evento-head"><b>Militar / acontecimento <span class="evento-num">'+nr+'</span></b>'+
 '<button type="button" data-remove="'+nr+'" class="btn-subtle">Remover</button></div>'+
 '<div class="fieldgrid">'+
 campoEvento('tipo','Tipo de acontecimento *','<select data-col="tipo_evento" required>'+grupos.tipos.map(x=>opcao(x)).join('')+'</select>')+
 campoEvento('data','Data do fato','<input data-col="data_evento" type="date" value="'+esc(valor('dia'))+'">')+
 campoEvento('hora','Hora do fato','<input data-col="hora_evento" type="time">')+
 campoEvento('turno','Turno calculado','<output data-turno class="output">Informe a hora</output>')+
 '<div class="wide"><details data-detalhes open><summary>Dados do militar e atendimento (quando houver)</summary><div class="fieldgrid">'+
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
 const a=numeroOpcional('kmInicial'),b=numeroOpcional('kmFinal');
 if(a!==null&&b!==null){
   $('kmRodados').value=b>=a?(b-a).toFixed(2):'';
   $('kmRodados').readOnly=true;
   $('kmAjuda').textContent=b>=a?'Calculado automaticamente pela diferença entre os hodômetros.':'Km final não pode ser menor que Km inicial.';
 }else{
   $('kmRodados').readOnly=false;
   $('kmAjuda').textContent='Sem os dois hodômetros, você pode informar apenas os km rodados.';
 }
}
async function carregarPostos(){
 const r=await sessao.client.from('cipg_postos').select('codigo,nome,tipo_local,ativo').eq('ativo',true).order('codigo');
 if(r.error)throw Error('Falha ao consultar postos: '+r.error.message);
 const postos=r.data||[];
 $('posto').innerHTML=opcao('','Selecione o posto (ou outro)')+postos.map(x=>opcao(x.codigo,x.codigo+' — '+x.nome)).join('')+opcao('OUTRO','Outro posto / instituição não cadastrada');
 const mapa=Object.fromEntries(postos.map(x=>[x.codigo,x]));
 $('posto').addEventListener('change',()=>{
  if(mapa[valor('posto')]){$('instituicao').value=mapa[valor('posto')].nome;$('tipoLocal').value=mapa[valor('posto')].tipo_local;}
  else $('instituicao').value='';
 });
}
function documentoServico(){
 const documento=valor('documento');
 if(!documento||documento.length<3)throw Error('Informe o Nº SEI do relatório de serviço.');
 if(!valor('dia'))throw Error('Informe a data do serviço.');
 if(!valor('turnoServico'))throw Error('Selecione o 1º ou 2º turno da CIPG.');
 if(!valor('instituicao')||valor('instituicao').length<3)throw Error('Selecione ou informe a instituição atendida.');
 if(valor('houveEvento')==='SIM'&&!linhasEventos().length)throw Error('Adicione pelo menos um acontecimento ou selecione “Não” em “Houve acontecimento?”.');
 if(valor('kmInicial')!==''&&valor('kmFinal')!==''&&Number(valor('kmFinal'))<Number(valor('kmInicial')))throw Error('Km final deve ser maior ou igual ao inicial.');
 return {
  unidade_id:sessao.contexto.unidade_id,
  data_servico:valor('dia'),
  numero_sei:documento,
  documento_referencia:documento,
  posto_codigo:valor('posto')&&valor('posto')!=='OUTRO'?valor('posto'):null,
  instituicao:valor('instituicao'),
  tipo_local:valor('tipoLocal'),
  modalidade:valor('modalidade'),
  regime:valor('regime')||null,
  turno_cipg:valor('turnoServico'),
  comandante:valor('comandante')||null,
  recebeu_de:valor('recebeuDe')||null,
  passou_para:valor('passouPara')||null,
  efetivo_ordinario:intCampo('efetivoOrdinario'),
  efetivo_svi:intCampo('efetivoSvi'),
  viatura:valor('viatura')||null,
  km_inicial:numeroOpcional('kmInicial'),
  km_final:numeroOpcional('kmFinal'),
  km_rodados:numeroOpcional('kmRodados'),
  litros_abastecidos:numeroOpcional('litros'),
  rondas_realizadas:intCampo('rondas'),
  saidas_autorizadas:valor('saidas')===''?null:intCampo('saidas'),
  alteracao_pessoal:valor('alteracaoPessoal')==='SIM',
  alteracao_instalacoes:valor('alteracaoInstalacoes')==='SIM',
  alteracao_material:valor('alteracaoMaterial')==='SIM',
  outros_solicitacoes:valor('outrosSolicitacoes')||null,
  situacao:$('situacao').value,
  intercorrencias:linhasEventos().length
 };
}
function eventoDeTela(el,servicoId){
 const reg={servico_id:servicoId,tipo_evento:valorEvento(el,'tipo_evento')};
 for(const key of ['data_evento','hora_evento','graduacao','unidade_militar','em_servico','causa_motivo','conduzido_por','setor_atendimento','desfecho','apoio_acompanhamento']){
  reg[key]=valorEvento(el,key)||null;
 }
 return reg;
}
async function salvar(evt){
 evt.preventDefault();
 if(!autenticado()||loading)return;
 $('form').reportValidity();
 if(!$('form').checkValidity())return;
 loading=true;$('salvar').disabled=true;
 try{
  const payload=documentoServico();
  if(!servicoSalvoId){
   const r=await sessao.client.from('cipg_servicos_guarda').insert(payload).select('id').single();
   if(r.error){
    if(r.error.code==='23505')throw Error('Este número SEI já foi cadastrado. Confira os últimos registros antes de lançar outro serviço.');
    throw r.error;
   }
   if(!r.data?.id)throw Error('O servidor não retornou a identificação do serviço salvo.');
   servicoSalvoId=r.data.id;
   status('Relatório de serviço salvo. Registrando os acontecimentos...');
  }
  for(const el of linhasEventos()){
   if(el.dataset.gravado==='sim')continue;
   const row=eventoDeTela(el,servicoSalvoId);
   const r=await sessao.client.from('cipg_eventos_guarda').insert(row);
   if(r.error)throw new Error('Relatório já salvo; não foi possível registrar um acontecimento: '+r.error.message);
   el.dataset.gravado='sim';
   el.classList.add('gravado');
  }
  status('Relatório SEI '+payload.numero_sei+' e '+linhasEventos().length+' acontecimento(s) registrados com sucesso.');
  const el=$('recibo');el.hidden=false;el.textContent='Registro concluído: SEI '+payload.numero_sei+'. Você já pode iniciar outro serviço.';
  servicoSalvoId=null;
  $('form').reset();$('dia').value=hoje();
  $('listaEventos').innerHTML='';eventCounter=0;
  $('kmRodados').readOnly=false;
  situacao();atualizarKm();atualizarEfetivo();
  await listar();
 }catch(e){
  console.error('CIPG caderno',e);
  status((servicoSalvoId?'O relatório já foi salvo. Revise e toque em “Concluir acontecimentos” para tentar novamente. ':'')+(e.message||e),true);
  if(servicoSalvoId)$('salvar').textContent='Concluir acontecimentos';
 }finally{loading=false;$('salvar').disabled=false;if(!servicoSalvoId)$('salvar').textContent='Salvar relatório de serviço'}
}
async function listar(){
 const r=await sessao.client.from('cipg_servicos_guarda')
  .select('id,data_servico,numero_sei,posto_codigo,instituicao,situacao,efetivo_ordinario,efetivo_svi')
  .eq('unidade_id',sessao.contexto.unidade_id).order('data_servico',{ascending:false}).limit(15);
 const host=$('recentes');
 if(r.error){host.textContent='Não foi possível consultar os últimos serviços: '+r.error.message;return}
 if(!r.data?.length){host.textContent='Nenhum relatório lançado ainda. Registre o primeiro serviço acima.';return}
 host.innerHTML=r.data.map(x=>'<article class="recent-card"><b>SEI '+esc(x.numero_sei||'Não informado')+'</b>'+
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
 for(const id of ['alteracaoPessoal','alteracaoInstalacoes','alteracaoMaterial'])$(id).addEventListener('change',situacao);
 $('adicionarEvento').addEventListener('click',()=>{$('listaEventos').insertAdjacentHTML('beforeend',itemEvento());situacao()});
 $('listaEventos').addEventListener('click',e=>{
  const b=e.target.closest('[data-remove]');if(!b)return;
  const card=b.closest('[data-evento]');
  if(card?.dataset.gravado==='sim')return status('O acontecimento já salvo não pode ser excluído neste formulário. Solicite correção ao setor de estatística.',true);
  card?.remove();situacao();
 });
 $('listaEventos').addEventListener('change',e=>{
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
 $('kmInicial').addEventListener('change',atualizarKm);
 $('kmFinal').addEventListener('change',atualizarKm);
 $('form').addEventListener('submit',salvar);
 $('limpar').addEventListener('click',()=>{
  if(servicoSalvoId){status('O relatório já foi salvo, mas há acontecimentos pendentes. Conclua o registro antes de limpar.',true);return}
  $('form').reset();$('listaEventos').innerHTML='';eventCounter=0;$('dia').value=hoje();situacao();atualizarKm();atualizarEfetivo();$('recibo').hidden=true;status('Formulário pronto para o próximo serviço.');
 });
}
async function iniciar(){
 try{
  sessao=window.SistemaAuth?.ready?await window.SistemaAuth.ready:window.SistemaAuth;
  if(!sessao||!autenticado()){window.location.replace('index.html?erro=sem-permissao');return}
  $('dia').value=hoje();$('dia').max=hoje();ligarEventos();situacao();atualizarEfetivo();
  await carregarPostos();await listar();
  status('Pronto para registrar o livro de serviço. O relatório é feito manualmente, sem PDF.');
 }catch(e){status('Não foi possível carregar o caderno: '+(e.message||e),true)}
}
window.CipgCaderno={iniciar,turno,documentoServico};
})();