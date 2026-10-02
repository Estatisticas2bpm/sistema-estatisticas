const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const dash=fs.readFileSync(path.join(root,'dashboard.html'),'utf8');

assert.match(index,/modoCavalaria/);
assert.match(index,/Visão rápida — Cavalaria/);
assert.match(index,/cavalaria_servicos_produtividade/);
assert.match(index,/Modalidades de Policiamento/);
assert.match(index,/Locais com Mais Atividades/);
assert.match(index,/dashboard\.html\?v=20261002-cavalaria-dashboard1/);

assert.match(dash,/navCavalaria/);
assert.match(dash,/secCavalariaProdutividade/);
assert.match(dash,/Dashboard Completo — Cavalaria/);
assert.match(dash,/cavServicos/);
assert.match(dash,/cavPessoas/);
assert.match(dash,/cavMontado/);
assert.match(dash,/cavMotorizado/);
assert.match(dash,/cavOperacoes/);
assert.match(dash,/cavComunitario/);
assert.match(dash,/cavEventos/);
assert.match(dash,/cavRops/);
assert.match(dash,/cavMotos/);
assert.match(dash,/cavCarros/);
assert.match(dash,/cavRemovidos/);
assert.match(dash,/cavForagidos/);
assert.match(dash,/cavArmas/);
assert.match(dash,/chartCavModalidades/);
assert.match(dash,/chartCavContextos/);
assert.match(dash,/chartCavEvolucao/);
assert.match(dash,/tabCavLocais/);
assert.match(dash,/tabCavSolipedes/);
assert.match(dash,/tabCavViaturas/);
assert.match(dash,/servicosCavalariaAtual/);
assert.match(dash,/cavalaria_servicos_produtividade/);

console.log('Cavalaria: visão rápida e dashboard de produtividade integrados.');
