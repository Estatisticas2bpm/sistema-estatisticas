const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const dashboard=read('dashboard.html');
const home=read('index.html');

assert.match(dashboard,/function ehGiro\(\)\{return siglaUnidadeAtiva\(\)==='GIRO'\}/);
assert.match(dashboard,/id="navGiro"/);
assert.match(dashboard,/id="secVisaoGeral"/);
assert.match(dashboard,/id="secGiroAbordagens" hidden/);
assert.doesNotMatch(dashboard,/id="secGiroOperacional"/);
assert.doesNotMatch(dashboard,/Resumo Operacional — GIRO/);

// O GIRO reaproveita o dashboard-base e acrescenta somente o módulo de abordagens.
assert.match(dashboard,/Total de ocorrências/);
assert.match(dashboard,/Ocorrências atendidas/);
assert.match(dashboard,/Demandas reprimidas/);
assert.match(dashboard,/Documentos produzidos/);
assert.match(dashboard,/Conduções/);
assert.match(dashboard,/Bairros com mais abordagens/);
assert.match(dashboard,/Ruas \/ logradouros/);
assert.match(dashboard,/Horários com mais abordagens/);
assert.match(dashboard,/Motocicletas abordadas/);
assert.match(dashboard,/Veículos abordados/);

// No modo GIRO, módulos específicos da CIPTUR ficam explicitamente ocultos.
assert.match(dashboard,/secCipturTransito'\)\)\$\('secCipturTransito'\)\.hidden=true/);
assert.match(dashboard,/secCipturTor'\)\)\$\('secCipturTor'\)\.hidden=true/);
assert.match(dashboard,/if\(\$\('documento'\)\)\{[\s\S]*?<option>BO<\/option><option>TCO<\/option><option>ROP<\/option>/);
assert.match(dashboard,/\(ehCiptur\(\)\|\|ehGiro\(\)\)\?\[\]/);
assert.match(dashboard,/const lblCompanhia=\$\('companhia'\)\?\.closest\('label'\);if\(lblCompanhia\)lblCompanhia\.hidden=true/);

// A página inicial reconhece a unidade e o mapa operacional próprio.
assert.match(home,/modoGiro=false/);
assert.match(home,/function aplicarModoGiro\(\)/);
assert.match(home,/siglaAtiva==="GIRO"/);
assert.match(home,/Visão rápida — GIRO/);
assert.match(home,/Mapa Operacional — GIRO/);
assert.match(home,/giro-moto-marker/);

console.log('GIRO: dashboard-base + abordagens específicas validados.');
