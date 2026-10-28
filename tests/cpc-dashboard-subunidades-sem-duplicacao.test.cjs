'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'dashboard-cpc.html'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261028193000_corrigir_dashboard_cpc_subunidades.sql'),'utf8');
const entre=(ini,fim)=>{
  const a=html.indexOf(ini),b=html.indexOf(fim,a);
  assert.ok(a>=0&&b>a,'Não localizou '+ini);
  return html.slice(a,b);
};
const functions=entre('function agruparMetricas(raw){','function agruparSerie(raw){');
const unidades=[
  {id:'bope',sigla:'BOPE',nome:'Batalhão de Operações Policiais Especiais',tipo:'BATALHAO',parent_id:'cpc'},
  {id:'choque',sigla:'CHOQUE',nome:'Choque',tipo:'SUBUNIDADE',parent_id:'bope'},
  {id:'forca',sigla:'FORCA_TATICA',nome:'Força Tática',tipo:'SUBUNIDADE',parent_id:'bope'},
  {id:'canil',sigla:'CANIL',nome:'Canil',tipo:'SUBUNIDADE',parent_id:'bope'},
  {id:'gate',sigla:'GATE',nome:'GATE',tipo:'SUBUNIDADE',parent_id:'bope'}
];
let selecionada='';
const scope={
  grupoIdParaUnidade:id=>selecionada?String(id):unidades.find(u=>u.id===id)?.tipo==='SUBUNIDADE'?'bope':String(id),
  unidadeH:id=>unidades.find(u=>u.id===id),
  filhosH:id=>unidades.filter(u=>u.parent_id===id),
  sigla:s=>s,
  n:x=>Number(x)||0
};
vm.createContext(scope);vm.runInContext(functions,scope);
const linhas=[
  {unidade_id:'bope',sigla:'BOPE',total_ocorrencias:44,conducoes:9,tcos:0},
  {unidade_id:'choque',sigla:'CHOQUE',total_ocorrencias:21,conducoes:4,tcos:0},
  {unidade_id:'forca',sigla:'FORCA_TATICA',total_ocorrencias:17,conducoes:3,tcos:0},
  {unidade_id:'canil',sigla:'CANIL',total_ocorrencias:6,conducoes:2,tcos:0},
  {unidade_id:'gate',sigla:'GATE',total_ocorrencias:0,conducoes:0,tcos:0}
];
const consolidados=scope.agruparMetricas(linhas);
assert.equal(consolidados.length,1);
assert.equal(consolidados[0].total_ocorrencias,44,'BOPE consolidado não pode somar as mesmas ocorrências duas vezes');
assert.equal(consolidados[0].conducoes,9);
const filhos=Object.fromEntries(consolidados[0].filhas.map(x=>[x.sigla,x.total_ocorrencias]));
assert.equal(filhos.CHOQUE,21);
assert.equal(filhos.FORCA_TATICA,17);
assert.equal(filhos.CANIL,6);
assert.equal(filhos.GATE,0);
selecionada='bope';
const soBope=scope.agruparMetricas([linhas[0]]);
assert.equal(soBope[0].total_ocorrencias,44);
assert.equal(soBope[0].filhas.length,0,'Não mostrar filhas com zero artificial quando a RPC retorna só BOPE');
selecionada='choque';
const choque=scope.agruparMetricas([linhas[1]]);
assert.equal(choque.length,1);
assert.equal(choque[0].total_ocorrencias,21);
selecionada='';
const top=scope.agruparTopNaturezas([
  {unidade_id:'bope',itens:[{natureza:'A',total:30}]},
  {unidade_id:'choque',itens:[{natureza:'A',total:18}]}
]);
assert.equal(top[0].itens[0].total,30,'Top naturezas do BOPE não pode contar Choque duas vezes');
selecionada='choque';
const topChoque=scope.agruparTopNaturezas([{unidade_id:'choque',itens:[{natureza:'A',total:18}]}]);
assert.equal(topChoque[0].itens[0].total,18);
assert.match(migration,/p_unidade_id is not null and e\.tipo='SUBUNIDADE' and e\.id=o\.subunidade_operacional_id/);
assert.match(migration,/e\.id unidade_id,\s*e\.sigla unidade_sigla/);
assert.match(migration,/p_unidade_id is null then total_administrativo else total_tcos/);
assert.match(migration,/p_unidade_id is null and e\.tipo='SUBUNIDADE' and b\.subunidade_operacional_id=e\.id/);
assert.doesNotMatch(migration,/SECURITY DEFINER/i);
console.log('CPC: métricas e naturezas do BOPE sem dupla contagem; subunidades e filtros isolados validados.');
