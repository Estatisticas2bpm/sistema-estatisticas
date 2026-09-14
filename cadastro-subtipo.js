(function(){
  'use strict';

  function iniciar(){
    const campoCrime = document.getElementById('crime');
    const campoOcorrencia = document.getElementById('ocorrencia');
    const formulario = document.getElementById('formOcorrencia') || document.querySelector('form');
    if(!campoCrime || !campoOcorrencia || !formulario || campoCrime.dataset.multiplasNaturezas === '1') return;
    campoCrime.dataset.multiplasNaturezas = '1';

    const normalizar = (valor) => {
      try { return normalizarCatalogo(valor); }
      catch (_) { return String(valor || '').trim().replace(/\s+/g,' ').toUpperCase(); }
    };

    let naturezasSelecionadas = [];
    let carregandoEdicao = false;

    const estilo = document.createElement('style');
    estilo.textContent = `
      .naturezas-acoes{grid-column:1/-1;display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:-4px}
      .btn-adicionar-natureza{width:auto;padding:10px 15px;font-size:14px;font-weight:800;background:#2556d8}
      .naturezas-selecionadas{grid-column:1/-1;display:grid;gap:10px;margin-top:2px}
      .natureza-card{border:1px solid #cbd5e1;border-radius:11px;background:#f8fafc;padding:12px 14px}
      .natureza-topo{display:flex;justify-content:space-between;align-items:center;gap:12px}
      .natureza-titulo{font-weight:900;color:#132b46;font-size:14px}
      .natureza-remover{border:0;background:#fee2e2;color:#991b1b;width:30px;height:30px;padding:0;border-radius:7px;font-size:17px;font-weight:900}
      .natureza-remover:hover{background:#fecaca}
      .subtipos-chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}
      .subtipo-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;background:#e0edff;color:#1d4ed8;font-size:12px;font-weight:800}
      .subtipo-chip button{border:0;background:transparent;color:#1d4ed8;padding:0;width:auto;min-width:0;font-size:16px;line-height:1}
      .subtipo-chip button:hover{background:transparent;color:#991b1b}
      .natureza-sem-subtipo{margin-top:8px;color:#64748b;font-size:12px}
      .naturezas-ajuda{color:#64748b;font-size:12px}
      .campo-com-acao-subtipo{display:flex;gap:8px;align-items:stretch}
      .campo-com-acao-subtipo input{flex:1}
      @media(max-width:600px){.naturezas-acoes{align-items:stretch}.btn-adicionar-natureza{width:100%}}
    `;
    document.head.appendChild(estilo);

    // Mantém o botão + para cadastrar novo subtipo no catálogo.
    if(!document.getElementById('abrirNovoSubtipoOcorrencia')){
      const paiCrime = campoCrime.parentElement;
      const grupoCrime = document.createElement('div');
      grupoCrime.className = 'campo-com-acao-subtipo';
      paiCrime.insertBefore(grupoCrime, campoCrime);
      grupoCrime.appendChild(campoCrime);

      const botaoNovoSubtipo = document.createElement('button');
      botaoNovoSubtipo.className = 'botao-adicionar';
      botaoNovoSubtipo.id = 'abrirNovoSubtipoOcorrencia';
      botaoNovoSubtipo.type = 'button';
      botaoNovoSubtipo.title = 'Cadastrar novo subtipo de ocorrência';
      botaoNovoSubtipo.setAttribute('aria-label','Cadastrar novo subtipo de ocorrência');
      botaoNovoSubtipo.textContent = '+';
      grupoCrime.appendChild(botaoNovoSubtipo);
    }

    const paiCrime = campoCrime.closest('.campo') || campoCrime.parentElement;
    const areaAcoes = document.createElement('div');
    areaAcoes.className = 'naturezas-acoes';
    areaAcoes.innerHTML = '<button type="button" id="adicionarNaturezaAoBo" class="btn-adicionar-natureza">＋ Adicionar natureza/subtipo ao BO</button><span class="naturezas-ajuda">O mesmo BO pode conter vários tipos de ocorrência e vários subtipos.</span>';
    paiCrime.insertAdjacentElement('afterend', areaAcoes);

    const listaNaturezas = document.createElement('div');
    listaNaturezas.id = 'naturezasSelecionadas';
    listaNaturezas.className = 'naturezas-selecionadas';
    areaAcoes.insertAdjacentElement('afterend', listaNaturezas);

    const modal = document.createElement('dialog');
    modal.id = 'modalSubtipoOcorrencia';
    modal.innerHTML = `
      <form class="modal-conteudo" id="formNovoSubtipoOcorrencia" method="dialog">
        <h3>Cadastrar novo subtipo de ocorrência</h3>
        <p>O subtipo será vinculado ao Tipo de Ocorrência selecionado no cadastro.</p>
        <div class="campo">
          <label for="tipoPaiSubtipo">Tipo de Ocorrência</label>
          <input id="tipoPaiSubtipo" type="text" readonly>
        </div>
        <div class="campo" style="margin-top:14px">
          <label for="novoSubtipoOcorrencia">Subtipo da Ocorrência</label>
          <input id="novoSubtipoOcorrencia" maxlength="160" autocomplete="off" placeholder="Ex.: AMEAÇA" required>
        </div>
        <div class="campo" style="margin-top:14px">
          <label for="novoSubtipoFundamento">Fundamento legal <span class="nota">(opcional)</span></label>
          <input id="novoSubtipoFundamento" maxlength="200" autocomplete="off" placeholder="Ex.: ART. 147 DO CÓDIGO PENAL">
        </div>
        <div class="modal-acoes">
          <button class="botao-secundario" id="cancelarNovoSubtipoOcorrencia" type="button">Cancelar</button>
          <button id="salvarNovoSubtipoOcorrencia" type="submit">Salvar subtipo</button>
        </div>
      </form>`;
    document.body.appendChild(modal);

    function tipoSelecionado(){
      if(typeof catalogos === 'undefined' || !Array.isArray(catalogos.tipos)) return null;
      const valor = normalizar(campoOcorrencia.value);
      return catalogos.tipos.find(t => normalizar(t.nome) === valor) || null;
    }

    function subtipoSelecionado(tipo){
      const valor = normalizar(campoCrime.value);
      if(!valor) return null;
      if(typeof catalogos === 'undefined' || !Array.isArray(catalogos.subtipos) || !tipo) return null;
      return catalogos.subtipos.find(s => Number(s.tipo_id) === Number(tipo.id) && normalizar(s.nome) === valor) || null;
    }

    function localizarNatureza(tipo){
      return naturezasSelecionadas.find(n => Number(n.tipo_id) === Number(tipo.id) || normalizar(n.nome) === normalizar(tipo.nome));
    }

    function adicionarSelecaoAtual({silencioso=false}={}){
      const tipo = tipoSelecionado();
      if(!tipo){
        if(!silencioso) alert('Selecione um Tipo de Ocorrência válido antes de adicionar ao BO.');
        return false;
      }

      const digitado = normalizar(campoCrime.value);
      const subtipo = digitado ? subtipoSelecionado(tipo) : null;
      if(digitado && !subtipo){
        if(!silencioso) alert('Selecione um Subtipo válido relacionado ao Tipo de Ocorrência escolhido.');
        return false;
      }

      let natureza = localizarNatureza(tipo);
      if(!natureza){
        natureza = {tipo_id:Number(tipo.id), nome:tipo.nome, subtipos:[]};
        naturezasSelecionadas.push(natureza);
      }

      if(subtipo && !natureza.subtipos.some(s => Number(s.id) === Number(subtipo.id) || normalizar(s.nome) === normalizar(subtipo.nome))){
        natureza.subtipos.push({
          id:Number(subtipo.id),
          nome:subtipo.nome,
          fundamento_legal:subtipo.fundamento_legal || null
        });
      }

      renderizar();
      if(subtipo){
        campoCrime.value = '';
        const fundamento = document.getElementById('fundamentoLegal');
        if(fundamento) fundamento.textContent = '';
      }
      return true;
    }

    function removerNatureza(indice){
      naturezasSelecionadas.splice(indice,1);
      renderizar();
    }

    function removerSubtipo(indiceNatureza, indiceSubtipo){
      const natureza = naturezasSelecionadas[indiceNatureza];
      if(!natureza) return;
      natureza.subtipos.splice(indiceSubtipo,1);
      renderizar();
    }

    function escaparHtml(valor){
      return String(valor ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    function renderizar(){
      if(!naturezasSelecionadas.length){
        listaNaturezas.innerHTML = '<div class="natureza-card"><div class="natureza-sem-subtipo">Nenhuma natureza adicionada ao BO ainda.</div></div>';
        return;
      }
      listaNaturezas.innerHTML = naturezasSelecionadas.map((n,ni)=>{
        const chips = n.subtipos.length
          ? '<div class="subtipos-chips">'+n.subtipos.map((s,si)=>'<span class="subtipo-chip">'+escaparHtml(s.nome)+'<button type="button" data-remover-subtipo="'+ni+'|'+si+'" title="Remover subtipo">×</button></span>').join('')+'</div>'
          : '<div class="natureza-sem-subtipo">Sem subtipo informado para esta natureza.</div>';
        return '<div class="natureza-card"><div class="natureza-topo"><span class="natureza-titulo">'+(ni+1)+'ª natureza — '+escaparHtml(n.nome)+'</span><button type="button" class="natureza-remover" data-remover-natureza="'+ni+'" title="Remover natureza">×</button></div>'+chips+'</div>';
      }).join('');
    }

    function sincronizarCamposLegados(){
      if(!naturezasSelecionadas.length) return;
      const primeira = naturezasSelecionadas[0];
      campoOcorrencia.value = primeira.nome;
      try { atualizarSubtipos(); } catch (_) {}
      campoCrime.value = primeira.subtipos[0]?.nome || '';
      const fundamento = document.getElementById('fundamentoLegal');
      if(fundamento) fundamento.textContent = primeira.subtipos[0]?.fundamento_legal || '';
    }

    function crimesParaSalvar(){
      const itens = [];
      naturezasSelecionadas.forEach(n => {
        if(n.subtipos.length){
          n.subtipos.forEach(s => itens.push({
            tipo_id:n.tipo_id || null,
            tipo_nome:n.nome,
            subtipo_id:s.id || null,
            nome:s.nome,
            fundamento_legal:s.fundamento_legal || null
          }));
        } else {
          itens.push({tipo_id:n.tipo_id || null,tipo_nome:n.nome,subtipo_id:null,nome:null,fundamento_legal:null});
        }
      });
      return itens;
    }

    window.obterCrimesSelecionados = crimesParaSalvar;
    window.obterNaturezasSelecionadas = function(){
      return naturezasSelecionadas.map(n=>({
        tipo_id:n.tipo_id || null,
        nome:n.nome,
        subtipos:n.subtipos.map(s=>({...s}))
      }));
    };

    function carregarDadosSalvos(x){
      if(!x) return;
      const grupos = [];
      const porChave = new Map();
      const garantir = (tipoId,nome) => {
        const chave = tipoId ? 'id:'+tipoId : 'nome:'+normalizar(nome);
        if(porChave.has(chave)) return porChave.get(chave);
        const tipoCatalogo = Array.isArray(catalogos?.tipos) ? catalogos.tipos.find(t => (tipoId && Number(t.id)===Number(tipoId)) || normalizar(t.nome)===normalizar(nome)) : null;
        const grupo = {tipo_id:Number(tipoCatalogo?.id || tipoId || 0) || null,nome:tipoCatalogo?.nome || nome,subtipos:[]};
        porChave.set(chave,grupo);grupos.push(grupo);return grupo;
      };

      const itens = Array.isArray(x.crimes_itens) ? x.crimes_itens : [];
      if(itens.some(i=>i && (i.tipo_nome || i.tipo_id))){
        itens.forEach(i=>{
          if(!i) return;
          const nomeTipo = i.tipo_nome || x.ocorrencia;
          if(!nomeTipo) return;
          const g = garantir(i.tipo_id,nomeTipo);
          if(i.nome && !g.subtipos.some(s=>normalizar(s.nome)===normalizar(i.nome))){
            const cat = Array.isArray(catalogos?.subtipos) ? catalogos.subtipos.find(s => Number(s.tipo_id)===Number(g.tipo_id) && normalizar(s.nome)===normalizar(i.nome)) : null;
            g.subtipos.push({id:Number(cat?.id || i.subtipo_id || 0)||null,nome:cat?.nome || i.nome,fundamento_legal:cat?.fundamento_legal || i.fundamento_legal || null});
          }
        });
      } else if(x.ocorrencia){
        const tipoCatalogo = Array.isArray(catalogos?.tipos) ? catalogos.tipos.find(t=>normalizar(t.nome)===normalizar(x.ocorrencia)) : null;
        const g = garantir(tipoCatalogo?.id,x.ocorrencia);
        const nomes = itens.map(i=>typeof i==='string'?i:i?.nome).filter(Boolean);
        if(!nomes.length && x.crime) nomes.push(x.crime);
        nomes.forEach(nome=>{
          const cat = Array.isArray(catalogos?.subtipos) ? catalogos.subtipos.find(s=>Number(s.tipo_id)===Number(g.tipo_id)&&normalizar(s.nome)===normalizar(nome)) : null;
          if(!g.subtipos.some(s=>normalizar(s.nome)===normalizar(nome))) g.subtipos.push({id:Number(cat?.id||0)||null,nome:cat?.nome||nome,fundamento_legal:cat?.fundamento_legal||null});
        });
      }

      if(grupos.length){
        naturezasSelecionadas = grupos;
        renderizar();
      }
    }

    async function carregarEdicao(){
      const id = new URLSearchParams(location.search).get('id');
      if(!id || carregandoEdicao) return;
      carregandoEdicao = true;
      try{
        const resposta = await banco.rpc('obter_ocorrencia_publica',{p_id:id});
        if(!resposta.error && resposta.data) carregarDadosSalvos(resposta.data);
      }catch(e){ console.warn('Não foi possível carregar múltiplas naturezas:',e); }
    }

    document.getElementById('adicionarNaturezaAoBo').addEventListener('click',()=>adicionarSelecaoAtual());
    listaNaturezas.addEventListener('click',e=>{
      const btNat = e.target.closest('[data-remover-natureza]');
      if(btNat){ removerNatureza(Number(btNat.dataset.removerNatureza)); return; }
      const btSub = e.target.closest('[data-remover-subtipo]');
      if(btSub){ const [ni,si]=btSub.dataset.removerSubtipo.split('|').map(Number); removerSubtipo(ni,si); }
    });

    document.getElementById('abrirNovoSubtipoOcorrencia').addEventListener('click', function(){
      const tipo = tipoSelecionado();
      if(!tipo){ alert('Selecione primeiro um Tipo de Ocorrência válido. Depois clique no + do Subtipo.'); campoOcorrencia.focus(); return; }
      document.getElementById('tipoPaiSubtipo').value = tipo.nome;
      document.getElementById('novoSubtipoOcorrencia').value = normalizar(campoCrime.value);
      document.getElementById('novoSubtipoFundamento').value = '';
      modal.showModal();
      setTimeout(()=>document.getElementById('novoSubtipoOcorrencia').focus(),0);
    });

    document.getElementById('cancelarNovoSubtipoOcorrencia').addEventListener('click',()=>modal.close());
    document.getElementById('formNovoSubtipoOcorrencia').addEventListener('submit',async function(evento){
      evento.preventDefault();
      const tipo = tipoSelecionado();
      if(!tipo){ alert('Selecione novamente o Tipo de Ocorrência.'); return; }
      const nome = normalizar(document.getElementById('novoSubtipoOcorrencia').value);
      const fundamento = String(document.getElementById('novoSubtipoFundamento').value || '').trim().replace(/\s+/g,' ');
      if(nome.length < 3){ alert('Informe um subtipo com pelo menos 3 caracteres.'); return; }
      const salvar = document.getElementById('salvarNovoSubtipoOcorrencia');
      salvar.disabled=true;salvar.textContent='Salvando...';
      try{
        const resposta = await banco.rpc('cadastrar_subtipo_ocorrencia_publico',{p_tipo_id:Number(tipo.id),p_nome:nome,p_fundamento_legal:fundamento||null});
        if(resposta.error) throw resposta.error;
        const novo = resposta.data;
        const indice = catalogos.subtipos.findIndex(s=>Number(s.id)===Number(novo.id));
        if(indice>=0) catalogos.subtipos[indice]=novo; else catalogos.subtipos.push(novo);
        catalogos.subtipos.sort((a,b)=>Number(a.tipo_id)-Number(b.tipo_id)||a.nome.localeCompare(b.nome,'pt-BR'));
        try { atualizarSubtipos(); } catch (_) {}
        campoCrime.value = novo.nome;
        const fundamentoEl=document.getElementById('fundamentoLegal');if(fundamentoEl) fundamentoEl.textContent=novo.fundamento_legal||'';
        modal.close();
      }catch(erro){ console.error(erro); alert('Não foi possível cadastrar o subtipo: '+(erro.message||erro)); }
      finally{ salvar.disabled=false;salvar.textContent='Salvar subtipo'; }
    });

    // Antes do código principal salvar, incorpora o que estiver nos campos e
    // mantém os campos legados com a primeira natureza/subtipo para compatibilidade.
    formulario.addEventListener('submit',function(){
      adicionarSelecaoAtual({silencioso:true});
      sincronizarCamposLegados();
    },true);

    renderizar();

    // Aguarda os catálogos do formulário principal estarem disponíveis antes de
    // reconstruir as naturezas de um registro em edição.
    const tentarCarregar = () => {
      if(typeof catalogos !== 'undefined' && Array.isArray(catalogos.tipos) && catalogos.tipos.length){ carregarEdicao(); return true; }
      return false;
    };
    if(!tentarCarregar()){
      let tentativas=0;
      const timer=setInterval(()=>{tentativas++;if(tentarCarregar()||tentativas>40)clearInterval(timer);},150);
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();
