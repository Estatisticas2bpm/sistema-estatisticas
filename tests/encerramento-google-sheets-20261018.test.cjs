'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261019000000_encerrar_sheets_arquivar_historico_e_liberar_espaco.sql'),'utf8');
const auth=fs.readFileSync(path.join(root,'auth-guard.js'),'utf8');
const cfg=fs.readFileSync(path.join(root,'auth-config.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const dashboard=fs.readFileSync(path.join(root,'dashboard.html'),'utf8');
const relatorio=fs.readFileSync(path.join(root,'relatorio.html'),'utf8');

test('encerrar Sheets sem alterar/cancelar BOs nem apagar suas tabelas',()=>{
 assert.match(sql,/UPDATE public\.unidades_integracoes\s+SET ativo=false/);
 assert.match(sql,/DROP TRIGGER IF EXISTS trg_enqueue_occurrence_for_google_sheets/);
 assert.match(sql,/DROP TRIGGER IF EXISTS trg_enqueue_deleted_occurrence_for_google_sheets/);
 assert.match(sql,/NEW\.sync_status := 'NAO_APLICAVEL'/);
 assert.match(sql,/UPDATE public\.ocorrencias\s+SET sync_status='NAO_APLICAVEL'/);
 assert.doesNotMatch(sql,/DELETE\s+FROM\s+public\.ocorrencias/i);
 assert.doesNotMatch(sql,/TRUNCATE\s+(?:TABLE\s+)?public\.ocorrencias/i);
 assert.match(sql,/ALTER TABLE public\.ocorrencias DISABLE TRIGGER atualizar_ocorrencias/);
 assert.match(sql,/ALTER TABLE public\.ocorrencias ENABLE TRIGGER atualizar_ocorrencias/);
});
test('histórico sem perder eventos sem BO ativo: guardar snapshots e metadados antes do truncamento',()=>{
 assert.match(sql,/CREATE TABLE private\.sheets_historico_eventos_20261018/);
 assert.match(sql,/CREATE TABLE private\.sheets_ultimos_payloads_20261018/);
 assert.match(sql,/CREATE TABLE private\.sheets_encerramento_manifesto_20261018/);
 assert.match(sql,/md5\(q\.payload::text\)/);
 assert.match(sql,/ORDER BY q\.occurrence_sync_id,q\.sync_version DESC,q\.id DESC/);
 assert.match(sql,/count\(distinct q\.occurrence_sync_id\) FILTER \(WHERE o\.id IS NULL\)/);
 assert.match(sql,/private\.sheets_ultimos_payloads_20261018 a\s+LEFT JOIN public\.ocorrencias o/);
 const locationBackup=sql.indexOf('INSERT INTO private.sheets_ultimos_payloads_20261018');
 const locationTruncate=sql.indexOf('TRUNCATE TABLE public.google_sheets_sync_outbox;');
 assert.ok(locationBackup>=0&&locationTruncate>locationBackup);
 assert.match(sql,/REVOKE ALL ON TABLE private\.sheets_historico_eventos_20261018/);
 for(const table of ['sheets_historico_eventos_20261018','sheets_ultimos_payloads_20261018','sheets_encerramento_manifesto_20261018'])
  assert.match(sql,new RegExp('ALTER TABLE private\\.'+table+' ENABLE ROW LEVEL SECURITY'));
});
test('operações de limpeza são transacionais e condicionadas à verificação de integridade',()=>{
 assert.match(sql,/^BEGIN;/m);
 assert.match(sql,/^COMMIT;/m);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/LOCK TABLE public\.ocorrencias/);
 assert.match(sql,/Falha de integridade: arquivo histórico incompleto/);
 assert.match(sql,/Verificação final falhou/);
 assert.match(sql,/TRUNCATE TABLE public\.google_sheets_sync_outbox;/);
});
test('atalhos removidos da homepage, dashboard e relatórios e RPC de Sheets não carregada',()=>{
 assert.doesNotMatch(index,/data-planilha-unidade/);
 assert.doesNotMatch(dashboard,/data-planilha-unidade/);
 assert.doesNotMatch(relatorio,/data-planilha-unidade/);
 assert.doesNotMatch(cfg,/"planilha"/);
 assert.doesNotMatch(auth,/client\.rpc\('obter_planilha_usuario'\)/);
 assert.match(auth,/const planilha=null/); // campo legado, sem saída Sheets
 for(const html of [index,dashboard,relatorio])
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
   if(match[1].trim())assert.doesNotThrow(()=>new Function(match[1]));
  }
});
