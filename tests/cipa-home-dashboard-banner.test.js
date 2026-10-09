const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const cipaHome = fs.readFileSync(path.join(root, 'cipa-home.js'), 'utf8');
const banner = path.join(root, 'assets', 'banners', 'cipa-home-banner.png');

assert.ok(fs.existsSync(banner), 'banner panorâmico da CIPA ausente');
assert.ok(fs.statSync(banner).size > 100_000, 'banner da CIPA parece vazio ou inválido');

assert.match(home, /modoCipa=!modoCpc&&siglaAtiva==="CIPA"/);
assert.match(home, /if\(modoCipa\)CipaHome\.preparar\(\)/);
assert.match(cipaHome, /classList\.add\('modo-cipa'\)/);
assert.match(home, /body\.modo-cipa \.hero/);
assert.match(home, /assets\/banners\/cipa-home-banner\.png\?v=20261009-cipa-banner2/);

assert.match(dashboard, /function ehCipa\(\)\{return siglaUnidadeAtiva\(\)==='CIPA'\}/);
assert.match(dashboard, /function configurarModuloCipa\(\)/);
assert.match(dashboard, /classList\.toggle\('modo-cipa',ativo\)/);
assert.match(dashboard, /body\.modo-cipa header/);
assert.match(dashboard, /Dashboard Ambiental — CIPA/);
assert.match(dashboard, /assets\/banners\/cipa-home-banner\.png\?v=20261009-cipa-banner2/);

// Protege as identidades já existentes contra substituição acidental.
assert.match(home, /body\.modo-giro \.hero/);
assert.match(home, /assets\/capa-giro-noturna\.png/);
assert.match(home, /body\.modo-2bpm \.hero/);
assert.match(home, /assets\/banners\/2bpm-home-banner\.png/);
assert.match(home, /body\.modo-ciptur \.hero/);
assert.match(home, /assets\/banners\/ciptur-home-banner\.png/);
assert.doesNotMatch(home, /body\.modo-(?:giro|2bpm|ciptur)[^{]*\{[^}]*cipa-home-banner/);
assert.doesNotMatch(dashboard, /body\.modo-giro[^{]*\{[^}]*cipa-home-banner/);

console.log('Banner exclusivo da CIPA validado na home e no dashboard ambiental.');
