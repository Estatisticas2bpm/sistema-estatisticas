const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const painel = fs.readFileSync(path.join(raiz, 'dashboard-cpc.html'), 'utf8');
const mapa = fs.readFileSync(path.join(raiz, 'mapa-criminal.html'), 'utf8');
const temporal = fs.readFileSync(path.join(raiz, 'analise-temporal.html'), 'utf8');
const home = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');

for (const aba of ['visao-geral', 'produtividade', 'perfis', 'territorial', 'comparativos']) {
  assert.match(painel, new RegExp(`data-cpc-tab="${aba}"`), `aba ${aba} deve existir`);
}
assert.match(painel, /role="tablist"/);
assert.match(painel, /aria-selected="true"/);
assert.match(painel, /ArrowLeft.*ArrowRight.*Home.*End/);

assert.match(painel, /Unidade policial<select id="unidade"/);
assert.match(painel, /Todas as unidades — CPC/);
assert.match(painel, /db\.from\('unidades'\).*\.eq\('ativo',true\)/);
assert.doesNotMatch(painel, /const\s+UNIDADE_[A-Z_]+\s*=\s*['"][0-9a-f-]{36}/i);
assert.match(painel, /id="anoFiltro"/);
assert.match(painel, /id="mesFiltro"/);
assert.match(painel, /function aplicarAnoMes\(/);
assert.match(painel, /function sincronizarAnoMes\(/);

assert.match(painel, /data-cpc-analise-area="produtividade"/);
assert.match(painel, /data-cpc-analise-area="perfis"/);
assert.match(painel, /data-cpc-analise-area="territorial"/);
assert.match(painel, /data-cpc-analise-area="comparativos"/);
assert.match(painel, /CpcDocumentoLeitura\.configurar/);
assert.match(painel, /CpcAnaliseIntegrada\.iniciar/);
assert.match(painel, /CpcIndicadoresDashboard\.carregar/);

assert.match(painel, /parametrosGlobaisCpc/);
assert.match(painel, /linkMapaCpc/);
assert.match(mapa, /aplicarParametrosEntrada/);
assert.match(mapa, /new URLSearchParams\(location\.search\)/);
assert.match(mapa, /db\.from\('unidades'\).*\.eq\('ativo',true\)/);
assert.match(temporal, /unidadeEntrada=qEntrada\.get\('unidade'\)/);
assert.match(temporal, /String\(x\.unidade_id\)===unidadeEntrada/);

assert.match(home, /if\(antigo\)antigo\.style\.display="none"/);
assert.match(home, /href="dashboard\.html[^>]*>[^<]*<span>▥<\/span>Dashboard completo/);

for (const proibido of [/\.insert\s*\(/, /\.update\s*\(/, /\.delete\s*\(/, /\.upsert\s*\(/]) {
  assert.doesNotMatch(painel, proibido, 'painel CPC deve permanecer somente leitura');
}

console.log('PASS: painel CPC em cinco abas, filtros globais e propagação segura de contexto validados.');
