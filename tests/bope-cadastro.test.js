const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const cadastro=fs.readFileSync(path.join(root,'cadastro.html'),'utf8');

assert.match(cadastro,/const unidadesBopeSemGrupamento=new Set\(\['CANIL','FORCA_TATICA','CHOQUE','GATE'\]\)/);
assert.match(cadastro,/const ehUnidadeBopeCadastro=unidadesBopeSemGrupamento\.has\(siglaCadastro\)/);
assert.match(cadastro,/const blocoGrupamento=ehGiroCadastro\s*\? ''\s*:\s*ehUnidadeBopeCadastro\s*\? ''\s*:\s*\(ehCipturCadastro/);

// As quatro unidades operacionais do BOPE usam o cadastro padrão, porém sem Tático Setorial e AME.
for(const sigla of ['CANIL','FORCA_TATICA','CHOQUE','GATE']){
  assert.ok(cadastro.includes(`'${sigla}'`), 'Unidade do BOPE ausente da regra: '+sigla);
}

// As opções continuam existindo para as unidades que de fato as utilizam.
assert.match(cadastro,/TÁTICO SETORIAL/);
assert.match(cadastro,/AME/);
assert.match(cadastro,/TOR — TÁTICO OSTENSIVO RODOVIÁRIO/);

console.log('BOPE: cadastro sem Tático Setorial/AME para CANIL, FORÇA TÁTICA, CHOQUE e GATE.');
