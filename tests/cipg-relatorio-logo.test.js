const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const relatorio = fs.readFileSync(path.join(root, 'relatorio.html'), 'utf8');
const logo = path.join(root, 'assets', 'logos', 'cipg-brasao.png');

assert.ok(fs.existsSync(logo), 'brasão recortado da CIPG ausente');
assert.ok(fs.statSync(logo).size > 100_000, 'arquivo do brasão da CIPG parece inválido');
assert.match(relatorio, /function ehCipgRel\(\)\{return String\(unidadeRel\(\)\.sigla\|\|''\)\.toUpperCase\(\)==='CIPG'\}/);
assert.match(relatorio, /const logoCipgPdf='assets\/logos\/cipg-brasao\.png';/);
assert.match(relatorio, /ehCipgRel\(\)\?'<img class="cover-brand-cipg" src="'\+logoCipgPdf\+'" alt="Brasão da CIPG">'/);
assert.match(relatorio, /\.cover-brand-cipg\{width:88px!important;height:88px!important;object-fit:contain!important/);
assert.match(relatorio, /ehBopeRel\(\)\?'<img class="cover-brand-bope"/, 'BOPE deve permanecer preservado');
assert.match(relatorio, /ehCavalariaRel\(\)\?'<img class="cover-brand-cavalaria"/, 'Cavalaria deve permanecer preservada');
assert.match(relatorio, /eh1BpmRel\(\)\?'<img class="cover-brand-1bpm"/, '1º BPM deve permanecer preservado');
assert.match(relatorio, /<div class="cover-brand">SIE-CPC<\/div>/, 'fallback das demais unidades deve permanecer');

console.log('Brasão recortado e exclusivo da CIPG no relatório PDF validado.');
