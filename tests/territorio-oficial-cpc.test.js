const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz=path.resolve(__dirname,'..');
const ler=p=>fs.readFileSync(path.join(raiz,p),'utf8');
const migrations=fs.readdirSync(path.join(raiz,'supabase','migrations'));
const migA=migrations.find(x=>x.endsWith('_fase3m_a_territorio_oficial_decreto_22414.sql'));
const migB=migrations.find(x=>x.endsWith('_fase3m_b_rpcs_territoriais.sql'));
const migC=migrations.find(x=>x.endsWith('_fase3m_c_painel_cpc_territorial.sql'));
assert.ok(migA&&migB&&migC,'as três migrations territoriais devem estar versionadas');

const a=ler(path.join('supabase','migrations',migA));
const b=ler(path.join('supabase','migrations',migB));
const c=ler(path.join('supabase','migrations',migC));
const index=ler('index.html'),painel=ler('dashboard-cpc.html'),dash=ler('dashboard.html'),mapa=ler('mapa-criminal.html'),cad=ler('cadastro-base.html'),cfg=ler('auth-config.js'),territorio=ler('territorio-cpc.html');

assert.match(a,/Decreto nº 22\.414-E\/2017/);
assert.match(a,/'AISC LESTE'/);assert.match(a,/'AISC OESTE'/);
for(let i=1;i<=6;i++)assert.match(a,new RegExp("'SISC "+i+"'"));
for(const setor of ['1.1','1.2','1.3','2.1','2.2','2.3','3.1','3.2','3.3','4.1','4.2','4.3','5.1','5.2','5.3','6.1','6.2','6.3'])assert.match(a,new RegExp("'"+setor.replace('.','\\.')+"'"));
assert.match(a,/SANTA CECÍLIA/);assert.match(a,/município do Cantá/i);
assert.match(a,/unidade_referencia_decreto/);
assert.match(a,/create or replace function public\.territorio_por_bairro/i);
assert.match(a,/create trigger trg_territorio_oficial_ocorrencia/i);
assert.doesNotMatch(a,/update\s+public\.ocorrencias/i);

assert.match(b,/obter_dados_dashboard_territorial/i);
assert.match(b,/obter_tcos_dashboard_territorial/i);
assert.match(b,/obter_home_cpc_territorial/i);
assert.match(b,/obter_mapa_cpc_territorial/i);
assert.match(c,/obter_painel_cpc_territorial/i);
assert.doesNotMatch(a+b+c,/security definer/i);

assert.match(cfg,/"territorio-cpc\.html":"dashboard"/);
assert.match(cfg,/"territorio-cpc\.html":"PAINEL_CPC"/);
assert.match(territorio,/Matriz Territorial Oficial do CPC/);
assert.match(territorio,/obter_catalogo_territorial_cpc/);
assert.match(territorio,/territorio_por_bairro/);
assert.match(index,/obter_home_cpc_territorial/);
assert.match(index,/obter_mapa_cpc_territorial/);
assert.match(index,/value="AISC"/);assert.match(index,/value="SETOR"/);
assert.match(painel,/id="aisc"/);assert.match(painel,/id="setor"/);assert.match(painel,/obter_painel_cpc_territorial/);
assert.match(dash,/id="aisc"/);assert.match(dash,/id="setor"/);assert.match(dash,/obter_dados_dashboard_territorial/);
assert.match(mapa,/Unidade que registrou/);assert.match(mapa,/Território:/);assert.match(mapa,/obter_dados_dashboard_territorial/);
assert.match(cad,/territorioBairroInfo/);assert.match(cad,/territorio_por_bairro/);

const todos=a+b+c+index+painel+dash+mapa+cad+territorio;
assert.doesNotMatch(todos,/fe74963f-c11a-4d6f-84be-7dcd8e15ff59/i);
assert.doesNotMatch(todos,/f09a10df-cd1d-48d1-a093-bf731906e175/i);

console.log('Fase 3M: matriz territorial oficial e integrações validadas.');
