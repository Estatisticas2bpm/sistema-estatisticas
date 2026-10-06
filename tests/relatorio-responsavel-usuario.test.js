const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const relatorio=fs.readFileSync(path.join(root,'relatorio.html'),'utf8');
const printRenderer=fs.readFileSync(path.join(root,'relatorio-print.js'),'utf8');

const inicio=relatorio.indexOf('function dadosResponsavelRelatorio');
const fim=relatorio.indexOf('function assinaturaResponsavelRelatorio',inicio);
assert.ok(inicio>=0&&fim>inicio,'Helper estruturado do responsável não encontrado.');
const contexto={
  window:{SistemaAuth:{perfil:{posto_graduacao:'SGT PM',nome:'JOÃO CARLOS DA SILVA',nome_guerra:'SILVA'}}},
  S:v=>(v??'').toString().trim(),
  eh2BpmRel:()=>true
};
vm.createContext(contexto);
vm.runInContext(relatorio.slice(inicio,fim),contexto);
const dados=contexto.dadosResponsavelRelatorio('Função genérica');
assert.equal(dados.identificacao,'SGT PM JOÃO CARLOS DA SILVA — SILVA');
assert.equal(dados.funcao,'Auxiliar da P2/P3 — 2º BPM');

const modeloInicio=relatorio.indexOf('function criarModeloRelatorio2Bpm');
const modeloFim=relatorio.indexOf('async function buildRelatorio2Bpm',modeloInicio);
const modelo=relatorio.slice(modeloInicio,modeloFim);
assert.ok(modelo.includes("const responsible=dadosResponsavelRelatorio('Auxiliar da P2/P3 — 2º BPM')"));
assert.ok(modelo.includes('responsible:{identification:responsible.identificacao,role:responsible.funcao,date:'),'Modelo deve transportar o responsável como dados estruturados.');
assert.ok(printRenderer.includes('signatureBlock(model.responsible)'),'Renderer A4 deve receber o responsável estruturado.');
assert.ok(printRenderer.includes('responsible.identification'));
assert.ok(printRenderer.includes('responsible.role'));

// Os renderers especializados legados continuam usando o mesmo helper.
assert.match(relatorio,/assinaturaResponsavelRelatorio\('Auxiliar da SIE-CPC \/ GIRO'\)/);
assert.match(relatorio,/assinaturaResponsavelRelatorio\('Auxiliar da SIE-CPC \/ CIPTUR'\)/);
assert.match(relatorio,/assinaturaResponsavelRelatorio\('Auxiliar da SIE-CPC \/ '\+unidadeRel\(\)\.sigla\)/);

console.log('Relatório: responsável estruturado a partir do usuário logado e renderizado no documento A4.');
