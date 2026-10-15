const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const home=read('index.html');
const cpc=read('mapa-cpc-profissional.js'),unidade=read('mapa-unidade-profissional.js');
const resumo=read('mapa-resumo-home.js'),interacao=read('mapa-interacao-home.js');

test('mapa da home é mais largo, sem aumentar sua altura, e mantém responsividade',()=>{
 assert.match(home,/\.mapPanel\{margin-top:18px;width:min\(1400px,calc\(100vw - 36px\)\)/);
 assert.match(home,/#mapa\{height:390px/);
 assert.match(home,/@media\(max-width:850px\)\{\.mapPanel\{width:100%/);
 assert.match(home,/mapaInteracaoDica/);
 assert.match(home,/scrollWheelZoom:false,dragging:false/);
 assert.match(home,/MapaInteracaoHome\.instalar\(mapa/);
});
test('scroll da página não ativa zoom; clique habilita zoom+drag; clique fora ou Escape desativa',()=>{
 const callbacks={},container={classList:{toggle:()=>{}},contains:target=>target==='mapa'};
 const document={addEventListener:(ev,fn)=>callbacks['doc_'+ev]=fn};
 container.addEventListener=(ev,fn)=>callbacks['map_'+ev]=fn;
 const mapa={getContainer:()=>container,dragging:{enable(){mapa.drag=true},disable(){mapa.drag=false}},scrollWheelZoom:{enable(){mapa.wheel=true},disable(){mapa.wheel=false}}};
 const context={window:{document}};vm.runInNewContext(interacao,context);
 const dica={textContent:''};
 const controller=context.window.MapaInteracaoHome.instalar(mapa,{dica});
 assert.equal(mapa.wheel,false);assert.equal(mapa.drag,false);
 assert.match(dica.textContent,/Clique no mapa/);
 callbacks.map_click();assert.equal(mapa.wheel,true);assert.equal(mapa.drag,true);
 callbacks.doc_pointerdown({target:'mapa'});assert.equal(mapa.wheel,true);
 callbacks.doc_keydown({key:'Escape'});assert.equal(mapa.wheel,false);assert.equal(mapa.drag,false);
 callbacks.map_click();callbacks.doc_pointerdown({target:'fora'});assert.equal(mapa.wheel,false);
 assert.equal(controller.estaAtivo(),false);
});
test('popups exibem natureza, BO, data/hora, comandante; abordagens mostram modalidade e quantidade sem inventar BO',()=>{
 const context={window:{}};vm.runInNewContext(resumo,context);
 const f=context.window.MapaResumoHome;
 const o=f.ocorrencia({ocorrencia:'FURTO',numero_bo:'2026/123',data_ocorrencia:'2026-10-15',hora_inicial:'14:35:00',comandante:'3º SGT PM LIMA'});
 for(const term of ['FURTO','2026/123','15/10/2026','14:35','3º SGT PM LIMA'])assert.ok(o.includes(term),term);
 assert.ok(!o.includes('hora_final'));
 const a=f.abordagem({tipo_abordagem:'MOTO',quantidade_pessoas:3,registrado_em:'2026-10-15T17:00:00.000Z',bairro:'Centro'});
 for(const term of ['motocicleta','3 pessoa(s)','Centro','15/10/2026'])assert.ok(a.includes(term),term);
 assert.ok(!a.includes('<b>BO</b>'));
 const safe=f.ocorrencia({ocorrencia:'<img src=x onerror=alert(1)>',comandante:'<script>alert(1)</script>'});
 assert.ok(!safe.includes('<img'));assert.ok(!safe.includes('<script>'));assert.ok(safe.includes('&lt;script&gt;'));
});
test('hover de marcador abre popup e mouseout fecha; comportamento antigo permanece no mapa analítico',()=>{
 const context={window:{matchMedia:()=>({matches:true})}};
 vm.runInNewContext(cpc,context);vm.runInNewContext(unidade,context);
 const L={divIcon:args=>args,marker:(coord,options)=>{
  const m={coord,options,events:{},tooltip:false,popupHtml:'',
    bindPopup(html){m.popupHtml=html;return m},
    bindTooltip(){m.tooltip=true;return m},
    on(ev,fn){m.events[ev]=fn;return m},
    openPopup(){m.open=true},closePopup(){m.open=false}
  };
  return m;
 }};
 const registro={latitude:2.82,longitude:-60.67,unidade_sigla:'GIRO',ocorrencia:'FURTO'};
 const markerCpc=context.window.MapaCpcProfissional.criarMarcador(L,registro,'BO TESTE',12,{popupAoPassar:true});
 assert.equal(typeof markerCpc.events.mouseover,'function');
 markerCpc.events.mouseover();assert.equal(markerCpc.open,true);
 markerCpc.events.mouseout();assert.equal(markerCpc.open,false);
 assert.equal(markerCpc.tooltip,false);
 assert.match(markerCpc.popupHtml,/sieCpcPopupHeader/);
 const markerUnidade=context.window.MapaUnidadeProfissional.criarMarcador(L,registro,'BO TESTE',12,'ocorrencia','GIRO',{popupAoPassar:true});
 assert.equal(typeof markerUnidade.events.mouseover,'function');
 assert.equal(markerUnidade.tooltip,false);
 const padrao=context.window.MapaCpcProfissional.criarMarcador(L,registro,'BO TESTE',12);
 assert.equal(padrao.tooltip,true);
 assert.equal(padrao.events.mouseover,undefined);
});
test('mapa inicial usa corretamente builders distintos de CPC e unidades, sem corromper agrupamento',()=>{
 const start=home.indexOf('function renderizarMapa(ajustarVista=true){'),end=home.indexOf('mapa.on("zoomend"',start);
 const render=home.slice(start,end);
 const unidadeBody=render.slice(0,render.indexOf('  }else{\n    // A densidade'));
 const cpcBody=render.slice(render.indexOf('  }else{\n    // A densidade'));
 assert.equal((unidadeBody.match(/marcadoresUnidadeAtuais\.push/g)||[]).length,2);
 assert.equal((unidadeBody.match(/marcadoresCpcAtuais\.push/g)||[]).length,0);
 assert.equal((cpcBody.match(/marcadoresCpcAtuais\.push/g)||[]).length,2);
 assert.equal((cpcBody.match(/marcadoresUnidadeAtuais\.push/g)||[]).length,0);
 assert.equal((render.match(/popupAoPassar:true/g)||[]).length,4);
 assert.match(render,/camadaAgrupadaUnidade\.addTo\(mapa\)/);
 assert.match(render,/camadaAgrupadaCpc\.addTo\(mapa\)/);
 assert.match(render,/camadaCalor\.setLatLngs/);
});
test('metadados complementares são lidos sob RLS e sem alterar os RPCs territoriais',()=>{
 assert.match(home,/\.from\('ocorrencias'\)\.select\('id,numero_bo,comandante,hora_inicial'\)\.in\('id',lote\)/);
 assert.match(home,/enriquecerOcorrenciasMapa\(r\.data\|\|\[\]\)/);
 assert.match(home,/obter_mapa_cpc_territorial/);
 assert.match(home,/obter_ocorrencias_mapa/);
 assert.match(home,/if\(requisicao!==requisicaoMapaAtual\)return;/);
});
test('javascript inline do index mantém sintaxe válida',()=>{
 const snippets=[...home.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(x=>x.trim());
 assert.ok(snippets.length>=1);
 for(const snippet of snippets)assert.doesNotThrow(()=>new Function(snippet));
 for(const js of [cpc,unidade,resumo,interacao])assert.doesNotThrow(()=>new Function(js));
});
