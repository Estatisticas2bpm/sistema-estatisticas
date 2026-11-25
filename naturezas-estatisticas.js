/* Naturezas estatísticas: uma ocorrência por categoria, sem alterar o PPE. */
(function(root){
  'use strict';
  function chave(v){return String(v||'').trim().replace(/\s+/g,' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();}
  function categoria(v){
    var original=String(v||'').trim().replace(/\s+/g,' ');
    var k=chave(original).replace(/^\d+\s*[:—–-]\s*/,'');
    if(!k||['NI','N/I','N','NA','NAO INFORMADO'].includes(k))return '';
    if(/^(HOMICIDIO)(?:$|\s+(?:SIMPLES|QUALIFICADO)\b|\s*\(ART\.)/.test(k)&&!/\b(TENTATIVA|CULPOSO|CULPOSA)\b/.test(k))return 'HOMICÍDIO';
    if(/^(ENCONTRO|ACHADO) DE CADAVER$/.test(k))return 'ENCONTRO DE CADÁVER';
    if(/\bMARIA DA PENHA\b|\bVIOLENCIA DOMESTICA\b/.test(k))return 'MARIA DA PENHA / VIOLÊNCIA DOMÉSTICA';
    if(/^(SINISTRO|ACIDENTE)\s+DE\s+TRANSITO\b/.test(k))return 'SINISTRO DE TRÂNSITO';
    return original;
  }
  function nomes(o){
    var itens=Array.isArray(o&&o.naturezas_itens)?o.naturezas_itens:[];
    var fontes=[o&&(o.ocorrencia||(!itens.length?o.crime:''))].concat(itens.map(function(n){return typeof n==='string'?n:n&&(n.nome||n.tipo);}));
    var mapa=new Map();
    fontes.forEach(function(v){var n=categoria(v),k=chave(n);if(n&&!mapa.has(k))mapa.set(k,n);});
    return Array.from(mapa.values());
  }
  function rank(registros,limite){
    var grupos=new Map(), vistos=new Map();
    (registros||[]).forEach(function(o){
      var id=o.id==null?'':String(o.id), keys=id?(vistos.get(id)||new Set()):new Set();
      nomes(o).forEach(function(n){var k=chave(n);if(keys.has(k))return;keys.add(k);var g=grupos.get(k);if(g)g[1]++;else grupos.set(k,[n,1]);});
      if(id)vistos.set(id,keys);
    });
    return Array.from(grupos.values()).sort(function(a,b){return b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR');}).slice(0,limite==null?999:limite);
  }
  function contem(o,n){return nomes(o).some(function(v){return chave(v)===chave(categoria(n));});}
  // Texto livre: preservar buscas parciais; o termo consolidado HOMICÍDIO
  // não deve trazer tentativas ou homicídios culposos.
  function busca(o,termo){
    var k=chave(termo);
    if(!k)return true;
    if(k==='HOMICIDIO'||k==='ENCONTRO DE CADAVER'||k==='ACHADO DE CADAVER')return contem(o,termo);
    var itens=Array.isArray(o&&o.naturezas_itens)?o.naturezas_itens:[];
    var brutos=[o&&(o.ocorrencia||(!itens.length?o.crime:''))].concat(itens.map(function(n){return typeof n==='string'?n:n&&(n.nome||n.tipo);}));
    return brutos.concat(nomes(o)).some(function(n){return chave(n).includes(k);});
  }
  var api={chave:chave,categoria:categoria,nomes:nomes,rank:rank,contem:contem,busca:busca};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.SieNaturezasEstatisticas=api;
})(typeof globalThis!=='undefined'?globalThis:this);
