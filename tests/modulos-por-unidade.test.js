const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = arquivo => fs.readFileSync(path.join(raiz, arquivo), 'utf8');

const config = ler('auth-config.js');
const guard = ler('auth-guard.js');
const index = ler('index.html');
const migrations = fs.readdirSync(path.join(raiz, 'supabase', 'migrations'))
  .filter(nome => nome.endsWith('_fase3d_a_modulos_por_unidade.sql'));

assert.equal(migrations.length, 1, 'deve existir uma única migration da Fase 3D-A');
const sql = ler(path.join('supabase', 'migrations', migrations[0]));
const sqlExecutavel = sql.replace(/^\s*--.*$/gm, '');

assert.match(config, /pageModules:\s*Object\.freeze/);
assert.match(config, /"acoes\.html"\s*:\s*"ACOES_SOCIAIS"/);

assert.match(index, /href="acoes\.html"[^>]*data-permission="acoes"[^>]*data-module="ACOES_SOCIAIS"[^>]*hidden/);
assert.match(index, />Ações preventivas<\/a>/);

assert.match(guard, /client\.rpc\(['"]obter_modulos_usuario['"]\)/);
assert.match(guard, /modulo-indisponivel/);
assert.match(guard, /function moduloDaPagina/);
assert.match(guard, /function temModulo/);
assert.match(guard, /acesso especializado bloqueado/);
assert.match(guard, /if\(r\.error\)[\s\S]*return new Set\(\)/);
assert.doesNotMatch(guard, /CAVALARIA/);
assert.doesNotMatch(guard, /usuarios_unidades_escopo/);

assert.match(sql, /create table public\.modulos_sistema/i);
assert.match(sql, /create table public\.unidades_modulos/i);
assert.match(sql, /create function public\.obter_modulos_usuario\(\)/i);
assert.match(sql, /security definer/i);
assert.match(sql, /p\.user_id\s*=\s*\(select auth\.uid\(\)\)/i);
assert.match(sql, /'ACOES_SOCIAIS'/);
assert.match(sql, /u\.sigla\s*=\s*'CAVALARIA'/i);
assert.match(sql, /revoke all on function public\.obter_modulos_usuario\(\)[\s\S]*from public, anon, authenticated/i);
assert.match(sql, /grant execute on function public\.obter_modulos_usuario\(\)[\s\S]*to authenticated, service_role/i);
assert.doesNotMatch(sqlExecutavel, /alter table public\.ocorrencias/i);
assert.doesNotMatch(sqlExecutavel, /alter table public\.acoes_preventivas/i);
assert.doesNotMatch(sqlExecutavel, /usuarios_unidades_escopo/);

console.log('Fase 3D-A: contratos de módulos por unidade validados.');
