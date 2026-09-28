/**
 * Sincronizador central CPC/PMRR -> Google Sheets.
 *
 * Segurança:
 * - o segredo NÃO fica neste arquivo;
 * - configure SYNC_SECRET nas Propriedades do script;
 * - o backend decide a unidade e a planilha de destino;
 * - o ack só ocorre depois de a gravação terminar com sucesso.
 */

const CPC_SYNC = Object.freeze({
  endpoint: 'https://jppmhhukujigxupgskdk.supabase.co/functions/v1/google-sheets-sync',
  limite: 50,
  abaPadrao: 'Ocorrências',
  abaStatus: 'Sincronização',
  linhaCabecalhoTecnico: 2,
  primeiraLinhaDados: 3,
  propriedadeSegredo: 'SYNC_SECRET'
});

function sincronizarOcorrenciasCpc() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;

  try {
    const segredo = obterSegredoSincronizacao_();
    const resposta = chamarSync_({
      action: 'pull',
      routing_mode: 'multi',
      limit: CPC_SYNC.limite
    }, segredo);

    const eventos = Array.isArray(resposta.events) ? resposta.events : [];
    if (!eventos.length) return;

    const confirmados = [];
    const falhas = [];

    eventos.forEach(evento => {
      try {
        validarEvento_(evento);
        aplicarEventoNaPlanilha_(evento);
        confirmados.push(Number(evento.event_id));
      } catch (erro) {
        falhas.push({
          eventId: Number(evento.event_id),
          mensagem: limitarMensagem_(erro)
        });
      }
    });

    if (confirmados.length) {
      chamarSync_({ action: 'ack', event_ids: confirmados }, segredo);
    }

    falhas.forEach(falha => {
      chamarSync_({
        action: 'fail',
        event_ids: [falha.eventId],
        error: falha.mensagem
      }, segredo);
    });
  } finally {
    lock.releaseLock();
  }
}

function aplicarEventoNaPlanilha_(evento) {
  const planilha = SpreadsheetApp.openById(String(evento.google_sheet_id));
  const nomeAba = String(evento.aba_principal || CPC_SYNC.abaPadrao);
  const aba = planilha.getSheetByName(nomeAba);
  if (!aba) throw new Error('Aba de ocorrências não encontrada: ' + nomeAba);

  const payload = evento.payload || {};
  const campos = aba
    .getRange(CPC_SYNC.linhaCabecalhoTecnico, 1, 1, aba.getLastColumn())
    .getValues()[0]
    .map(v => String(v || '').trim());

  const indiceSyncId = campos.indexOf('sync_id');
  if (indiceSyncId < 0) throw new Error('Coluna técnica sync_id não encontrada.');

  const syncId = String(evento.occurrence_sync_id || payload.sync_id || '').trim();
  if (!syncId) throw new Error('Evento sem occurrence_sync_id.');

  const linhaExistente = localizarLinhaPorSyncId_(aba, indiceSyncId + 1, syncId);

  if (payload._deleted === true) {
    if (linhaExistente) aba.deleteRow(linhaExistente);
    atualizarStatus_(planilha, 1, 'Ocorrência removida da planilha.');
    return;
  }

  const valores = campos.map(campo => normalizarValorPlanilha_(payload[campo]));
  let linhaDestino = linhaExistente;

  if (!linhaDestino) {
    linhaDestino = Math.max(aba.getLastRow() + 1, CPC_SYNC.primeiraLinhaDados);
  }

  aba.getRange(linhaDestino, 1, 1, valores.length).setValues([valores]);
  atualizarStatus_(planilha, 1, 'Sincronização concluída sem duplicar ocorrências.');
}

function localizarLinhaPorSyncId_(aba, coluna, syncId) {
  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha < CPC_SYNC.primeiraLinhaDados) return null;

  const quantidade = ultimaLinha - CPC_SYNC.primeiraLinhaDados + 1;
  const faixa = aba.getRange(CPC_SYNC.primeiraLinhaDados, coluna, quantidade, 1);
  const achado = faixa.createTextFinder(syncId).matchEntireCell(true).findNext();

  return achado ? achado.getRow() : null;
}

function normalizarValorPlanilha_(valor) {
  if (valor === null || valor === undefined) return '';
  if (Array.isArray(valor) || (typeof valor === 'object' && valor !== null)) {
    return JSON.stringify(valor);
  }
  return valor;
}

function validarEvento_(evento) {
  if (!evento || !Number.isFinite(Number(evento.event_id))) {
    throw new Error('Evento sem event_id válido.');
  }
  if (!evento.unidade_id || !evento.unidade_sigla) {
    throw new Error('Evento sem identificação da unidade.');
  }
  if (!evento.google_sheet_id) {
    throw new Error('Evento sem planilha de destino.');
  }
  if (!evento.payload || typeof evento.payload !== 'object') {
    throw new Error('Evento sem payload válido.');
  }
}

function atualizarStatus_(planilha, processados, mensagem) {
  const aba = planilha.getSheetByName(CPC_SYNC.abaStatus);
  if (!aba) return;

  aba.getRange('A2:D2').setValues([[
    'ATUALIZADO',
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'),
    Number(processados) || 0,
    String(mensagem || '')
  ]]);
}

function obterSegredoSincronizacao_() {
  const segredo = PropertiesService
    .getScriptProperties()
    .getProperty(CPC_SYNC.propriedadeSegredo);

  if (!segredo) {
    throw new Error(
      'SYNC_SECRET não configurado nas Propriedades do script.'
    );
  }

  return segredo;
}

function chamarSync_(corpo, segredo) {
  const resposta = UrlFetchApp.fetch(CPC_SYNC.endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-sync-secret': segredo
    },
    payload: JSON.stringify(corpo),
    muteHttpExceptions: true
  });

  const status = resposta.getResponseCode();
  const texto = resposta.getContentText() || '{}';

  let json;
  try {
    json = JSON.parse(texto);
  } catch (_) {
    throw new Error('Resposta inválida do serviço de sincronização (HTTP ' + status + ').');
  }

  if (status < 200 || status >= 300) {
    throw new Error(
      'Falha no serviço de sincronização (HTTP ' + status + '): ' +
      String(json.error || texto)
    );
  }

  return json;
}

function limitarMensagem_(erro) {
  const texto = erro instanceof Error ? erro.message : String(erro);
  return texto.slice(0, 900);
}

function instalarGatilhoSincronizacaoCpc() {
  removerGatilhosSincronizacaoCpc();

  ScriptApp.newTrigger('sincronizarOcorrenciasCpc')
    .timeBased()
    .everyMinutes(5)
    .create();
}

function removerGatilhosSincronizacaoCpc() {
  ScriptApp.getProjectTriggers()
    .filter(gatilho => gatilho.getHandlerFunction() === 'sincronizarOcorrenciasCpc')
    .forEach(gatilho => ScriptApp.deleteTrigger(gatilho));
}
