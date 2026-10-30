'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const c=read('cadastro-base.html');
const sql=read('supabase/migrations/20261030131000_cia_apuracao_separada_companhia_gerada.sql');
test('cadastro não tenta gravar coluna territorial GENERATED ALWAYS',()=>{
 assert.doesNotMatch(c,/\n\s*companhia:\s*document\.getElementById\("companhia"\)/);
 assert.match(c,/cia_unidade_apuracao:\s*document\.getElementById\("companhia"\)\.value/);
 assert.match(c,/cia_unidade_apuracao:"companhia"/);
 assert.match(c,/window\.PdfCompanhia\?\.extrair\(texto\)/);
});
test('coluna documental independente é criada, sem substituir a coluna territorial',()=>{
 assert.match(sql,/ADD COLUMN IF NOT EXISTS cia_unidade_apuracao text/);
 assert.match(sql,/cia_unidade_apuracao=v\.cia_unidade_apuracao/);
 assert.match(sql,/companhia' AND is_generated='ALWAYS'/);
 assert.doesNotMatch(sql,/DROP COLUMN (?:IF EXISTS )?companhia|ALTER COLUMN companhia/i);
 assert.doesNotMatch(sql,/DELETE FROM public\.ocorrencias|TRUNCATE public\.ocorrencias/i);
});
