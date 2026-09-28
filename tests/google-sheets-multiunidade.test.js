const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = arquivo => fs.readFileSync(path.join(raiz, arquivo), 'utf8');

const migrations = fs.readdirSync(path.join(raiz, 'supabase', 'migrations'))
  .filter(nome => nome.endsWith('_fase3d_d_google_sheets_multiunidade.sql'));

assert.equal(migrations.length, 1, 'deve existir uma única migration da Fase 3D-D');

const sql = ler(path.join('supabase', 'migrations', migrations[0]));
const edge = ler(path.join('supabase', 'functions', 'google-sheets-sync', 'index.ts'));
const guard = ler('auth-guard.js');
const index = ler('index.html');

assert.match(sql, /create table public\.unidades_integracoes/i);
assert.match(sql, /GOOGLE_SHEETS_OCORRENCIAS/);
assert.match(sql, /alter table public\.google_sheets_sync_outbox\s+add column unidade_id uuid/i);
assert.match(sql, /create function public\.claim_google_sheets_sync_batch_v2/i);
assert.match(sql, /create function public\.obter_planilha_usuario\(\)/i);
assert.match(sql, /new\.unidade_id/);
assert.match(sql, /old\.unidade_id/);
assert.match(sql, /ocorrencias_unidade_fase2_2bpm_chk/);

assert.match(edge, /claim_google_sheets_sync_batch_v2/);
assert.match(edge, /routing_mode/);
assert.match(edge, /google_sheet_id/);
assert.match(edge, /activeIntegrations\.length === 1/);
assert.match(edge, /Roteamento obrigatorio/);

assert.match(guard, /obter_planilha_usuario/);
assert.match(guard, /data-planilha-unidade/);
assert.match(index, /data-planilha-unidade/);
assert.match(index, /data-permission="planilha"/);
assert.doesNotMatch(index, /href="https:\/\/docs\.google\.com\/spreadsheets\/d\/10BcWmWxzSrFghs_y_1L6QchidNWAwS6eAC9T53J_vs8\/edit"/);

console.log('Fase 3D-D: contratos de Google Sheets multiunidade validados.');
