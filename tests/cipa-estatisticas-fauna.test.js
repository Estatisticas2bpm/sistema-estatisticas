const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const cipa=fs.readFileSync(path.join(root,'cipa-cadastro.js'),'utf8');
const extrator=require('../cipa-extrator.js');
const migracao=fs.readdirSync(path.join(root,'supabase','migrations')).find(f=>f.endsWith('_cipa_fauna_procedimento_destinacao_estatistica.sql'));
assert.ok(migracao);
const sql=fs.readFileSync(path.join(root,'supabase','migrations',migracao),'utf8');
assert.match(sql,/add column if not exists procedimento text/);
assert.match(sql,/add column if not exists destinacao text/);
assert.match(sql,/add column if not exists tipo_infracao text/);
assert.doesNotThrow(()=>new Function(cipa));

// O cadastro é estatístico, os campos administrativos anteriores continuam no banco.
const autoInicio=cipa.indexOf("autos:{box:'cipaAutos'");
const autoFim=cipa.indexOf("embargos:{box:",autoInicio);
const camposAutos=cipa.slice(autoInicio,autoFim);
assert.match(camposAutos,/tipo_infracao/);
assert.match(camposAutos,/tipo_sancao/);
assert.match(camposAutos,/valor_multa/);
assert.match(camposAutos,/area_embargada_ha/);
assert.doesNotMatch(camposAutos,/autuado|fiscal_ambiental|art_lei_9605|art_dec_6514|outra_legislacao/);
const faunaInicio=cipa.indexOf("fauna:{box:'cipaFauna'");
const faunaFim=cipa.indexOf("educacao:{box:",faunaInicio);
const camposFauna=cipa.slice(faunaInicio,faunaFim);
for(const t of ['nome_comum','nome_cientifico','quantidade','procedimento','destinacao','numero_tr']) assert.ok(camposFauna.includes(t));
assert.doesNotMatch(camposFauna,/data_registro|procedencia/);
assert.match(cipa,/if\(!animal\.data_registro\)animal\.data_registro=\$\('data'\)\.value\|\|null/);
assert.match(cipa,/function classificarInfracao/);
assert.match(cipa,/cipaFaunaImportacaoAviso/);
assert.match(cipa,/documentos\?\.fauna\?\.length&&!estado\.fauna\.length/);

const relatoGalo='RELATO/HISTÓRICO\nForam apreendidos 71 galos vivos. Os animais permaneceram no próprio imóvel, sob responsabilidade de depositário fiel.';
const r=extrator.extrairFauna(relatoGalo);
assert.equal(r.fauna.length,1);
assert.equal(r.fauna[0].nome_comum,'Galo');
assert.equal(r.fauna[0].quantidade,71);
assert.equal(r.fauna[0].procedimento,'APREENSÃO');
assert.equal(r.fauna[0].destinacao,'MANTIDOS NO LOCAL SOB DEPÓSITO');

const curicaca=extrator.extrairFauna('RELATO/HISTÓRICO\nHouve resgate de uma curicaca, a qual a guarnição encaminhou ao CETAS.');
assert.equal(curicaca.fauna[0].nome_comum,'Curicaca');
assert.equal(curicaca.fauna[0].quantidade,1);
assert.equal(curicaca.fauna[0].procedimento,'RESGATE');
assert.equal(curicaca.fauna[0].destinacao,'CETAS');

const conflito=extrator.extrairFauna('RELATO/HISTÓRICO\nConstatados 71 galos vivos, inclusive 2 galos feridos.');
assert.equal(conflito.fauna.length,0,'não deve escolher arbitrariamente entre quantidades conflitantes');
assert.equal(conflito.avisos.length,1);
const semFauna=extrator.extrairFauna('RELATO/HISTÓRICO\nForam realizados levantamentos e buscas nas fazendas.');
assert.equal(semFauna.fauna.length,0);
console.log('PASS: tela estatística enxuta, fauna 71 galos, resgate de curicaca, destinação e conflitos.');
