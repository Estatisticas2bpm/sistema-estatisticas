const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const relatorio=fs.readFileSync(path.join(root,'relatorio.html'),'utf8');
const printRenderer=fs.readFileSync(path.join(root,'relatorio-print.js'),'utf8');

const modeloInicio=relatorio.indexOf('function criarModeloRelatorio2Bpm');
const modeloFim=relatorio.indexOf('async function buildRelatorio2Bpm',modeloInicio);
assert.ok(modeloInicio>=0&&modeloFim>modeloInicio,'Modelo específico do 2º BPM não encontrado.');
const modelo=relatorio.slice(modeloInicio,modeloFim);

assert.ok(modelo.includes("{label:'4. COMPARATIVO DE PRODUTIVIDADE',key:'final'}"),'Sumário específico deve terminar na seção 4.');
assert.ok(!/PREVENÇÃO|PREVENCAO|ANEXOS FOTOGRÁFICOS|prevention|actionPage|annexes/.test(modelo),'Modelo do 2º BPM não pode conter prevenção nem anexos.');
assert.ok(!/PALESTRAS|VISITAS SOLIDÁRIAS|VISITAS COMUNITÁRIAS/.test(modelo),'Comparativo do 2º BPM não pode incluir ações preventivas.');
assert.ok(!/PREVENÇÃO|PREVENCAO|ANEXOS FOTOGRÁFICOS|prevention/.test(printRenderer),'Renderer exclusivo do 2º BPM não pode montar prevenção/anexos.');

assert.ok(relatorio.includes('if(eh2BpmRel())return buildRelatorio2Bpm(d,old,tcos,tcosOld)'),'2º BPM deve sair do fluxo genérico antes de montar páginas legadas.');
assert.ok(relatorio.includes("eh2BpmRel()?Promise.resolve({data:[],error:null}):db.rpc('obter_acoes_preventivas'"));

// O bloco continua disponível para outras unidades que ainda possam usar o modelo genérico.
assert.ok(relatorio.includes("4. RESULTADOS DE PROGRAMAS DE PREVENÇÃO À CRIMINALIDADE"));
assert.ok(relatorio.includes("ANEXOS FOTOGRÁFICOS"));

console.log('2º BPM: modelo e renderer A4 sem programas de prevenção/anexos, com seção final 4.');
