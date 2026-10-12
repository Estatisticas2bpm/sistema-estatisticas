const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const relatorio = fs.readFileSync(path.join(root, 'relatorio.html'), 'utf8');
const logo = path.join(root, 'assets', 'logos', 'bope-brasao.png');

assert.ok(fs.existsSync(logo), 'brasão do BOPE ausente');
assert.ok(fs.statSync(logo).size > 5_000, 'arquivo do brasão do BOPE parece inválido');
assert.match(relatorio, /function ehBopeRel\(\)\{return String\(unidadeRel\(\)\.sigla\|\|''\)\.toUpperCase\(\)==='BOPE'\}/);
assert.match(relatorio, /const logoBopePdf='assets\/logos\/bope-brasao\.png';/);
assert.match(relatorio, /ehBopeRel\(\)\?'<img class="cover-brand-bope" src="'\+logoBopePdf\+'" alt="Brasão do BOPE">'/);
assert.match(relatorio, /\.cover-brand-bope\{width:88px!important;height:88px!important;object-fit:contain!important/);
assert.match(relatorio, /ehCavalariaRel\(\)\?'<img class="cover-brand-cavalaria"/, 'Cavalaria deve permanecer preservada');
assert.match(relatorio, /eh1BpmRel\(\)\?'<img class="cover-brand-1bpm"/, '1º BPM deve permanecer preservado');
assert.match(relatorio, /ehCipturRel\(\)\?'<img class="cover-brand-ciptur"/, 'CIPTUR deve permanecer preservada');
assert.match(relatorio, /<div class="cover-brand">SIE-CPC<\/div>/, 'fallback das demais unidades deve permanecer');

console.log('Brasão exclusivo do BOPE no relatório PDF validado.');
