const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'dashboard-cpc.html'), 'utf8');
const banner = path.join(root, 'assets', 'banners', 'cpc-home-banner.png');

assert.ok(fs.existsSync(banner), 'banner panorâmico do CPC ausente');
assert.ok(fs.statSync(banner).size > 100_000, 'banner do CPC parece vazio ou inválido');
assert.match(home, /id="cpc-banner-styles"/);
assert.match(home, /body\.modo-cpc \.hero/);
assert.match(home, /assets\/banners\/cpc-home-banner\.png\?v=20261012-cpc-banner1/);
assert.match(home, /body\.modo-cpc \.hero\{[^}]*background-size:100% 100%,contain/);
assert.match(home, /function aplicarModoCpc\(\)\{document\.body\.classList\.add\("modo-cpc"\)/);
assert.match(dashboard, /assets\/banners\/cpc-home-banner\.png\?v=20261012-cpc-banner1/);
assert.match(dashboard, /header\{min-height:clamp\(310px,28vw,410px\)[^}]*background-size:100% 100%,contain/);
for (const asset of ['2bpm-home-banner.png','1bpm-home-banner.png','bope-home-banner.png','cipa-home-banner.png','cipg-home-banner.png','cavalaria-home-banner.png','ciptur-home-banner.png','capa-giro-noturna.png']) {
  assert.ok(home.includes(asset), `${asset} deve permanecer preservado`);
}
assert.doesNotMatch(home, /body\.modo-(?:2bpm|1bpm|bope|cipa|cipg|cavalaria|ciptur|giro)[^{]*\{[^}]*cpc-home-banner/);

console.log('Banner exclusivo do CPC validado na página inicial e no dashboard executivo.');
