'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('dashboard-cpc.html'),js=read('cpc-indicadores-dashboard.js');
const ids=['cpcDetalhamentoOrigem','cpcOrigemTitulo','cpcOrigemPeriodo','cpcOrigemAlerta',
  'cpcOrigemBusca','cpcOrigemFonte','cpcOrigemCorpo','cpcOrigemQuantidade','cpcOrigemPagina',
  'cpcOrigemAnterior','cpcOrigemProximo','cpcOrigemExportar','cpcOrigemFechar'];
const elements={};
for(const id of ids){
  const events={};
  elements[id]={
    hidden:false,disabled:false,textContent:'',innerHTML:'',value:'',
    events,addEventListener(t,cb){events[t]=cb},emit(t,value){
      assert.equal(typeof events[t],'function','Event listener '+id+'.'+t);
      events[t]({target:{value},preventDefault(){}});
    },scrollIntoView(){this.scrolled=true}
  };
}
let clicks=[],downloads=[];
const document={
  getElementById:id=>elements[id]||null,
  createElement:()=>({
    set href(v){this._href=v},set download(v){this._download=v},
    click(){clicks.push(this._download)},remove(){}
  }),
  body:{appendChild(){return null}}
};
const scope={
  window:{CpcRastreabilidade:{csv:rows=>(downloads.push(rows),rows.length+'-CSV')}},
  document,console,Blob,Map,Set,Intl,Number,String,
  URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{}},
  setTimeout:cb=>cb()
};
vm.runInNewContext(read('cpc-detalhamento-origem.js'),scope);
const D=scope.window.CpcDetalhamentoOrigem;
const rows=Array.from({length:33},(_,i)=>({
  data:'2026-10-'+String(i%12+1).padStart(2,'0'),
  fonte:i%2?'CIPTUR · autos':'Ocorrência policial',
  referencia:String(58000+i),descricao:i===0?'<img src=x onerror=alert(1)> SINISTRO DE TRÂNSITO':'SINISTRO DE TRÂNSITO',
  quantidade:i%2?1:2,unidade:'ocorrência',criterio:'data_ocorrencia'
}));
D.registrar('CIPTUR',rows,false,'2026-10-01','2026-10-12');
D.abrir('CIPTUR');
assert.equal(elements.cpcDetalhamentoOrigem.hidden,false);
assert.equal(elements.cpcOrigemTitulo.textContent,'Registros de origem — CIPTUR');
assert.equal(elements.cpcDetalhamentoOrigem.scrolled,true);
assert.match(elements.cpcOrigemQuantidade.textContent,/33 registro/);
assert.equal((elements.cpcOrigemCorpo.innerHTML.match(/<tr>/g)||[]).length,12,'12 linhas por página');
assert.match(elements.cpcOrigemCorpo.innerHTML,/&lt;img src=x onerror=alert\(1\)&gt;/,'dados escapados');
assert.doesNotMatch(elements.cpcOrigemCorpo.innerHTML,/<img src=x/,'conteúdo do usuário não pode virar HTML');
assert.equal(elements.cpcOrigemProximo.disabled,false);
elements.cpcOrigemProximo.emit('click');
assert.equal((elements.cpcOrigemCorpo.innerHTML.match(/<tr>/g)||[]).length,12);
elements.cpcOrigemProximo.emit('click');
assert.equal((elements.cpcOrigemCorpo.innerHTML.match(/<tr>/g)||[]).length,9);
assert.equal(elements.cpcOrigemPagina.textContent,'Página 3 de 3');
assert.equal(elements.cpcOrigemProximo.disabled,true);
elements.cpcOrigemAnterior.emit('click');
assert.equal(elements.cpcOrigemPagina.textContent,'Página 2 de 3');
elements.cpcOrigemBusca.emit('input','transito');
assert.equal(elements.cpcOrigemQuantidade.textContent.startsWith('33 registro'),true,'busca ignora acentos');
elements.cpcOrigemBusca.emit('input','58000');
assert.equal(elements.cpcOrigemPagina.textContent,'Página 1 de 1');
assert.equal((elements.cpcOrigemCorpo.innerHTML.match(/<tr>/g)||[]).length,1);
elements.cpcOrigemExportar.emit('click');
assert.equal(downloads.at(-1).length,1,'CSV respeita busca e não é limitado à página');
assert.equal(clicks.at(-1),'sie-cpc-origem-ciptur-20261001-a-20261012.csv');
elements.cpcOrigemBusca.emit('input','');
elements.cpcOrigemFonte.emit('change','Ocorrência policial');
assert.equal(D.linhasAtuais().length,17);
elements.cpcOrigemExportar.emit('click');
assert.equal(downloads.at(-1).length,17,'exporta TODAS as linhas da fonte filtrada, não apenas as 12 visíveis');
D.registrar('CIPA',[],true,'2026-10-01','2026-10-12');
D.abrir('CIPA');
assert.equal(elements.cpcOrigemAlerta.hidden,false,'fonte parcial identificada');
assert.equal(elements.cpcOrigemExportar.disabled,true);
D.reiniciar();
assert.equal(elements.cpcDetalhamentoOrigem.hidden,true,'mudança de período fecha dados da consulta anterior');
D.abrir('CIPTUR');
assert.equal(elements.cpcDetalhamentoOrigem.hidden,true,'não reabre dados de escopo antigo');
for(const id of ids)assert.match(html,new RegExp('id="'+id+'"'),id+' presente no layout');
assert.match(html,/cpc-detalhamento-origem\.js\?v=20261012-v1/);
assert.match(html,/cpc-indicadores-dashboard\.js\?v=20261012-origem-painel1/);
assert.match(js,/CpcDetalhamentoOrigem\.reiniciar\(\)/);
assert.match(js,/data-abrir-origem/);
assert.match(js,/CpcDetalhamentoOrigem\.registrar/);
assert.doesNotMatch(js,/<table class="cpcOrigemTabela"/,'tabelas devem ficar fora dos cartões');
console.log('OK: detalhamento amplo, pesquisa, filtros, 12 linhas por página, CSV completo, escopo e dados escapados.');
