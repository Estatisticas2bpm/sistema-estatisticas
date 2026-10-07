const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const migration=read('supabase/migrations/20261007170559_bope_unidade_lancadora_origem_operacional.sql');
const cadastro=read('cadastro.html');
const dashboard=read('dashboard.html');
const relatorio=read('relatorio.html');

assert.match(migration,/when sigla='BOPE' then true/);
assert.match(migration,/sigla in \('CANIL','FORCA_TATICA','CHOQUE','GATE'\) then false/);
assert.match(migration,/subunidade_operacional_id uuid references public\.unidades/);
assert.match(migration,/set subunidade_operacional_id=o\.unidade_id, unidade_id=\(select id from bope\)/);
assert.match(migration,/validar_subunidade_operacional_ocorrencia/);
assert.match(migration,/listar_subunidades_operacionais_bope/);
assert.match(migration,/FORCA_TATICA.*CHOQUE.*CANIL.*GATE/s);

assert.match(cadastro,/siglaCadastro==='BOPE'/);
assert.match(cadastro,/Unidade operacional do BOPE \*/);
assert.match(cadastro,/subunidade_operacional_id/);
assert.match(cadastro,/listar_subunidades_operacionais_bope/);
assert.doesNotMatch(cadastro,/GAT['"]/);

assert.match(dashboard,/id="subunidadeBope"/);
assert.match(dashboard,/subunidade_operacional_sigla/);
assert.match(dashboard,/subunidade_bope=/);

assert.match(relatorio,/id="subunidadeBope"/);
assert.match(relatorio,/subunidade_operacional_sigla/);
assert.match(relatorio,/obter_dados_dashboard_territorial/);

console.log('PASS: BOPE lança os registros e Força Tática, Choque, Canil e GATE funcionam como origem operacional/filtro.');
