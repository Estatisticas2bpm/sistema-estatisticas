const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const raiz=path.resolve(__dirname,'..');
const ler=p=>fs.readFileSync(path.join(raiz,p),'utf8');
const pagina=ler('autos-infracao.html');
const dash=ler('dashboard.html');
const cfg=ler('auth-config.js');
const index=ler('index.html');
const mig=ler(path.join('supabase','migrations','20260929195925_fase3q_autos_infracao_ciptur.sql'));

assert.match(cfg,/"autos-infracao\.html":"cadastro"/);
assert.match(cfg,/"autos-infracao\.html":"AUTOS_INFRACAO"/);
assert.match(index,/href="autos-infracao\.html"[\s\S]*data-module="AUTOS_INFRACAO"/);
assert.match(pagina,/id="dataInfracao"/);
assert.match(pagina,/id="codigo"/);
assert.doesNotMatch(pagina,/id="bairro"/);
assert.doesNotMatch(pagina,/id="logradouro"/);
assert.doesNotMatch(pagina,/id="hora"/);
assert.match(pagina,/codigo_normalizado/);
assert.match(pagina,/c\.descricao/);
assert.match(pagina,/c\.base_legal/);
assert.match(pagina,/c\.valor/);
assert.match(dash,/from\('ciptur_autos_infracao'\)/);
assert.match(dash,/tabCipturInfracoes/);
assert.doesNotMatch(dash,/tabCipturBairros/);
assert.doesNotMatch(dash,/tabCipturTurnos/);
assert.match(mig,/create table if not exists public\.ciptur_catalogo_infracoes/);
assert.match(mig,/create table if not exists public\.ciptur_autos_infracao/);
assert.match(mig,/'65\.992'/);
assert.match(mig,/Conduzir o veículo registrado sem licenciamento/);
assert.match(mig,/'51\.691'/);
assert.match(mig,/Dirigir sob a influência de álcool/);
assert.match(mig,/AUTOS_INFRACAO/);

console.log('Módulo de A.I. da CIPTUR validado.');
