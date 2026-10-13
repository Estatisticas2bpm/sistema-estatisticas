'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const box={window:{}};
vm.runInNewContext(read('estatistica-indicadores.js'),box);
vm.runInNewContext(read('mapa-cpc-profissional.js'),box);
const M=box.window.MapaCpcProfissional;
const stub={
  divIcon:o=>o,
  marker:(coord,opts)=>({
    coord,options:opts,
    bindPopup(html){this.popup=html;return this},
    bindTooltip(msg){this.tooltip=msg;return this}
  }),
  markerClusterGroup:options=>({options}),
  layerGroup:()=>({layer:true})
};
assert.equal(M.sigla('2º BPM'),'2BPM');
assert.equal(M.sigla('CIPTUR'),'CIPTUR');
assert.equal(M.nome('1BPM'),'1º BPM');
assert.equal(M.abreviacao('CIPTUR'),'CT');
assert.equal(M.contagens([{unidade_sigla:'1BPM'},{unidade_sigla:'1BPM'},{unidade_sigla:'CIPTUR'}]).CIPTUR,1);
const pequeno=M.iconePonto(stub,'CIPTUR',12);
assert.equal(pequeno.iconSize[0],12);
assert.ok(!pequeno.html.includes('<img'),'Brasão não pode poluir o ponto');
assert.ok(!pequeno.html.includes('CT'));
const zoomalto=M.iconePonto(stub,'CIPTUR',17);
assert.equal(zoomalto.iconSize[0],22);
assert.ok(zoomalto.html.includes('CT'));
const marcador=M.criarMarcador(stub,{latitude:2.82,longitude:-60.67,unidade_sigla:'CIPTUR'},'<b>Sinistro</b>',12);
assert.equal(marcador.options.unidadeSieCpc,'CIPTUR');
assert.ok(marcador.popup.includes('ciptur-brasao.svg'));
assert.ok(marcador.popup.includes('Sinistro'));
assert.equal(marcador.tooltip,'CIPTUR');
const legendaPontos=M.legenda([{unidade_sigla:'CIPTUR'},{unidade_sigla:'CIPTUR'},{unidade_sigla:'2BPM'}],{visual:'agrupado',abordagens:0});
assert.match(legendaPontos,/data-sie-unidade="CIPTUR"/);
assert.match(legendaPontos,/Unidades responsáveis/);
assert.match(legendaPontos,/Clique nos grupos/);
const legendaCalor=M.legenda([{unidade_sigla:'CIPTUR'}],{visual:'calor'});
assert.match(legendaCalor,/Densidade de registros/);
assert.doesNotMatch(legendaCalor,/data-sie-unidade/);
const grupo=M.agrupador(stub);
assert.equal(grupo.disponivel,true);
assert.equal(grupo.camada.options.spiderfyOnMaxZoom,true);
const cluster={
  getChildCount:()=>3,
  getAllChildMarkers:()=>[
    {options:{unidadeSieCpc:'2BPM'}},
    {options:{unidadeSieCpc:'2BPM'}},
    {options:{unidadeSieCpc:'CIPTUR'}}
  ]
};
const icon=grupo.camada.options.iconCreateFunction(cluster);
assert.match(icon.html,/sieCpcClusterBubble misto/);
assert.match(icon.html,/>3<\/span>/);
assert.equal(M.agrupador({layerGroup:stub.layerGroup}).disponivel,false,'Falha da CDN não derruba o mapa');
for(const arquivo of ['index.html','mapa-criminal.html']){
 const html=read(arquivo);
 assert.match(html,/leaflet\.markercluster@1\.5\.3/);
 assert.match(html,/mapa-cpc-profissional\.css/);
 assert.match(html,/value="agrupado"/);
 assert.match(html,/MapaCpcProfissional\.exportarVisao/);
 assert.match(html,/MapaCpcProfissional\.legenda/);
 assert.match(html,/MapaCpcProfissional\.criarMarcador/);
 assert.match(html,/mapaCalor|\$\('visual'\)\.value==='calor'/);
}
assert.match(read('index.html'),/if\(!mapaCalor\)/,'No calor não desenhar pontos CPC');
assert.match(read('mapa-criminal.html'),/if\(\$\('visual'\)\.value==='calor'\)/,'Calor separado dos marcadores');
console.log('OK: pontos 12 px, sigla no zoom, clusters mistos, brasão no popup, mapa de calor isolado, legenda e CSV.');
