const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const manager=read('cipg-gerenciar-acessos.html');
const mobile=read('cipg-caderno-acesso.html');
const edge=read('supabase/functions/admin-users/index.ts');
const sql=read('supabase/migrations/20261016160000_cipg_restringir_unidade_caderno.sql');
test('CIPG apresenta ativação da própria conta de ADMIN sem outra senha',()=>{
 assert.match(manager,/id="ativarProprio"/);
 assert.match(manager,/Habilitar meu acesso ao Caderno Digital/);
 assert.match(manager,/cipg_access_self_enable/);
 assert.match(manager,/Mesm[a-z]+.*SIE-CPC|mesmo e-mail e senha do SIE-CPC/i);
 assert.match(manager,/id="irCaderno"/);
 assert.match(mobile,/cipg-gerenciar-acessos\.html/);
 assert.match(mobile,/cada policial precisa estar habilitado/);
});
test('Cadastro de terceiros continua exigindo dados pessoais e e-mail, erros junto ao botão',()=>{
 for(const c of ['nome','nome_guerra','posto_graduacao','email','password'])assert.match(manager,new RegExp('name="'+c+'"'));
 assert.match(manager,/cipg_access_create/);
 assert.match(manager,/id="erroCadastro"/);
 assert.match(manager,/Erro ao cadastrar:/);
 assert.match(manager,/error\.context/);
 assert.match(manager,/resposta\.json\(\)/);
});
test('Ativação vincula exclusivamente a sessão ativa e não duplica auth.users',()=>{
 assert.match(edge,/cipg_access_self_enable/);
 assert.match(edge,/acoesCadernoCipg\.has\(action\)/);
 assert.match(edge,/perfilCaller\.perfil === "ADMIN"/);
 assert.match(edge,/perfilCaller\.perfil === "ESTATISTICA"/);
 assert.match(edge,/admin\.rpc\("admin_validar_sessao"/);
 assert.match(edge,/eq\("user_id",caller\.id\)/);
 assert.match(edge,/user_id:caller\.id,\.\.\.payload/);
 assert.match(edge,/if\(existente\?\.ativo===true\)/);
 assert.match(edge,/HABILITOU_PROPRIO_CADERNO_CIPG/);
 assert.doesNotMatch(edge.slice(edge.indexOf('if (action === "cipg_access_self_enable")'),edge.indexOf('if (action === "cipg_access_list")')),/admin\.auth\.admin\.createUser/);
});
test('RLS compara explicitamente unidade do relatório, não a coluna do mesmo alias',()=>{
 assert.match(sql,/a\.unidade_id=cipg_servicos_guarda\.unidade_id/g);
 assert.equal((sql.match(/a\.unidade_id=cipg_servicos_guarda\.unidade_id/g)||[]).length,2);
 assert.doesNotMatch(sql.replace(/^--.*$/gm,''),/a\.unidade_id\s*=\s*unidade_id\b/);
 assert.match(sql,/criado_por=\(select auth\.uid\(\)\)/);
 assert.match(sql,/a\.ativo=true/);
});
test('HTML e scripts embutidos válidos',()=>{
 for(const html of [manager,mobile]){
  for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
   if(m[1].trim())assert.doesNotThrow(()=>new Function(m[1]));
  }
 }
});
