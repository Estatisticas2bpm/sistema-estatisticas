'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const home=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const page=fs.readFileSync(path.join(__dirname,'..','produtividade-cpc.html'),'utf8');
const dashboard=fs.readFileSync(path.join(__dirname,'..','dashboard-cpc.html'),'utf8');
assert.match(home,/<a class="action" href="produtividade-cpc\.html"><span>▣<\/span>Operações e apresentações documentadas<\/a>/,
 'Atalho deve estar visível também nas unidades, não apenas no painel CPC');
assert.match(page,/<a href="index\.html">Voltar à página inicial<\/a>/,
 'Operador não pode ser redirecionado ao painel CPC, restrito ao comando');
assert.match(page,/permiteRegistro=Boolean\(usuarioUnidadeId\)&&\['ADMIN','ESTATISTICA','OPERADOR'\]/);
assert.match(page,/permiteRevisao=Boolean\(usuarioUnidadeId\)&&\['ADMIN','ESTATISTICA'\]/);
assert.match(dashboard,/href="produtividade-cpc\.html"/);
console.log('CPC: registro e conferência documental acessíveis pelas unidades com validação restrita à estatística/administração.');
