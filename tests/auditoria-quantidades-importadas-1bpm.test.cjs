'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const val=require('../verificacao-quantidades-operacionais.js');
const raiz=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(raiz,'cadastro-base.html'),'utf8');
const sql=fs.readFileSync(path.join(raiz,'supabase/migrations/20261018190000_auditoria_corrigir_17_bos_1bpm_quantidades.sql'),'utf8');

const recuperado=(quantidade,detalhes)=>({veiculos_recuperados:quantidade,itens_recuperados:[{tipo:'MOTOCICLETA',quantidade,detalhes}]});
const arma=(quantidade,detalhes,categoria='ARMA DE FOGO')=>({quantidade_armas:quantidade,armas_itens:[{categoria,quantidade,detalhes}]});

test('regressão: modelos de veículos não são quantidades',()=>{
 for(const [q,descricao] of [
  [100,'HONDA/BIZ 100 ES - PLACA ABC1234'],
  [1000,'VW/GOL 1000L - PLACA KCP6764'],
  [125,'HONDA/CG 125 FAN KS - PLACA X'],
  [150,'HONDA/CG 150 TITAN ESD - PLACA X'],
  [160,'HONDA/CG TITAN 160 - PLACA X'],
  [250,'YAMAHA/LANDER XTZ 250, PLACA X']
 ]){
  assert.match(val.verificar(recuperado(q,descricao)).join(' '),/Veículo:/,descricao);
  assert.equal(val.verificar(recuperado(1,descricao)).length,0,descricao);
 }
});
test('regressão: calibres não são contagens de armas e simulacros',()=>{
 for(const [q,descricao] of [
  [38,'REVOLVER TAURUS CALIBRE .38, 3 MUNIÇÕES .38'],
  [38,'PISTOLA TAURUS G2C .38TPC'],
  [38,'UM SIMULACRO DE CAL.38'],
  [9,'UMA ARMA DE FOGO: PISTOLA 9MM GLOCK'],
  [9,'PISTOLA/TAURUS- PT92-9MM']
 ]){
  assert.match(val.verificar(arma(q,descricao)).join(' '),/Arma\/simulacro:/,descricao);
  assert.equal(val.verificar(arma(1,descricao)).length,0,descricao);
 }
});
test('quantidade material legítima sem coincidência com modelo não gera alerta',()=>{
 assert.deepEqual(val.verificar({veiculos_recuperados:5,itens_recuperados:[{quantidade:5,detalhes:'cinco bicicletas'}]}),[]);
 assert.deepEqual(val.verificar({armas_itens:[{quantidade:12,detalhes:'12 armas de fogo calibre .40'}]}),[]);
 assert.deepEqual(val.verificar({quantidade_armas:3,armas_itens:[{quantidade:3,detalhes:'pistola calibre 9mm'}]}),[]);
 assert.deepEqual(val.verificar({quantidade_armas:0,itens_recuperados:[],armas_itens:[]}),[]);
});
test('registros legados agregados também podem ser detectados',()=>{
 assert.ok(val.verificar({veiculos_recuperados:160,itens_recuperados:[],materialidade:'HONDA CG 160'}).length>0);
 assert.ok(val.verificar({quantidade_armas:38,armas_itens:[],armas:'REVÓLVER CALIBRE .38'}).length>0);
});
test('proteção integrada após montagem do registro e antes de insert/update',()=>{
 assert.match(html,/src="verificacao-quantidades-operacionais\.js\?v=20261018-auditoria1"/);
 const montagem=html.indexOf('const registro = {'),alerta=html.indexOf('const alertasMateriais = window.ValidacaoQuantidadesOperacionais?.verificar(registro)'),gravar=html.indexOf('await banco.from("ocorrencias").insert([registro])');
 assert.ok(montagem>=0&&alerta>montagem&&gravar>alerta);
 assert.match(html,/confirm\(\s*"ATENÇÃO — confira as quantidades/);
 assert.match(html,/alertasMateriais\.join/);
 assert.match(html,/Conferiu com o boletim original/);
 const inline=Array.from(html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)).map(x=>x[1]).filter(s=>s.trim());
 for(const s of inline) assert.doesNotThrow(()=>new Function(s));
});
test('migração usa exatamente 17 alvos e mantém cópia auditável antes/depois',()=>{
 assert.equal((sql.match(/::uuid,/g)||[]).length,17);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS private\.auditoria_correcao_quantidades_1bpm_20261018/);
 assert.match(sql,/itens_antes jsonb NOT NULL/);
 assert.match(sql,/itens_depois jsonb NOT NULL/);
 assert.match(sql,/REVOKE ALL ON private\.auditoria_correcao_quantidades_1bpm_20261018/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/quantidade_armas=1,armas_itens=itens_depois/);
 assert.match(sql,/veiculos_recuperados=1,itens_recuperados=itens_depois/);
 assert.match(sql,/IF alterados<>17/);
});
