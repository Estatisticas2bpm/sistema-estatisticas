const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../cipa-regras-ppe.js');
const root=path.resolve(__dirname,'..');
const cadastro=fs.readFileSync(path.join(root,'cadastro.html'),'utf8');
const cipa=fs.readFileSync(path.join(root,'cipa-cadastro.js'),'utf8');

const tipos=[
'MAUS-TRATOS',
'PERTURBAÇÃO DO TRABALHO OU SOSSEGO ALHEIOS',
'RESGATE DE ANIMAL',
'SALVAMENTO TERRESTRE',
'DESMATAMENTO',
'PATRULHAMENTO FLUVIAL',
'OMISSÃO DE CAUTELA DE ANIMAL'
].map(nome=>({nome}));
function natureza(s){return 'Natureza Meio(s) Empregado(s)\n'+s+'\nENVOLVIDO(S)';}
const alias={
'MAUS TRATOS':'MAUS-TRATOS',
'PERTUBAÇÃO DO SOSSEGO':'PERTURBAÇÃO DO TRABALHO OU SOSSEGO ALHEIOS',
'RESGATE DE ANIMAL':'RESGATE DE ANIMAL',
'SALVAMENTO TERRESTRE':'SALVAMENTO TERRESTRE',
'DESMATAMENTO':'DESMATAMENTO',
'PATRULHAMENTO FLUVIAL':'PATRULHAMENTO FLUVIAL',
'OMISSÃO DE CAUTELA DE ANIMAL':'OMISSÃO DE CAUTELA DE ANIMAL'
};
for(const [entrada,esperado] of Object.entries(alias)){
  assert.equal(core.naturezaDoPpe(natureza(entrada),tipos)?.nome,esperado,entrada);
}
assert.equal(core.naturezaDoPpe(natureza('BR 174'),tipos),null,'BR 174 é local, não natureza');
const doc='Relata-se atendimento à ORDEM DE MISSÃO DA PMRR Nº 34/2026/PMRR/QCG/CPC/CIPA/P2P3A OPERAÇÃO BIOMA - BRASIL CONTRA O CRIME ORGANIZADO.';
const resposta=core.extrair(doc,tipos);
assert.equal(resposta.origem,'BIOMA');
assert.equal(resposta.documento.tipo,'ORDEM DE MISSÃO');
assert.equal(resposta.documento.numero,'34/2026');
assert.match(resposta.documento.referencia,/PMRR\/QCG\/CPC\/CIPA\/P2P3A/);
assert.equal(core.origemDaAtuacao('Ocorrência recebida do CICC'),'CICC');
assert.equal(core.origemDaAtuacao('Em patrulhamento preventivo'),'PATRULHAMENTO');
const os=core.documentoDaMissao('ORDEM DE SERVIÇO Nº 21201323/2026PMRR/QCG/CPC/CIPA/P2P3A');
assert.equal(os.tipo,'ORDEM DE SERVIÇO');
assert.equal(os.numero,'21201323/2026');
assert.match(cipa,/Origem do acionamento \/ operação/);
assert.match(cipa,/cipaTipoOrdem/);
assert.match(cipa,/cipaNumeroOrdem/);
assert.match(cipa,/finalizarPreenchimentoPpe/);
assert.match(cadastro,/cipa-regras-ppe\.js/);
assert.match(cadastro,/finalizarPreenchimentoPpe\?\./);
console.log('PASS: fluxo CIPA, tipos, 7 aliases, origem BIOMA/CICC e ordens PMRR.');
