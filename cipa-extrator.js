/* Extrator determinístico dos anexos ambientais CIPA.
 * Não transmite PDF nem dados pessoais para serviços externos.
 * Os documentos são reconhecidos apenas quando o título inicia uma linha.
 */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  root.CipaExtrator=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  const normal=s=>String(s||'').replace(/\uFB01/g,'fi').replace(/\uFB02/g,'fl').replace(/\u00a0/g,' ').replace(/\r/g,'');
  const decimal=s=>{const t=String(s||'').trim().replace(/\./g,'').replace(',','.');const n=Number(t);return Number.isFinite(n)?n:null;};
  const iso=s=>{const m=String(s||'').match(/(\d{2})\/(\d{2})\/(20\d{2})/);return m?m[3]+'-'+m[2]+'-'+m[1]:'';};
  const normLabel=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const header= /^\s*(AUTO DE INFRA[ÇC][ÃA]O|TERMO DE EMBARGO\s*\/\s*INTERDI[ÇC][ÃA]O)\s*(?:N[º°o.]*)?\s*[:#-]?\s*(\d{8,12})\s*$/gmi;
  function documentos(texto){
    const t=normal(texto),matches=[...t.matchAll(header)].map(m=>({tipo:/^AUTO/i.test(m[1])?'auto':'termo',numero:m[2],inicio:m.index}));
    return matches.map((h,i)=>({...h,corpo:t.slice(h.inicio,matches[i+1]?.inicio??t.length)}));
  }
  function campoApos(bloco,rotulo,maxLinhas=7){
    const linhas=String(bloco||'').split('\n');
    const i=linhas.findIndex(l=>rotulo.test(l));
    if(i<0)return '';
    const mesma=linhas[i].replace(rotulo,'').trim();
    if(mesma&&!/^\(\d{2}\)/.test(mesma))return mesma;
    for(let j=i+1;j<Math.min(linhas.length,i+maxLinhas+1);j++){
      const l=linhas[j].trim();
      if(!l||/^\(\d{2}\)\s/.test(l)||/^\(\d{2}\)/.test(l)||/^(?:Fls:|Visto:)/i.test(l))continue;
      return l;
    }
    return '';
  }
  function secao(corpo,inicio,fim){
    const m=inicio.exec(corpo);if(!m)return '';
    const start=m.index+m[0].length;
    const tail=corpo.slice(start);
    const match=fim.exec(tail);
    return (match?tail.slice(0,match.index):tail).trim();
  }
  function artigos(corpo){
    const d=corpo.match(/Legisla[çc][ãa]o:\s*Decreto Federal\s*6[.]514\/(?:08|2008)[\s\S]{0,130}?Artigo:\s*Art[.]?\s*(\d+[A-Za-zº°-]*)/i);
    const l=corpo.match(/Legisla[çc][ãa]o:\s*Lei Federal\s*9[.]605\/(?:98|1998)[\s\S]{0,130}?Artigo:\s*Art[.]?\s*(\d+[A-Za-zº°-]*)/i);
    return {art_dec_6514:d?d[1]:'',art_lei_9605:l?l[1]:''};
  }
  function dataAutuacao(corpo){
    const fragmento=secao(corpo,/\((?:17|18)\)\s*DATA DA AUTUA[ÇC][ÃA]O/i,/\((?:18|19)\)\s*DATA DO VENCIMENTO/i);
    const m=fragmento.match(/\b\d{2}\/\d{2}\/20\d{2}\b/);
    return iso(m?.[0]);
  }
  function sancao(corpo){
    const cabecalho=corpo.split(/\(01\)\s*CPF/i)[0];
    const marcadas=[...cabecalho.matchAll(/[☒☑■✓X]\s*(Multa Simples|Embargo|Advert[êe]ncia|Apreens[ãa]o)/gi)].map(x=>normLabel(x[1]));
    if(marcadas.length)return marcadas.join(' E ');
    return '';
  }
  function lerAuto(doc){
    const b=doc.corpo;
    const desc=secao(b,/\(12\)\s*DESCRI[ÇC][ÃA]O DA INFRA[ÇC][ÃA]O/i,/\(13\)\s*DISPOSITIVOS LEGAIS/i);
    const area=secao(b,/\(14\)\s*[ÁA]REA\b/i,/\(15\)\s*VALOR DA MULTA/i);
    const multa=secao(b,/\(15\)\s*VALOR DA MULTA/i,/\(16\)\s*DESCRI[ÇC][ÃA]O/i);
    const a=area.match(/([\d.,]+)\s*(?:Hectares|ha\b)/i);
    const v=multa.match(/R\$\s*([\d.,]+)\b/i);
    const nome=campoApos(b,/\(03\)\s*NOME DO AUTUADO/i);
    return {
      numero:doc.numero,
      data_autuacao:dataAutuacao(b),
      autuado:nome,
      tipo_sancao:sancao(b),
      descricao_infracao:desc.replace(/\s+/g,' ').trim(),
      ...artigos(b),
      valor_multa:v?decimal(v[1]):'',
      area_embargada_ha:a?decimal(a[1]):'',
      fiscal_ambiental:''
    };
  }
  function lerTermo(doc){
    const b=doc.corpo;
    const vinc=secao(b,/\(15\)\s*AUTO DE INFRA[ÇC][ÃA]O ORIGIN[ÁA]RIO/i,/\((?:16|17)\)\s*(?:HORA|DATA) DA AUTUA[ÇC][ÃA]O/i);
    const numeroOrigem=(vinc.match(/\b\d{8,12}\b/)||[])[0]||'';
    const fundamentacao=artigos(b);
    const desc=secao(b,/\(14\)\s*DESCRI[ÇC][ÃA]O DAS DEMAIS SAN[ÇC][ÕO]ES/i,/\(15\)\s*AUTO DE INFRA[ÇC][ÃA]O ORIGIN[ÁA]RIO/i);
    return {
      numero:doc.numero,
      data_embargo: dataAutuacao(b) || iso((b.match(/\(17\)\s*DATA DA AUTUA[ÇC][ÃA]O[\s\S]{0,110}?(\d{2}\/\d{2}\/20\d{2})/i)||[])[1]),
      auto_infracao_originario:numeroOrigem,
      area_embargada_ha:'',
      descricao:[fundamentacao.art_dec_6514&&'Art. '+fundamentacao.art_dec_6514+' do Decreto 6.514/08',fundamentacao.art_lei_9605&&'Art. '+fundamentacao.art_lei_9605+' da Lei 9.605/98',desc.replace(/\s+/g,' ').trim()].filter(Boolean).join('; ')
    };
  }
  function extrair(texto){
    const docs=documentos(texto);
    const autos=docs.filter(d=>d.tipo==='auto').map(lerAuto);
    const embargos=docs.filter(d=>d.tipo==='termo').map(lerTermo);
    const mapa=new Map(autos.map(a=>[a.numero,a]));
    embargos.forEach(t=>{
      const orig=mapa.get(t.auto_infracao_originario);
      if(orig && orig.area_embargada_ha!=='' && orig.area_embargada_ha!==null) t.area_embargada_ha=orig.area_embargada_ha;
    });
    return {
      autos:[...new Map(autos.map(x=>[x.numero,x])).values()],
      embargos:[...new Map(embargos.map(x=>[x.numero,x])).values()],
      documentosEncontrados:docs.length
    };
  }
  return {documentos,extrair,lerAuto,lerTermo};
});
