const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

const migration = read('supabase/migrations/20261003162948_fase3v_nucleo_generico_multiunidade_cpc.sql');
const cadastro = read('cadastro.html');
const authConfig = read('auth-config.js');
const authGuard = read('auth-guard.js');
const index = read('index.html');
const dashboard = read('dashboard.html');
const relatorio = read('relatorio.html');

const unidades = [
  'CPC', '1BPM', '2BPM', 'GIRO', 'CIPTUR', 'CIPA', 'CIPG',
  'CAVALARIA', 'BOPE', 'CANIL', 'FORCA_TATICA', 'CHOQUE', 'GATE'
];

for (const sigla of unidades) {
  assert(migration.includes(`'${sigla}'`), `Migration não contempla ${sigla}`);
}

assert(migration.includes('set ativo = true'), 'Unidades não são ativadas');
assert(migration.includes('alter table public.tcos'), 'TCO não foi tornado multiunidade');
assert(migration.includes('new.unidade_id := v_unidade'), 'Unidade do TCO não deriva da ocorrência');
assert(migration.includes('tcos_unidade_numero_ano_uq'), 'Unicidade de TCO não inclui unidade');
assert(migration.includes('incluir_descendentes = excluded.incluir_descendentes'), 'Escopo hierárquico não é sincronizado');
assert(migration.includes("gate.sigla = 'GATE' and bope.sigla = 'BOPE'"), 'Hierarquia GATE/BOPE não foi validada');
assert(!migration.includes("sigla = 'GAT' and"), 'Sigla institucional incorreta GAT foi usada');

assert(cadastro.includes("const ehCipturCadastro=siglaCadastro==='CIPTUR'"), 'Cadastro não reconhece CIPTUR');
assert(cadastro.includes('TOR — TÁTICO OSTENSIVO RODOVIÁRIO'), 'TOR da CIPTUR foi removido');
assert(cadastro.includes('TÁTICO SETORIAL'), 'Tático Setorial genérico/2BPM foi removido');
assert(cadastro.includes('AME'), 'AME genérico/2BPM foi removido');
assert(cadastro.includes('tipo_registro: document.getElementById("tipoRegistro").value || "BO"'), 'BO genérico não está preservado');

for (const pagina of ['cadastro.html', 'consulta.html', 'dashboard.html', 'mapa.html', 'relatorio.html']) {
  assert(!new RegExp(`['\"]${pagina.replace('.', '\\.') }['\"]\\s*:\\s*['\"][A-Z_]`).test(authConfig), `${pagina} foi indevidamente presa a módulo especializado`);
}

assert(authConfig.includes('"autos-infracao.html":"AUTOS_INFRACAO"'), 'Módulo CIPTUR não foi preservado');
assert(authConfig.includes('"cavalaria-produtividade.html":"PRODUTIVIDADE_CAVALARIA"'), 'Módulo Cavalaria não foi preservado');
assert(authConfig.includes('"dashboard-cpc.html":"PAINEL_CPC"'), 'Módulo CPC não foi preservado');
assert(authGuard.includes("client.rpc('obter_contexto_unidade_usuario')"), 'Contexto autoritativo não é carregado');
assert(authGuard.includes("client.rpc('obter_modulos_usuario')"), 'Módulos por unidade não são carregados');
assert(authGuard.includes("formatarSiglaUnidade"), 'Identidade institucional não é formatada');

for (const [nome, conteudo] of [['index', index], ['dashboard', dashboard], ['relatorio', relatorio]]) {
  assert(/CIPTUR/i.test(conteudo), `${nome} perdeu a especialização CIPTUR`);
  assert(/GIRO/i.test(conteudo), `${nome} perdeu a especialização GIRO`);
}
assert(/CAVALARIA/i.test(index), 'Visão Rápida da Cavalaria foi removida');
assert(/CAVALARIA/i.test(dashboard), 'Dashboard da Cavalaria foi removido');

for (const file of fs.readdirSync(root).filter(f => /\.(?:html|js)$/i.test(f))) {
  const content = read(file);
  assert(!/service_role/i.test(content), `Credencial/termo service_role encontrado no frontend: ${file}`);
}

console.log('PASS: núcleo genérico multiunidade e especializações preservadas.');
