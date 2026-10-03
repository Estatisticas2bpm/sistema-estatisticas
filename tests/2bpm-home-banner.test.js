const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const banner = path.join(root, 'assets', 'banners', '2bpm-home-banner.png');

assert.ok(fs.existsSync(banner), 'banner institucional do 2º BPM ausente');
assert.match(home, /modo2Bpm=!modoCpc&&siglaAtiva==="2BPM"/);
assert.match(home, /function aplicarModo2Bpm\(\)/);
assert.match(home, /classList\.add\("modo-2bpm"\)/);
assert.match(home, /body\.modo-2bpm \.hero/);
assert.match(home, /assets\/banners\/2bpm-home-banner\.png\?v=20261003-2bpm-home1/);
assert.match(home, /body\.modo-giro \.hero/);
assert.match(home, /assets\/capa-giro-noturna\.png/);
assert.match(home, /body\.modo-ciptur \.hero/);
assert.match(home, /assets\/banners\/ciptur-home-banner\.png/);
assert.doesNotMatch(home, /siglaAtiva==="(?:GIRO|CIPTUR|CPC|CAVALARIA)"[^;]*modo2Bpm=true/);

console.log('Banner exclusivo do 2º BPM validado.');
