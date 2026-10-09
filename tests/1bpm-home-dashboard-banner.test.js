const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
const dashboard=fs.readFileSync(path.join(root,'dashboard.html'),'utf8');
const banner=path.join(root,'assets','banners','1bpm-home-banner.png');

assert.ok(fs.existsSync(banner),'banner panorâmico do 1º BPM ausente');
assert.ok(fs.statSync(banner).size>100_000,'banner do 1º BPM parece vazio ou inválido');

assert.match(home,/function aplicarModo1Bpm\(\)/);
assert.match(home,/sigla==='1BPM'/);
assert.match(home,/classList\.add\("modo-1bpm"\)/);
assert.match(home,/body\.modo-1bpm \.hero/);
assert.match(home,/assets\/banners\/1bpm-home-banner\.png\?v=20261009-1bpm-banner1/);
assert.match(home,/body\.modo-1bpm \.hero\{[^}]*background-size:100% 100%,contain/);
assert.match(home,/Visão rápida — 1º BPM/);

assert.match(dashboard,/function ehPrimeiroBpm\(\)\{return siglaUnidadeAtiva\(\)==='1BPM'\}/);
assert.match(dashboard,/function configurarModuloPrimeiroBpm\(\)/);
assert.match(dashboard,/classList\.toggle\('modo-1bpm',ativo\)/);
assert.match(dashboard,/body\.modo-1bpm header/);
assert.match(dashboard,/assets\/banners\/1bpm-home-banner\.png\?v=20261009-1bpm-banner1/);
assert.match(dashboard,/body\.modo-1bpm header\{[^}]*background-size:100% 100%,contain/);
assert.match(dashboard,/Dashboard Operacional — 1º BPM/);

for(const asset of ['bope-home-banner.png','cipa-home-banner.png','capa-giro-noturna.png','2bpm-home-banner.png','ciptur-home-banner.png']){
  assert.match(home,new RegExp(asset.replace(/[.]/g,'\\.')),'identidade existente removida: '+asset);
}
assert.doesNotMatch(home,/body\.modo-(?:bope|cipa|giro|2bpm|ciptur)[^{]*\{[^}]*1bpm-home-banner/);
assert.doesNotMatch(dashboard,/body\.modo-(?:bope|cipa|giro)[^{]*\{[^}]*1bpm-home-banner/);

console.log('Banner exclusivo do 1º BPM validado na página inicial e no dashboard.');
