const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const migration = read('supabase/migrations/20261005235825_otimizar_dashboard_cpc_timeout.sql');
const dashboard = read('dashboard.html');

assert.match(migration, /alter policy auth_ocorrencias_select on public\.ocorrencias/);
assert.match(migration, /unidade_id = any\(\s*coalesce\(\(select private\.unidades_acessiveis_atual\(\)\), array\[\]::uuid\[\]\)\s*\)/s);
assert.ok((migration.match(/base as materialized/gi) || []).length >= 2);
assert.ok((migration.match(/mapa as materialized/gi) || []).length >= 2);
assert.doesNotMatch(migration, /left join lateral \(select public\.territorio_por_bairro/);
assert.match(migration, /m\.alias_chave=public\.normalizar_bairro_sisc/);
assert.match(migration, /obter_dados_dashboard_territorial/);
assert.match(migration, /obter_tcos_dashboard_territorial/);
assert.match(dashboard, /obter_dados_dashboard_territorial/);
assert.match(dashboard, /obter_tcos_dashboard_territorial/);

console.log('PASS: dashboard territorial usa escopo e mapa materializados para evitar timeout no CPC.');
