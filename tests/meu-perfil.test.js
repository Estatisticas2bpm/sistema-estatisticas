const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const raiz=path.resolve(__dirname,'..');
const ler=p=>fs.readFileSync(path.join(raiz,p),'utf8');
const cfg=ler('auth-config.js');
const guard=ler('auth-guard.js');
const perfil=ler('meu-perfil.html');
const admin=ler(path.join('supabase','functions','admin-users','index.ts'));

assert.match(cfg,/profilePage:\s*"meu-perfil\.html"/);
assert.match(guard,/cfg\.profilePage\|\|'meu-perfil\.html'/);
assert.match(guard,/perfilLink\.textContent='Perfil'/);
assert.match(perfil,/id="nome"/);
assert.match(perfil,/id="nomeGuerra"/);
assert.match(perfil,/id="postoGraduacao"/);
assert.match(perfil,/id="matricula"/);
assert.match(perfil,/id="email" readonly/);
assert.match(perfil,/id="perfil" readonly/);
assert.match(perfil,/id="unidade" readonly/);
assert.match(perfil,/action:'self_update'/);
assert.match(perfil,/client\.auth\.updateUser\(\{password:senha\}\)/);
assert.match(perfil,/action:'password_changed'/);
assert.match(admin,/action === "self_update"/);
assert.match(admin,/EDITOU_PROPRIO_PERFIL/);
assert.match(admin,/posto_graduacao: postoGraduacao/);
assert.doesNotMatch(admin,/self_update[\s\S]{0,1600}perfil:\s*upper\(body\.perfil\)/);
assert.doesNotMatch(admin,/self_update[\s\S]{0,1600}unidade_id:\s*limpar\(body\.unidade_id\)/);

console.log('Meu perfil: autoedição funcional e troca de senha validadas.');
