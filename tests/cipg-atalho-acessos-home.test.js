const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const root=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('CIPG displays access manager shortcut on home, not on other unit modes',()=>{
 const h=root('index.html');
 assert.match(h,/id="cipgAccessShortcut" href="cipg-gerenciar-acessos\.html"/);
 assert.match(h,/data-permission="cadastro" data-module="PRODUTIVIDADE_CIPG"/);
 const m=h.match(/if\(modoCipg\)\{CipgHome\.preparar\(\);[\s\S]*?if\(modoGiro\)/);
 assert.ok(m,'CIPG mode must configure shortcut');
 assert.match(m[0],/perfilCipg==='ADMIN'\|\|perfilCipg==='ESTATISTICA'/);
 assert.match(m[0],/atalhoCaderno\.hidden=/);
});
test('CIPG access manager is protected by page and module permissions',()=>{
 const c=root('auth-config.js');
 assert.match(c,/"cipg-gerenciar-acessos\.html":"cadastro"/);
 assert.match(c,/"cipg-gerenciar-acessos\.html":"PRODUTIVIDADE_CIPG"/);
});
