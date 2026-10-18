const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('autos-infracao.html');
const migration=read('supabase/migrations/20261018160000_ciptur_teste_etilometro_ai.sql');

test('CIPTUR: pergunta de etilômetro fica imediatamente abaixo da remoção de veículo',()=>{
 const remo=html.indexOf('id="houveRemocao"');
 const veiculo=html.indexOf('id="campoTipoVeiculo"');
 const teste=html.indexOf('Houve teste de etilômetro? *');
 const resultado=html.indexOf('id="resultado"');
 assert.ok(remo>=0 && remo<veiculo && veiculo<teste && teste<resultado);
 assert.match(html,/<fieldset class="campo campoEtilometro">/);
 assert.match(html,/<legend>Houve teste de etilômetro\? \*<\/legend>/);
});

test('duas opções em quadradinhos, exclusivas, sem resposta pré-marcada',()=>{
 const radios=[...html.matchAll(/<input type="radio" name="houveTesteEtilometro" value="([^"]+)" required>/g)];
 assert.deepEqual(radios.map(m=>m[1]),['SIM','NAO']);
 assert.doesNotMatch(html.slice(html.indexOf('<fieldset class="campo campoEtilometro">'),html.indexOf('</fieldset>',html.indexOf('<fieldset class="campo campoEtilometro">'))),/checked(?:\s|>|=)/);
 assert.match(html,/\.campo \.opcaoEtilometro input\{appearance:none;width:17px;height:17px/);
 assert.match(html,/\.campo \.opcaoEtilometro input:checked/);
});

test('salvar A.I. usa booleano fiel à escolha; ambos os fluxos insert e update usam o payload',()=>{
 assert.match(html,/testeEtilometro=document\.querySelector\('input\[name="houveTesteEtilometro"\]:checked'\)\?\.value/);
 assert.match(html,/if\(!\['SIM','NAO'\]\.includes\(testeEtilometro\)\)/);
 assert.match(html,/houve_teste_etilometro:testeEtilometro==='SIM'/);
 assert.match(html,/\.update\(payload\)\.eq\('id',editandoId\)/);
 assert.match(html,/\.insert\(\{\.\.\.payload,unidade_id:auth\.contexto\.unidade_id\}\)/);
 assert.match(html,/tipo_veiculo_removido,houve_teste_etilometro,criado_por/);
});

test('editar, cancelar e novo registro preservam Sim/Não/sem informação',()=>{
 const start=html.indexOf('function marcarTesteEtilometro(valor){');
 const end=html.indexOf('function cancelar(){',start);
 assert.ok(start>=0 && end>start);
 const inputs=[{value:'SIM',checked:false},{value:'NAO',checked:false}];
 const document={querySelectorAll:sel=>{
  assert.equal(sel,'input[name="houveTesteEtilometro"]');
  return inputs;
 }};
 const marcar=new Function('document',html.slice(start,end)+'return marcarTesteEtilometro;')(document);
 marcar(true);assert.deepEqual(inputs.map(x=>x.checked),[true,false]);
 marcar(false);assert.deepEqual(inputs.map(x=>x.checked),[false,true]);
 marcar(null);assert.deepEqual(inputs.map(x=>x.checked),[false,false]);
 assert.match(html,/marcarTesteEtilometro\(r\.houve_teste_etilometro\)/);
 assert.match(html,/marcarTesteEtilometro\(null\)/);
});

test('migração preserva os autos históricos como Não informado e não altera RLS',()=>{
 assert.match(migration,/add column if not exists houve_teste_etilometro boolean;/);
 assert.doesNotMatch(migration,/not null|default false|default true/i);
 assert.doesNotMatch(migration,/\bupdate\b|\bdelete\b|\bgrant\b|\bpolicy\b/i);
});

test('JavaScript inline continua com sintaxe válida',()=>{
 for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
  if(match[1].trim())assert.doesNotThrow(()=>new Function(match[1]));
 }
});
