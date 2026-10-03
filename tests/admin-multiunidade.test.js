const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = arquivo => fs.readFileSync(path.join(raiz, arquivo), 'utf8');

const guard = ler('auth-guard.js');
const migrations = fs.readdirSync(path.join(raiz, 'supabase', 'migrations'))
  .filter(nome => nome.endsWith('_fase3k_admin_multiunidade.sql'));

assert.equal(migrations.length, 1, 'deve existir uma única migration da Fase 3K');
const sql = ler(path.join('supabase', 'migrations', migrations[0]));

assert.match(guard, /obter_contexto_unidade_usuario/);
assert.match(guard, /listar_unidades_contexto_admin/);
assert.match(guard, /definir_contexto_unidade_admin/);
assert.match(guard, /titulo\.textContent='Unidade de trabalho:'/);
assert.match(guard, /aria-label','Unidade de trabalho do administrador/);
assert.match(guard, /somente_leitura_operacional/);
assert.match(guard, /permissoesEscritaOperacional=new Set\(\['cadastro','tco','acoes'\]\)/);
assert.match(guard, /perfil\.unidade_principal_id=perfil\.unidade_id/);
assert.match(guard, /perfil\.unidade_id=contexto\.unidade_id/);
assert.match(guard, /contexto:contextoAtual/);

assert.match(sql, /create table if not exists private\.admin_contextos_unidade/i);
assert.match(sql, /create or replace function private\.unidade_atual\(\)/i);
assert.match(sql, /when p\.perfil = 'ADMIN' then coalesce\(cu\.id, p\.unidade_id\)/i);
assert.match(sql, /create or replace function private\.unidades_acessiveis_atual\(\)/i);
assert.match(sql, /if v_perfil = 'ADMIN' then/i);
assert.match(sql, /and u\.tipo <> 'COMANDO'/i);
assert.match(sql, /create or replace function public\.obter_contexto_unidade_usuario\(\)/i);
assert.match(sql, /create or replace function public\.listar_unidades_contexto_admin\(\)/i);
assert.match(sql, /create or replace function public\.definir_contexto_unidade_admin\(p_unidade_id uuid\)/i);
assert.match(sql, /where u\.id = private\.unidade_atual\(\)/i);
assert.match(sql, /private\.unidade_atual\(\) as comando_id/i);
assert.doesNotMatch(sql, /update\s+public\.perfis_usuarios\s+set\s+unidade_id/i);

console.log('Fase 3K: contratos do modo administrador multiunidade validados.');
