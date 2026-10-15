const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const js=read('mapa-unidade-profissional.js');
const home=read('index.html'),complete=read('mapa-criminal.html'),css=read('mapa-cpc-profissional.css');
const asset=read('assets/icons/giro-bigtrail-preta.svg');
const window={matchMedia:()=>({matches:true})};vm.runInNewContext(js,{window});
const mod=window.MapaUnidadeProfissional;
function marker(){
 return {events:{},bindPopup(x){this.popup=x;return this},bindTooltip(x){this.tooltip=x;return this},on(ev,fn){this.events[ev]=fn;return this},openPopup(){this.open=true},closePopup(){this.open=false}}
}
const L={divIcon:v=>v,marker:(point,options)=>Object.assign(marker(),{point,options})};
const record={latitude:2.8,longitude:-60.7,unidade_sigla:'GIRO',tipo_abordagem:'A_PE'};
test('motocicleta vetorial preta big trail em tamanho compacto',()=>{
 assert.match(asset,/<svg[^>]+viewBox="0 0 64 48"/);
 assert.match(asset,/<circle/);
 assert.match(asset,/<path/);
 assert.match(asset,/#090b0c/);
 const small=mod.iconeMotoGiro(L,12);
 const detailed=mod.iconeMotoGiro(L,17);
 assert.deepEqual(Array.from(small.iconSize),[18,14]);
 assert.deepEqual(Array.from(detailed.iconSize),[24,18]);
 assert.match(small.html,/giro-bigtrail-preta\.svg/);
 assert.match(css,/\.sieGiroMotoPin/);
});
test('qualquer modalidade de abordagem GIRO usa moto; ocorrências e outras unidades continuam pontos',()=>{
 for(const tipo of ['A_PE','MOTO','VEICULO']){
  const m=mod.criarMarcador(L,{...record,tipo_abordagem:tipo},'<b>3 pessoas</b>',12,'abordagem','GIRO');
  assert.match(m.options.icon.className,/sieGiroMotoPin/);
  assert.equal(m.options.sieAbordagemGiro,true);
  assert.equal(m.options.sieUnidade,'GIRO');
  assert.match(m.popup,/sieCpcPopupDados/);
  assert.match(m.popup,/<b>3 pessoas<\/b>/);
 }
 const normal=mod.criarMarcador(L,{...record,ocorrencia:'ROUBO'},'ocorrencia',12,'ocorrencia','GIRO');
 assert.match(normal.options.icon.className,/sieUnidadePin/);
 assert.equal(normal.options.sieAbordagemGiro,false);
 const other=mod.criarMarcador(L,record,'abordagem',12,'abordagem','CIPA');
 assert.match(other.options.icon.className,/sieUnidadePin/);
});
test('popup em hover ou clique mantém quantidade, data, hora, local e cabeçalho GIRO',()=>{
 const m=mod.criarMarcador(L,record,'<div>3 pessoas, 15/10/2026 14:35, Centro</div>',12,'abordagem','GIRO',{popupAoPassar:true});
 assert.match(m.popup,/3 pessoas, 15\/10\/2026 14:35, Centro/);
 assert.equal(typeof m.events.mouseover,'function');
 assert.equal(typeof m.events.mouseout,'function');
 m.events.mouseover();assert.equal(m.open,true);
 m.events.mouseout();assert.equal(m.open,false);
 // O clique segue sendo responsabilidade padrão do Leaflet; bindPopup permanece configurado.
});
test('a silhueta não desaparece após zoom da home nem do mapa completo',()=>{
 for(const h of [home,complete]){
  assert.match(h,/sieAbordagemGiro\?'abordagem':'ocorrencia'/);
  assert.match(h,/pt\.options\.sieUnidade/);
  assert.match(h,/mapa-unidade-profissional\.js\?v=20261015-bigtrail1/);
  assert.match(h,/mapa-cpc-profissional\.css\?v=20261015-bigtrail1/);
 }
 assert.match(home,/MapaResumoHome\.abordagem\(x\)/);
 assert.match(complete,/pontosProfissionaisUnidade\.push\(MapaUnidadeProfissional\.criarMarcador/);
});
