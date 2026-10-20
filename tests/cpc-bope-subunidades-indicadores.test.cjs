'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const home=read('index.html');
const dados=read('supabase/migrations/20261020194500_cpc_bope_subunidades_vinculadas.sql');
const mapa=read('supabase/migrations/20261020195000_mapa_cpc_filtro_subunidades_bope.sql');
const inicio=home.indexOf('function dadosPorUnidade(');
const fim=home.indexOf('function unidadesCpcPrincipais()',inicio);
assert.ok(inicio>=0&&fim>inicio,'deve encontrar seletor CPC');
const selecionar=new Function('idsDescendentesUnidade',home.slice(inicio,fim)+'return dadosPorUnidade;')(
  id=>{
    const filhos={CPC:['CPC','BOPE','CANIL','CHOQUE','FORCA_TATICA','GATE'],BOPE:['BOPE','CANIL','CHOQUE','FORCA_TATICA','GATE']};
    return filhos[id]||[id];
  }
);
const registros=[
  {id:'c1',unidade_id:'BOPE',subunidade_operacional_id:'CHOQUE',conducoes_operacionais:2},
  {id:'c2',unidade_id:'BOPE',subunidade_operacional_id:'CANIL',conducoes_operacionais:1},
  {id:'c3',unidade_id:'BOPE',subunidade_operacional_id:'FORCA_TATICA',conducoes_operacionais:1},
  {id:'c4',unidade_id:'BOPE',subunidade_operacional_id:'GATE',conducoes_operacionais:0},
  {id:'c5',unidade_id:'BOPE',subunidade_operacional_id:null,conducoes_operacionais:0},
  {id:'c6',unidade_id:'1BPM',subunidade_operacional_id:null,conducoes_operacionais:0}
];
assert.equal(selecionar(registros,'').length,6,'consolidado CPC não pode duplicar BO');
assert.deepEqual(selecionar(registros,'BOPE').map(x=>x.id),['c1','c2','c3','c4','c5']);
assert.deepEqual(selecionar(registros,'CHOQUE').map(x=>x.id),['c1']);
assert.deepEqual(selecionar(registros,'CANIL').map(x=>x.id),['c2']);
assert.deepEqual(selecionar(registros,'FORCA_TATICA').map(x=>x.id),['c3']);
assert.deepEqual(selecionar(registros,'GATE').map(x=>x.id),['c4']);
assert.deepEqual(selecionar(registros,'CPC').map(x=>x.id),['c1','c2','c3','c4','c5']);
assert.deepEqual(selecionar(registros,'1BPM').map(x=>x.id),['c6']);
assert.match(home,/ids\.has\(String\(x\.subunidade_operacional_id\)\)/);
assert.match(home,/return EstatisticaIndicadores\.cards\(u\?\.sigla\|\|'',ocorrencias,tcos/);
assert.match(dados,/public\.obter_home_cpc\(date,date\)/);
assert.match(dados,/o\.subunidade_operacional_id/);
assert.match(dados,/'subunidade_operacional_id'',b\.subunidade_operacional_id/);
assert.match(dados,/'subunidade_operacional_id'',t\.subunidade_operacional_id/);
assert.match(mapa,/public\.obter_mapa_cpc_territorial\(date,date,uuid,text,text,text,text,text\)/);
assert.match(mapa,/or o\.subunidade_operacional_id=p_unidade_id/);
for(const sql of [dados,mapa])
  assert.doesNotMatch(sql,/UPDATE\s+(?:public\.)?ocorrencias|DELETE FROM\s+(?:public\.)?ocorrencias|TRUNCATE\s+(?:TABLE\s+)?(?:public\.)?ocorrencias/i);
console.log('PASS: visão BOPE e 4 subunidades sem duplicação; mapa segue a unidade operacional.');
