(function(){
  'use strict';

  function iniciar(){
    const campoCrime = document.getElementById('crime');
    const campoOcorrencia = document.getElementById('ocorrencia');
    const formulario = document.getElementById('formOcorrencia') || document.querySelector('form');
    if(!campoCrime || !campoOcorrencia || campoCrime.dataset.multiplosCrimes === '1') return;
    campoCrime.dataset.multiplosCrimes = '1';

    const normalizar = (valor) => {
      try { return normalizarCatalogo(valor); }
      catch (_) { return String(valor || '').trim().replace(/\s+/g,' ').toUpperCase(); }
    };

    let crimesSelecionados = [];
    let edicaoCarregada = false;

    const estilo = document.createElement('style');
    estilo.textContent = `
      .campo-crimes-acoes{display:flex;gap:8px;align-items:stretch}
      .campo-crimes-acoes input{flex:1;min-width:0}
      .btn-adicionar-crime{width:auto;min-width:118px;padding:0 14px;font-size:13px;font-weight:800;white-space:nowrap;border-radius:8px}
      .crimes-selecionados{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
      .crime-chip{display:inline-flex;align-items:center;gap:8px;padding:7px 9px 7px 11px;border:1px solid #bfdbfe;border-radius:999px;background:#eff6ff;color:#1e3a8a;font-size:12px;font-weight:800}
      .crime-chip button{width:22px;height:22px;min-width:22px;padding:0;border-radius:50%;background:#dbeafe;color:#1e3a8a;font-size:15px;line-height:1}
      .crime-chip button:hover{background:#bfdbfe;color:#172554}
      .crimes-ajuda{margin-top:5px;color:#64748b;font-size:12px}
      @media(max-width:600px){.campo-crimes-acoes{flex-wrap:wrap}.campo-crimes-acoes input{flex-basis:100%}.btn-adicionar-crime{flex:1}.campo-crimes-acoes .botao-adicionar{width:44px!important}}
    `;
    document.head.appendChild(estilo);

    const pai = campoCrime.parentElement;
    const grupo = document.createElement('div');
    grupo.className = 'campo-crimes-acoes';
    pai.insertBefore(grupo, campoCrime);
    grupo.appendChild(campoCrime);

    const botaoAdicionar = document.createElement('button');
    botaoAdicionar.className = 'btn-adicionar-crime';
    botaoAdicionar.id = 'adicionarCrimeOcorrencia';
    botaoAdicionar.type = 'button';
    botaoAdicionar.textContent = 'Adicionar crime';
    botaoAdicionar.title = 'Vincular este crime ao mesmo BO';
    grupo.appendChild(botaoAdicionar);

    const botaoNovo = document.createElement('button');
    botaoNovo.className = 'botao-adicionar';
    botaoNovo.id = 'abrirNovoSubtipoOcorrencia';
    botaoNovo.type = 'button';
    botaoNovo.title = 'Cadastrar novo subtipo de ocorrência';
    botaoNovo.setAttribute('aria-label','Cadastrar novo subtipo de ocorrência');
    botaoNovo.textContent = '+';
    grupo.appendChild(botaoNovo);

    const listaChips = document.createElement('div');
    listaChips.className = 'crimes-selecionados';
    listaChips.id = 'crimesSelecionados';
    pai.insertBefore(listaChips, document.getElementById('fundamentoLegal'));

    const ajuda = document.createElement('div');
    ajuda.className = 'crimes-ajuda';
    ajuda.id = 'ajudaCrimes';
    ajuda.textContent = 'Um mesmo BO pode possuir mais de um crime. Selecione um e clique em “Adicionar crime”.';
    pai.appendChild(ajuda);

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

    function subtipoCatalogo(nome){
      const tipo = tipoSelecionado();
      if(!tipo || typeof catalogos === 'undefined' || !Array.isArray(catalogos.subtipos)) return null;
      const alvo = normalizar(nome);
      return catalogos.subtipos.find(s => Number(s.tipo_id) === Number(tipo.id) && normalizar(s.nome) === alvo) || null;
    }

    function renderizar(){
      listaChips.replaceChildren();
      crimesSelecionados.forEach((crime,indice) => {
        const chip = document.createElement('span');
        chip.className = 'crime-chip';
        const texto = document.createElement('span');
        texto.textContent = crime.nome;
        chip.appendChild(texto);
        const remover = document.createElement('button');
        remover.type = 'button';
        remover.setAttribute('aria-label','Remover '+crime.nome);
        remover.title = 'Remover este crime';
        remover.textContent = '×';
        remover.addEventListener('click', () => {
          crimesSelecionados.splice(indice,1);
          renderizar();
        });
        chip.appendChild(remover);
        listaChips.appendChild(chip);
      });
      ajuda.textContent = crimesSelecionados.length
        ? crimesSelecionados.length + (crimesSelecionados.length === 1 ? ' crime vinculado a este BO.' : ' crimes vinculados a este BO.') + ' Você pode adicionar outros.'
        : 'Um mesmo BO pode possuir mais de um crime. Selecione um e clique em “Adicionar crime”.';
      const fundamentos = crimesSelecionados.map(c=>c.fundamento_legal).filter(Boolean);
      const legal = document.getElementById('fundamentoLegal');
      if(legal) legal.textContent = fundamentos.join(' | ');
    }

    function adicionarCrime(nome, silencioso){
      const valor = normalizar(nome == null ? campoCrime.value : nome);
      if(!valor) return true;
      const tipo = tipoSelecionado();
      if(!tipo){
        if(!silencioso) alert('Selecione primeiro um Tipo de Ocorrência válido.');
        campoOcorrencia.focus();
        return false;
      }
      const subtipo = subtipoCatalogo(valor);
      if(!subtipo){
        if(!silencioso) alert('Selecione um Subtipo válido relacionado ao Tipo de Ocorrência. Se ele ainda não existir, use o botão + para cadastrá-lo.');
        campoCrime.focus();
        return false;
      }
      if(!crimesSelecionados.some(c=>normalizar(c.nome) === normalizar(subtipo.nome))){
        crimesSelecionados.push({
          nome: subtipo.nome,
          subtipo_id: Number(subtipo.id) || null,
          tipo_id: Number(tipo.id) || null,
          fundamento_legal: subtipo.fundamento_legal || null
        });
      }
      campoCrime.value = '';
      renderizar();
      return true;
    }

    function carregarCrimes(itens, legado){
      const lista = Array.isArray(itens) ? itens : [];
      crimesSelecionados = [];
      lista.forEach(item => {
        const nome = typeof item === 'string' ? item : item && item.nome;
        if(!nome) return;
        const cat = subtipoCatalogo(nome);
        const tipo = tipoSelecionado();
        crimesSelecionados.push({
          nome: cat ? cat.nome : normalizar(nome),
          subtipo_id: cat ? Number(cat.id) || null : (Number(item && item.subtipo_id) || null),
          tipo_id: cat ? Number(cat.tipo_id) || null : (Number(item && item.tipo_id) || (tipo ? Number(tipo.id) : null)),
          fundamento_legal: (cat && cat.fundamento_legal) || (item && item.fundamento_legal) || null
        });
      });
      if(!crimesSelecionados.length && legado){
        const cat = subtipoCatalogo(legado);
        const tipo = tipoSelecionado();
        crimesSelecionados.push({nome:cat ? cat.nome : normalizar(legado),subtipo_id:cat?Number(cat.id)||null:null,tipo_id:cat?Number(cat.tipo_id)||null:(tipo?Number(tipo.id):null),fundamento_legal:cat&&cat.fundamento_legal||null});
      }
      campoCrime.value = '';
      renderizar();
    }

    window.obterCrimesSelecionados = function(){
      return crimesSelecionados.map(c=>({...c}));
    };
    window.definirCrimesSelecionados = function(itens){
      carregarCrimes(itens, null);
    };

    botaoAdicionar.addEventListener('click', () => adicionarCrime(null,false));
    campoCrime.addEventListener('keydown', e => {
      if(e.key === 'Enter'){
        e.preventDefault();
        adicionarCrime(null,false);
      }
    });

    botaoNovo.addEventListener('click', function(){
      const tipo = tipoSelecionado();
      if(!tipo){
        alert('Selecione primeiro um Tipo de Ocorrência válido. Depois clique no + do Subtipo.');
        campoOcorrencia.focus();
        return;
      }
      document.getElementById('tipoPaiSubtipo').value = tipo.nome;
      document.getElementById('novoSubtipoOcorrencia').value = normalizar(campoCrime.value);
      document.getElementById('novoSubtipoFundamento').value = '';
      modal.showModal();
      setTimeout(() => document.getElementById('novoSubtipoOcorrencia').focus(), 0);
    });

    document.getElementById('cancelarNovoSubtipoOcorrencia').addEventListener('click', () => modal.close());

    document.getElementById('formNovoSubtipoOcorrencia').addEventListener('submit', async function(evento){
      evento.preventDefault();
      const tipo = tipoSelecionado();
      if(!tipo){
        alert('O Tipo de Ocorrência deixou de estar selecionado. Feche esta janela e selecione o tipo novamente.');
        return;
      }
      const nome = normalizar(document.getElementById('novoSubtipoOcorrencia').value);
      const fundamento = String(document.getElementById('novoSubtipoFundamento').value || '').trim().replace(/\s+/g,' ');
      if(nome.length < 3){ alert('Informe um subtipo com pelo menos 3 caracteres.'); return; }

      const salvar = document.getElementById('salvarNovoSubtipoOcorrencia');
      salvar.disabled = true;
      salvar.textContent = 'Salvando...';
      try {
        const resposta = await banco.rpc('cadastrar_subtipo_ocorrencia_publico', {
          p_tipo_id: Number(tipo.id),
          p_nome: nome,
          p_fundamento_legal: fundamento || null
        });
        if(resposta.error) throw resposta.error;
        const novo = resposta.data;
        const indiceExistente = catalogos.subtipos.findIndex(s => Number(s.id) === Number(novo.id));
        if(indiceExistente >= 0) catalogos.subtipos[indiceExistente] = novo;
        else catalogos.subtipos.push(novo);
        catalogos.subtipos.sort((a,b) => Number(a.tipo_id)-Number(b.tipo_id) || a.nome.localeCompare(b.nome,'pt-BR'));
        atualizarSubtipos();
        campoCrime.value = novo.nome;
        modal.close();
        adicionarCrime(novo.nome,false);
      } catch (erro) {
        console.error(erro);
        alert('Não foi possível cadastrar o subtipo: ' + (erro.message || erro));
      } finally {
        salvar.disabled = false;
        salvar.textContent = 'Salvar subtipo';
      }
    });

    let tipoAnterior = normalizar(campoOcorrencia.value);
    const revisarMudancaTipo = () => {
      setTimeout(() => {
        const atual = normalizar(campoOcorrencia.value);
        if(atual !== tipoAnterior && crimesSelecionados.length){
          crimesSelecionados = [];
          renderizar();
        }
        tipoAnterior = atual;
      },0);
    };
    campoOcorrencia.addEventListener('change', revisarMudancaTipo);

    if(formulario){
      formulario.addEventListener('submit', function(evento){
        if(evento.defaultPrevented) return;
        if(campoCrime.value.trim() && !adicionarCrime(null,false)){
          evento.preventDefault();
          evento.stopImmediatePropagation();
          return;
        }
        campoCrime.value = crimesSelecionados[0]?.nome || '';
      }, true);
    }

    const relogioEdicao = setInterval(() => {
      if(edicaoCarregada){ clearInterval(relogioEdicao); return; }
      try{
        if(typeof registroOriginalEdicao !== 'undefined' && registroOriginalEdicao){
          carregarCrimes(registroOriginalEdicao.crimes_itens, registroOriginalEdicao.crime);
          edicaoCarregada = true;
          clearInterval(relogioEdicao);
        }
      }catch(_){ }
    },250);
    setTimeout(()=>clearInterval(relogioEdicao),12000);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, {once:true});
  else iniciar();
})();
