const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const auth=read('auth-config.js');
const home=read('index.html');
const usuarios=read('usuarios.html');
const guard=read('auth-guard.js');
const mobile=read('giro-abordagem.html');
const scope=read('supabase/migrations/20261020124500_comandante_escopo_unidade_principal.sql');
const config={window:{}};
new Function('window',auth)(config.window);
const cfg=config.window.SISTEMA_AUTH_CONFIG;
const esperadas=['consulta','dashboard','analise','mapa','relatorio'];
assert.deepEqual(cfg.permissions.COMANDANTE,esperadas);
for(const nao of ['cadastro','tco','acoes','usuarios','auditoria','logs','configuracoes']) {
  assert.equal(cfg.permissions.COMANDANTE.includes(nao),false,'comandante nao pode '+nao);
}
for(const pagina of ['dashboard-cpc.html','territorio-cpc.html']) {
  assert.equal(cfg.pagePermissions[pagina],'dashboard');
  assert.equal(cfg.pageModules[pagina],'PAINEL_CPC');
  assert.ok(home.includes('href="'+pagina+'"'));
}
assert.ok(scope.includes("if v_perfil IN ('ADMIN','COMANDANTE') then"));
assert.ok(scope.includes("u.parent_id = a.id"));
assert.ok(usuarios.includes("'COMANDANTE DO CPC: acesso somente de leitura"));
assert.ok(usuarios.includes("String(sigla).toUpperCase()==='CPC'"));
assert.ok(usuarios.includes("COMANDANTE CPC"));
assert.ok(usuarios.includes("Sem auditoria de dados, gerenciar usuários"));
assert.ok(home.includes('id="giroAdminAbordagensShortcut" href="giro-abordagem.html?admin=1" hidden'));
assert.ok(!/id="giroAdminAbordagensShortcut"[^>]*data-permission/.test(home));
assert.ok(home.includes("if(testarGiro)testarGiro.hidden=!(modoGiro&&perfilGiro==='ADMIN'"));
assert.ok(home.includes("window.SistemaAuth?.contexto?.sigla||''"));
assert.ok(mobile.includes("auth.user.id===session.user.id"));
assert.ok(mobile.includes("auth.contexto.aceita_registro_operacional===true"));
assert.ok(mobile.includes("auth.perfil.ativo===true"));
assert.ok(guard.includes("if(permissao==='usuarios'&&normalizarPerfil(perfil)!=='ADMIN')return false"));
console.log('Comandante CPC e teste GIRO restrito ao ADMIN da unidade: contratos validados.');
