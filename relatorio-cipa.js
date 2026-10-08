(function(){
  const q=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])),n=v=>Number(v)||0;
  const moeda=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const ha=v=>Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:2})+' ha';
  const rank=(a,get,limit=20)=>{const m={};a.forEach(x=>{const v=typeof get==='function'?get(x):x[get];if(v!==null&&v!==undefined&&String(v).trim())m[String(v).trim()]=(m[String(v).trim()]||0)+1});return Object.entries(m).sort((x,y)=>y[1]-x[1]||x[0].localeCompare(y[0],'pt-BR')).slice(0,limit)};
  const soma=(a,k)=>a.reduce((s,x)=>s+n(x[k]),0);
  const varPct=(a,b)=>!b?(a?'NOVO':'0%'):(((a-b)/b)*100).toFixed(1).replace('.',',')+'%';
  async function consultaPeriodo(tabela,campo,inicio,fim,select='*'){
    const db=window.SistemaAuth.client;const r=await db.from(tabela).select(select).gte(campo,inicio).lte(campo,fim);if(r.error)throw r.error;return r.data||[];
  }
  window.buildRelatorioCipa=async function(){
    const db=window.SistemaAuth.client,ini=q('ini').value,fim=q('fim').value,cr=window.comparisonRange(),periodo=window.periodoRelatorio(ini,fim),u=window.unidadeRel();
    q('document').innerHTML='<div class="notice">Consultando dados ambientais da CIPA...</div>';
    try{
      const base=await Promise.all([
        db.rpc('obter_dados_dashboard_territorial',{data_inicio:ini,data_fim:fim}),
        db.rpc('obter_dados_dashboard_territorial',{data_inicio:cr[0],data_fim:cr[1]}),
        consultaPeriodo('cipa_autos_infracao','data_autuacao',ini,fim,'id,ocorrencia_id,numero,data_autuacao,autuado,tipo_sancao,descricao_infracao,art_lei_9605,art_dec_6514,valor_multa,area_embargada_ha,fiscal_ambiental'),
        consultaPeriodo('cipa_autos_infracao','data_autuacao',cr[0],cr[1],'id,ocorrencia_id,numero,data_autuacao,autuado,tipo_sancao,descricao_infracao,art_lei_9605,art_dec_6514,valor_multa,area_embargada_ha,fiscal_ambiental'),
        consultaPeriodo('cipa_autos_notificacao','data_notificacao',ini,fim),
        consultaPeriodo('cipa_fauna','data_registro',ini,fim),
        consultaPeriodo('cipa_educacao_ambiental','data_acao',ini,fim),
        consultaPeriodo('cipa_fauna','data_registro',cr[0],cr[1]),
        consultaPeriodo('cipa_educacao_ambiental','data_acao',cr[0],cr[1])
      ]);
      if(base[0].error)throw base[0].error;if(base[1].error)throw base[1].error;
      const d=base[0].data||[],old=base[1].data||[],autos=base[2],autosOld=base[3],notifs=base[4],fauna=base[5],edu=base[6],faunaOld=base[7],eduOld=base[8];
      document.title='SIE-CPC - CIPA - '+periodo.arquivo;
      const cover=`<section class="page cover"><div class="cover-top"><img src="brasao-pmrr.png"><div>ESTADO DE RORAIMA<br>POLÍCIA MILITAR DE RORAIMA<br>COMANDO DE POLICIAMENTO DA CAPITAL - CPC<br>${esc(u.nome).toUpperCase()}<br>“Amazônia: Patrimônio dos Brasileiros”</div><div class="cover-brand">CIPA</div></div><div class="cover-title"><h1>RELATÓRIO DE ANÁLISE DE DADOS ESTATÍSTICOS</h1><h2>${esc(periodo.titulo)}</h2></div><div class="cover-bottom">BOA VISTA - RR<br><br>${esc(periodo.anos)}</div></section>`;
      const toc=window.page('SUMÁRIO',`<ul class="toc"><li><span>1. PPEs E OCORRÊNCIAS AMBIENTAIS</span><span class="dots"></span><span data-toc-target="cipa-ppe">-</span></li><li><span>2. FISCALIZAÇÃO AMBIENTAL</span><span class="dots"></span><span data-toc-target="cipa-fisc">-</span></li><li><span>3. FAUNA E EDUCAÇÃO AMBIENTAL</span><span class="dots"></span><span data-toc-target="cipa-fauna">-</span></li><li><span>4. COMPARATIVO DE PRODUTIVIDADE</span><span class="dots"></span><span data-toc-target="cipa-final">-</span></li></ul>`,'summary');
      const nats=rank(d,x=>x.ocorrencia||x.crime,20),mun=rank(d,'municipio',15),areas=rank(d,x=>x.cipa_area_tipo,4),origens=rank(d,x=>x.cipa_origem_atuacao,12);
      const p3=window.page('1. PPEs E OCORRÊNCIAS AMBIENTAIS',`<div class="kpis-rel"><div class="kpi-rel"><b>${d.length}</b><span>PPE / BO</span></div><div class="kpi-rel"><b>${mun.length}</b><span>MUNICÍPIOS</span></div><div class="kpi-rel"><b>${areas.find(x=>x[0]==='RURAL')?.[1]||0}</b><span>ÁREA RURAL</span></div><div class="kpi-rel"><b>${areas.find(x=>x[0]==='URBANA')?.[1]||0}</b><span>ÁREA URBANA</span></div></div><h3 class="subtitle">PRINCIPAIS NATUREZAS</h3>${window.table(['ITEM','NATUREZA','QUANTIDADE'],nats.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x[0])}</td><td>${x[1]}</td></tr>`))}<h3 class="subtitle">MUNICÍPIOS</h3>${window.table(['ITEM','MUNICÍPIO','PPEs'],mun.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x[0])}</td><td>${x[1]}</td></tr>`))}<h3 class="subtitle">ORIGEM DA ATUAÇÃO</h3>${window.table(['ORIGEM','PPEs'],origens.map(x=>`<tr><td>${esc(x[0])}</td><td>${x[1]}</td></tr>`))}`,'cipa-ppe');
      const multas=soma(autos,'valor_multa'),area=soma(autos,'area_embargada_ha'),emb=autos.filter(x=>String(x.tipo_sancao||'').toUpperCase().includes('EMBARGO')).length;
      const infr={};autos.forEach(x=>{const k=String(x.descricao_infracao||('Art. '+(x.art_dec_6514||x.art_lei_9605||'Não informado'))).trim();if(!infr[k])infr[k]={q:0,m:0,a:0};infr[k].q++;infr[k].m+=n(x.valor_multa);infr[k].a+=n(x.area_embargada_ha)});
      const ir=Object.entries(infr).sort((a,b)=>b[1].q-a[1].q).slice(0,18);
      const p4=window.page('2. FISCALIZAÇÃO AMBIENTAL',`<div class="kpis-rel"><div class="kpi-rel"><b>${autos.length}</b><span>AUTOS DE INFRAÇÃO</span></div><div class="kpi-rel"><b>${moeda(multas)}</b><span>MULTAS</span></div><div class="kpi-rel"><b>${ha(area)}</b><span>ÁREA EMBARGADA</span></div><div class="kpi-rel"><b>${emb}</b><span>EMBARGOS</span></div><div class="kpi-rel"><b>${notifs.length}</b><span>AUTOS DE NOTIFICAÇÃO</span></div></div><h3 class="subtitle">AUTOS DE INFRAÇÃO POR NATUREZA ADMINISTRATIVA</h3>${window.table(['ITEM','INFRAÇÃO','AUTOS','VALOR','ÁREA HA'],ir.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x[0])}</td><td>${x[1].q}</td><td>${moeda(x[1].m)}</td><td>${x[1].a.toLocaleString('pt-BR',{maximumFractionDigits:2})}</td></tr>`),`<tr class="total"><td colspan="2">TOTAL</td><td>${autos.length}</td><td>${moeda(multas)}</td><td>${area.toLocaleString('pt-BR',{maximumFractionDigits:2})}</td></tr>`)}`,'cipa-fisc');
      const fm={};fauna.forEach(x=>{const k=String(x.nome_comum||'Não informado').trim();fm[k]=(fm[k]||0)+n(x.quantidade)});const fr=Object.entries(fm).sort((a,b)=>b[1]-a[1]);
      const p5=window.page('3. FAUNA E EDUCAÇÃO AMBIENTAL',`<div class="kpis-rel"><div class="kpi-rel"><b>${soma(fauna,'quantidade')}</b><span>ANIMAIS</span></div><div class="kpi-rel"><b>${fauna.length}</b><span>REGISTROS DE FAUNA</span></div><div class="kpi-rel"><b>${edu.length}</b><span>AÇÕES EDUCATIVAS</span></div><div class="kpi-rel"><b>${soma(edu,'publico_estimado')}</b><span>PÚBLICO ESTIMADO</span></div></div><h3 class="subtitle">FAUNA REGISTRADA</h3>${window.table(['ITEM','ESPÉCIE','QUANTIDADE'],fr.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x[0])}</td><td>${x[1]}</td></tr>`))}<h3 class="subtitle">EDUCAÇÃO AMBIENTAL</h3>${window.table(['AÇÃO','LOCAL','PÚBLICO'],edu.map(x=>`<tr><td>${esc(x.acao||'')}</td><td>${esc(x.local_acao||'')}</td><td>${n(x.publico_estimado)}</td></tr>`))}`,'cipa-fauna');
      const prod=[
        ['PPE / BO',d.length,old.length],['AUTOS DE INFRAÇÃO',autos.length,autosOld.length],['VALOR DAS MULTAS',multas,soma(autosOld,'valor_multa')],
        ['ÁREA EMBARGADA (HA)',area,soma(autosOld,'area_embargada_ha')],['ANIMAIS REGISTRADOS',soma(fauna,'quantidade'),soma(faunaOld,'quantidade')],
        ['AÇÕES DE EDUCAÇÃO AMBIENTAL',edu.length,eduOld.length]
      ];
      const p6=window.page('4. COMPARATIVO DE PRODUTIVIDADE DA CIPA',`${window.table(['INDICADOR','PERÍODO ATUAL','PERÍODO COMPARADO','VARIAÇÃO'],prod.map(x=>`<tr><td>${x[0]}</td><td>${x[0].includes('VALOR')?moeda(x[1]):x[1]}</td><td>${x[0].includes('VALOR')?moeda(x[2]):x[2]}</td><td>${varPct(x[1],x[2])}</td></tr>`))}<div class="signature">Boa Vista/RR, ${new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})}.<br><br><br><b>RESPONSÁVEL PELO RELATÓRIO</b><br>${window.assinaturaResponsavelRelatorio('Auxiliar da SIE-CPC / CIPA')}</div><p class="source">Fonte: Sistema Integrado de Estatística do CPC - SIE-CPC / CIPA.</p>`,'cipa-final');
      q('document').innerHTML=cover+toc+p3+p4+p5+p6;
      const pages=[...document.querySelectorAll('.page')];pages.forEach((p,i)=>{const f=p.querySelector('.footer');if(f)f.textContent='Página '+(i+1)+' de '+pages.length});
      window.atualizarSumarioRelatorio();setTimeout(window.finalizarLayoutRelatorio,150);
    }catch(e){console.error(e);q('document').innerHTML='<div class="notice">Erro ao gerar relatório da CIPA: '+esc(e.message||e)+'</div>'}
  };
})();