const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const raiz=path.resolve(__dirname,'..');
const ler=p=>fs.readFileSync(path.join(raiz,p),'utf8');
const usuarios=ler('usuarios.html');
const guard=ler('auth-guard.js');
const admin=ler(path.join('supabase','functions','admin-users','index.ts'));
const migration=ler(path.join('supabase','migrations','20260929121404_fase3p_posto_graduacao_usuarios.sql'));

assert.match(migration,/add column if not exists posto_graduacao text/i);
assert.match(usuarios,/id="postoGraduacao" required/);
assert.match(usuarios,/id="editPostoGraduacao" required/);
for(const perfil of ['OPERADOR','ESTATISTICA','GESTOR','CONSULTA','ADMIN'])assert.ok(usuarios.includes('value="'+perfil+'"'));
for(const posto of ['CEL PM','TEN CEL PM','MAJ PM','CAP PM','1º TEN PM','2º TEN PM','ASP OF PM','AL OF PM','SUB TEN PM','1º SGT PM','2º SGT PM','3º SGT PM','CB PM','SD PM'])assert.ok(usuarios.includes('value="'+posto+'"'));
assert.ok(usuarios.includes("posto_graduacao:$('postoGraduacao').value"));
assert.ok(usuarios.includes("posto_graduacao:$('editPostoGraduacao').value"));
assert.match(admin,/postosGraduacoesValidos/);
assert.match(admin,/posto_graduacao: postoGraduacao/);
assert.match(guard,/perfil\.posto_graduacao,perfil\.nome_guerra/);
assert.match(guard,/nome_guerra,posto_graduacao,matricula/);

console.log('Cadastro de usuários com posto/graduação validado.');
