'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.resolve(__dirname,'../supabase/migrations/20261018235000_sheets_apenas_1bpm_2bpm_cancelar_pendencias.sql'),'utf8');
const clean=sql.replace(/^--.*$/gm,'');
const first='fe74963f-c11a-4d6f-84be-7dcd8e15ff59';
const second='f09a10df-cd1d-48d1-a093-bf731906e175';

test('somente IDs oficiais do 1º BPM e 2º BPM são permitidos em novas tarefas',()=>{
 assert.ok(sql.includes(first));
 assert.ok(sql.includes(second));
 assert.match(sql,/google_sheets_sync_outbox_somente_bpm_check/);
 assert.match(sql,/unidade_id in\s*\(\s*'fe74963f/);
 assert.match(sql,/or status='CANCELADO'/);
 assert.doesNotMatch(sql,/['"](?:CIPA|CIPTUR|GIRO|BOPE|GATE|CHOQUE)['"]/);
});

test('eventos das unidades sem planilhas cancelados, preservando conteúdo e auditoria',()=>{
 assert.match(clean,/add column if not exists cancelled_at timestamptz/i);
 assert.match(clean,/add column if not exists cancel_reason text/i);
 assert.match(clean,/set status='CANCELADO'/);
 assert.match(clean,/cancelled_at=now\(\)/);
 assert.match(clean,/cancel_reason='Integração Google Sheets descontinuada/);
 assert.match(clean,/and q.status in \('PENDENTE','ERRO'\)/);
 assert.doesNotMatch(clean,/delete\s+from\s+public\.(?:ocorrencias|google_sheets_sync_outbox)/i);
 assert.doesNotMatch(clean,/\btruncate\s+(?:table\s+)?(?:public\.)?(?:ocorrencias|google_sheets_sync_outbox)/i);
 assert.doesNotMatch(clean,/set status='CONCLUIDO'/);
});

test('BOs de outras unidades não ficam com falsa pendência de planilha',()=>{
 assert.match(clean,/ocorrencias_sync_status_check/);
 assert.match(clean,/'NAO_APLICAVEL'/);
 assert.match(clean,/new\.sync_status := case when v_sheets_habilitado then 'PENDENTE' else 'NAO_APLICAVEL' end/);
 assert.match(clean,/set sync_status='NAO_APLICAVEL'/);
 assert.match(clean,/where o\.unidade_id not in/);
 assert.doesNotMatch(clean,/delete\s+from\s+public\.ocorrencias/i);
});

test('triggers de inserir, editar e excluir preservam guardas de origem',()=>{
 assert.match(clean,/create or replace function public\.enqueue_occurrence_for_google_sheets\(\)/);
 assert.match(clean,/create or replace function public\.enqueue_deleted_occurrence_for_google_sheets\(\)/);
 assert.match(clean,/new\.unidade_id not in/);
 assert.match(clean,/old\.unidade_id not in/);
 assert.match(clean,/i\.tipo='GOOGLE_SHEETS_OCORRENCIAS'/);
 assert.match(clean,/i\.ativo=true/);
 assert.match(clean,/nullif\(btrim\(i\.google_sheet_id\),'\s*'\)/);
 assert.match(clean,/public\.occurrence_business_payload\(new\)/);
 assert.match(clean,/current_setting\('app\.google_sheets_ack',true\)/);
 assert.match(clean,/to_jsonb\(old\)\|\|jsonb_build_object\('_deleted',true\)/);
});

test('migração transacional e invariantes para evitar envio a unidade sem destino',()=>{
 assert.match(clean,/\bbegin;/i);
 assert.match(clean,/\bcommit;/i);
 assert.match(clean,/if exists \(\s*select 1 from public\.google_sheets_sync_outbox/);
 assert.match(clean,/if exists \(\s*select 1 from public\.ocorrencias/);
 assert.match(clean,/deveriam existir exatamente duas integrações Sheets ativas/);
});
