const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = arquivo => fs.readFileSync(path.join(raiz, arquivo), 'utf8');

const migrations = fs.readdirSync(path.join(raiz, 'supabase', 'migrations'))
  .filter(nome => nome.endsWith('_fase3g_remover_travas_temporarias_2bpm.sql'));

assert.equal(migrations.length, 1, 'deve existir uma única migration da Fase 3G');

const sql = ler(path.join('supabase', 'migrations', migrations[0]));
const sqlExecutavel = sql.replace(/^\s*--.*$/gm, '');

assert.match(sql, /^begin;/i);
assert.match(sql, /commit;\s*$/i);
assert.match(sql, /lock table public\.ocorrencias in access exclusive mode/i);

assert.match(sql, /v_total_ocorrencias < 2753/i);
assert.match(sql, /v_ocorrencias_2bpm <> v_total_ocorrencias/i);
assert.match(sql, /v_ocorrencias_1bpm <> 0/i);
assert.match(sql, /v_sem_unidade <> 0/i);

assert.match(sql, /ocorrencias_unidade_fase2_2bpm_chk/);
assert.match(sql, /drop constraint ocorrencias_unidade_fase2_2bpm_chk/i);
assert.match(sql, /alter column unidade_id drop default/i);

assert.match(sql, /is_nullable/i);
assert.match(sql, /is distinct from 'NO'/i);
assert.match(sql, /ocorrencias_unidade_id_fkey/i);
assert.match(sql, /trg_definir_unidade_ocorrencia/i);

assert.match(sql, /sigla = '1BPM'[\s\S]*ativo = false/i);
assert.match(sql, /sigla = '2BPM'[\s\S]*ativo = true/i);
assert.match(sql, /GOOGLE_SHEETS_OCORRENCIAS/);
assert.match(sql, /integração do 1BPM foi ativada indevidamente/i);
assert.match(sql, /usuário do 1BPM foi criado indevidamente/i);

assert.doesNotMatch(sqlExecutavel, /\bupdate\s+public\.unidades\b/i);
assert.doesNotMatch(sqlExecutavel, /\bupdate\s+public\.unidades_integracoes\b/i);
assert.doesNotMatch(sqlExecutavel, /\binsert\s+into\s+public\.perfis_usuarios\b/i);
assert.doesNotMatch(sqlExecutavel, /\binsert\s+into\s+public\.ocorrencias\b/i);
assert.doesNotMatch(sqlExecutavel, /\bupdate\s+public\.ocorrencias\b/i);
assert.doesNotMatch(sqlExecutavel, /\bdelete\s+from\s+public\.ocorrencias\b/i);
assert.doesNotMatch(sqlExecutavel, /alter\s+column\s+unidade_id\s+drop\s+not\s+null/i);

console.log('Fase 3G: retirada controlada das travas temporárias do 2BPM validada.');
