const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const dashboard=read('dashboard.html');
const home=read('index.html');

assert.match(dashboard,/function ehGiro\(\)\{return siglaUnidadeAtiva\(\)==='GIRO'\}/);
assert.match(dashboard,/id="navGiro"/);
assert.match(dashboard,/id="secGiroOperacional" hidden/);
assert.match(dashboard,/Resumo Operacional — GIRO/);
assert.match(dashboard,/id="giroOcorrencias"/);
assert.match(dashboard,/id="giroConducoes"/);
assert.match(dashboard,/id="giroPrisoes"/);
assert.match(dashboard,/id="giroVeiculos"/);
assert.match(dashboard,/id="giroArmas"/);
assert.match(dashboard,/id="giroDrogas"/);
assert.match(dashboard,/id="chartGiroMes"/);
assert.match(dashboard,/id="tabGiroOcorrencias"/);
assert.match(dashboard,/function renderGiro\(registros\)/);
assert.match(dashboard,/soma\(base,'numero_prisoes'\)/);
assert.match(dashboard,/totaisCategoriasArmas\(base\)/);
assert.match(dashboard,/base\.filter\(temEntorpecente\)\.length/);
assert.match(dashboard,/configurarModuloCiptur\(\);configurarModuloGiro\(\)/);

// No modo GIRO, classificações específicas de outras unidades não ficam no seletor.
assert.match(dashboard,/if\(\$\('documento'\)\)\{[\s\S]*?<option>BO<\/option><option>TCO<\/option><option>ROP<\/option>/);
assert.match(dashboard,/const lblCompanhia=\$\('companhia'\)\?\.closest\('label'\);if\(lblCompanhia\)lblCompanhia\.hidden=true/);

// A página inicial reconhece a unidade sem alterar os KPIs genéricos.
assert.match(home,/modoGiro=false/);
assert.match(home,/function aplicarModoGiro\(\)/);
assert.match(home,/siglaAtiva==="GIRO"/);
assert.match(home,/Visão rápida — GIRO/);
assert.match(home,/Mapa Operacional — GIRO/);

console.log('GIRO: painel operacional base validado.');
