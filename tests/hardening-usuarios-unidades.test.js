const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = arquivo => fs.readFileSync(path.join(raiz, arquivo), 'utf8');

const migrations = fs.readdirSync(path.join(raiz, 'supabase', 'migrations'))
  .filter(nome => nome.endsWith('_fase3d_c_hardening_usuarios_unidades.sql'));

assert.equal(migrations.length, 1, 'deve existir uma única migration da Fase 3D-C');

const sql = ler(path.join('supabase', 'migrations', migrations[0]));
const sqlExecutavel = sql.replace(/^\s*--.*$/gm, '');
const edge = ler(path.join('supabase', 'functions', 'admin-users', 'index.ts'));
const usuarios = ler('usuarios.html');
const guard = ler('auth-guard.js');
const login = ler('login.html');

assert.match(sql, /create function private\.validar_unidade_ativa_perfil\(\)/i);
assert.match(sql, /create trigger trg_validar_unidade_ativa_perfil/i);
assert.match(sql, /create function private\.impedir_desativacao_unidade_com_perfis_ativos\(\)/i);
assert.match(sql, /create trigger trg_impedir_desativacao_unidade_com_perfis_ativos/i);
assert.match(sql, /trg_sincronizar_escopo_principal_usuario/i);
assert.match(sql, /security definer/i);
assert.match(sql, /set search_path\s*=\s*''/i);
assert.match(sql, /ocorrencias_unidade_fase2_2bpm_chk/i);
assert.doesNotMatch(sqlExecutavel, /\bupdate\s+public\.ocorrencias\b/i);
assert.doesNotMatch(sqlExecutavel, /\bdelete\s+from\s+public\.ocorrencias\b/i);
assert.doesNotMatch(sqlExecutavel, /\binsert\s+into\s+public\.ocorrencias\b/i);
assert.doesNotMatch(sqlExecutavel, /alter\s+table\s+public\.ocorrencias/i);

assert.match(edge, /async function validarUnidadeAtiva/);
assert.match(edge, /A unidade selecionada não está ativa/);
assert.match(edge, /await validarUnidadeAtiva\(unidadeId\)/);
assert.match(edge, /await validarUnidadeAtiva\(alvo\.unidade_id\)/);
assert.match(edge, /perfilCaller\.unidades\?\.ativo !== true/);
assert.match(edge, /\.filter\(\(u: any\) => u\.ativo === true && u\.aceita_registro_operacional === true\)/);

assert.doesNotMatch(usuarios, /prompt\(['"]ID da unidade/i);
assert.match(usuarios, /id="modalEditar"/);
assert.match(usuarios, /id="editUnidade"/);
assert.match(usuarios, /opcoesUnidadesEdicao/);

assert.match(guard, /unidade-indisponivel/);
assert.match(guard, /perfil\.unidades\.ativo!==true/);
assert.match(login, /unidade-indisponivel/);

console.log('Fase 3D-C: contratos de hardening de usuários e unidades validados.');
