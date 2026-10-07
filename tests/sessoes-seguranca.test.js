const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

const guard=fs.readFileSync(path.join(root,'auth-guard.js'),'utf8');
const cfg=fs.readFileSync(path.join(root,'auth-config.js'),'utf8');
const perfil=fs.readFileSync(path.join(root,'meu-perfil.html'),'utf8');
const mfa=fs.readFileSync(path.join(root,'mfa.html'),'utf8');
const sessoes=fs.readFileSync(path.join(root,'sessoes.html'),'utf8');
const edge=fs.readFileSync(path.join(root,'supabase','functions','admin-users','index.ts'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase','migrations','20261007160517_seguranca_sessoes_online_revogacao.sql'),'utf8');

assert.ok(cfg.includes('mfaPage: "mfa.html"'));
assert.ok(cfg.includes('"sessoes.html":"usuarios"'));

assert.ok(guard.includes("client.from('sessoes_presenca').upsert"),'Guard deve emitir heartbeat.');
assert.ok(guard.includes("setInterval(ping,30000)"),'Heartbeat deve ser periódico.');
assert.ok(guard.includes("getAuthenticatorAssuranceLevel()"),'Guard deve exigir desafio quando houver MFA verificado.');
assert.ok(guard.includes("location.replace(urlLogin('sessao-revogada'))"),'Sessão revogada deve sair do sistema.');

assert.ok(migration.includes('create table public.sessoes_presenca'));
assert.ok(migration.includes('create table public.sessoes_revogadas'));
assert.ok(migration.includes('from auth.sessions s'),'Validação forte deve consultar auth.sessions.');
assert.ok(migration.includes('and not exists (\n      select 1\n      from public.sessoes_revogadas'),'usuario_ativo deve bloquear sessões revogadas.');
assert.ok(migration.includes('grant execute on function public.admin_sessoes_snapshot() to service_role'));
assert.ok(!migration.includes('grant execute on function public.admin_sessoes_snapshot() to authenticated'));

assert.ok(edge.includes('admin_validar_sessao'),'Edge Function deve rejeitar JWT de sessão revogada.');
assert.ok(edge.includes('sessions_list'));
assert.ok(edge.includes('session_revoke'));
assert.ok(edge.includes('sessions_revoke_others_self'));
assert.ok(edge.includes('sessions_revoke_user'));
assert.ok(edge.includes('USUARIO_ENCERROU_OUTRAS_SESSOES'));

assert.ok(sessoes.includes('usuários online agora'));
assert.ok(sessoes.includes('Encerrar minhas outras sessões'));
assert.ok(sessoes.includes("client.auth.signOut({scope:'others'})"));
assert.ok(sessoes.includes("setInterval(()=>{if(document.visibilityState==='visible')carregar(true)},15000)"));

assert.ok(perfil.includes('Verificação em duas etapas (2FA)'));
assert.ok(perfil.includes("client.auth.mfa.enroll({factorType:'totp'"));
assert.ok(perfil.includes("client.auth.mfa.verify("));
assert.ok(perfil.includes("sessions_revoke_others_self"));
assert.ok(perfil.includes("signOut({scope:'others'})"));

assert.ok(mfa.includes("client.auth.mfa.challenge({factorId})"));
assert.ok(mfa.includes("client.auth.mfa.verify({factorId,challengeId:challenge.data.id,code})"));

console.log('Segurança de sessões: presença, revogação e MFA validados por contrato.');
