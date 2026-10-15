const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
test('GIRO e CIPG exibem link Meu perfil somente nos módulos individuais',()=>{
const g=read('giro-abordagem.html'),c=read('cipg-caderno-acesso.html'),a=read('cipg-acesso.js');
assert.match(g,/id="perfilGiro"/);assert.match(g,/meu-perfil-operacional\.html\?unidade=GIRO/);
assert.match(c,/id="perfilCipg"/);assert.match(c,/meu-perfil-operacional\.html\?unidade=CIPG/);
assert.match(a,/\$\('perfilCipg'\)\.hidden=!autorizado/);
});
test('Página de perfil reutiliza storage keys segregadas e restringe dados editáveis',()=>{
const p=read('meu-perfil-operacional.html');
assert.match(p,/sie-cpc-giro-abordagem-auth/);assert.match(p,/sie-cipg-caderno-auth/);
assert.match(p,/id="posto_graduacao" required/);assert.match(p,/id="nome_guerra" required/);
assert.match(p,/id="nomeCompleto" disabled/);assert.match(p,/id="matricula" disabled/);
assert.match(p,/perfil-operacional/);assert.match(p,/client\.auth\.getUser\(\)/);
});
test('Endpoint edita somente próprio perfil, valida graduação e registra auditoria',()=>{
const e=read('supabase/functions/perfil-operacional/index.ts');
assert.match(e,/admin\.auth\.getUser\(token\)/);
assert.match(e,/\.eq\("user_id",user\.id\)/);
assert.match(e,/nome_guerra:nomeGuerra,posto_graduacao:posto/);
assert.match(e,/graduacoes\.has\(posto\)/);
assert.match(e,/auditoria_perfil_operacional/);
assert.doesNotMatch(e,/update\(\{[^}]*nome_completo/);
});
