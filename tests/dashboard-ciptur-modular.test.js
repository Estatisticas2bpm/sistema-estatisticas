const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const raiz=path.resolve(__dirname,'..');
const dash=fs.readFileSync(path.join(raiz,'dashboard.html'),'utf8');

assert.match(dash,/id="secCipturTransito" hidden/);
assert.match(dash,/id="navCiptur"/);
assert.match(dash,/siglaUnidadeAtiva\(\)==='CIPTUR'/);
assert.match(dash,/quantidade_autos_infracao/);
assert.match(dash,/chartCipturAutosMes/);
assert.match(dash,/tabCipturBairros/);
assert.match(dash,/tabCipturTurnos/);
assert.match(dash,/ehCiptur\(\)\?\[\]:\[\['Autos de infração'/);
assert.match(dash,/aiscDaUnidade/);

console.log('Dashboard CIPTUR modular validado.');
