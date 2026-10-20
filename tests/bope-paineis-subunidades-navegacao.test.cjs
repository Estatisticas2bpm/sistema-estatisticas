'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const home=read('index.html'),js=read('bope-painel.js'),dash=read('dashboard.html'),
  mapa=read('mapa-criminal.html'),temporal=read('analise-temporal.html'),
  consulta=read('consulta.html'),relatorio=read('relatorio.html');
const rootScope={};
new Function('window',js)(rootScope);
const api=rootScope.BopePainel;
assert.ok(api,'Helper de subunidades deve inicializar');
assert.deepEqual(api.unidades.map(u=>u.sigla),['GATE','CHOQUE','CANIL','FORCA_TATICA']);
const brasoes={
  GATE:'assets/logos/bope-subunidades/gate.jpeg',
  CHOQUE:'assets/logos/bope-subunidades/choque.jpeg',
  CANIL:'assets/logos/bope-subunidades/canil.png',
  FORCA_TATICA:'assets/logos/bope-subunidades/forca-tatica.jpeg'
};
for(const unidade of api.unidades){
 assert.equal(unidade.brasao,brasoes[unidade.sigla],unidade.sigla+': caminho do brasão incorreto');
 assert.ok(fs.existsSync(path.join(root,unidade.brasao)),unidade.sigla+': arquivo do brasão ausente');
 assert.ok(fs.statSync(path.join(root,unidade.brasao)).size>5_000,unidade.sigla+': arquivo do brasão parece inválido');
}
assert.equal(api.filtro('1BPM','?bope_subunidade=GATE'),null,'Filtro não muda escopo do 1BPM');
assert.equal(api.filtro('CPC','?bope_subunidade=GATE'),null,'Filtro não habilita contexto CPC');
assert.equal(api.filtro('BOPE','?bope_subunidade=OUTRA'),null,'Rejeitar subunidades desconhecidas');
assert.equal(api.filtro('BOPE','?bope_subunidade=CHOQUE').sigla,'CHOQUE');
const sub=api.unidade('FORCA_TATICA');
assert.equal(api.url('index.html',sub),'index.html?bope_subunidade=FORCA_TATICA');
assert.ok(api.url('dashboard.html?v=abc',sub).includes('subunidade_bope=FORCA_TATICA'));
assert.ok(api.url('relatorio.html',sub).includes('subunidade=FORCA_TATICA'));
assert.equal(api.url('consulta.html?q=BO123',null),'consulta.html?q=BO123');
const registros=[{id:1,subunidade_operacional_sigla:'CHOQUE'},{id:2,subunidade_operacional_sigla:'GATE'},
  {id:3,subunidade_operacional_sigla:'FORCA_TATICA'},{id:4,subunidade_operacional_sigla:'CANIL'}];
assert.deepEqual(api.filtrar(registros,api.unidade('CANIL')).map(x=>x.id),[4]);
assert.equal(api.filtrar(registros,null).length,4);
for(const nome of ['bopeSubPainel','bopeSubCards','bopeVoltarConsolidado'])assert.ok(home.includes('id="'+nome+'"'));
assert.ok(home.indexOf('id="bopeSubPainel"')<home.indexOf('id="total"'),'Cartões precedem KPIs');
assert.match(home,/class="bopeEmblema"><img src="'\+escHome\(un\.brasao\)\+'" alt="Brasão institucional de /);
assert.match(home,/\.bopeSubCard \.bopeEmblema img\{[^}]*object-fit:contain/);
assert.match(home,/renderCardsSubunidadesBope\(completos\)/);
assert.match(home,/var rpcOcc=modoBope\?"obter_dados_dashboard_territorial"/);
assert.match(home,/window\.BopePainel\.filtrar\(d,bopeSubAtiva\)/);
assert.match(home,/idsAutorizados\(db,bopeSubAtiva,p,bopeIdUnidadeAtiva\)/);
assert.match(home,/window\.BopePainel\.url\(base,bopeSubAtiva\)/);
assert.match(dash,/if\(selecionada\)\$\('subunidadeBope'\)\.value=selecionada\.sigla/);
assert.match(dash,/Dashboard Operacional — '\+sub\.nome/);
assert.match(dash,/&subunidade='\+encodeURIComponent/);
assert.match(relatorio,/const filtro=window\.BopePainel\?\.filtro\('BOPE',location\.search\)/);
assert.match(mapa,/base=window\.BopePainel\.filtrar\(r\.data\|\|\[\],bopeSubMapa\)/);
assert.match(temporal,/bopeSubTemporal\?'obter_dados_dashboard_territorial'/);
assert.match(temporal,/window\.BopePainel\.emEscopo\(x,bopeSubTemporal\)/);
assert.match(consulta,/idsAutorizados\(banco,bopeSubConsulta,null,bopeUnidadeConsulta\)/);
for(const [name,html] of Object.entries({home,dash,mapa,temporal,consulta,relatorio})){
 assert.match(html,/bope-painel\.js\?v=/,name+': helper compartilhado');
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new Function(m[1]);
}
console.log('PASS: cartões BOPE, escopo individual, mapa, dashboard, relatório, consulta e análise temporal.');
