const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const cadastro=read('cadastro.html');
const cipaCadastro=read('cipa-cadastro.js');
const dashboard=read('dashboard.html');
const relatorio=read('relatorio.html');
const relCipa=read('relatorio-cipa.js');

assert.match(cadastro,/const ehCipaCadastro=siglaCadastro==='CIPA'/);
assert.match(cadastro,/ehGiroCadastro\|\|ehCipaCadastro/);
assert.match(cadastro,/CipaCadastro\?\.salvar/);
assert.match(cadastro,/cipa-cadastro\.js/);

assert.match(cipaCadastro,/await window\.SistemaAuth\.ready/);
assert.match(cipaCadastro,/form#formOcorrencia > section/);
assert.match(cipaCadastro,/Dados ambientais — CIPA/);
assert.match(cipaCadastro,/Autos de Infração Ambiental/);
assert.match(cipaCadastro,/Termos de Embargo \/ Interdição/);
assert.match(cipaCadastro,/Fauna \/ TR/);
assert.match(cipaCadastro,/Educação Ambiental/);
assert.match(cipaCadastro,/cipa_autos_infracao/);
assert.match(cipaCadastro,/cipa_termos_embargo/);
assert.match(cipaCadastro,/cipa_autos_notificacao/);
assert.match(cipaCadastro,/cipa_fauna/);
assert.match(cipaCadastro,/Data\\\/Hora In/);
assert.match(cipaCadastro,/AUTO DE INFRA/);
assert.match(cipaCadastro,/TERMO DE EMBARGO/);

assert.match(dashboard,/Dashboard Ambiental — CIPA/);
assert.match(dashboard,/Fiscalização e Produtividade Ambiental/);
assert.match(dashboard,/cipa_autos_infracao/);
assert.match(dashboard,/cipa_area_tipo/);
assert.match(dashboard,/cipa_origem_atuacao/);

assert.match(relatorio,/ehCipaRel/);
assert.match(relatorio,/buildRelatorioCipa/);
assert.match(relCipa,/FISCALIZAÇÃO AMBIENTAL/);
assert.match(relCipa,/VALOR DAS MULTAS/);
assert.match(relCipa,/ÁREA EMBARGADA/);
assert.match(relCipa,/FAUNA, EDUCAÇÃO AMBIENTAL E TCO/);

console.log('PASS: módulo ambiental especializado da CIPA validado.');
