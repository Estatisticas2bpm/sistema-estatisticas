const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const cadastro=fs.readFileSync(path.join(root,'cadastro.html'),'utf8');

assert.match(cadastro,/const unidadesBopeSemGrupamento=new Set\(\['CANIL','FORCA_TATICA','CHOQUE','GATE'\]\)/);
assert.match(cadastro,/const ehUnidadeBopeCadastro=unidadesBopeSemGrupamento\.has\(siglaCadastro\)/);
assert.match(cadastro,/const ehBopeCadastro=siglaCadastro==='BOPE'/);
assert.match(cadastro,/ehUnidadeBopeCadastro\|\|ehBopeCadastro/);
assert.match(cadastro,/Unidade operacional do BOPE \*/);
assert.match(cadastro,/listar_subunidades_operacionais_bope/);
assert.match(cadastro,/subunidade_operacional_id/);

// As quatro estruturas internas permanecem na nomenclatura, mas o lançamento é feito no BOPE.
for(const sigla of ['CANIL','FORCA_TATICA','CHOQUE','GATE']){
  assert.ok(cadastro.includes(`'${sigla}'`), 'Unidade do BOPE ausente da regra: '+sigla);
}

// As opções continuam existindo para as unidades que de fato as utilizam.
assert.match(cadastro,/TÁTICO SETORIAL/);
assert.match(cadastro,/AME/);
assert.match(cadastro,/TOR — TÁTICO OSTENSIVO RODOVIÁRIO/);

console.log('BOPE: unidade lançadora com origem operacional obrigatória e sem Tático Setorial/AME.');
