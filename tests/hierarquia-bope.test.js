const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const migration = read('supabase/migrations/20261003173000_fase3w_hierarquia_bope_nomenclatura.sql');
const guard = read('auth-guard.js');
const index = read('index.html');
const painel = read('dashboard-cpc.html');
const usuarios = read('usuarios.html');
const adminUsers = read('supabase/functions/admin-users/index.ts');

for (const trecho of [
  "when 'BOPE' then 'Batalhão de Operações Policiais Especiais'",
  "when 'CANIL' then '1ª Companhia de Cães do BOPE'",
  "when 'FORCA_TATICA' then '2ª Companhia de Força Tática do BOPE'",
  "when 'CHOQUE' then '3ª Companhia de Choque do BOPE'",
  "when 'GATE' then 'Grupo de Ações Táticas Especiais'",
  "when 'CAVALARIA' then '1º Esquadrão Independente de Polícia Montada'",
  "when 'CIPG' then 'Companhia Independente de Policiamento de Guarda'",
  "when 'GIRO' then 'Grupamento Independente de Intervenção Rápida Ostensiva'"
]) assert.ok(migration.includes(trecho), 'Nomenclatura ausente: '+trecho);

assert.match(migration, /aceita_registro_operacional = \(sigla not in \('CPC','BOPE'\)\)/);
assert.match(migration, /agrega_descendentes = \(sigla in \('CPC','BOPE'\)\)/);
assert.match(migration, /u\.aceita_registro_operacional = true/);
assert.match(migration, /not uc\.aceita_registro_operacional/);
assert.match(migration, /p_unidade_id=any\(d\.caminho\)/);

assert.match(guard, /ordenarUnidadesHierarquia/);
assert.match(guard, /rotuloUnidade/);
assert.match(guard, /CONS<|CONSOLIDADO/);
assert.match(guard, /FORCA_TATICA:'FORÇA TÁTICA'/);

assert.match(index, /idsDescendentesUnidade/);
assert.match(index, /unidadesCpcPrincipais/);
assert.match(index, /dadosPorUnidade\(cpcAtual,u\.id\)/);
assert.match(index, /consolidado/);

assert.match(painel, /consultarPainelCpc/);
assert.match(painel, /agruparMetricas/);
assert.match(painel, /renderTabelaUnidades/);
assert.match(painel, /agrega_descendentes/);
assert.match(painel, /data-child-of/);

assert.match(usuarios, /FORCA_TATICA:'FORÇA TÁTICA'/);
assert.match(adminUsers, /aceita_registro_operacional/);
assert.match(adminUsers, /CPC e BOPE são contextos consolidados somente leitura/);
assert.match(adminUsers, /u\.ativo === true && u\.aceita_registro_operacional === true/);

console.log('PASS: nomenclatura e hierarquia consolidada do BOPE/CPC validadas.');
