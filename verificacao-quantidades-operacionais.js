/* SIE-CPC | alerta não destrutivo de quantidades suspeitas na revisão de BO/PDF.
 * Números de modelo e calibres não devem virar contagens de materiais.
 * Não substitui a conferência do policial; não altera dados automaticamente. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ValidacaoQuantidadesOperacionais=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const qtd=v=>{
    if(v===null||v===undefined||v==='')return 0;
    const x=Number(v);return Number.isFinite(x)&&x>0?x:0;
  };
  const texto=v=>String(v??'').trim();
  function numerosModeloVeiculo(descricao){
    const fonte=texto(descricao).toUpperCase(),encontrados=[];
    const marcas=[
      /\b(?:CG|TITAN|FAN|START|BIZ|XTZ|LANDER|GOL)[\s\/-]*(1000|250|160|150|125|100)(?!\d)/g,
      /\b(?:VW[\s\/-]*GOL|HONDA[\s\/-]*CG|HONDA[\s\/-]*BIZ)\s*(1000|250|160|150|125|100)(?!\d)/g
    ];
    for(const re of marcas){
      for(const m of fonte.matchAll(re))encontrados.push(Number(m[1]));
    }
    return [...new Set(encontrados)];
  }
  function numerosCalibre(descricao){
    const fonte=texto(descricao).toUpperCase(),encontrados=[];
    const padroes=[
      /\.([1-9]\d{1,2})(?!\d)/g,
      /\b([1-9]\d{0,2})\s*MM\b/g,
      /\bCAL(?:IBRE)?\.?\s*\.?([1-9]\d{0,2})(?!\d)/g
    ];
    for(const re of padroes)for(const m of fonte.matchAll(re))encontrados.push(Number(m[1]));
    return [...new Set(encontrados)];
  }
  function verificar(registro){
    const alertas=[],recuperados=Array.isArray(registro?.itens_recuperados)?registro.itens_recuperados:[],
      armas=Array.isArray(registro?.armas_itens)?registro.armas_itens:[];
    for(const item of recuperados){
      const quantidade=qtd(item?.quantidade);
      if(quantidade>=10&&numerosModeloVeiculo(item?.detalhes).includes(quantidade)){
        alertas.push('Veículo: quantidade '+quantidade+' coincide com número de modelo em "'+texto(item.detalhes).slice(0,110)+'".');
      }
    }
    for(const item of armas){
      const quantidade=qtd(item?.quantidade);
      if(quantidade>=9&&numerosCalibre(item?.detalhes).includes(quantidade)){
        alertas.push('Arma/simulacro: quantidade '+quantidade+' coincide com calibre em "'+texto(item.detalhes).slice(0,110)+'".');
      }
    }
    // Registro legado/manual que preencheu apenas o agregado, sem item estruturado.
    if(!recuperados.length&&qtd(registro?.veiculos_recuperados)>=100&&
       numerosModeloVeiculo(registro?.materialidade).includes(qtd(registro?.veiculos_recuperados))){
      alertas.push('Veículos recuperados: confira se a quantidade é número de modelo.');
    }
    if(!armas.length&&qtd(registro?.quantidade_armas)>=9&&
       numerosCalibre(registro?.armas||registro?.materialidade).includes(qtd(registro?.quantidade_armas))){
      alertas.push('Armas: confira se a quantidade é calibre.');
    }
    return alertas;
  }
  return Object.freeze({verificar});
});
