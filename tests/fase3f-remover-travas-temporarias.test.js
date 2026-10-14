const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const migrations = fs.readdirSync(path.join(raiz, 'supabase', 'migrations'))
  .filter(nome => nome.endsWith('_fase3f_remover_travas_temporarias_2bpm.sql'));

assert.equal(migrations.length, 1, 'deve existir uma única migration da Fase 3F');

const sql = fs.readFileSync(path.join(raiz, 'supabase', 'migrations', migrations[0]), 'utf8');
const executavel = sql.replace(/^\s*--.*$/gm, '');

assert.match(sql, /^begin;/i);
assert.match(sql, /commit;\s*$/i);
assert.match(sql, /lock table public\.ocorrencias in share row exclusive mode/i);
assert.match(sql, /create temporary table fase3f_snapshot/i);

assert.match(
  sql,
  /drop constraint ocorrencias_unidade_fase2_2bpm_chk/i,
  'deve remover somente o CHECK temporário do 2º BPM'
);
assert.match(
  sql,
  /alter column unidade_id drop default/i,
  'deve remover o DEFAULT temporário de unidade_id'
);

assert.match(sql, /total_ocorrencias <> ocorrencias_2bpm/i);
assert.match(sql, /ocorrencias_1bpm <> 0/i);
assert.match(sql, /sem_unidade <> 0/i);
assert.match(sql, /sigla = '1BPM'[\s\S]*ativo = false/i);
assert.match(sql, /unidade_id = 'fe74963f-c11a-4d6f-84be-7dcd8e15ff59'::uuid[\s\S]*ativo = false/i);
assert.match(sql, /já existe usuário vinculado ao 1º BPM/i);

assert.doesNotMatch(executavel, /update\s+public\.ocorrencias/i);
assert.doesNotMatch(executavel, /insert\s+into\s+public\.ocorrencias/i);
assert.doesNotMatch(executavel, /delete\s+from\s+public\.ocorrencias/i);
assert.doesNotMatch(executavel, /update\s+public\.unidades\b/i);
assert.doesNotMatch(executavel, /update\s+public\.unidades_integracoes\b/i);
assert.doesNotMatch(executavel, /insert\s+into\s+public\.perfis_usuarios/i);
assert.doesNotMatch(executavel, /\bset\s+ativo\s*=\s*true/i);

assert.match(sql, /unidade_id deixou de ser NOT NULL/i);
assert.match(sql, /FK de unidade foi alterada/i);
assert.match(sql, /índices multiunidade foram alterados/i);
assert.match(sql, /ativação das unidades foi alterada/i);
assert.match(sql, /estado das integrações foi alterado/i);
assert.match(sql, /usuário do 1º BPM foi criado/i);

console.log('Fase 3F: retirada controlada de CHECK/DEFAULT validada.');
