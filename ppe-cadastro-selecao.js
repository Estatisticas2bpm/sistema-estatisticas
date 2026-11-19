/* Seleção estruturada PPe durante a transição.
 * A classificação legada continua disponível até homologação dos indicadores.
 */
(function(){
'use strict';
const $=id=>document.getElementById(id),norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
const equal=(a,b)=>JSON.stringify([...new Set(a||[])].sort())===JSON.stringify([...new Set(b||[])].sort());
let db,auth,cat=[],aliases=new Map(),ids=[],originais=[],edicao=null,pronto=null,versao=0,ligacaoPdf=null;
let host=null;
function node(tag,txt,cl){const n=document.createElement(tag);if(txt!==undefined)n.textContent=txt;if(cl)n.className=cl;return n}
function nota(txt){if($('ppeSelecaoStatus'))$('ppeSelecaoStatus').textContent=txt;}
function permitido(n){return n&&n.ativo&&n.status_validacao!=='DIVERGENTE';}
function atividade(){return window.CavalariaCadastro?.ehAtividade?.()===true;}
function podeAssociar(){return !edicao||!!edicao.ppe_naturezas_selecionadas?.length||auth?.perfil?.perfil==='ADMIN';}
async function todos(tabela,ordem){let a=[];for(let i=0;;i+=500){const r=await db.from(tabela).select('*').order(ordem).range(i,i+499);if(r.error)throw Error(r.error.message);a.push(...r.data);if(r.data.length<500)return a;if(i>=100000)throw Error('Catálogo excede limite de consulta.');}}
async function atualizar(){
 if(!db)return;
 const [c,s]=await Promise.all([todos('naturezas_ppe','codigo_ppe'),todos('naturezas_ppe_sinonimos','termo')]);
 cat=c;aliases=new Map();for(const x of s){if(!aliases.has(x.natureza_id))aliases.set(x.natureza_id,[]);aliases.get(x.natureza_id).push(x.termo);}
}
function listar(){
 if(!host)return;
 host.hidden=atividade();
 const original=$('ppeOriginaisLista');original.replaceChildren();
 if(originais.length){for(const n of originais)original.append(node('li',n.codigo_ppe+' — '+n.descricao_original));}
 else original.append(node('li','Nenhuma natureza com código identificada no documento.'));
 const selecionadas=$('ppeSelecionadasLista');selecionadas.replaceChildren();
 for(const id of ids){
  const n=cat.find(x=>x.id===id),li=node('div',n?n.codigo_ppe+' — '+n.descricao_padronizada:'Natureza anteriormente vinculada (ID: '+id+')','ppe-item');
  if(n&&n.status_validacao!=='VALIDADA')li.append(node('small',' · Validação administrativa pendente'));
  if(n&&!n.ativo)li.append(node('small',' · Inativa (vínculo anterior preservado)'));
  if(podeAssociar()){const b=node('button','Remover');b.type='button';b.className='botao-secundario';b.onclick=()=>{ids=ids.filter(x=>x!==id);listar();};li.append(b);}
  selecionadas.append(li);
 }
 if(!ids.length)selecionadas.append(node('p','Nenhuma natureza PPe selecionada nesta etapa.','nota'));
 const busca=norm($('ppeBusca').value),res=$('ppeResultados');res.replaceChildren();
 const candidatas=cat.filter(n=>permitido(n)&&!ids.includes(n.id)&&(!busca||norm([n.codigo_ppe,n.descricao_original,n.descricao_padronizada,n.fundamentacao_legal,...(aliases.get(n.id)||[])].join(' ')).includes(busca)));
 for(const n of candidatas.slice(0,30)){
  const b=node('button',n.codigo_ppe+' — '+n.descricao_padronizada+' ['+n.status_validacao+']');b.type='button';b.className='ppe-opcao';
  b.disabled=!podeAssociar();b.onclick=()=>{if(ids.length>=30)return nota('Já foram selecionadas 30 naturezas.');ids.push(n.id);$('ppeBusca').value='';listar();};
  res.append(b);
 }
 if(!candidatas.length)res.append(node('p','Nenhuma natureza disponível nesta busca.','nota'));
 $('ppeBusca').disabled=!podeAssociar();
 $('ppeJustificativa').disabled=!podeAssociar();
 if(!podeAssociar())nota('A associação inicial deste BO histórico deve ser feita pelo administrador.');
}
async function iniciar(){
 if(pronto)return pronto;
 pronto=(async()=>{
  const campo=$('ocorrencia');if(!campo)return;
  const pai=campo.closest('.campo');if(!pai)return;
  host=node('div',undefined,'campo duplo ppe-selection');
  host.id='ppeSelecao';host.style.cssText='grid-column:1/-1;border:1px solid #cbd5e1;padding:14px;border-radius:11px;background:#f8fafc;display:grid;gap:9px';
  host.innerHTML='<strong>Naturezas do PPe — catálogo padronizado</strong><p class="nota">A classificação por código está em implantação. Nesta etapa, mantenha também a classificação operacional já utilizada pelo sistema; os indicadores existentes não serão alterados automaticamente.</p><details open><summary>Naturezas originais identificadas no PDF</summary><ul id="ppeOriginaisLista"></ul></details><label for="ppeBusca">Pesquisar e selecionar natureza padronizada</label><input id="ppeBusca" autocomplete="off" maxlength="160" type="search" placeholder="Código, descrição, artigo ou termo equivalente"><div id="ppeResultados" style="max-height:210px;overflow:auto;display:grid;gap:5px"></div><div id="ppeSelecionadasLista" style="display:grid;gap:7px"></div><label for="ppeJustificativa">Justificativa da correção (quando a seleção diferir do PPe ou de uma classificação anterior)</label><textarea id="ppeJustificativa" maxlength="500" rows="2" placeholder="Preencha somente quando necessário"></textarea><div><button type="button" id="ppeSolicitar" class="botao-secundario">Solicitar inclusão de natureza</button><button type="button" id="ppeAtualizar" class="botao-secundario">Atualizar catálogo</button></div><p class="nota" id="ppeSelecaoStatus" role="status" aria-live="polite"></p>';
  pai.insertAdjacentElement('afterend',host);
  const css=node('style');css.textContent='.ppe-opcao{width:100%;text-align:left;background:#fff;color:#16334e;border:1px solid #d4dee8;border-radius:7px;padding:9px;font:inherit}.ppe-opcao:hover{background:#e8f2ff;color:#16334e}.ppe-item{background:#eaf2fa;padding:10px;border-radius:8px;overflow-wrap:anywhere;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ppe-item button,.ppe-selection button.botao-secundario{width:auto}.ppe-selection[hidden]{display:none!important}';document.head.append(css);
  auth=window.SistemaAuth?.ready?await window.SistemaAuth.ready:window.SistemaAuth;db=auth?.client;
  if(!db){nota('Catálogo indisponível.');return;}
  $('ppeBusca').oninput=listar;
  $('ppeAtualizar').onclick=async()=>{try{await atualizar();listar();nota('Catálogo atualizado.');}catch(e){nota('Falha ao carregar catálogo: '+e.message);}};
  $('ppeSolicitar').onclick=async()=>{
   const valor=prompt('Informe a natureza, código se conhecido e fundamento legal. Não informe dados pessoais dos envolvidos.');
   if(!valor||valor.trim().length<3)return;
   try{const r=await db.rpc('ppe_solicitar_inclusao',{p_descricao:valor.trim().slice(0,320)});if(r.error)throw r.error;nota('Solicitação enviada ao administrador. Ela não entra nas estatísticas.');}catch(e){nota('Falha ao solicitar: '+e.message);}
  };
  $('cavClasse')?.addEventListener('change',()=>{listar();});
  try{await atualizar();}catch(e){nota('Falha na consulta de naturezas: '+e.message);}
  listar();
 })();
 return pronto;
}
async function carregarPdf(itens,num,data){
 const v=++versao;await iniciar();if(!host)return;
 if(edicao?.ppe_naturezas_originais){nota('A natureza original já vinculada ao BO foi preservada.');return;}
 originais=Array.isArray(itens)?itens:[];ligacaoPdf={numero:num,data};ids=edicao?.ppe_naturezas_selecionadas?[...edicao.ppe_naturezas_selecionadas]:[];
 $('ppeJustificativa').value='';
 try{await atualizar();}catch(e){nota('Não foi possível consultar o catálogo: '+e.message);}
 if(v!==versao)return;
 if(podeAssociar()&&!edicao?.ppe_naturezas_selecionadas?.length){
  for(const x of originais){
   const n=cat.find(y=>y.codigo_ppe===x.codigo_ppe);
   if(permitido(n)&&norm(n.descricao_original)===norm(x.descricao_original)&&!ids.includes(n.id))ids.push(n.id);
  }
 }
 listar();
 if(originais.length&&!ids.length)nota('Os códigos foram identificados, mas não há seleção segura. Revise o catálogo ou solicite a inclusão.');
}
async function carregarEdicao(x){
 ++versao;await iniciar();if(!host)return;edicao=x;originais=Array.isArray(x?.ppe_naturezas_originais)?x.ppe_naturezas_originais:[];ids=Array.isArray(x?.ppe_naturezas_selecionadas)?[...x.ppe_naturezas_selecionadas]:[];ligacaoPdf=null;listar();
}
function fundo(){
 ++versao;if(!host)return;if(edicao?.ppe_naturezas_originais)return;originais=[];ligacaoPdf=null;ids=edicao?.ppe_naturezas_selecionadas?[...edicao.ppe_naturezas_selecionadas]:[];$('ppeJustificativa').value='';listar();
}
function campos(){
 if(!host||atividade()||!podeAssociar())return {ok:true,campos:{}};
 const anteriores=edicao?.ppe_naturezas_selecionadas||[];
 if(!ids.length){if(anteriores.length)return {ok:false,mensagem:'Selecione uma natureza PPe; não é possível apagar os vínculos anteriores.'};return {ok:true,campos:{}};}
 if(ligacaoPdf&&(ligacaoPdf.numero!==String($('numeroBo').value||'').trim()||String(ligacaoPdf.data||'').slice(0,4)!==String($('data').value||'').slice(0,4)))return {ok:false,mensagem:'O número/ano do BO foi alterado desde a importação. Reimporte o documento para confirmar a classificação PPe.'};
 const codigos=ids.map(id=>cat.find(n=>n.id===id)?.codigo_ppe).filter(Boolean);
 const alterou=edicao?!equal(ids,anteriores):originais.length&&!equal(codigos,originais.map(x=>x.codigo_ppe));
 const j=$('ppeJustificativa').value.trim();
 if(alterou&&j.length<5)return {ok:false,mensagem:'Informe a justificativa da alteração da natureza PPe.'};
 if(edicao&&equal(ids,anteriores))return {ok:true,campos:{}};
 return {ok:true,campos:{ppe_naturezas_selecionadas:[...ids],ppe_justificativa_classificacao:j||null}};
}
window.PpeSelecao=Object.freeze({iniciar,carregarPdf,carregarEdicao,limpar:fundo,campos});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>iniciar().catch(e=>nota(e.message)),{once:true});else iniciar().catch(e=>nota(e.message));
})();