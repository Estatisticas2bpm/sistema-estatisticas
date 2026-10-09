const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
const dashboard=fs.readFileSync(path.join(root,'dashboard.html'),'utf8');
const banner=path.join(root,'assets','banners','bope-home-banner.png');

assert.ok(fs.existsSync(banner),'banner panorâmico do BOPE ausente');
assert.ok(fs.statSync(banner).size>100_000,'banner do BOPE parece vazio ou inválido');

assert.match(home,/modoBope=!modoCpc&&siglaAtiva==="BOPE"/);
assert.match(home,/function aplicarModoBope\(\)/);
assert.match(home,/classList\.add\("modo-bope"\)/);
assert.match(home,/body\.modo-bope \.hero/);
assert.match(home,/assets\/banners\/bope-home-banner\.png\?v=20261009-bope-banner1/);
assert.match(home,/body\.modo-bope \.hero\{[^}]*background-size:100% 100%,contain/);
assert.match(home,/Visão rápida — BOPE/);

assert.match(dashboard,/function ehBope\(\)\{return siglaUnidadeAtiva\(\)==='BOPE'\}/);
assert.match(dashboard,/function configurarModuloBope\(\)/);
assert.match(dashboard,/classList\.toggle\('modo-bope',ativo\)/);
assert.match(dashboard,/body\.modo-bope header/);
assert.match(dashboard,/assets\/banners\/bope-home-banner\.png\?v=20261009-bope-banner1/);
assert.match(dashboard,/body\.modo-bope header\{[^}]*background-size:100% 100%,contain/);
assert.match(dashboard,/Dashboard Operacional — BOPE/);

for(const asset of ['capa-giro-noturna.png','2bpm-home-banner.png','ciptur-home-banner.png','cipa-home-banner.png']){
  assert.match(home,new RegExp(asset.replace(/[.]/g,'\\.')),'identidade existente removida: '+asset);
}
assert.doesNotMatch(home,/body\.modo-(?:giro|2bpm|ciptur|cipa)[^{]*\{[^}]*bope-home-banner/);
assert.doesNotMatch(dashboard,/body\.modo-(?:giro|cipa)[^{]*\{[^}]*bope-home-banner/);

console.log('Banner exclusivo do BOPE validado na página inicial e no dashboard.');
