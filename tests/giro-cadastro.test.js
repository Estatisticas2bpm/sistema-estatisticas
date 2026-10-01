const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const cadastro=fs.readFileSync(path.join(root,'cadastro.html'),'utf8');

assert.match(cadastro,/const ehGiroCadastro=siglaCadastro==='GIRO'/);
assert.match(cadastro,/const blocoGrupamento=ehGiroCadastro\s*\? ''/);
assert.match(cadastro,/ehCipturCadastro[\s\S]*TOR — TÁTICO OSTENSIVO RODOVIÁRIO/);
assert.match(cadastro,/TÁTICO SETORIAL/);
assert.match(cadastro,/AME/);

// O GIRO usa o cadastro-base dos batalhões, mas sem subgrupamentos que não pertencem à unidade.
assert.match(cadastro,/GIRO não possui subgrupamento especializado neste cadastro/);

console.log('GIRO: cadastro operacional sem Tático Setorial/AME/TOR no contexto da unidade.');
