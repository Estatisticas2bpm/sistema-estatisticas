(function(){
  const sigla=String(window.SistemaAuth?.contexto?.sigla||window.SistemaAuth?.perfil?.unidades?.sigla||'').toUpperCase();
  if(sigla!=='CIPA')return;

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{const n=Number(String(v??'').replace(/\./g,'').replace(',','.'));return Number.isFinite(n)?n:null};
  const iso=s=>{const m=String(s||'').match(/(\d{2})\/(\d{2})\/(\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:''};
  const dtLocal=(d,h)=>{const x=iso(d);return x?(x+'T'+String(h||'00:00').slice(0,5)):''};
  const money=s=>{const m=String(s||'').match(/R\$\s*([\d.]+,\d{2})/);return m?num(m[1]):null};
  const style=document.createElement('style');
  style.textContent='.cipa-modulo{border:1px solid #a7c7b6!important;background:linear-gradient(180deg,#f6fbf8,#fff)}.cipa-modulo h2{color:#245b43}.cipa-repeater{grid-column:1/-1;border:1px solid #d6e5dc;border-radius:12px;padding:12px;background:#fff}.cipa-repeater-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px}.cipa-repeater-head h3{margin:0;color:#245b43}.cipa-list{display:grid;gap:10px}.cipa-item{border:1px solid #dbe6df;border-radius:10px;padding:10px;background:#fbfdfc}.cipa-item-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.cipa-item-grid label{font-size:11px;font-weight:800;color:#52677a}.cipa-item-grid input,.cipa-item-grid select,.cipa-item-grid textarea{display:block;width:100%;margin-top:4px;border:1px solid #cdd8e5;border-radius:8px;padding:8px;background:#fff}.cipa-item-grid textarea{min-height:64px;resize:vertical}.cipa-span2{grid-column:span 2}.cipa-span4{grid-column:1/-1}.cipa-remove{border:0;background:#a63d40;color:#fff;border-radius:7px;padding:7px 10px;cursor:pointer;float:right}@media(max-width:800px){.cipa-item-grid{grid-template-columns:1fr 1fr}.cipa-span4{grid-column:1/-1}}';
  document.head.appendChild(style);

  const alvo=[...document.querySelectorAll('form#formOcorrencia > section')].find(s=>/10\. Outros indicadores/i.test(s.querySelector('h2')?.textContent||''));
  if(!alvo)return;
  const sec=document.createElement('section');
  sec.className='cipa-modulo';
  sec.innerHTML=`
    <h2>10. Dados ambientais — CIPA</h2>
    <div class="grade">
      <div class="campo"><label for="cipaDataRegistroInicio">Início do registro do PPE</label><input id="cipaDataRegistroInicio" type="datetime-local"></div>
      <div class="campo"><label for="cipaDataRegistroFim">Fim do registro do PPE</label><input id="cipaDataRegistroFim" type="datetime-local"></div>
      <div class="campo"><label for="cipaAreaTipo">Área</label><select id="cipaAreaTipo"><option value="">Selecione</option><option>URBANA</option><option>RURAL</option></select></div>
      <div class="campo"><label for="cipaOrigem">Origem da atuação</label><input id="cipaOrigem" list="cipaOrigens" placeholder="CICC, BIOMA, Ordem de Missão..."><datalist id="cipaOrigens"><option>CICC</option><option>BIOMA</option><option>ORDEM DE MISSÃO</option><option>ORDEM DE SERVIÇO</option><option>PATRULHAMENTO</option></datalist></div>
      <div class="campo duplo"><label for="cipaCoordenadas">Coordenadas geográficas</label><input id="cipaCoordenadas" placeholder="Ex.: 2°21'... / 61°44'..."></div>
      <div class="campo duplo"><label for="cipaDocumentoOrigem">Documento de origem / missão</label><input id="cipaDocumentoOrigem" placeholder="Ordem de Missão, Ordem de Serviço..."></div>
      <div class="campo duplo"><label for="cipaAnexo">Anexo / referência</label><input id="cipaAnexo" placeholder="Mapa, TR, AI, relatório ambiental..."></div>
      <div id="cipaAutos" class="cipa-repeater"></div>
      <div id="cipaEmbargos" class="cipa-repeater"></div>
      <div id="cipaNotificacoes" class="cipa-repeater"></div>
      <div id="cipaFauna" class="cipa-repeater"></div>
      <div id="cipaEducacao" class="cipa-repeater"></div>
      <div id="cipaTdba" class="cipa-repeater"></div>
      <div id="cipaTcos" class="cipa-repeater"></div>
    </div>`;
  alvo.before(sec);
  const h=alvo.querySelector('h2');if(h)h.textContent='11. Outros indicadores operacionais';

  const defs={
    autos:{box:'cipaAutos',titulo:'Autos de Infração Ambiental',botao:'+ Adicionar Auto de Infração',campos:[
      ['numero','Nº do Auto','text'],['data_autuacao','Data da autuação','date'],['autuado','Autuado','text'],['tipo_sancao','Sanção','text'],
      ['valor_multa','Valor da multa (R$)','number'],['area_embargada_ha','Área embargada (ha)','number'],['fiscal_ambiental','Fiscal ambiental','text'],['art_lei_9605','Art. Lei 9.605/98','text'],
      ['art_dec_6514','Art. Dec. 6.514/08','text'],['outra_legislacao','Outra legislação','text'],['descricao_infracao','Descrição da infração','textarea','cipa-span4']
    ]},
    embargos:{box:'cipaEmbargos',titulo:'Termos de Embargo / Interdição',botao:'+ Adicionar Termo',campos:[
      ['numero','Nº do Termo','text'],['data_embargo','Data','date'],['auto_infracao_originario','Auto de Infração originário','text'],['area_embargada_ha','Área (ha)','number'],['descricao','Descrição','textarea','cipa-span4']
    ]},
    notificacoes:{box:'cipaNotificacoes',titulo:'Autos de Notificação',botao:'+ Adicionar Notificação',campos:[
      ['numero','Nº da Notificação','text'],['data_notificacao','Data','date'],['hora_notificacao','Hora','time'],['autuado','Autuado','text'],['data_limite','Data limite','date'],['fiscal_ambiental','Fiscal ambiental','text'],['descricao','Descrição','textarea','cipa-span4']
    ]},
    fauna:{box:'cipaFauna',titulo:'Fauna / TR',botao:'+ Adicionar registro de fauna',campos:[
      ['numero_tr','TR','text'],['data_registro','Data','date'],['procedencia','Procedência','text'],['quantidade','Quantidade','number'],['nome_comum','Nome comum','text'],['nome_cientifico','Nome científico','text','cipa-span2']
    ]},
    educacao:{box:'cipaEducacao',titulo:'Educação Ambiental',botao:'+ Adicionar ação',campos:[
      ['data_acao','Data','date'],['publico_estimado','Público estimado','number'],['acao','Ação','text'],['local_acao','Local','text']
    ]},
    tdba:{box:'cipaTdba',titulo:'TDBA / Bens Apreendidos',botao:'+ Adicionar TDBA',campos:[
      ['numero_tdba','TDBA','text'],['auto_infracao','Auto de Infração','text'],['tipo','Tipo','text'],['quantidade','Quantidade','number'],['apreensao','Apreensão','text','cipa-span2'],['valor_bens','Valor dos bens (R$)','number'],['depositario_fiel','Depositário fiel','text'],['caracteristicas','Características','textarea','cipa-span4']
    ]},
    tcos:{box:'cipaTcos',titulo:'TCO ambiental',botao:'+ Adicionar TCO',campos:[
      ['crime','Crime','text','cipa-span2'],['numero_processo_jecrim','Processo JECRIM','text'],['localidade','Localidade','select'],['responsavel','Responsável','text'],['autor','Autor','text'],['vitima','Vítima','text'],['apreensoes','Apreensões','textarea','cipa-span4']
    ]}
  };
  const estado={autos:[],embargos:[],notificacoes:[],fauna:[],educacao:[],tdba:[],tcos:[]};
  function campoHtml(c,v=''){
    const [k,l,t,cls='']=c,val=v??'',step=(k.includes('area_')?'0.0001':k.includes('valor_')?'0.01':'1');
    if(t==='textarea')return `<label class="${cls}">${l}<textarea data-k="${k}">${esc(val)}</textarea></label>`;
    if(t==='select')return `<label class="${cls}">${l}<select data-k="${k}"><option value="">Selecione</option><option ${val==='CAPITAL'?'selected':''}>CAPITAL</option><option ${val==='INTERIOR'?'selected':''}>INTERIOR</option></select></label>`;
    return `<label class="${cls}">${l}<input data-k="${k}" type="${t}" ${t==='number'?`min="0" step="${step}"`:''} value="${esc(val)}"></label>`;
  }
  function render(tipo){
    const d=defs[tipo],box=$(d.box);box.innerHTML=`<div class="cipa-repeater-head"><h3>${d.titulo}</h3><button type="button" class="botao-item" data-add="${tipo}">${d.botao}</button></div><div class="cipa-list">${estado[tipo].map((x,i)=>`<div class="cipa-item" data-tipo="${tipo}" data-i="${i}"><button type="button" class="cipa-remove" data-rm="${tipo}" data-i="${i}">Remover</button><div class="cipa-item-grid">${d.campos.map(c=>campoHtml(c,x[c[0]])).join('')}</div></div>`).join('')||'<p class="lista-vazia">Nenhum registro informado.</p>'}</div>`;
    if(tipo==='autos'){$('quantAutoInfracao').value=estado.autos.length||'';$('autoInfracao').value=estado.autos.map(x=>x.numero).filter(Boolean).join('; ');}
  }
  function syncItem(el){
    const tipo=el.dataset.tipo,i=Number(el.dataset.i),obj=estado[tipo][i];if(!obj)return;
    el.querySelectorAll('[data-k]').forEach(c=>obj[c.dataset.k]=c.value);
  }
  Object.keys(defs).forEach(render);
  sec.addEventListener('input',e=>{const item=e.target.closest('.cipa-item');if(item)syncItem(item)});
  sec.addEventListener('change',e=>{const item=e.target.closest('.cipa-item');if(item)syncItem(item)});
  sec.addEventListener('click',e=>{
    const add=e.target.closest('[data-add]');if(add){estado[add.dataset.add].push({});render(add.dataset.add);return}
    const rm=e.target.closest('[data-rm]');if(rm){estado[rm.dataset.rm].splice(Number(rm.dataset.i),1);render(rm.dataset.rm)}
  });

  function dadosBase(){
    return {ppe_original:null,data_registro_inicio:$('cipaDataRegistroInicio').value||null,data_registro_fim:$('cipaDataRegistroFim').value||null,area_tipo:$('cipaAreaTipo').value||null,coordenadas_texto:$('cipaCoordenadas').value.trim()||null,origem_atuacao:$('cipaOrigem').value.trim()||null,documento_origem:$('cipaDocumentoOrigem').value.trim()||null,anexo_referencia:$('cipaAnexo').value.trim()||null};
  }
  function normalizarLinhas(tipo){
    return estado[tipo].map(x=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,v===''?null:v]))).filter(x=>Object.values(x).some(v=>v!==null&&v!==false));
  }
  async function substituir(tabela,ocorrenciaId,linhas){
    const del=await banco.from(tabela).delete().eq('ocorrencia_id',ocorrenciaId);if(del.error)throw del.error;
    if(!linhas.length)return;
    const ins=await banco.from(tabela).insert(linhas.map(x=>({...x,ocorrencia_id:ocorrenciaId})));if(ins.error)throw ins.error;
  }
  async function salvar(ocorrenciaId){
    if(!ocorrenciaId)throw new Error('Não foi possível identificar a ocorrência da CIPA.');
    const ppe=$('numeroBo').value.trim(),ano=String($('data').value||'').slice(0,4);
    const base={...dadosBase(),ppe_original:ppe&&ano?String(ppe).padStart(8,'0')+'/'+ano:null,ocorrencia_id:ocorrenciaId};
    const up=await banco.from('cipa_ocorrencias_ambientais').upsert(base,{onConflict:'ocorrencia_id'});if(up.error)throw up.error;
    await substituir('cipa_autos_infracao',ocorrenciaId,normalizarLinhas('autos'));
    await substituir('cipa_termos_embargo',ocorrenciaId,normalizarLinhas('embargos'));
    await substituir('cipa_autos_notificacao',ocorrenciaId,normalizarLinhas('notificacoes'));
    await substituir('cipa_fauna',ocorrenciaId,normalizarLinhas('fauna'));
    await substituir('cipa_educacao_ambiental',ocorrenciaId,normalizarLinhas('educacao'));
    await substituir('cipa_tdba',ocorrenciaId,normalizarLinhas('tdba'));
    await substituir('cipa_tcos_ambientais',ocorrenciaId,normalizarLinhas('tcos'));
    $('quantAutoInfracao').value=estado.autos.length||'';
    $('autoInfracao').value=estado.autos.map(x=>x.numero).filter(Boolean).join('; ');
  }
  async function carregar(ocorrenciaId){
    if(!ocorrenciaId)return;
    const qs=[
      banco.from('cipa_ocorrencias_ambientais').select('*').eq('ocorrencia_id',ocorrenciaId).maybeSingle(),
      banco.from('cipa_autos_infracao').select('*').eq('ocorrencia_id',ocorrenciaId).order('data_autuacao'),
      banco.from('cipa_termos_embargo').select('*').eq('ocorrencia_id',ocorrenciaId).order('data_embargo'),
      banco.from('cipa_autos_notificacao').select('*').eq('ocorrencia_id',ocorrenciaId).order('data_notificacao'),
      banco.from('cipa_fauna').select('*').eq('ocorrencia_id',ocorrenciaId).order('data_registro'),
      banco.from('cipa_educacao_ambiental').select('*').eq('ocorrencia_id',ocorrenciaId).order('data_acao'),
      banco.from('cipa_tdba').select('*').eq('ocorrencia_id',ocorrenciaId),
      banco.from('cipa_tcos_ambientais').select('*').eq('ocorrencia_id',ocorrenciaId)
    ];
    const r=await Promise.all(qs);if(r.some(x=>x.error)){console.error('Falha ao carregar módulo CIPA',r.find(x=>x.error)?.error);return}
    const b=r[0].data||{};$('cipaDataRegistroInicio').value=b.data_registro_inicio?String(b.data_registro_inicio).slice(0,16):'';$('cipaDataRegistroFim').value=b.data_registro_fim?String(b.data_registro_fim).slice(0,16):'';$('cipaAreaTipo').value=b.area_tipo||'';$('cipaCoordenadas').value=b.coordenadas_texto||'';$('cipaOrigem').value=b.origem_atuacao||'';$('cipaDocumentoOrigem').value=b.documento_origem||'';$('cipaAnexo').value=b.anexo_referencia||'';
    ['autos','embargos','notificacoes','fauna','educacao','tdba','tcos'].forEach((k,i)=>{estado[k]=r[i+1].data||[];render(k)});
  }

  function blocoAte(texto,inicio,proximos){
    const p=texto.indexOf(inicio);if(p<0)return'';let fim=texto.length;proximos.forEach(m=>{const x=texto.indexOf(m,p+inicio.length);if(x>=0&&x<fim)fim=x});return texto.slice(p,fim);
  }
  function extrairCipa(texto){
    const ri=texto.match(/Data\/Hora In[íi]cio do Registro:\s*(\d{2}\/\d{2}\/\d{4})\s*(\d{2}:\d{2})/i),rf=texto.match(/Data\/Hora Fim:\s*(\d{2}\/\d{2}\/\d{4})\s*(\d{2}:\d{2})/i);
    if(ri)$('cipaDataRegistroInicio').value=dtLocal(ri[1],ri[2]);if(rf)$('cipaDataRegistroFim').value=dtLocal(rf[1],rf[2]);
    const local=texto.match(/Tipo do Local:\s*([^\n]+)/i);if(local)$('cipaAreaTipo').value=/RURAL/i.test(local[1])?'RURAL':/URBAN/i.test(local[1])?'URBANA':'';
    const om=texto.match(/(ORDEM DE (?:MISS[ÃA]O|SERVI[ÇC]O)[^\n]{0,180})/i);if(om)$('cipaDocumentoOrigem').value=om[1].replace(/\s+/g,' ').trim();
    const origem=/OPERA[ÇC][ÃA]O BIOMA|\bBIOMA\b/i.test(texto)?'BIOMA':/\bCICC\b/i.test(texto)?'CICC':om?/MISS[ÃA]O/i.test(om[1])?'ORDEM DE MISSÃO':'ORDEM DE SERVIÇO':'';if(origem)$('cipaOrigem').value=origem;
    const coord=texto.match(/\b\d{1,2}[°º][^\n]{0,35}?[NS]\s*[/,;-]\s*\d{1,3}[°º][^\n]{0,35}?[EW]\b/i);if(coord)$('cipaCoordenadas').value=coord[0];

    const autos=[];for(const m of texto.matchAll(/AUTO DE INFRA[ÇC][ÃA]O\s*(?:N[º°]|Nº)?\s*[:]?\s*(\d{4,})/gi)){
      const b=blocoAte(texto,m[0],['AUTO DE INFRAÇÃO Nº','TERMO DE EMBARGO/INTERDIÇÃO Nº']);
      const au=b.match(/\(03\)\s*NOME DO AUTUADO\s*([^\n]+)/i),da=b.match(/DATA DA AUTUA[ÇC][ÃA]O\s*(\d{2}\/\d{2}\/\d{4})/i),ar=b.match(/\(14\)\s*[ÁA]REA\s*([\d.,]+)\s*Hectares/i),vl=b.match(/\(15\)\s*VALOR DA MULTA\s*(R\$\s*[\d.]+,\d{2})/i),desc=b.match(/\(12\)\s*DESCRI[ÇC][ÃA]O DA INFRA[ÇC][ÃA]O\s*([\s\S]*?)(?=\(13\))/i),l=b.match(/Lei Federal\s*9\.605\/98[\s\S]*?Artigo:\s*Art\.\s*([\dA-Za-zº°.-]+)/i),d=b.match(/Decreto Federal\s*6\.514\/08[\s\S]*?Artigo:\s*Art\.\s*([\dA-Za-zº°.-]+)/i);
      autos.push({numero:m[1],data_autuacao:da?iso(da[1]):'',autuado:au?au[1].trim():'',tipo_sancao:/Multa Simples[\s\S]{0,30}Embargo/i.test(b)?'MULTA E EMBARGO':/Multa Simples/i.test(b)?'MULTA':'',descricao_infracao:desc?desc[1].replace(/\s+/g,' ').trim():'',art_lei_9605:l?l[1]:'',art_dec_6514:d?d[1]:'',valor_multa:vl?money(vl[1]):'',area_embargada_ha:ar?num(ar[1]):'',fiscal_ambiental:''});
    }
    const unicos=new Map(autos.map(x=>[x.numero,x]));if(unicos.size){estado.autos=[...unicos.values()];render('autos')}

    const emb=[];for(const m of texto.matchAll(/TERMO DE EMBARGO\/INTERDI[ÇC][ÃA]O\s*(?:N[º°]|Nº)?\s*[:]?\s*(\d{4,})/gi)){
      const b=blocoAte(texto,m[0],['TERMO DE EMBARGO/INTERDIÇÃO Nº','AUTO DE INFRAÇÃO Nº']);
      const ai=b.match(/AUTO DE INFRA[ÇC][ÃA]O ORIGIN[ÁA]RIO\s*(\d+)/i),da=b.match(/DATA DA AUTUA[ÇC][ÃA]O\s*(\d{2}\/\d{2}\/\d{4})/i);
      emb.push({numero:m[1],data_embargo:da?iso(da[1]):'',auto_infracao_originario:ai?ai[1]:'',descricao:'',area_embargada_ha:''});
    }
    const ue=new Map(emb.map(x=>[x.numero,x]));if(ue.size){estado.embargos=[...ue.values()];render('embargos')}
    $('quantAutoInfracao').value=estado.autos.length||'';$('autoInfracao').value=estado.autos.map(x=>x.numero).join('; ');
  }

  const originalLer=window.lerTextoPdfLocal;if(typeof originalLer==='function')window.lerTextoPdfLocal=async function(arq){const t=await originalLer(arq);window.__cipaPdfTexto=t;return t};
  $('arquivoOcorrenciaPdf')?.addEventListener('change',()=>setTimeout(()=>{if(window.__cipaPdfTexto){extrairCipa(window.__cipaPdfTexto);window.__cipaPdfTexto=''}},900));

  const idEdicaoCipa=new URLSearchParams(location.search).get('id');if(idEdicaoCipa)carregar(idEdicaoCipa);
  window.CipaCadastro={salvar,carregar,estado,extrairCipa};
})();