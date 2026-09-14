(function(){
  'use strict';

  function iniciar(){
    const campoCrime = document.getElementById('crime');
    const campoOcorrencia = document.getElementById('ocorrencia');
    if(!campoCrime || !campoOcorrencia || document.getElementById('abrirNovoSubtipoOcorrencia')) return;

    // Mantém o mesmo padrão visual do botão + usado no Tipo de Ocorrência.
    const pai = campoCrime.parentElement;
    const grupo = document.createElement('div');
    grupo.className = 'campo-com-acao';
    pai.insertBefore(grupo, campoCrime);
    grupo.appendChild(campoCrime);

    const botao = document.createElement('button');
    botao.className = 'botao-adicionar';
    botao.id = 'abrirNovoSubtipoOcorrencia';
    botao.type = 'button';
    botao.title = 'Cadastrar novo subtipo de ocorrência';
    botao.setAttribute('aria-label','Cadastrar novo subtipo de ocorrência');
    botao.textContent = '+';
    grupo.appendChild(botao);

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

    const normalizar = (valor) => {
      try { return normalizarCatalogo(valor); }
      catch (_) { return String(valor || '').trim().replace(/\s+/g,' ').toUpperCase(); }
    };

    function tipoSelecionado(){
      if(typeof catalogos === 'undefined' || !Array.isArray(catalogos.tipos)) return null;
      const valor = normalizar(campoOcorrencia.value);
      return catalogos.tipos.find(t => normalizar(t.nome) === valor) || null;
    }

    botao.addEventListener('click', function(){
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
      if(nome.length < 3){
        alert('Informe um subtipo com pelo menos 3 caracteres.');
        return;
      }

      const existente = Array.isArray(catalogos.subtipos)
        ? catalogos.subtipos.find(s => Number(s.tipo_id) === Number(tipo.id) && normalizar(s.nome) === nome)
        : null;
      if(existente && !fundamento){
        campoCrime.value = existente.nome;
        document.getElementById('fundamentoLegal').textContent = existente.fundamento_legal || '';
        modal.close();
        return;
      }

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
        document.getElementById('fundamentoLegal').textContent = novo.fundamento_legal || '';
        modal.close();
      } catch (erro) {
        console.error(erro);
        alert('Não foi possível cadastrar o subtipo: ' + (erro.message || erro));
      } finally {
        salvar.disabled = false;
        salvar.textContent = 'Salvar subtipo';
      }
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, {once:true});
  else iniciar();
})();
