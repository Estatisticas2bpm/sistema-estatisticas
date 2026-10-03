const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const cadastro=read('cadastro.html');
const dashboard=read('dashboard.html');
const home=read('index.html');

assert.match(cadastro,/ehCipturCadastro/);
assert.match(cadastro,/grupamentoTor/);
assert.match(cadastro,/TOR — TÁTICO OSTENSIVO RODOVIÁRIO/);
assert.match(cadastro,/grupamento_atendimento:grupamentoSelecionado\(\)/);
// O clique manual no TOR deve permanecer marcado; a sincronização só sobrescreve ao carregar um registro.
assert.match(cadastro,/if\(origem\)\{\\n\s*if\(grupamentoTor\)grupamentoTor\.checked/);
assert.doesNotMatch(cadastro,/const grupo=origem[^;]+;\\n\s*if\(grupamentoTor\)grupamentoTor\.checked/);
assert.match(cadastro,/grupamentoTor\?\.addEventListener/);
assert.match(cadastro,/tatico_setorial: Boolean/);

// Fora da CIPTUR, Tático Setorial e AME continuam disponíveis.
assert.match(cadastro,/TÁTICO SETORIAL/);
assert.match(cadastro,/grupamentoAme/);

// Dashboard CIPTUR: TOR é filtro e módulo próprio.
assert.match(dashboard,/id="secCipturTor"/);
assert.match(dashboard,/TOR — Tático Ostensivo Rodoviário/);
assert.match(dashboard,/function ehTor\(x\)/);
assert.match(dashboard,/grupamento_atendimento/);
assert.match(dashboard,/documento\.value==='TOR'/);
assert.match(dashboard,/cipturTorOcorrencias/);
assert.match(dashboard,/cipturTorConducoes/);
assert.match(dashboard,/cipturTorVeiculos/);
assert.match(dashboard,/cipturTorForagidos/);
assert.match(dashboard,/cipturTorDrogas/);
assert.match(dashboard,/Fiscalização de Trânsito — A\.I\. e Remoções/);
assert.match(dashboard,/cipturRemocoesTotal/);

// Visão rápida da CIPTUR usa os quatro KPIs definidos.
assert.match(home,/function aplicarModoCiptur\(\)/);
assert.match(home,/Autos de Infração/);
assert.match(home,/Veículos Removidos/);
assert.match(home,/ciptur_autos_infracao/);
assert.match(home,/Carros /);
assert.match(home,/Motos /);

console.log('CIPTUR: TOR, dashboard e visão rápida validados.');
