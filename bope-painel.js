/* Navegação estatística de subunidades BOPE; não altera unidade de trabalho nem permissões. */
(function(root){
  'use strict';
  const unidades=[
    {sigla:'GATE',nome:'GATE',curta:'GATE',simbolo:'✥',cor:'#8e303c'},
    {sigla:'CHOQUE',nome:'Choque',curta:'CH',simbolo:'◈',cor:'#95632a'},
    {sigla:'CANIL',nome:'Canil',curta:'K9',simbolo:'♞',cor:'#246b63'},
    {sigla:'FORCA_TATICA',nome:'Força Tática',curta:'FT',simbolo:'✦',cor:'#23568f'}
  ];
  function normalizar(s){return String(s||'').trim().toUpperCase()}
  function unidade(sigla){return unidades.find(u=>u.sigla===normalizar(sigla))||null}
  function filtro(contexto,search){
    if(normalizar(contexto)!=='BOPE')return null;
    return unidade(new URLSearchParams(search||'').get('bope_subunidade'));
  }
  function emEscopo(registro,sub){
    return !sub||normalizar(registro?.subunidade_operacional_sigla)===sub.sigla;
  }
  function filtrar(registros,sub){return sub?(registros||[]).filter(x=>emEscopo(x,sub)):(registros||[])}
  function url(destino,sub){
    if(!sub)return destino;
    const [base,hash='']=destino.split('#');
    const [caminho,query='']=base.split('?');
    const p=new URLSearchParams(query);
    p.set('bope_subunidade',sub.sigla);
    if(caminho==='dashboard.html')p.set('subunidade_bope',sub.sigla);
    if(caminho==='relatorio.html')p.set('subunidade',sub.sigla);
    return caminho+'?'+p.toString()+(hash?'#'+hash:'');
  }
  async function idsAutorizados(db,sub,intervalo,bopeId){
    if(!sub||!bopeId)return null;
    const u=await db.from('unidades').select('id').eq('sigla',sub.sigla)
      .eq('parent_id',bopeId).eq('ativo',true).maybeSingle();
    if(u.error)throw u.error;
    if(!u.data?.id)throw new Error('Subunidade não pertence ao BOPE ativo.');
    const resultado=new Set(),tam=800;
    for(let pagina=0;pagina<250;pagina++){
      let q=db.from('ocorrencias').select('id').eq('subunidade_operacional_id',u.data.id)
        .order('id',{ascending:true}).range(pagina*tam,(pagina+1)*tam-1);
      if(intervalo?.[0])q=q.gte('data_ocorrencia',intervalo[0]);
      if(intervalo?.[1])q=q.lte('data_ocorrencia',intervalo[1]);
      const resp=await q;
      if(resp.error)throw resp.error;
      const lote=resp.data||[];
      lote.forEach(x=>resultado.add(String(x.id)));
      if(lote.length<tam)return resultado;
    }
    throw new Error('Muitos registros para a consulta da subunidade. Reduza o período.');
  }
  root.BopePainel=Object.freeze({unidades,unidade,filtro,filtrar,emEscopo,url,idsAutorizados});
})(typeof window!=='undefined'?window:globalThis);
