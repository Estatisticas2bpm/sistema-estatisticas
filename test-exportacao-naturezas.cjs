const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const N = require('./naturezas-estatisticas.js');
let csv;
const win={SieNaturezasEstatisticas:N};
const code=fs.readFileSync(path.join(__dirname,'mapa-cpc-profissional.js'),'utf8');
new Function('window','URL','Blob','document','setTimeout',code)(win,
 {createObjectURL:b=>{csv=b.parts[0];return 'blob:test'},revokeObjectURL(){}},
 class {constructor(parts){this.parts=parts}},
 {createElement:()=>({click(){},remove(){}}),body:{appendChild(){}}},()=>{});
const bo={id:'a',numero_bo:'61143',ocorrencia:'ROUBO',naturezas_itens:[{nome:'ROUBO'},{nome:'HOMICÍDIO SIMPLES (ART. 121 CAPUT DO CPB)'}],latitude:2.8,longitude:-60.6};
const total=win.MapaCpcProfissional.exportarVisao({getBounds:()=>({contains:()=>true})},[bo,bo,{id:'b',ocorrencia:'AMEAÇA',latitude:2.8,longitude:-60.6}],[],'teste');
assert.equal(total,2);
assert.equal(csv.split('\r\n').length,3);
assert(csv.includes('ROUBO | HOMICÍDIO SIMPLES'));
assert(csv.includes('ROUBO | HOMICÍDIO'));
assert(csv.includes('NATUREZAS ADICIONAIS NÃO DISPONÍVEIS'));
console.log('OK: exportação de naturezas múltiplas sem duplicação');
