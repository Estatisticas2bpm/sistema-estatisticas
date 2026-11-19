/* Administração do catálogo PPe. O servidor verifica ADMIN para cada alteração. */
(async function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const dt=x=>x?new Date(x).toLocaleDateString('pt-BR',{timeZone:'America/Boa_Vista'}):'—';
let db,catalogo=[],sinonimos=[],divergencias=[],solicitacoes=[],auditoria=[],pagina=0,editando=null,carregando=false;
const aviso=(m,e=false)=>{$('status').textContent=m;$('status').className=e?'erro':''};
const editorAviso=m=>$('editorStatus').textContent=m;
async function rpc(name,args){const r=await db.rpc(name,args);if(r.error)throw Error(r.error.message);return r.data;}
async function todos(tabela,ordem){let a=[];for(let i=0;;i+=500){const r=await db.from(tabela).select('*').order(ordem).range(i,i+499);if(r.error)throw Error(r.error.message);a.push(...r.data);if(r.data.length<500)return a;if(i>=100000)throw Error('Limite de consulta atingido.');}}
function filtrados(){
 const q=norm($('pesquisa').value.trim()),status=$('filtroStatus').value,ativo=$('filtroAtivo').value,categoria=$('filtroCategoria').value;
 const mapa=new Map();for(const s of sinonimos){if(!mapa.has(s.natureza_id))mapa.set(s.natureza_id,[]);mapa.get(s.natureza_id).push(s.termo);}
 return catalogo.filter(n=>(!status||n.status_validacao===status)&&(!ativo||String(n.ativo)===ativo)&&(!categoria||n.categoria===categoria)&&(!q||norm([n.codigo_ppe,n.descricao_original,n.descricao_padronizada,n.fundamentacao_legal,n.categoria,...(mapa.get(n.id)||[])].join(' ')).includes(q)));
}
function render(){
 const g=filtrados(),mes=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Boa_Vista',year:'numeric',month:'2-digit'}).format(new Date());
 const cards=[['Total catalogadas',catalogo.length],['Validadas',catalogo.filter(n=>n.status_validacao==='VALIDADA').length],['Pendentes',catalogo.filter(n=>n.status_validacao!=='VALIDADA').length],['Divergências em aberto',divergencias.filter(d=>!d.resolvido_em).length],['Inativas',catalogo.filter(n=>!n.ativo).length],['Novas neste mês',catalogo.filter(n=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Boa_Vista',year:'numeric',month:'2-digit'}).format(new Date(n.primeiro_registro))===mes).length]];
 $('indicadores').innerHTML=cards.map(([l,n])=>'<div class="card"><small>'+esc(l)+'</small><strong>'+n.toLocaleString('pt-BR')+'</strong></div>').join('');
 pagina=Math.max(0,Math.min(pagina,Math.max(0,Math.ceil(g.length/50)-1)));
 $('linhas').innerHTML=g.slice(pagina*50,pagina*50+50).map(n=>'<tr><td><b>'+esc(n.codigo_ppe)+'</b></td><td class="descricao">'+esc(n.descricao_original)+'</td><td class="descricao">'+esc(n.descricao_padronizada)+'</td><td>'+esc(n.fundamentacao_legal||'—')+'</td><td>'+esc(n.categoria||'—')+'</td><td>'+n.quantidade_registros+'</td><td>'+esc(dt(n.primeiro_registro))+'</td><td>'+esc(dt(n.ultimo_registro))+'</td><td>'+esc(n.status_validacao)+(n.ativo?' · Ativa':' · Inativa')+'</td><td><button type="button" class="btn" data-editar="'+esc(n.id)+'">Revisar</button></td></tr>').join('')||'<tr><td colspan="10">Nenhuma natureza neste recorte.</td></tr>';
 $('pagina').textContent=g.length+' resultado(s) · página '+(pagina+1)+' de '+Math.max(1,Math.ceil(g.length/50));$('anterior').disabled=pagina===0;$('proxima').disabled=(pagina+1)*50>=g.length;
 const mapa=new Map(catalogo.map(x=>[x.id,x]));
 $('divergencias').innerHTML=divergencias.filter(d=>!d.resolvido_em).map(d=>'<article class="item"><b>'+esc(mapa.get(d.natureza_id)?.codigo_ppe||'—')+'</b><p>Original: '+esc(mapa.get(d.natureza_id)?.descricao_original||'—')+'</p><p>Identificada: '+esc(d.descricao)+'</p><p>Fundamento: '+esc(d.fundamentacao_legal||'—')+' · '+esc(dt(d.identificado_em))+'</p><div class="acoes"><button type="button" class="btn" data-editar="'+esc(d.natureza_id)+'">Revisar catálogo</button><button type="button" class="btn gray" data-resolver="'+esc(d.id)+'" data-tipo="DIVERGENCIA">Resolver divergência</button></div></article>').join('')||'<p class="muted">Nenhuma divergência pendente.</p>';
 $('solicitacoes').innerHTML=solicitacoes.filter(s=>s.status==='PENDENTE').map(s=>'<article class="item"><b>'+esc(s.descricao)+'</b><p>'+esc(dt(s.criado_em))+' · Unidade ID: '+esc(s.unidade_id)+'</p><div class="acoes"><button type="button" class="btn green" data-resolver="'+esc(s.id)+'" data-tipo="SOLICITACAO">Marcar atendida</button><button type="button" class="btn gray" data-resolver="'+esc(s.id)+'" data-tipo="SOLICITACAO" data-recusar="sim">Recusar</button></div></article>').join('')||'<p class="muted">Nenhuma solicitação pendente.</p>';
 $('auditoria').innerHTML=auditoria.map(a=>'<tr><td>'+esc(new Date(a.criado_em).toLocaleString('pt-BR',{timeZone:'America/Boa_Vista'}))+'</td><td>'+esc(a.acao)+'</td><td>'+esc(mapa.get(a.natureza_id)?.codigo_ppe||'—')+'</td><td>'+esc(a.justificativa||'—')+'</td><td>'+esc(a.usuario_id||'—')+'</td></tr>').join('')||'<tr><td colspan="5">Sem alterações registradas.</td></tr>';
}
async function carregar(){
 if(carregando)return;carregando=true;$('atualizar').disabled=true;aviso('Consultando catálogo...');
 try{
  const [c,s,d,r,a]=await Promise.all([todos('naturezas_ppe','codigo_ppe'),todos('naturezas_ppe_sinonimos','termo'),todos('naturezas_ppe_divergencias','identificado_em'),todos('naturezas_ppe_solicitacoes','criado_em'),db.from('naturezas_ppe_auditoria').select('*').order('criado_em',{ascending:false}).limit(50)]);
  if(a.error)throw Error(a.error.message);catalogo=c;sinonimos=s;divergencias=d;solicitacoes=r;auditoria=a.data||[];
  const cat=$('filtroCategoria').value;$('filtroCategoria').replaceChildren(new Option('Todas',''));for(const v of [...new Set(c.map(x=>x.categoria).filter(Boolean))].sort())$('filtroCategoria').add(new Option(v,v));$('filtroCategoria').value=cat;
  render();aviso('Catálogo atualizado.');
 }catch(e){aviso('Falha ao carregar: '+e.message,true);}
 finally{carregando=false;$('atualizar').disabled=false;}
}
function renderSinonimos(){
 const lista=$('sinonimosLista');lista.replaceChildren();
 for(const x of sinonimos.filter(s=>s.natureza_id===editando?.id)){
  const div=document.createElement('div');div.className='item';div.textContent=x.termo+' ';
  const b=document.createElement('button');b.type='button';b.className='btn gray';b.textContent='Remover';b.onclick=async()=>{if(!confirm('Remover este termo de busca?'))return;try{await rpc('ppe_admin_sinonimo',{p_id:editando.id,p_termo:x.termo,p_remover:true});sinonimos=sinonimos.filter(y=>y!==x);renderSinonimos();render();}catch(e){editorAviso(e.message);}};div.append(b);lista.append(div);
 }
}
function abrirEditor(n){
 editando=n||null;$('formEditor').reset();editorAviso('');
 $('tituloEditor').textContent=n?'Revisar natureza '+n.codigo_ppe:'Incluir código validado';
 $('codigo').readOnly=!!n;$('original').readOnly=!!n;$('padronizada').readOnly=!n;
 $('codigo').value=n?.codigo_ppe||'';$('original').value=n?.descricao_original||'';$('padronizada').value=n?.descricao_padronizada||'';$('legal').value=n?.fundamentacao_legal||'';$('categoria').value=n?.categoria||'';$('ativo').value=String(n?.ativo??true);$('ativo').disabled=!n;
 $('sinonimosEditor').hidden=!n;renderSinonimos();$('editor').showModal();
}
const colunas=['Código','Descrição original','Descrição padronizada','Fundamento','Categoria','Ocorrências','Primeiro registro','Último registro','Status','Ativa'];
function linhasExportacao(){return [colunas,...filtrados().map(n=>[n.codigo_ppe,n.descricao_original,n.descricao_padronizada,n.fundamentacao_legal||'',n.categoria||'',n.quantidade_registros,dt(n.primeiro_registro),dt(n.ultimo_registro),n.status_validacao,n.ativo?'Sim':'Não'])];}
function baixar(texto,tipo,nome){const u=URL.createObjectURL(new Blob([texto],{type:tipo}));const a=document.createElement('a');a.href=u;a.download=nome;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function csvCelula(x){let s=String(x??'');if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function exportarCsv(){baixar('\ufeff'+linhasExportacao().map(x=>x.map(csvCelula).join(';')).join('\r\n'),'text/csv;charset=utf-8','catalogo-naturezas-ppe.csv');}
function exportarExcel(){const rows=linhasExportacao().map(row=>'<Row>'+row.map(v=>'<Cell><Data ss:Type="String">'+esc(String(v??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,''))+'</Data></Cell>').join('')+'</Row>').join('');baixar('<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Naturezas PPe"><Table>'+rows+'</Table></Worksheet></Workbook>','application/xml','catalogo-naturezas-ppe.xml');}
let historicos=[],histAtual=null,histIds=[];
async function carregarHistoricos(){
 const termo=$('histPesquisa').value.trim();
 if(termo.length<3){aviso('Informe pelo menos três caracteres para pesquisar.',true);return;}
 $('histBuscar').disabled=true;
 try{
  historicos=await rpc('ppe_admin_buscar_historico',{p_nome:termo,p_limite:200});
  $('histLinhas').innerHTML=historicos.map(o=>'<tr><td>'+esc(o.numero_bo)+'</td><td>'+esc(o.data_ocorrencia)+'</td><td>'+esc(o.unidade_sigla)+'</td><td>'+esc(o.ocorrencia)+(o.crime?' · '+esc(o.crime):'')+'</td><td>'+esc((o.ppe_naturezas_selecionadas||[]).map(id=>catalogo.find(n=>n.id===id)?.codigo_ppe||id).join(', ')||'Não associada')+'</td><td><button type="button" class="btn" data-historico="'+esc(o.id)+'">Associar</button></td></tr>').join('')||'<tr><td colspan="6">Nenhum registro encontrado no escopo autorizado.</td></tr>';
  aviso(historicos.length+' candidato(s). A busca não confirma equivalência jurídica.');
 }catch(e){aviso('Falha ao pesquisar: '+e.message,true);}finally{$('histBuscar').disabled=false;}
}
function renderHistEditor(){
 const q=norm($('histBuscaCatalogo').value),lst=$('histOpcoes'),sel=$('histSelecionadas');lst.replaceChildren();sel.replaceChildren();
 for(const n of catalogo.filter(n=>n.ativo&&n.status_validacao==='VALIDADA'&&!histIds.includes(n.id)&&(!q||norm([n.codigo_ppe,n.descricao_padronizada,n.fundamentacao_legal,...sinonimos.filter(s=>s.natureza_id===n.id).map(s=>s.termo)].join(' ')).includes(q))).slice(0,50)){
  const b=document.createElement('button');b.type='button';b.className='btn gray';b.style.cssText='display:block;text-align:left;width:100%;margin-bottom:5px';b.textContent=n.codigo_ppe+' — '+n.descricao_padronizada;b.onclick=()=>{if(histIds.length<30)histIds.push(n.id);renderHistEditor();};lst.append(b);
 }
 if(!lst.childNodes.length)lst.textContent='Nenhuma natureza administrativamente validada disponível.';
 for(const id of histIds){const n=catalogo.find(x=>x.id===id);const d=document.createElement('p');d.textContent=(n?n.codigo_ppe+' — '+n.descricao_padronizada:id)+' ';const b=document.createElement('button');b.type='button';b.className='btn gray';b.textContent='Remover';b.onclick=()=>{histIds=histIds.filter(x=>x!==id);renderHistEditor();};d.append(b);sel.append(d);}
 if(!histIds.length)sel.textContent='Nenhuma natureza selecionada.';
}
function abrirHistorico(o){
 histAtual=o;histIds=[...(o.ppe_naturezas_selecionadas||[])];$('histResumo').textContent='BO '+o.numero_bo+' · '+o.unidade_sigla+' · '+o.ocorrencia+(o.crime?' / '+o.crime:'');$('histBuscaCatalogo').value='';$('histJustificativa').value='';$('histStatus').textContent='';renderHistEditor();$('histEditor').showModal();
}
try{
 const auth=window.SistemaAuth?.ready?await window.SistemaAuth.ready:window.SistemaAuth;
 if(!auth?.client||auth.perfil?.perfil!=='ADMIN'){aviso('Acesso restrito ao administrador do SIE-CPC.',true);return;}
 db=auth.client;$('conteudo').hidden=false;
 for(const id of ['pesquisa','filtroStatus','filtroAtivo','filtroCategoria'])$(id).addEventListener(id==='pesquisa'?'input':'change',()=>{pagina=0;render();});
 $('anterior').onclick=()=>{pagina--;render();};$('proxima').onclick=()=>{pagina++;render();};$('atualizar').onclick=carregar;$('nova').onclick=()=>abrirEditor(null);$('csv').onclick=exportarCsv;$('excel').onclick=exportarExcel;$('cancelar').onclick=()=>$('editor').close();$('original').oninput=()=>{if(!editando)$('padronizada').value=$('original').value;};
 document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.historico){const o=historicos.find(x=>x.id===b.dataset.historico);if(o)abrirHistorico(o);}
  if(b.dataset.editar){const n=catalogo.find(x=>x.id===b.dataset.editar);if(n)abrirEditor(n);}
  if(b.dataset.resolver){const motivo=prompt('Justifique e documente a resolução (mínimo de 5 caracteres):');if(!motivo||motivo.trim().length<5)return;b.disabled=true;try{await rpc('ppe_admin_resolver',{p_id:b.dataset.resolver,p_tipo:b.dataset.tipo,p_resposta:motivo,p_aceitar:b.dataset.recusar!=='sim'});await carregar();}catch(err){aviso(err.message,true);}finally{b.disabled=false;}}
 });
 $('formEditor').onsubmit=async e=>{
  e.preventDefault();$('salvar').disabled=true;editorAviso('');
  try{const base={p_lei:$('legal').value,p_categoria:$('categoria').value,p_justificativa:$('justificativa').value};
   if(editando)await rpc('ppe_admin_validar',{...base,p_id:editando.id,p_descricao:$('padronizada').value,p_ativo:$('ativo').value==='true'});
   else await rpc('ppe_admin_criar',{...base,p_codigo:$('codigo').value,p_descricao:$('original').value});
   $('editor').close();await carregar();
  }catch(err){editorAviso(err.message);}finally{$('salvar').disabled=false;}
 };
 $('adicionarSinonimo').onclick=async()=>{if(!editando)return;const termo=$('sinonimo').value.trim();if(termo.length<2){editorAviso('Informe um termo válido.');return;}try{await rpc('ppe_admin_sinonimo',{p_id:editando.id,p_termo:termo,p_remover:false});sinonimos=await todos('naturezas_ppe_sinonimos','termo');$('sinonimo').value='';renderSinonimos();render();}catch(e){editorAviso(e.message);}};
 $('histBuscar').onclick=carregarHistoricos;$('histBuscaCatalogo').oninput=renderHistEditor;$('histCancelar').onclick=()=>$('histEditor').close();
 $('histSalvar').onclick=async()=>{const j=$('histJustificativa').value.trim();if(!histAtual||!histIds.length||j.length<5){$('histStatus').textContent='Selecione natureza validada e informe a justificativa.';return;}if(!confirm('Confirmar associação apenas deste BO, preservando a natureza anterior?'))return;$('histSalvar').disabled=true;try{await rpc('ppe_admin_associar_historico',{p_ocorrencia:histAtual.id,p_ids:histIds,p_justificativa:j});$('histEditor').close();await carregar();await carregarHistoricos();}catch(e){$('histStatus').textContent=e.message;}finally{$('histSalvar').disabled=false;}};
 await carregar();
}catch(e){aviso('Falha de inicialização: '+e.message,true);}
})();