'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const box={window:{}};
vm.runInNewContext(read('estatistica-indicadores.js'),box);
vm.runInNewContext(read('mapa-cpc-profissional.js'),box);
vm.runInNewContext(read('mapa-unidade-profissional.js'),box);
const U=box.window.MapaUnidadeProfissional;
const L={
  divIcon:x=>x,
  marker:(latlng,options)=>({latlng,options,bindPopup(v){this.popup=v;return this},bindTooltip(v){this.tooltip=v;return this}}),
  markerClusterGroup:opts=>({opts}),
  layerGroup:()=>({fallback:true})
};
assert.equal(U.classificarOcorrencia({ocorrencia:'ROUBO MAJORADO'},'2BPM').codigo,'ROUBO');
assert.equal(U.classificarOcorrencia({ocorrencia:'FURTO'},'1BPM').codigo,'FURTO');
assert.equal(U.classificarOcorrencia({ocorrencia:'VIOLÊNCIA DOMÉSTICA'},'BOPE').codigo,'VIOLENCIA');
assert.equal(U.classificarOcorrencia({ocorrencia:'SINISTRO DE TRÂNSITO'},'CIPTUR').codigo,'TRANSITO');
assert.equal(U.classificarOcorrencia({ocorrencia:'POLUIÇÃO AMBIENTAL'},'CIPA').codigo,'AMBIENTAL');
assert.equal(U.classificarOcorrencia({cipa_area_tipo:'FAUNA',ocorrencia:'Resgate'},'CIPA').codigo,'FAUNA');
assert.equal(U.classificarOcorrencia({cipa_area_tipo:'EMBARGO',ocorrencia:'Ação ambiental'},'CIPA').codigo,'EMBARGO');
assert.equal(U.classificarAbordagem({tipo_abordagem:'MOTO'}).codigo,'ABORDAGEM_MOTO');
assert.equal(U.classificarAbordagem({tipo_abordagem:'A_PE'}).codigo,'ABORDAGEM_PE');
assert.equal(U.classificarAbordagem({tipo_abordagem:'VEICULO'}).codigo,'ABORDAGEM_VEICULO');
const tema=U.classificarOcorrencia({ocorrencia:'ROUBO'},'2BPM');
assert.equal(U.icone(L,tema,12).iconSize[0],12);
assert.equal(U.icone(L,tema,17).iconSize[0],22);
assert.doesNotMatch(U.icone(L,tema,12).html,/<img/);
const marcador=U.criarMarcador(L,{latitude:2.82,longitude:-60.67,ocorrencia:'ROUBO'},'<b>BO 12</b>',12,'ocorrencia','2BPM');
assert.equal(marcador.options.sieCategoria,'ROUBO');
assert.match(marcador.popup,/2bpm/i);
assert.match(marcador.popup,/BO 12/);
assert.match(marcador.popup,/sieUnidadeTipo/);
assert.match(U.legenda([{ocorrencia:'FURTO'},{ocorrencia:'FURTO'},{ocorrencia:'ROUBO'}],[],'pontos','1BPM'),/Naturezas \/ atividades/);
assert.match(U.legenda([{ocorrencia:'FURTO'}],[],'calor','1BPM'),/Densidade espacial/);
assert.doesNotMatch(U.legenda([{ocorrencia:'FURTO'}],[],'calor','1BPM'),/Naturezas \/ atividades/);
const grupo=U.agregador(L);
assert.equal(grupo.disponivel,true);
assert.equal(grupo.camada.opts.spiderfyOnMaxZoom,true);
const c=grupo.camada.opts.iconCreateFunction({
  getChildCount:()=>3,
  getAllChildMarkers:()=>[{options:{sieCategoria:'ROUBO'}},{options:{sieCategoria:'ROUBO'}},{options:{sieCategoria:'FURTO'}}]
});
assert.match(c.html,/sieCpcClusterBubble misto/);
assert.equal(U.agregador({layerGroup:L.layerGroup}).disponivel,false);
const home=read('index.html'),completo=read('mapa-criminal.html'),tv=read('mapa-tv.html');
for(const [nome,s] of [['Home',home],['Mapa completo',completo],['TV',tv]]){
  assert.match(s,/mapa-unidade-profissional\.js\?v=20261013-v1/,nome+' deve carregar motor temático');
  assert.match(s,/MapaUnidadeProfissional\.criarMarcador/,nome+' deve desenhar marcadores compactos');
  assert.match(s,/MapaUnidadeProfissional\.agregador/,nome+' deve criar agrupador temático');
}
for(const s of [home,completo]){
  assert.match(s,/value="agrupado"/);
  assert.match(s,/MapaUnidadeProfissional\.legenda/);
  assert.match(s,/MapaCpcProfissional\.exportarVisao/);
}
assert.match(home,/if\(!mapaCalor\)/);
assert.match(completo,/if\(calorAtivo\)/);
assert.match(home,/MapaCpcProfissional\.criarMarcador/,'CPC mantém simbologia por unidade');
assert.match(completo,/renderCpc\(ajustarVista\)/,'CPC mantém seu modo independente');
console.log('OK: classificação temática por unidade, três visualizações, clusters e exportação preservada.');
