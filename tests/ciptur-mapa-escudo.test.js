const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

const contrato=read('estatistica-indicadores.js');
const componente=read('mapa-cpc-profissional.js');
const home=read('index.html');
const completo=read('mapa-criminal.html');
const svg=read('assets/logos/ciptur-brasao.svg');

assert.match(svg,/<svg\s[^>]*viewBox=/);
assert.match(svg,/data:image\/jpeg;base64,/);
assert.match(contrato,/'CIPTUR':'assets\/logos\/ciptur-brasao\.svg'/);
assert.match(componente,/function cabecalhoPopup\(v\)/);
assert.match(componente,/onerror="this\.remove\(\)"/);
assert.match(componente,/'CIPTUR':'CT'/);
assert.match(componente,/function iconePonto\(L,v,zoom\)/);
assert.doesNotMatch(componente.slice(componente.indexOf('function iconePonto('),componente.indexOf('function cabecalhoPopup(')),/<img/,
  'Ícones individuais precisam ser círculos simples, não escudos');
for(const [nome,codigo] of [['home CPC',home],['mapa analítico CPC',completo]]){
  assert.match(codigo,/mapa-cpc-profissional\.js\?v=20261012-v1/,nome+' deve carregar módulo de mapa compartilhado');
  assert.match(codigo,/MapaCpcProfissional\.criarMarcador/,nome+' usa círculos em lugar de brasões');
}
console.log('OK: brasão CIPTUR preservado no detalhamento; pontos do mapa permanecem discretos.');
