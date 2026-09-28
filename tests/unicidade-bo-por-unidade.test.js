const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = arquivo => fs.readFileSync(path.join(raiz, arquivo), 'utf8');

const migrations = fs.readdirSync(path.join(raiz, 'supabase', 'migrations'))
  .filter(nome => nome.endsWith('_fase3d_b_unicidade_bo_por_unidade.sql'));

assert.equal(migrations.length, 1, 'deve existir uma única migration da Fase 3D-B');

const sql = ler(path.join('supabase', 'migrations', migrations[0]));
const sqlExecutavel = sql.replace(/^\s*--.*$/gm, '');
const cadastro = ler('cadastro-base.html');

assert.match(sql, /^begin;/i);
assert.match(sql, /commit;\s*$/i);
assert.match(sql, /set local lock_timeout\s*=\s*'10s'/i);
assert.match(sql, /set local statement_timeout\s*=\s*'2min'/i);
assert.match(sql, /lock table public\.ocorrencias in share row exclusive mode/i);

assert.match(
  sql,
  /create unique index ocorrencia_numero_ano_unico\s+on public\.ocorrencias\s*\(\s*unidade_id\s*,\s*tipo_registro\s*,\s*numero_bo\s*,\s*\(extract\(year from data_ocorrencia\)\)\s*\)/i
);
assert.match(
  sql,
  /create unique index ocorrencias_chave_importacao_uq\s+on public\.ocorrencias\s*\(\s*unidade_id\s*,\s*data_ocorrencia\s*,\s*tipo_registro\s*,\s*numero_bo\s*\)/i
);

assert.match(sql, /ocorrencias_unidade_fase2_2bpm_chk/);
assert.match(sql, /f09a10df-cd1d-48d1-a093-bf731906e175/);
assert.match(sql, /esperado total de 2731 ocorrências/i);
assert.match(sql, /somente o 2º BPM deve estar ativo/i);

assert.doesNotMatch(sqlExecutavel, /drop\s+constraint/i);
assert.doesNotMatch(sqlExecutavel, /drop\s+default/i);
assert.doesNotMatch(sqlExecutavel, /alter\s+column\s+unidade_id/i);
assert.doesNotMatch(sqlExecutavel, /\bupdate\s+public\.ocorrencias\b/i);
assert.doesNotMatch(sqlExecutavel, /\bdelete\s+from\s+public\.ocorrencias\b/i);
assert.doesNotMatch(sqlExecutavel, /\binsert\s+into\s+public\.ocorrencias\b/i);
assert.doesNotMatch(sqlExecutavel, /\bupdate\s+public\.unidades\b/i);
assert.doesNotMatch(sqlExecutavel, /\balter\s+table\s+public\.ocorrencias\b/i);

assert.match(cadastro, /error\.code\s*===\s*["']23505["']/);
assert.match(cadastro, /já está cadastrada e não pode ser duplicada/);

console.log('Fase 3D-B: contratos de unicidade de BO por unidade validados.');
