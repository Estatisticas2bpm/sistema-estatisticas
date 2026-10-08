(async function(){
  const sessaoCipa=window.SistemaAuth?.ready?await window.SistemaAuth.ready:window.SistemaAuth;
  const sigla=String(sessaoCipa?.contexto?.sigla||sessaoCipa?.perfil?.unidades?.sigla||'').toUpperCase();
  if(sigla!=='CIPA')return;

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{const n=Number(String(v??'').replace(/\./g,'').replace(',','.'));return Number.isFinite(n)?n:null};
  const iso=s=>{const m=String(s||'').match(/(\d{2})\/(\d{2})\/(\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:''};
  const dtLocal=(d,h)=>{const x=iso(d);return x?(x+'T'+String(h||'00:00').slice(0,5)):''};
  const money=s=>{const m=String(s||'').match(/R\$\s*([\d.]+,\d{2})/);return m?num(m[1]):null};
  const coordCampo=()=>$('cipaLocalCoordenadas')||$('cipaCoordenadas');
  const coordNumero=v=>Number(String(v??'').trim().replace(',','.'));
  function coordNoEstado(lat,lon){return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-2&&lat<=6&&lon>=-66&&lon<=-58}
  function coordDms(g,m,s,h){
    let v=Math.abs(coordNumero(g))+(coordNumero(m)||0)/60+(coordNumero(s)||0)/3600;
    if(/[SWO]/i.test(h||''))v=-v;
    return v;
  }
  function parseCoordenadas(valor){
    const bruto=String(valor||'').trim();if(!bruto)return null;
    const partes=[];
    const reSufixo=/(\d{1,3}(?:[.,]\d+)?)(?:\s*[°º]\s*(\d{1,2}(?:[.,]\d+)?))?(?:\s*(?:['’′]\s*)?(\d{1,2}(?:[.,]\d+)?)\s*(?:["”″])?)?\s*([NSEWO])/gi;
    let m;while((m=reSufixo.exec(bruto)))partes.push({v:coordDms(m[1],m[2],m[3],m[4]),h:m[4].toUpperCase()});
    const rePrefixo=/([NSEWO])\s*(\d{1,3}(?:[.,]\d+)?)(?:\s*[°º]\s*(\d{1,2}(?:[.,]\d+)?))?(?:\s*(?:['’′]\s*)?(\d{1,2}(?:[.,]\d+)?)\s*(?:["”″])?)?/gi;
    while(partes.length<2&&(m=rePrefixo.exec(bruto)))partes.push({v:coordDms(m[2],m[3],m[4],m[1]),h:m[1].toUpperCase()});
    if(partes.length>=2){
      const lat=partes.find(x=>/[NS]/.test(x.h))?.v,lon=partes.find(x=>/[EWO]/.test(x.h))?.v;
      if(coordNoEstado(lat,lon))return{lat,lon};
    }
    const normal=bruto.replace(/(\d),(\d)/g,'$1.$2');
    const nums=(normal.match(/-?\d{1,3}(?:\.\d+)?/g)||[]).map(Number).filter(Number.isFinite);
    for(let i=0;i<nums.length-1;i++){
      let lat=nums[i],lon=nums[i+1];
      if(/\bS\b/i.test(bruto)&&lat>0)lat=-lat;
      if(/\b(?:W|O)\b/i.test(bruto)&&lon>0)lon=-lon;
      if(coordNoEstado(lat,lon))return{lat,lon};
    }
    return null;
  }
  function sincronizarCoordenadasLocal(){
    const campo=coordCampo(),status=$('cipaStatusCoordenadas');if(!campo)return null;
    const p=parseCoordenadas(campo.value);
    if(!campo.value.trim()){
      if(status){status.textContent='Em área rural, informe ou confirme as coordenadas do PPE. Em área urbana, você pode usar o endereço normalmente.';status.style.color='#64748b'}
      return null;
    }
    if(!p){
      if(status){status.textContent='Coordenadas não reconhecidas. Use graus/minutos/segundos com N/S e W/O, ou latitude/longitude decimal.';status.style.color='#b45309'}
      return null;
    }
    $('latitude').value=p.lat.toFixed(7);$('longitude').value=p.lon.toFixed(7);
    if(!$('endereco').value)$('enderecoFormatado').value='COORDENADAS '+p.lat.toFixed(6)+', '+p.lon.toFixed(6);
    if(status){status.textContent='Coordenadas válidas. Este ponto será usado diretamente no mapa criminal.';status.style.color='#166534'}
    return p;
  }
  function coordenadasDoTexto(texto){
    const bruto=String(texto||''),linhas=bruto.split(/\r?\n/);
    const latNome=bruto.match(/\bLAT(?:ITUDE)?\s*[:=]?\s*(-?\d{1,2}[.,]\d{3,})/i);
    const lonNome=bruto.match(/\b(?:LON(?:GITUDE)?|LONG)\s*[:=]?\s*(-?\d{1,3}[.,]\d{3,})/i);
    if(latNome&&lonNome){
      const lat=coordNumero(latNome[1]),lon=coordNumero(lonNome[1]);
      if(coordNoEstado(lat,lon))return{texto:latNome[1]+', '+lonNome[1],lat,lon,origem:'latitude e longitude identificadas'};
    }
    for(const linha of linhas){
      if(/COORD|LATITUDE|LONGITUDE|\bGPS\b|LOCALIZA[ÇC][ÃA]O|GEOGR[ÁA]FIC/i.test(linha)){
        const p=parseCoordenadas(linha);if(p)return{texto:linha.trim(),lat:p.lat,lon:p.lon,origem:'texto identificado'};
      }
    }
    const hem=bruto.match(/[^\n]{0,100}\d{1,3}(?:[.,]\d+)?(?:\s*[°º][^\n]{0,55})?[NS][^\n]{0,120}\d{1,3}(?:[.,]\d+)?(?:\s*[°º][^\n]{0,55})?[EWO][^\n]{0,60}/i);
    if(hem){const p=parseCoordenadas(hem[0]);if(p)return{texto:hem[0].replace(/\s+/g,' ').trim(),lat:p.lat,lon:p.lon,origem:'coordenada hemisférica'}}
    for(let i=0;i<linhas.length;i++){
      const trecho=linhas.slice(i,i+3).join(' ').replace(/\s+/g,' ').trim();
      const hemisferios=/\d[^\n]{0,55}[NS][^\n]{0,90}\d[^\n]{0,55}[EWO]/i.test(trecho);
      const decimal=/-?\d{1,2}[.,]\d{4,}\s*[,;/]\s*-?\d{1,3}[.,]\d{4,}/.test(trecho);
      if(!hemisferios&&!decimal)continue;
      const p=parseCoordenadas(trecho);
      if(p)return{texto:trecho,lat:p.lat,lon:p.lon,origem:'par geográfico válido'};
    }
    return null;
  }
  const style=document.createElement('style');
  style.textContent='.cipa-modulo{border:1px solid #a7c7b6!important;background:linear-gradient(180deg,#f6fbf8,#fff)}.cipa-modulo h2{color:#245b43}.cipa-repeater{grid-column:1/-1;border:1px solid #d6e5dc;border-radius:12px;padding:12px;background:#fff}.cipa-repeater-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px}.cipa-repeater-head h3{margin:0;color:#245b43}.cipa-list{display:grid;gap:10px}.cipa-item{border:1px solid #dbe6df;border-radius:10px;padding:10px;background:#fbfdfc}.cipa-item-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.cipa-item-grid label{font-size:11px;font-weight:800;color:#52677a}.cipa-item-grid input,.cipa-item-grid select,.cipa-item-grid textarea{display:block;width:100%;margin-top:4px;border:1px solid #cdd8e5;border-radius:8px;padding:8px;background:#fff}.cipa-item-grid textarea{min-height:64px;resize:vertical}.cipa-span2{grid-column:span 2}.cipa-span4{grid-column:1/-1}.cipa-remove{border:0;background:#a63d40;color:#fff;border-radius:7px;padding:7px 10px;cursor:pointer;float:right}@media(max-width:800px){.cipa-item-grid{grid-template-columns:1fr 1fr}.cipa-span4{grid-column:1/-1}}';
  style.textContent+='.cipa-fauna-escolha{display:flex;gap:6px;align-items:center}.cipa-fauna-escolha input{flex:1;min-width:0}.cipa-fauna-escolha button{flex:none;margin-top:4px;border:0;border-radius:8px;background:#245b43;color:white;font-size:19px;padding:5px 12px;cursor:pointer}.cipa-fauna-novo{grid-column:1/-1;border:1px solid #9fc5b0;background:#f1faf5;border-radius:12px;padding:14px}.cipa-fauna-novo[hidden]{display:none}.cipa-fauna-novo-grade{display:grid;grid-template-columns:2fr 2fr 1fr;gap:10px}.cipa-fauna-novo-grade label{font-size:12px;font-weight:700}.cipa-fauna-novo-grade input,.cipa-fauna-novo-grade select{width:100%;display:block;margin-top:5px;padding:9px;border:1px solid #bdcdd4;border-radius:8px}.cipa-fauna-acoes{display:flex;gap:8px;margin-top:10px}.cipa-fauna-ajuda{font-size:11px;font-weight:400;color:#617589}@media(max-width:800px){.cipa-fauna-novo-grade{grid-template-columns:1fr}}';
  document.head.appendChild(style);

  const alvo=[...document.querySelectorAll('form#formOcorrencia > section')].find(s=>/10\. Outros indicadores/i.test(s.querySelector('h2')?.textContent||''));
  if(!alvo)return;
  const sec=document.createElement('section');
  sec.className='cipa-modulo';
  sec.innerHTML=`
    <h2>10. Dados ambientais — CIPA</h2>
    <div class="grade">
      <div class="campo duplo"><label for="cipaOrigem">Origem do acionamento / operação</label><select id="cipaOrigem"><option value="">Selecione</option><option value="CICC">CICC — Centro Integrado de Comando e Controle</option><option value="BIOMA">Operação Bioma</option><option value="PATRULHAMENTO">Patrulhamento</option><option value="ORDEM DE MISSÃO">Ordem de Missão</option><option value="ORDEM DE SERVIÇO">Ordem de Serviço</option></select></div>
      <div class="campo duplo"><label for="cipaTipoOrdem">Tipo do documento que determinou a missão</label><select id="cipaTipoOrdem"><option value="">Não informado</option><option>ORDEM DE MISSÃO</option><option>ORDEM DE SERVIÇO</option><option>OUTRO DOCUMENTO</option></select></div>
      <div class="campo cipa-span4"><label for="cipaDocumentoOrigem">Identificação completa do documento da missão</label><textarea id="cipaDocumentoOrigem" rows="2" spellcheck="false" placeholder="Ex.: ORDEM DE MISSÃO DA PMRR Nº 42/2026PMRR/QCG/CPC/CIPA/P2P3A"></textarea><span class="nota">Informe a referência completa como aparece no PPE. O número da ordem será identificado automaticamente.</span></div>
      <div class="campo duplo"><label for="cipaAnexo">Anexo / referência</label><input id="cipaAnexo" placeholder="Mapa, TR, AI, relatório ambiental..."></div>
      <div id="cipaAutos" class="cipa-repeater"></div>
      <div id="cipaEmbargos" class="cipa-repeater"></div>
      <div id="cipaNotificacoes" class="cipa-repeater"></div>
      <div id="cipaFauna" class="cipa-repeater"></div>
      <datalist id="cipaFaunaOpcoes"></datalist>
      <div id="cipaFaunaNovoPainel" class="cipa-fauna-novo" hidden>
        <strong>Cadastrar animal no catálogo</strong>
        <p>Inclua uma espécie ausente da lista. O nome científico pode ficar pendente de confirmação.</p>
        <div class="cipa-fauna-novo-grade">
          <label>Nome popular *<input id="cipaFaunaNovoNome" maxlength="100" placeholder="Ex.: Jabuti-tinga"></label>
          <label>Nome científico<input id="cipaFaunaNovoCientifico" maxlength="120" placeholder="Ex.: Chelonoidis denticulatus"></label>
          <label>Grupo<select id="cipaFaunaNovoGrupo"><option>AVES</option><option>MAMÍFEROS</option><option>RÉPTEIS</option><option>PEIXES</option><option>ANFÍBIOS</option><option>OUTROS</option></select></label>
        </div>
        <div class="cipa-fauna-acoes"><button type="button" class="botao-item" data-fauna-salvar>Adicionar ao catálogo</button><button type="button" class="botao-item" data-fauna-fechar>Cancelar</button></div>
        <p id="cipaFaunaNovoStatus" role="status"></p>
      </div>
      <div id="cipaEducacao" class="cipa-repeater"></div>
      <div id="cipaTdba" class="cipa-repeater"></div>
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
      ['numero','Nº do Termo','text'],['data_embargo','Data','date'],['auto_infracao_originario','Auto de Infração originário','text'],['area_embargada_ha','Área vinculada (ha)','number'],['descricao','Fundamento legal (Art. Decreto 6.514/08) e descrição','textarea','cipa-span4']
    ]},
    notificacoes:{box:'cipaNotificacoes',titulo:'Autos de Notificação',botao:'+ Adicionar Notificação',campos:[
      ['numero','Nº da Notificação','text'],['data_notificacao','Data','date'],['hora_notificacao','Hora','time'],['autuado','Autuado','text'],['data_limite','Data limite','date'],['fiscal_ambiental','Fiscal ambiental','text'],['descricao','Descrição','textarea','cipa-span4']
    ]},
    fauna:{box:'cipaFauna',titulo:'Fauna / Animais Envolvidos',botao:'+ Adicionar animal',campos:[
      ['nome_comum','Animal (nome popular)','fauna','cipa-span2'],['nome_cientifico','Nome científico','text','cipa-span2'],
      ['quantidade','Quantidade','number'],['numero_tr','TR (opcional)','text'],['data_registro','Data','date'],['procedencia','Procedência','text']
    ]},
    educacao:{box:'cipaEducacao',titulo:'Educação Ambiental',botao:'+ Adicionar ação',campos:[
      ['data_acao','Data','date'],['publico_estimado','Público estimado','number'],['acao','Ação','text'],['local_acao','Local','text']
    ]},
    tdba:{box:'cipaTdba',titulo:'TDBA / Bens Apreendidos',botao:'+ Adicionar TDBA',campos:[
      ['numero_tdba','TDBA','text'],['auto_infracao','Auto de Infração','text'],['tipo','Tipo','text'],['quantidade','Quantidade','number'],['apreensao','Apreensão','text','cipa-span2'],['valor_bens','Valor dos bens (R$)','number'],['depositario_fiel','Depositário fiel','text'],['caracteristicas','Características','textarea','cipa-span4']
    ]}
  };
  const estado={autos:[],embargos:[],notificacoes:[],fauna:[],educacao:[],tdba:[]};
  const datasPpe={inicio:null,fim:null};
  let catalogoFauna=[],faunaIndiceNovo=null,faunaCatalogoCarregado=false;
  const normalizarFauna=texto=>String(texto||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').trim().toUpperCase().replace(/\\s+/g,' ');
  function animalPorNome(nome){return catalogoFauna.find(a=>normalizarFauna(a.nome_popular)===normalizarFauna(nome))}
  function atualizarOpcoesFauna(){
    const lista=$('cipaFaunaOpcoes');if(!lista)return;
    lista.innerHTML=catalogoFauna.map(a=>'<option value="'+esc(a.nome_popular)+'" label="'+esc(a.nome_cientifico||'Nome científico a confirmar')+'"></option>').join('');
  }
  async function carregarCatalogoFauna(){
    const resposta=await banco.from('cipa_catalogo_animais').select('id,nome_popular,nome_cientifico,grupo').eq('ativo',true).order('nome_popular');
    if(resposta.error){console.warn('Não foi possível carregar o catálogo de fauna da CIPA.',resposta.error);return false}
    catalogoFauna=resposta.data||[];faunaCatalogoCarregado=true;
    atualizarOpcoesFauna();return true;
  }
  function associarAnimal(indice){
    const item=estado.fauna[indice];if(!item)return;
    const achado=animalPorNome(item.nome_comum);
    if(!achado){item.animal_catalogo_id=null;item.nome_cientifico='';return}
    item.nome_comum=achado.nome_popular;item.nome_cientifico=achado.nome_cientifico||'';
    item.animal_catalogo_id=achado.id;
  }
  function abrirCadastroAnimal(indice){
    faunaIndiceNovo=indice;
    const atual=estado.fauna[indice];
    $('cipaFaunaNovoNome').value=atual?.nome_comum||'';
    $('cipaFaunaNovoCientifico').value='';
    $('cipaFaunaNovoGrupo').value='AVES';
    $('cipaFaunaNovoStatus').textContent='';
    $('cipaFaunaNovoPainel').hidden=false;
    $('cipaFaunaNovoNome').focus();
  }
  function fecharCadastroAnimal(){faunaIndiceNovo=null;$('cipaFaunaNovoPainel').hidden=true}
  async function cadastrarAnimal(){
    const nome=$('cipaFaunaNovoNome').value.trim(),cientifico=$('cipaFaunaNovoCientifico').value.trim();
    const status=$('cipaFaunaNovoStatus');
    if(nome.length<2){status.textContent='Informe o nome popular do animal.';return}
    if(animalPorNome(nome)){status.textContent='Esse animal já existe na lista. Selecione-o pelo nome popular.';return}
    const botao=sec.querySelector('[data-fauna-salvar]');
    botao.disabled=true;status.textContent='Cadastrando no catálogo...';
    try{
      const resposta=await banco.from('cipa_catalogo_animais').insert({
        nome_popular:nome,nome_cientifico:cientifico||null,grupo:$('cipaFaunaNovoGrupo').value,
        revisao_taxonomica_pendente:!cientifico
      }).select('id,nome_popular,nome_cientifico,grupo').single();
      if(resposta.error)throw resposta.error;
      catalogoFauna.push(resposta.data);catalogoFauna.sort((a,b)=>a.nome_popular.localeCompare(b.nome_popular,'pt-BR'));
      atualizarOpcoesFauna();
      if(faunaIndiceNovo!==null){
        const item=estado.fauna[faunaIndiceNovo];
        if(item){item.nome_comum=resposta.data.nome_popular;associarAnimal(faunaIndiceNovo);render('fauna')}
      }
      fecharCadastroAnimal();
    }catch(erro){
      status.textContent=erro?.code==='23505'?'O animal já foi cadastrado. Atualize a lista e selecione a espécie.':'Não foi possível cadastrar o animal: '+(erro?.message||'erro desconhecido');
    }finally{botao.disabled=false}
  }
  function campoHtml(c,v='',obj={}){
    const [k,l,t,cls='']=c,val=v??'',step=(k.includes('area_')?'0.0001':k.includes('valor_')?'0.01':'1');
    if(t==='fauna')return `<label class="${cls}">${l}<span class="cipa-fauna-escolha"><input data-k="nome_comum" list="cipaFaunaOpcoes" autocomplete="off" placeholder="Pesquise o animal" value="${esc(val)}"><button type="button" data-fauna-novo title="Adicionar animal ao catálogo" aria-label="Adicionar animal ao catálogo">+</button></span><input type="hidden" data-k="animal_catalogo_id" value="${esc(obj.animal_catalogo_id||'')}"><span class="cipa-fauna-ajuda">Selecione uma espécie ou use + para cadastrar outra.</span></label>`;
    if(k==='nome_cientifico')return `<label class="${cls}">${l}<input data-k="${k}" type="text" readonly value="${esc(val)}" placeholder="Preenchido pela lista"></label>`;
    if(t==='textarea')return `<label class="${cls}">${l}<textarea data-k="${k}">${esc(val)}</textarea></label>`;
    if(t==='select')return `<label class="${cls}">${l}<select data-k="${k}"><option value="">Selecione</option><option ${val==='CAPITAL'?'selected':''}>CAPITAL</option><option ${val==='INTERIOR'?'selected':''}>INTERIOR</option></select></label>`;
    return `<label class="${cls}">${l}<input data-k="${k}" type="${t}" ${t==='number'?`min="0" step="${step}"`:''} value="${esc(val)}"></label>`;
  }
  function render(tipo){
    const d=defs[tipo],box=$(d.box);box.innerHTML=`<div class="cipa-repeater-head"><h3>${d.titulo}</h3><button type="button" class="botao-item" data-add="${tipo}">${d.botao}</button></div><div class="cipa-list">${estado[tipo].map((x,i)=>`<div class="cipa-item" data-tipo="${tipo}" data-i="${i}"><button type="button" class="cipa-remove" data-rm="${tipo}" data-i="${i}">Remover</button><div class="cipa-item-grid">${d.campos.map(c=>campoHtml(c,x[c[0]],x)).join('')}</div></div>`).join('')||'<p class="lista-vazia">Nenhum registro informado.</p>'}</div>`;
    if(tipo==='autos'){$('quantAutoInfracao').value=estado.autos.length||'';$('autoInfracao').value=estado.autos.map(x=>x.numero).filter(Boolean).join('; ');}
  }
  function syncItem(el){
    const tipo=el.dataset.tipo,i=Number(el.dataset.i),obj=estado[tipo][i];if(!obj)return;
    el.querySelectorAll('[data-k]').forEach(c=>obj[c.dataset.k]=c.value);
  }
  Object.keys(defs).forEach(render);
  sec.addEventListener('input',e=>{const item=e.target.closest('.cipa-item');if(item)syncItem(item)});
  sec.addEventListener('change',e=>{
    const item=e.target.closest('.cipa-item');if(!item)return;
    syncItem(item);
    if(item.dataset.tipo==='fauna'&&e.target.dataset.k==='nome_comum'){
      associarAnimal(Number(item.dataset.i));render('fauna');
    }
  });
  sec.addEventListener('click',async e=>{
    const novo=e.target.closest('[data-fauna-novo]');if(novo){abrirCadastroAnimal(Number(novo.closest('.cipa-item').dataset.i));return}
    if(e.target.closest('[data-fauna-fechar]')){fecharCadastroAnimal();return}
    if(e.target.closest('[data-fauna-salvar]')){await cadastrarAnimal();return}
    const add=e.target.closest('[data-add]');if(add){estado[add.dataset.add].push({});render(add.dataset.add);return}
    const rm=e.target.closest('[data-rm]');if(rm){estado[rm.dataset.rm].splice(Number(rm.dataset.i),1);render(rm.dataset.rm)}
  });
  carregarCatalogoFauna();

  function dadosDocumentoMissao(){
    const referencia=$('cipaDocumentoOrigem').value.trim();
    const identificado=referencia?window.CipaRegrasPpe?.documentoDaMissao(referencia):null;
    return {
      tipo_documento_origem:$('cipaTipoOrdem').value||identificado?.tipo||null,
      numero_documento_origem:identificado?.numero||null,
      documento_origem:referencia||null
    };
  }
  function dadosBase(){
    return {ppe_original:null,data_registro_inicio:datasPpe.inicio,data_registro_fim:datasPpe.fim,area_tipo:$('cipaAreaTipo').value||null,coordenadas_texto:coordCampo()?.value.trim()||null,origem_atuacao:$('cipaOrigem').value||null,...dadosDocumentoMissao(),anexo_referencia:$('cipaAnexo').value.trim()||null};
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
    if(!faunaCatalogoCarregado)await carregarCatalogoFauna();
    for(const animal of estado.fauna){
      if(!String(animal.nome_comum||'').trim())continue;
      const especie=animalPorNome(animal.nome_comum);
      if(especie){
        animal.animal_catalogo_id=especie.id;animal.nome_comum=especie.nome_popular;animal.nome_cientifico=especie.nome_cientifico||null;
      }else if(!animal.id){
        throw new Error('O animal "'+animal.nome_comum+'" não está no catálogo. Use o botão + para cadastrá-lo.');
      }
    }
    const ppe=$('numeroBo').value.trim(),ano=String($('data').value||'').slice(0,4);
    const base={...dadosBase(),ppe_original:ppe&&ano?String(ppe).padStart(8,'0')+'/'+ano:null,ocorrencia_id:ocorrenciaId};
    const up=await banco.from('cipa_ocorrencias_ambientais').upsert(base,{onConflict:'ocorrencia_id'});if(up.error)throw up.error;
    await substituir('cipa_autos_infracao',ocorrenciaId,normalizarLinhas('autos'));
    await substituir('cipa_termos_embargo',ocorrenciaId,normalizarLinhas('embargos'));
    await substituir('cipa_autos_notificacao',ocorrenciaId,normalizarLinhas('notificacoes'));
    await substituir('cipa_fauna',ocorrenciaId,normalizarLinhas('fauna'));
    await substituir('cipa_educacao_ambiental',ocorrenciaId,normalizarLinhas('educacao'));
    await substituir('cipa_tdba',ocorrenciaId,normalizarLinhas('tdba'));
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
      banco.from('cipa_tdba').select('*').eq('ocorrencia_id',ocorrenciaId)
    ];
    const r=await Promise.all(qs);if(r.some(x=>x.error)){console.error('Falha ao carregar módulo CIPA',r.find(x=>x.error)?.error);return}
    const b=r[0].data||{};datasPpe.inicio=b.data_registro_inicio||null;datasPpe.fim=b.data_registro_fim||null;$('cipaAreaTipo').value=b.area_tipo||'';if(coordCampo())coordCampo().value=b.coordenadas_texto||'';sincronizarCoordenadasLocal();const origemSalva=b.origem_atuacao||'';if(origemSalva&&![...$('cipaOrigem').options].some(o=>o.value===origemSalva)){$('cipaOrigem').add(new Option(origemSalva,origemSalva))}$('cipaOrigem').value=origemSalva;$('cipaDocumentoOrigem').value=b.documento_origem||'';const ordemSalva=window.CipaRegrasPpe?.documentoDaMissao(b.documento_origem||'')||{};$('cipaTipoOrdem').value=b.tipo_documento_origem||ordemSalva.tipo||'';$('cipaAnexo').value=b.anexo_referencia||'';
    ['autos','embargos','notificacoes','fauna','educacao','tdba'].forEach((k,i)=>{estado[k]=r[i+1].data||[];render(k)});
  }

  function blocoAte(texto,inicio,proximos){
    const p=texto.indexOf(inicio);if(p<0)return'';let fim=texto.length;proximos.forEach(m=>{const x=texto.indexOf(m,p+inicio.length);if(x>=0&&x<fim)fim=x});return texto.slice(p,fim);
  }
  function extrairCipa(texto){
    const registro=texto.match(/Data\/Hora In[íi]cio do Registro:\s*(\d{2}\/\d{2}\/20\d{2})\s*(\d{2}:\d{2})/i);
    const encerramento=texto.match(/Data\/Hora Fim:\s*(\d{2}\/\d{2}\/20\d{2})\s*(\d{2}:\d{2})/i);
    if(registro)datasPpe.inicio=dtLocal(registro[1],registro[2])+':00-04:00';
    if(encerramento)datasPpe.fim=dtLocal(encerramento[1],encerramento[2])+':00-04:00';
    const local=texto.match(/Tipo do Local:\s*([^\n]+)/i);if(local)$('cipaAreaTipo').value=/RURAL/i.test(local[1])?'RURAL':/URBAN/i.test(local[1])?'URBANA':'';
    const regras=window.CipaRegrasPpe?.extrair(texto)||{};
    if(regras.documento?.referencia&&!$('cipaDocumentoOrigem').value.trim())$('cipaDocumentoOrigem').value=regras.documento.referencia;
    if(regras.documento?.tipo&&!$('cipaTipoOrdem').value)$('cipaTipoOrdem').value=regras.documento.tipo;
    if(regras.origem&&!$('cipaOrigem').value)$('cipaOrigem').value=regras.origem;
    const coord=coordenadasDoTexto(texto);if(coord&&coordCampo()&&!coordCampo().value.trim()){coordCampo().value=coord.texto;sincronizarCoordenadasLocal()}


    const documentos=window.CipaExtrator?.extrair(texto);
    if(documentos?.autos?.length){estado.autos=documentos.autos;render('autos')}
    if(documentos?.embargos?.length){estado.embargos=documentos.embargos;render('embargos')}
    $('quantAutoInfracao').value=estado.autos.length||'';$('autoInfracao').value=estado.autos.map(x=>x.numero).join('; ');
  }

  function finalizarPreenchimentoPpe(texto,tipos){
    const resultado=window.CipaRegrasPpe?.extrair(texto,tipos);
    const tipo=resultado?.natureza;
    if(tipo?.nome){
      $('ocorrencia').value=tipo.nome;
      $('ocorrencia').dispatchEvent(new Event('change',{bubbles:true}));
    }
    // O comandante só vem da informação explícita do PPE; RELATOR da planilha
    // não significa obrigatoriamente comandante da guarnição.
    return resultado;
  }
  coordCampo()?.addEventListener('input',sincronizarCoordenadasLocal);
  coordCampo()?.addEventListener('change',sincronizarCoordenadasLocal);
  $('cipaAreaTipo')?.addEventListener('change',()=>{
    const rural=$('cipaAreaTipo').value==='RURAL',status=$('cipaStatusCoordenadas');
    if(status&&!coordCampo()?.value.trim())status.textContent=rural?'Área rural: informe as coordenadas geográficas para posicionar a ocorrência no mapa.':'Área urbana: informe o endereço ou, se disponível, as coordenadas.';
  });

  window.addEventListener('sie:pdf-texto-extraido',evento=>{
    const texto=evento?.detail?.texto;
    if(!texto)return;
    const haviaCoordenada=Boolean(coordCampo()?.value.trim());
    extrairCipa(texto);
    const info=evento.detail||{};
    if(!haviaCoordenada&&info.origem==='ocr'&&coordCampo()?.value.trim()){
      const status=$('cipaStatusCoordenadas');
      if(status){
        status.textContent='Coordenada sugerida pelo OCR ('+(info.metodo||'imagem')+', página '+info.pagina+'). Confira com o PPE antes de salvar.';
        status.style.color='#9a5b0b';
      }
    }
  });

  const idEdicaoCipa=new URLSearchParams(location.search).get('id');if(idEdicaoCipa)carregar(idEdicaoCipa);
  window.CipaCadastro={salvar,carregar,estado,extrairCipa,finalizarPreenchimentoPpe,parseCoordenadas,coordenadasDoTexto,sincronizarCoordenadasLocal};
})();