const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const migration=read('supabase/migrations/20261016161500_cipg_privilegios_service_role.sql');
const edge=read('supabase/functions/admin-users/index.ts');
const original=read('supabase/migrations/20261015160000_cipg_acesso_individual_caderno.sql');
test('função administrativa volta a ter apenas SELECT INSERT UPDATE na tabela CIPG',()=>{
 assert.match(migration,/grant\s+select\s*,\s*insert\s*,\s*update\s+on\s+table\s+public\.cipg_acessos_caderno\s+to\s+service_role\s*;/i);
 const sql=migration.replace(/^--.*$/gm,'');
 assert.doesNotMatch(sql,/\bgrant\b[\s\S]*?\bto\s+(anon|authenticated)\b/i);
 assert.doesNotMatch(sql,/\bdelete\b|\btruncate\b|\bcreate\s+policy\b/i);
});
test('RLS dos usuários finais permanece e só habilita própria conta',()=>{
 assert.match(original,/enable row level security/);
 assert.match(original,/create policy cipg_acesso_proprio/);
 assert.match(original,/user_id=\(select auth\.uid\(\)\) and ativo=true/);
 assert.match(edge,/cipg_access_self_enable/);
 assert.match(edge,/admin\.rpc\("admin_validar_sessao"/);
 assert.match(edge,/if \(!autorizado\)/);
 assert.match(edge,/eq\("user_id",caller\.id\)/);
});
