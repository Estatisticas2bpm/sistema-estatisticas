(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BopeSubunidades = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ORDEM = ["FORCA_TATICA", "CHOQUE", "CANIL", "GATE"];
  const ROTULOS = Object.freeze({
    FORCA_TATICA: "FORÇA TÁTICA",
    CHOQUE: "CHOQUE",
    CANIL: "CANIL",
    GATE: "GATE"
  });
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function validarRegistros(registros) {
    if (!Array.isArray(registros)) {
      throw new Error("A resposta das unidades operacionais do BOPE é inválida.");
    }

    const porSigla = new Map();
    registros.forEach(function (registro) {
      const sigla = String(registro && registro.sigla || "").trim().toUpperCase();
      if (!ORDEM.includes(sigla)) return;
      if (porSigla.has(sigla)) {
        throw new Error("Há unidades operacionais duplicadas na configuração do BOPE.");
      }
      const id = String(registro && registro.id || "").trim();
      if (!UUID.test(id)) {
        throw new Error("Uma unidade operacional do BOPE não possui UUID válido.");
      }
      porSigla.set(sigla, {
        id: id,
        sigla: sigla,
        nome: ROTULOS[sigla],
        nomeCompleto: String(registro && registro.nome || ROTULOS[sigla]).trim()
      });
    });

    const ausentes = ORDEM.filter(function (sigla) { return !porSigla.has(sigla); });
    if (ausentes.length || porSigla.size !== ORDEM.length) {
      throw new Error("A configuração operacional do BOPE está incompleta.");
    }
    return ORDEM.map(function (sigla) { return porSigla.get(sigla); });
  }

  async function buscar(banco) {
    if (!banco || typeof banco.rpc !== "function") {
      throw new Error("A conexão com o banco não está disponível.");
    }
    const resposta = await banco.rpc("listar_subunidades_operacionais_bope");
    if (resposta && resposta.error) {
      const erro = new Error("Não foi possível consultar as unidades operacionais do BOPE.");
      erro.cause = resposta.error;
      throw erro;
    }
    return validarRegistros(resposta && resposta.data);
  }

  function criarOpcao(documento, valor, texto, desabilitada) {
    const opcao = documento.createElement("option");
    opcao.value = valor;
    opcao.textContent = texto;
    opcao.disabled = Boolean(desabilitada);
    return opcao;
  }

  function renderizar(select, registros, valorPreferido, documento) {
    const doc = documento || select.ownerDocument;
    const opcoes = [criarOpcao(doc, "", "Selecione a unidade responsável", false)];
    registros.forEach(function (registro) {
      const opcao = criarOpcao(doc, registro.id, registro.nome, false);
      opcao.dataset.sigla = registro.sigla;
      opcao.title = registro.nomeCompleto;
      opcoes.push(opcao);
    });
    select.replaceChildren.apply(select, opcoes);

    const preferido = String(valorPreferido || "");
    const encontrado = preferido && registros.some(function (registro) { return registro.id === preferido; });
    select.value = encontrado ? preferido : "";
    return Boolean(encontrado);
  }

  function informar(status, mensagem, falha) {
    if (!status) return;
    status.textContent = mensagem;
    status.style.color = falha ? "#b91c1c" : "#475569";
  }

  async function carregarNoFormulario(configuracao) {
    const banco = configuracao && configuracao.banco;
    const select = configuracao && configuracao.select;
    const status = configuracao && configuracao.status;
    const tentarNovamente = configuracao && configuracao.tentarNovamente;
    const documento = configuracao && configuracao.documento;
    const valorPreferido = configuracao && configuracao.valorPreferido;
    if (!select) return { registros: [], selecionado: false, erro: null };

    const valorAtual = String(valorPreferido || select.value || "");
    select.disabled = true;
    select.setAttribute("aria-busy", "true");
    if (tentarNovamente) tentarNovamente.hidden = true;
    informar(status, "Carregando unidades operacionais do BOPE...", false);

    try {
      const registros = await buscar(banco);
      const selecionado = renderizar(select, registros, valorAtual, documento);
      select.disabled = false;
      select.removeAttribute("aria-busy");
      informar(status, "Força Tática, Choque, Canil e GATE disponíveis.", false);
      return { registros: registros, selecionado: selecionado, erro: null };
    } catch (erro) {
      const doc = documento || select.ownerDocument;
      select.replaceChildren(criarOpcao(doc, "", "Não foi possível carregar as unidades", true));
      select.disabled = true;
      select.removeAttribute("aria-busy");
      informar(status, "Não foi possível carregar as unidades operacionais do BOPE. Tente novamente.", true);
      if (tentarNovamente) tentarNovamente.hidden = false;
      console.error("Falha ao carregar unidades operacionais do BOPE", erro && (erro.cause || erro));
      return { registros: [], selecionado: false, erro: erro };
    }
  }

  return Object.freeze({
    ORDEM: ORDEM.slice(),
    ROTULOS: ROTULOS,
    validarRegistros: validarRegistros,
    buscar: buscar,
    renderizar: renderizar,
    carregarNoFormulario: carregarNoFormulario
  });
});
