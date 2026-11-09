(function () {
  'use strict';
  // A interface é apenas conveniência; a RPC verifica o perfil ADMIN no servidor.
  async function iniciar() {
    const sessao = window.SistemaAuth?.ready ? await window.SistemaAuth.ready : window.SistemaAuth;
    if (!sessao || String(sessao.perfil?.perfil || '').toUpperCase() !== 'ADMIN') return;

    const campoTipo = document.getElementById('ocorrencia');
    const campoSubtipo = document.getElementById('crime');
    if (!campoTipo || !campoSubtipo || typeof banco === 'undefined') return;

    const css = document.createElement('style');
    css.textContent = '.btn-gerenciar-catalogo{flex:0 0 auto;min-width:38px;width:38px;height:38px;padding:0;border:1px solid #cbd5e1;border-radius:8px;background:#eaf0f9;color:#1e3a5f;font-size:18px;font-weight:700;cursor:pointer}.btn-gerenciar-catalogo:hover{background:#dce8fb}.gestao-catalogo-aviso{font-size:12px;color:#64748b;margin:9px 0}.gestao-catalogo-status{font-size:13px;color:#b91c1c;min-height:18px}.gestao-catalogo-alerta{margin-top:10px;padding:10px;border-radius:7px;background:#fff7ed;color:#92400e;font-size:12px}.gestao-catalogo-excluir{background:#991b1b;color:white}.gestao-catalogo-excluir:hover{background:#7f1d1d}.gestao-catalogo-acoes{display:flex;gap:9px;justify-content:flex-end;flex-wrap:wrap;margin-top:18px}.gestao-catalogo-acoes button{width:auto}';
    document.head.appendChild(css);

    const modal = document.createElement('dialog');
    modal.id = 'modalGestaoCatalogoOcorrencia';
    modal.innerHTML = '<form class="modal-conteudo" id="formGestaoCatalogoOcorrencia" method="dialog">' +
      '<h3 id="gestaoCatalogoTitulo">Gerenciar catálogo</h3>' +
      '<p class="gestao-catalogo-aviso">Disponível apenas para administradores. Alterações no catálogo não modificam ocorrências já salvas.</p>' +
      '<div class="campo"><label for="gestaoCatalogoSelecionado">Item existente</label><select id="gestaoCatalogoSelecionado" required></select></div>' +
      '<div class="campo" style="margin-top:12px"><label for="gestaoCatalogoNome">Nome do item</label><input type="text" id="gestaoCatalogoNome" maxlength="160" required></div>' +
      '<div class="campo" style="margin-top:12px" id="gestaoCatalogoCampoFundamento"><label for="gestaoCatalogoFundamento">Fundamento legal (opcional)</label><input type="text" id="gestaoCatalogoFundamento" maxlength="200"></div>' +
      '<p class="gestao-catalogo-alerta">Excluir retira o item das listas futuras, sem apagar boletins ou dados históricos.</p>' +
      '<p class="gestao-catalogo-status" id="gestaoCatalogoStatus" role="alert" aria-live="polite"></p>' +
      '<div class="gestao-catalogo-acoes"><button type="button" class="botao-secundario" id="gestaoCatalogoCancelar">Cancelar</button><button type="button" class="gestao-catalogo-excluir" id="gestaoCatalogoExcluir">Excluir do catálogo</button><button type="submit" id="gestaoCatalogoSalvar">Salvar alteração</button></div>' +
      '</form>';
    document.body.appendChild(modal);

    const titulo = modal.querySelector('#gestaoCatalogoTitulo');
    const lista = modal.querySelector('#gestaoCatalogoSelecionado');
    const entradaNome = modal.querySelector('#gestaoCatalogoNome');
    const entradaFundamento = modal.querySelector('#gestaoCatalogoFundamento');
    const campoFundamento = modal.querySelector('#gestaoCatalogoCampoFundamento');
    const status = modal.querySelector('#gestaoCatalogoStatus');
    const salvar = modal.querySelector('#gestaoCatalogoSalvar');
    const excluir = modal.querySelector('#gestaoCatalogoExcluir');
    let entidade = 'TIPO';
    let itens = [];
    let ocupado = false;

    function normalizar(valor) {
      return String(valor || '').trim().replace(/\s+/g, ' ').toUpperCase();
    }
    function obterTipo() {
      return catalogos.tipos.find(item => normalizar(item.nome) === normalizar(campoTipo.value));
    }
    function itemAtual() {
      return itens.find(item => String(item.id) === lista.value) || null;
    }
    function exibirSelecionado() {
      const item = itemAtual();
      entradaNome.value = item?.nome || '';
      entradaFundamento.value = item?.fundamento_legal || '';
      status.textContent = '';
      salvar.disabled = !item;
      excluir.disabled = !item;
    }
    function abrirGestao(tipo) {
      if (ocupado) return;
      entidade = tipo;
      status.textContent = '';
      campoFundamento.hidden = tipo !== 'SUBTIPO';
      entradaNome.maxLength = tipo === 'TIPO' ? 120 : 160;
      const selecionado = tipo === 'TIPO' ? normalizar(campoTipo.value) : normalizar(campoSubtipo.value);
      if (tipo === 'TIPO') {
        titulo.textContent = 'Editar ou excluir tipo de ocorrência';
        itens = [...catalogos.tipos].sort((a,b) => a.nome.localeCompare(b.nome,'pt-BR'));
      } else {
        const pai = obterTipo();
        if (!pai) {
          alert('Selecione um Tipo de Ocorrência válido para gerenciar seus subtipos.');
          campoTipo.focus();
          return;
        }
        titulo.textContent = 'Editar ou excluir subtipo de ' + pai.nome;
        itens = catalogos.subtipos.filter(item => Number(item.tipo_id) === Number(pai.id))
          .sort((a,b) => a.nome.localeCompare(b.nome,'pt-BR'));
      }
      lista.replaceChildren(new Option('Selecione um item do catálogo', ''));
      itens.forEach(item => lista.add(new Option(item.nome, String(item.id))));
      const encontrado = itens.find(item => normalizar(item.nome) === selecionado);
      lista.value = encontrado ? String(encontrado.id) : '';
      exibirSelecionado();
      modal.showModal();
      if (!encontrado) lista.focus();
    }

    function adicionarBotao(campo, tipo) {
      const grupo = campo.parentElement;
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'btn-gerenciar-catalogo';
      botao.title = 'Editar ou excluir ' + (tipo === 'TIPO' ? 'tipos' : 'subtipos') + ' do catálogo (administrador)';
      botao.setAttribute('aria-label', botao.title);
      botao.textContent = '✎';
      grupo.appendChild(botao);
      botao.addEventListener('click', () => abrirGestao(tipo));
    }

    adicionarBotao(campoTipo, 'TIPO');
    adicionarBotao(campoSubtipo, 'SUBTIPO');
    lista.addEventListener('change', exibirSelecionado);
    modal.querySelector('#gestaoCatalogoCancelar').addEventListener('click', () => {
      if (!ocupado) modal.close();
    });

    async function executar(acao) {
      if (ocupado) return;
      const selecionado = itemAtual();
      if (!selecionado) {
        status.textContent = 'Selecione um item válido.';
        lista.focus();
        return;
      }
      const novoNome = normalizar(entradaNome.value);
      if (acao === 'EDITAR' && (novoNome.length < 3 || novoNome.length > entradaNome.maxLength)) {
        status.textContent = 'Informe um nome com pelo menos 3 caracteres, dentro do limite.';
        entradaNome.focus();
        return;
      }
      if (acao === 'DESATIVAR' && !confirm('Excluir "' + selecionado.nome + '" do catálogo?\n\nO item deixará de aparecer para novos cadastros. As ocorrências anteriores continuarão registradas.')) return;

      ocupado = true;
      salvar.disabled = true;
      excluir.disabled = true;
      lista.disabled = true;
      status.textContent = 'Salvando alteração...';
      try {
        const resposta = await banco.rpc('gerenciar_catalogo_ocorrencias_admin', {
          p_entidade: entidade,
          p_acao: acao,
          p_id: Number(selecionado.id),
          p_nome: acao === 'EDITAR' ? novoNome : null,
          p_fundamento_legal: entidade === 'SUBTIPO' && acao === 'EDITAR'
            ? String(entradaFundamento.value || '').trim().replace(/\s+/g, ' ') || null : null
        });
        if (resposta.error) throw resposta.error;

        const detalhe = {
          entidade, acao, id: Number(selecionado.id),
          tipoId: Number(selecionado.tipo_id || 0),
          nomeAnterior: selecionado.nome,
          nomeAtual: acao === 'EDITAR' ? resposta.data.nome : null,
          fundamentoLegal: resposta.data.fundamento_legal || null
        };
        if (entidade === 'TIPO' && normalizar(campoTipo.value) === normalizar(selecionado.nome)) {
          campoTipo.value = detalhe.nomeAtual || '';
          if (acao === 'DESATIVAR') campoSubtipo.value = '';
        }
        if (entidade === 'SUBTIPO' && normalizar(campoSubtipo.value) === normalizar(selecionado.nome)) {
          campoSubtipo.value = detalhe.nomeAtual || '';
          const fundamento = document.getElementById('fundamentoLegal');
          if (fundamento) fundamento.textContent = detalhe.fundamentoLegal || '';
        }

        await carregarCatalogos();
        campoTipo.dispatchEvent(new Event('change'));
        window.dispatchEvent(new CustomEvent('sie:catalogo-ocorrencia-alterado', { detail: detalhe }));
        modal.close();
        alert(acao === 'EDITAR' ? 'Item atualizado com sucesso.' : 'Item excluído do catálogo. Os registros históricos foram preservados.');
      } catch (erro) {
        status.textContent = 'Não foi possível concluir: ' + (erro.message || String(erro));
      } finally {
        ocupado = false;
        lista.disabled = false;
        salvar.disabled = !itemAtual();
        excluir.disabled = !itemAtual();
      }
    }

    modal.querySelector('#formGestaoCatalogoOcorrencia').addEventListener('submit', evento => {
      evento.preventDefault();
      executar('EDITAR');
    });
    excluir.addEventListener('click', () => executar('DESATIVAR'));
    modal.addEventListener('cancel', evento => { if (ocupado) evento.preventDefault(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();