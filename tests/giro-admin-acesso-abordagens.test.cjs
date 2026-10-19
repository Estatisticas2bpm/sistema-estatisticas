'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.resolve(__dirname,'..',f),'utf8');
const mobile=read('giro-abordagem.html');
const sql=read('supabase/migrations/20261019131000_admin_acesso_abordagem_giro_por_contexto.sql');
const home=read('index.html');
const dashboard=read('dashboard.html');
const mgmt=read('giro-acesso-abordagens.html');
const config=read('auth-config.js');

test('ADMIN no GIRO usa própria sessão institucional e a guarda de MFA',()=>{
 assert.match(mobile,/MODO_ADMIN_GIRO=new URLSearchParams\(location.search\)\.get\('admin'\)==='1'/);
 assert.match(mobile,/MODO_ADMIN_GIRO\s*\? undefined/);
 assert.match(mobile,/await carregarGuardaAdmin\('auth-guard\.js'\)/);
 assert.match(mobile,/auth\.user\.id===session\.user\.id/);
 assert.match(mobile,/auth\.perfil\.ativo===true/);
 assert.match(mobile,/auth\.contexto\.aceita_registro_operacional===true/);
 assert.match(mobile,/auth\.contexto\.somente_leitura_operacional!==true/);
 assert.match(mobile,/String\(auth\.contexto\?\.sigla\|\|''\)\.toUpperCase\(\)==='GIRO'/);
 assert.match(mobile,/MODO_ADMIN_GIRO\?\s*'Voltar ao SIE-CPC'/);
 assert.match(mobile,/if\(MODO_ADMIN_GIRO\)\{location\.href='index\.html';return;\}/);
});
test('login de policiais GIRO permanece individual e isolado',()=>{
 assert.match(mobile,/storageKey:'sie-cpc-giro-abordagem-auth'/);
 assert.match(mobile,/giro_acessos_abordagem/);
 assert.match(mobile,/data-tipo="A_PE"/);
 assert.match(mobile,/registrar_abordagem_giro/);
 assert.match(mobile,/if\(!MODO_ADMIN_GIRO\)/);
});
test('backend autoriza somente ADMIN no contexto GIRO e preserva autoria de todas abordagens',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.registrar_abordagem_giro/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION private\.validar_abordagem_giro_insert/);
 assert.match(sql,/private\.perfil_atual\(\) = 'ADMIN'/);
 assert.match(sql,/u\.id = private\.unidade_atual\(\)/);
 assert.match(sql,/upper\(u\.sigla\) = 'GIRO'/);
 assert.match(sql,/u\.aceita_registro_operacional = true/);
 assert.match(sql,/CREATE POLICY giro_abordagens_insert_admin_contexto_giro/);
 assert.match(sql,/criado_por = \(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/unidade_id = private\.unidade_atual\(\)/);
 assert.match(sql,/new\.criado_por := v_user;/i);
 assert.doesNotMatch(sql,/ALTER POLICY giro_abordagens_insert_acesso_compartilhado/i);
 assert.doesNotMatch(sql,/DELETE FROM|TRUNCATE TABLE|DROP TABLE/i);
});
test('atalhos para ADMIN apontam à rota segura; estatística não recebe esse atalho',()=>{
 assert.match(home,/id="giroAdminAbordagensShortcut" href="giro-abordagem\.html\?admin=1" data-permission="usuarios"/);
 assert.match(config,/ADMIN: \["cadastro"/);
 assert.match(dashboard,/giroLink\.href='giro-abordagem\.html\?admin=1'/);
 assert.match(mgmt,/link\.href='giro-abordagem\.html\?admin=1'/);
});
