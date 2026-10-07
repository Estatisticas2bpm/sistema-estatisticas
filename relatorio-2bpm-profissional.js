(()=>{
  const R2_COLORS=['#1d4ed8','#0891b2','#059669','#d97706','#7c3aed','#dc2626','#475569','#0ea5e9','#65a30d','#ea580c','#9333ea','#0f766e'];

  function h(v){return String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
  function num(v){return Number(v)||0}
  function scopeLabel(){
    const s=document.getElementById('sisc')?.value||'';
    const c=document.getElementById('companhia')?.value||'';
    return [s,c].filter(Boolean).join(' - ');
  }
  function row(cells,cls=''){return '<tr'+(cls?' class="'+cls+'"':'')+'>'+cells.map((v,i)=>'<td'+(i>0&&typeof v==='number'?' class="num"':'')+'>'+h(v)+'</td>').join('')+'</tr>'}
  function table(headers,rows,{cls='',widths=null,total=null}={}){
    const colgroup=widths?'<colgroup>'+widths.map(w=>'<col style="width:'+w+'">').join('')+'</colgroup>':'';
    const body=rows.length?rows.map(r=>row(r)).join(''):'<tr><td colspan="'+headers.length+'" class="r2-center">SEM REGISTROS NO PERÍODO</td></tr>';
    const totalHtml=total?'<tr class="total">'+total.map((v,i)=>'<td'+(i>0&&typeof v==='number'?' class="num"':'')+'>'+h(v)+'</td>').join('')+'</tr>':'';
    return '<table class="r2-table '+cls+'">'+colgroup+'<thead><tr>'+headers.map(x=>'<th>'+h(x)+'</th>').join('')+'</tr></thead><tbody>'+body+totalHtml+'</tbody></table>';
  }
  function topComOutros(entries,limit,label){
    const top=entries.slice(0,limit).map(x=>[x[0],num(x[1])]);
    const rest=entries.slice(limit);
    const qtd=rest.reduce((s,x)=>s+num(x[1]),0);
    if(qtd>0)top.push([label,qtd]);
    return {rows:top,restNames:new Set(rest.map(x=>x[0]))};
  }
  function distribuir(lista,maxPorPagina){
    if(!lista.length)return [[]];
    const paginas=Math.max(1,Math.ceil(lista.length/maxPorPagina));
    const base=Math.floor(lista.length/paginas),resto=lista.length%paginas;
    const out=[];let pos=0;
    for(let i=0;i<paginas;i++){const tam=base+(i<resto?1:0);out.push(lista.slice(pos,pos+tam));pos+=tam}
    return out;
  }
  function docNome(v){
    const k=chaveEstatisticaRel(v);
    if(k==='TS'||k.includes('TATICO SETORIAL'))return 'TÁTICO SETORIAL';
    if(k==='AME')return 'AME - MARIA DA PENHA / VIOLÊNCIA DOMÉSTICA';
    return String(v||'').toUpperCase();
  }
  function nacionalidades(registros,prefix,status){
    const m=new Map();
    pessoasRelatorio(registros,prefix).forEach(p=>{
      const nac=normalizarNacionalidadeRel(p.nacionalidade),sexo=normalizarSexoRel(p.sexo);
      if(nac==='NÃO INFORMADA'||!['M','F'].includes(sexo))return;
      const k=nac+'|'+sexo;m.set(k,(m.get(k)||0)+1);
    });
    const itens=[...m.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR'));
    return {rows:itens.map(([k,q],i)=>{const [nac,sexo]=k.split('|');return[i+1,status,nac,sexo,q]}),total:itens.reduce((s,x)=>s+x[1],0)};
  }
  function resultadoComandante(r){
    const p=[];
    if(num(r.armas_fogo))p.push('Armas: '+num(r.armas_fogo));
    if(num(r.simulacros))p.push('Simulacros: '+num(r.simulacros));
    if(num(r.legado))p.push('Legado: '+num(r.legado));
    if(num(r.municoes))p.push('Munições: '+num(r.municoes));
    if(num(r.veiculos))p.push('Veículos: '+num(r.veiculos));
    if(num(r.foragidos_descumprimento))p.push('Forag./Desc.: '+num(r.foragidos_descumprimento));
    if(num(r.entorpecentes))p.push('Drogas: '+num(r.entorpecentes));
    return p.join(' · ')||'—';
  }
  function resultadoTotalComandantes(lista){
    return resultadoComandante({
      armas_fogo:lista.reduce((s,r)=>s+num(r.armas_fogo),0),
      simulacros:lista.reduce((s,r)=>s+num(r.simulacros),0),
      legado:lista.reduce((s,r)=>s+num(r.legado),0),
      municoes:lista.reduce((s,r)=>s+num(r.municoes),0),
      veiculos:lista.reduce((s,r)=>s+num(r.veiculos),0),
      foragidos_descumprimento:lista.reduce((s,r)=>s+num(r.foragidos_descumprimento),0),
      entorpecentes:lista.reduce((s,r)=>s+num(r.entorpecentes),0)
    });
  }
  async function chartImage(config,w=1100,he=620){
    const box=document.createElement('div');box.style.cssText='position:fixed;left:-20000px;top:0;width:'+w+'px;height:'+he+'px;background:#fff;z-index:-1';
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=he;box.appendChild(canvas);document.body.appendChild(box);
    const bg={id:'r2white',beforeDraw(chart){const ctx=chart.ctx;ctx.save();ctx.globalCompositeOperation='destination-over';ctx.fillStyle='#fff';ctx.fillRect(0,0,chart.width,chart.height);ctx.restore()}};
    const chart=new Chart(canvas.getContext('2d'),{...config,plugins:[...(config.plugins||[]),bg],options:{responsive:false,animation:false,devicePixelRatio:2,...(config.options||{})}});
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const img=chart.toBase64Image('image/png',1);chart.destroy();box.remove();return img;
  }
  function barConfig(labels,values,horizontal=false){
    return {type:'bar',data:{labels,datasets:[{data:values,backgroundColor:R2_COLORS.slice(0,labels.length)}]},options:{indexAxis:horizontal?'y':'x',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{precision:0,font:{size:10}}},y:{beginAtZero:true,ticks:{autoSkip:false,font:{size:10}}}}}};
  }
  function lineConfig(labels,values){
    return {type:'line',data:{labels,datasets:[{data:values,borderColor:'#1d4ed8',backgroundColor:'#1d4ed8',tension:.25,pointRadius:4,pointHoverRadius:4}]},options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0,font:{size:10}}},x:{ticks:{font:{size:10}}}}}};
  }
  function pageShell(body,pageNo,total,{key='',layout='',cover=false}={}){
    if(cover)return '<section class="r2-page r2-page-cover" data-key="cover">'+body+'</section>';
    const periodo=periodoRelatorio(document.getElementById('ini').value,document.getElementById('fim').value),esc=scopeLabel();
    return '<section class="r2-page"'+(key?' data-key="'+h(key)+'"':'')+(layout?' data-layout="'+h(layout)+'"':'')+'>'+
      '<div class="r2-header">'+h(periodo.titulo)+(esc?'<br>'+h(esc):'')+'<br>2º BATALHÃO DE POLÍCIA MILITAR</div>'+
      body+'<div class="r2-footer">Página '+pageNo+' de '+total+'</div></section>';
  }
  function coverHtml(periodo){
    return '<div class="r2-cover-top"><img src="brasao-pmrr.png" alt="Brasão da PMRR"><div>ESTADO DE RORAIMA<br>POLÍCIA MILITAR DE RORAIMA<br>COMANDO DE POLICIAMENTO DA CAPITAL - CPC<br>2º BATALHÃO DE POLÍCIA MILITAR<br>“Amazônia: Patrimônio dos Brasileiros”</div><img src="logo-2bpm-novo.png" alt="Brasão do 2º BPM"></div>'+
      '<div class="r2-cover-title"><h1>RELATÓRIO DE ANÁLISE DE DADOS ESTATÍSTICOS</h1><h2>'+h(periodo.titulo)+'</h2></div>'+
      '<div class="r2-cover-bottom">BOA VISTA - RR<br>'+h(periodo.anos)+'</div>';
  }
  function tocHtml(entries,keyPage){
    return '<h1 class="r2-title">SUMÁRIO</h1><ul class="r2-toc">'+entries.map(e=>'<li><span>'+h(e[0])+'</span><span class="dots"></span><span class="page-no">'+h(keyPage[e[1]]||'—')+'</span></li>').join('')+'</ul>';
  }

  window.buildRelatorio2BpmProfissional=async function(){
    const doc=document.getElementById('document');
    doc.className='document r2-document';doc.innerHTML='<div class="notice">Compondo relatório profissional do 2º BPM...</div>';
    const iniEl=document.getElementById('ini'),fimEl=document.getElementById('fim');
    const periodo=periodoRelatorio(iniEl.value,fimEl.value),cr=comparisonRange();
    document.title='SIE-CPC - 2º BPM - '+periodo.arquivo;
    const res=await Promise.all([
      db.rpc('obter_dados_dashboard',{data_inicio:iniEl.value,data_fim:fimEl.value}),
      db.rpc('obter_dados_dashboard',{data_inicio:cr[0],data_fim:cr[1]}),
      db.rpc('obter_tcos_dashboard',{data_inicio:iniEl.value,data_fim:fimEl.value}),
      db.rpc('obter_tcos_dashboard',{data_inicio:cr[0],data_fim:cr[1]})
    ]);
    if(res[0].error){doc.innerHTML='<div class="notice">Erro: '+h(res[0].error.message)+'</div>';return}
    const d=filtrarTerritorio(res[0].data||[]),old=filtrarTerritorio(res[1].data||[]),tcos=filtrarTerritorio(res[2].data||[]),tcosOld=filtrarTerritorio(res[3].data||[]);
    const docs=docsRelatorioGenerico(d,tcos),occ=rankNaturezasRel(d),hoods=rank(d,'bairro'),hoodOld=Object.fromEntries(rank(old,'bairro'));
    const days=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'],shifts=['MADRUGADA','MANHÃ','TARDE','NOITE'];
    const dayTotals=days.map((_,i)=>d.filter(y=>new Date(y.data_ocorrencia+'T12:00').getDay()===i).length);
    const shiftTotals=shifts.map(t=>d.filter(x=>S(x.turno)===t).length);
    const matrix=days.map((day,di)=>{const vals=shifts.map(t=>d.filter(x=>new Date(x.data_ocorrencia+'T12:00').getDay()===di&&S(x.turno)===t).length);return[di+1,day,...vals,vals.reduce((a,b)=>a+b,0)]});

    const occTop=topComOutros(occ,15,'OUTRAS OCORRÊNCIAS');
    const occRows=occTop.rows.map((x,i)=>{
      const nomes=x[0]==='OUTRAS OCORRÊNCIAS'?occTop.restNames:new Set([x[0]]);
      const g=d.filter(y=>nomes.has(naturezaPrincipalRel(y))),ages=g.map(y=>num(y.infrator_idade)).filter(Boolean);
      return[i+1,x[0],x[1],rank(g,'bairro',2).map(z=>z[0]).join(' / ')||'NI',ages.length?Math.min(...ages)+' a '+Math.max(...ages)+' anos':'NI'];
    });

    const hoodTop=hoods.slice(0,20),hoodTopNames=new Set(hoodTop.map(x=>x[0]));
    const hoodOldEntries=rank(old,'bairro'),hoodOther=hoods.slice(20).reduce((s,x)=>s+num(x[1]),0),hoodOldOther=hoodOldEntries.filter(x=>!hoodTopNames.has(x[0])).reduce((s,x)=>s+num(x[1]),0);
    const hoodRows=hoodTop.map((x,i)=>[i+1,x[0],x[1],hoodOld[x[0]]||0,variance(x[1],hoodOld[x[0]]||0)]);
    if(hoodOther>0)hoodRows.push([hoodRows.length+1,'OUTROS BAIRROS',hoodOther,hoodOldOther,variance(hoodOther,hoodOldOther)]);

    const streets=rank(d,'endereco',15).map((x,i)=>{const g=d.filter(y=>S(y.endereco)===x[0]);return[i+1,x[0],x[1],rank(g,'turno',1)[0]?.[0]||'NI',rank(g,y=>naturezaPrincipalRel(y),2).map(z=>z[0]).join(' / ')||'NI']});
    const inf=nacionalidades(d,'infrator','Infrator'),vit=nacionalidades(d,'vitima','Vítima');
    const acts=[
      ['CONDUÇÕES',sum(d,'conducoes_operacionais')],['ORIENTAÇÕES',sum(d,'orientacoes')],['FORAGIDOS CAPTURADOS (MANDADO DE PRISÃO)',sum(d,'foragidos')],
      ['INFRATORES EM DESCUMPRIMENTO DE CAUTELARES',d.filter(x=>S(x.ocorrencia).includes('DESCUMPRIMENTO')).length],
      ['OCORRÊNCIAS COM ARMAS / SIMULACROS / MUNIÇÕES',d.filter(ocorrenciaComArmasOuMunicoes).length],['OCORRÊNCIAS COM APREENSÕES DE DROGAS',d.filter(temEntorpecente).length],
      ['OCORRÊNCIAS COM VEÍCULOS RECUPERADOS',d.filter(x=>num(x.veiculos_recuperados)>0).length],['VEÍCULOS COM RESTRIÇÃO APREENDIDOS',sum(d,'veiculos_restricao')],
      ['OCORRÊNCIAS DO TÁTICO SETORIAL - ÁREA OESTE',d.filter(x=>x.tatico_setorial===true).length]
    ];
    const weapons=detalhesArmasRel(d),ammo=detalhesMunicoesRel(d),ammoTotal=ammo.reduce((s,x)=>s+num(x[1]),0),entInc=incidenciaEntorpecentes(d),entMat=materiaisEntorpecentes(d),white=armasBrancasAgrupadasRel(d);
    const oldWhite=armasBrancasAgrupadasRel(old);
    const qtdArmas=totalEstruturadoOuLegado(d,'armas_itens','quantidade_armas');
    const qtdAutos=sum(d,'quantidade_autos_infracao'),qtdRemocoes=d.filter(x=>S(x.auto_infracao).includes('REMO')).length,qtdResistencia=d.filter(x=>S(x.auto_resistencia)==='SIM').length;
    const temDetalhesApreensao=entInc.length>0||entMat.length>0||white.total>0||qtdAutos>0||qtdRemocoes>0||qtdResistencia>0;

    const cmdData=comandantesAgrupadosRel(d).map(x=>({nome:x.nome,...metricasComandanteRel(x.registros)}));
    const cmdChunks=distribuir(cmdData,26);
    const comandantesNaPaginaResultados=cmdData.length>0&&cmdData.length<=10&&!temDetalhesApreensao;

    const chartOccData=topComOutros(occ,9,'OUTRAS');
    const chartHoodData=topComOutros(hoods,9,'OUTROS');
    const [imgOcc,imgHoods,imgDays,imgShifts]=await Promise.all([
      chartImage(barConfig(chartOccData.rows.map(x=>x[0]),chartOccData.rows.map(x=>x[1]),true),1200,720),
      chartImage(barConfig(chartHoodData.rows.map(x=>x[0]),chartHoodData.rows.map(x=>x[1]),true),1200,720),
      chartImage(lineConfig(days,dayTotals),900,520),
      chartImage(barConfig(shifts,shiftTotals,false),900,520)
    ]);

    const bodyPages=[];
    bodyPages.push({key:'docs',layout:'dense',html:
      '<h1 class="r2-title">1. DOCUMENTAÇÕES EMITIDAS PELA UNIDADE</h1>'+
      '<h2 class="r2-section">DOCUMENTOS E INDICADORES OPERACIONAIS</h2>'+
      table(['DOCUMENTO / INDICADOR','QUANTIDADE'],docs.map(x=>[docNome(x[0]),x[1]]),{cls:'r2-tight',widths:['76%','24%']})+

      '<h1 class="r2-title" style="margin-top:4mm">2. PRINCIPAIS TIPOS DE OCORRÊNCIAS NA UNIDADE OPERACIONAL</h1>'+
      '<h2 class="r2-section">CLASSIFICAÇÃO DAS OCORRÊNCIAS - TOP 15</h2>'+
      table(['ITEM','DESCRIÇÃO','FREQ.','BAIRROS RECORRENTES','FAIXA ETÁRIA'],occRows,{cls:'r2-mini',widths:['6%','35%','10%','32%','17%']})
    });

    bodyPages.push({key:'occ-chart',layout:'dense',html:
      '<h2 class="r2-section">GRÁFICO DAS PRINCIPAIS OCORRÊNCIAS</h2><img class="r2-chart r2-chart-large" src="'+imgOcc+'" alt="Gráfico das principais ocorrências">'+
      '<h2 class="r2-section">VOLUME DE OCORRÊNCIAS / PRINCIPAIS BAIRROS</h2>'+
      table(['ORDEM','BAIRRO','ATUAL','COMPARADO','VARIAÇÃO'],hoodRows,{cls:'r2-mini',widths:['8%','42%','16%','17%','17%'],total:['TOTAL GERAL','',d.length,old.length,variance(d.length,old.length)]})
    });

    bodyPages.push({key:'hood-chart',layout:'dense',html:
      '<h2 class="r2-section">GRÁFICO DOS PRINCIPAIS BAIRROS</h2><img class="r2-chart" src="'+imgHoods+'" alt="Gráfico dos principais bairros">'+
      '<h2 class="r2-section">QUADRO COMPARATIVO DE OCORRÊNCIAS POR DIAS DA SEMANA / TURNO</h2>'+
      table(['ITEM','DIA','MADRUGADA','MANHÃ','TARDE','NOITE','TOTAL'],matrix,{cls:'r2-mini',widths:['6%','22%','14%','14%','14%','14%','16%'],total:['','TOTAL GERAL',...shiftTotals,d.length]})+
      '<div class="r2-chart-row"><div class="r2-chart-card"><h3 class="r2-subsection">OCORRÊNCIAS POR DIA DA SEMANA</h3><img class="r2-chart" src="'+imgDays+'" alt="Ocorrências por dia"></div><div class="r2-chart-card"><h3 class="r2-subsection">OCORRÊNCIAS POR TURNO</h3><img class="r2-chart" src="'+imgShifts+'" alt="Ocorrências por turno"></div></div>'
    });

    bodyPages.push({key:'streets',layout:'dense',html:
      '<h2 class="r2-section">RUAS E AVENIDAS COM PREDOMINÂNCIA DE OCORRÊNCIAS</h2>'+
      table(['ORDEM','RUA / AVENIDA','FREQ.','TURNO','OCORRÊNCIAS PREDOMINANTES'],streets,{cls:'r2-mini',widths:['7%','30%','10%','15%','38%']})+
      '<div class="r2-grid-2 align-start"><div><h2 class="r2-section">INFRATORES POR NACIONALIDADE</h2>'+
      table(['ITEM','PAÍS DE ORIGEM','SEXO','FREQ.'],inf.rows.map(r=>[r[0],r[2],r[3],r[4]]),{cls:'r2-mini',widths:['10%','52%','16%','22%'],total:['','TOTAL','',inf.total]})+
      '</div><div><h2 class="r2-section">VÍTIMAS POR NACIONALIDADE</h2>'+
      table(['ITEM','PAÍS DE ORIGEM','SEXO','FREQ.'],vit.rows.map(r=>[r[0],r[2],r[3],r[4]]),{cls:'r2-mini',widths:['10%','52%','16%','22%'],total:['','TOTAL','',vit.total]})+'</div></div>'
    });

    const blocosArmasMunicoes=[];
    if(weapons.length)blocosArmasMunicoes.push('<div><h2 class="r2-section">ARMAS / SIMULACROS / CARREGADORES</h2>'+table(['ESPECIFICAÇÃO','QUANTIDADE'],weapons.map(x=>[x[0],x[1]]),{cls:'r2-mini',widths:['72%','28%'],total:['TOTAL',qtdArmas]})+'</div>');
    if(ammo.length)blocosArmasMunicoes.push('<div><h2 class="r2-section">MUNIÇÕES APREENDIDAS</h2>'+table(['CALIBRE','QUANTIDADE'],ammo.map(x=>[x[0],x[1]]),{cls:'r2-mini',widths:['68%','32%'],total:['TOTAL',ammoTotal]})+'</div>');

    let resultsHtml=
      '<h1 class="r2-title">3. INFORMAÇÕES GERAIS SOBRE ATUAÇÕES DA UNIDADE</h1>'+
      '<h2 class="r2-section">RESUMO DAS ATUAÇÕES DA UNIDADE</h2>'+table(['ESPECIFICAÇÃO','QUANTIDADE'],acts,{cls:'r2-mini',widths:['78%','22%']})+
      (blocosArmasMunicoes.length?'<div class="r2-grid-2 align-start">'+blocosArmasMunicoes.join('')+'</div>':'');

    if(comandantesNaPaginaResultados){
      const rows=cmdData.map((r,i)=>[i+1,r.nome,r.ocorrencias,resultadoComandante(r)]);
      resultsHtml+='<h2 class="r2-section">OCORRÊNCIAS POR COMANDANTES DE VIATURAS</h2>'+
        table(['ITEM','COMANDANTE','OCORRÊNCIAS','RESULTADOS OPERACIONAIS'],rows,{cls:'r2-commander-table',widths:['7%','29%','12%','52%'],total:['','TOTAL COM CMT. IDENTIFICADO',cmdData.reduce((s,r)=>s+num(r.ocorrencias),0),resultadoTotalComandantes(cmdData)]});
    }
    bodyPages.push({key:'results',layout:'dense',html:resultsHtml});

    if(temDetalhesApreensao){
      const cards=[
        [d.filter(temEntorpecente).length,'OCORRÊNCIAS COM DROGAS'],
        [white.total,'ARMAS BRANCAS'],
        [ammoTotal,'MUNIÇÕES'],
        [qtdArmas,'ARMAS / SIMULACROS']
      ].filter(x=>x[0]>0);
      const esquerda=[];
      if(entInc.length)esquerda.push('<h2 class="r2-section">ENTORPECENTES - INCIDÊNCIA POR OCORRÊNCIA</h2>'+table(['TIPO','OCORRÊNCIAS'],entInc.map(x=>[x[0],x[1]]),{cls:'r2-mini',widths:['70%','30%'],total:['TOTAL',d.filter(temEntorpecente).length]}));
      if(white.total)esquerda.push('<h2 class="r2-section">APREENSÕES DE ARMA BRANCA</h2>'+table(['TIPO','QUANTIDADE'],white.itens.map(x=>[x[0],x[1]]),{cls:'r2-mini',widths:['70%','30%'],total:['TOTAL',white.total]}));
      if(qtdAutos||qtdRemocoes||qtdResistencia)esquerda.push('<h2 class="r2-section">TRÂNSITO / RESISTÊNCIA</h2>'+table(['INDICADOR','QUANTIDADE'],[
        ['INFRAÇÕES DE TRÂNSITO',qtdAutos],['AUTOS DE REMOÇÃO',qtdRemocoes],['AUTOS DE RESISTÊNCIA',qtdResistencia]
      ].filter(x=>x[1]>0),{cls:'r2-mini',widths:['72%','28%']}));
      const direita=entMat.length?'<div><h2 class="r2-section">ENTORPECENTES - MATERIAIS REGISTRADOS</h2>'+table(['TIPO','APRESENTAÇÃO','QTD.'],entMat.map(x=>[x[0],x[1],x[2]]),{cls:'r2-mini',widths:['31%','47%','22%']})+'</div>':'';
      bodyPages.push({key:'drugs',layout:'dense',html:
        (cards.length?'<div class="r2-kpis">'+cards.map(x=>'<div class="r2-kpi"><b>'+x[0]+'</b><span>'+x[1]+'</span></div>').join('')+'</div>':'')+
        '<div class="r2-grid-2 align-start"><div>'+esquerda.join('')+'</div>'+direita+'</div>'
      });
    }

    if(cmdData.length&&!comandantesNaPaginaResultados)cmdChunks.forEach((chunk,idx)=>{
      const first=idx===0,totalFinal=idx===cmdChunks.length-1;
      const rows=chunk.map((r,i)=>[cmdChunks.slice(0,idx).reduce((s,x)=>s+x.length,0)+i+1,r.nome,r.ocorrencias,resultadoComandante(r)]);
      const totals=totalFinal?['','TOTAL COM CMT. IDENTIFICADO',cmdData.reduce((s,r)=>s+num(r.ocorrencias),0),resultadoTotalComandantes(cmdData)]:null;
      bodyPages.push({key:first?'commanders':'commanders-cont',layout:'dense',html:
        '<h2 class="r2-section">OCORRÊNCIAS POR COMANDANTES DE VIATURAS'+(first?'':' - CONTINUAÇÃO')+'</h2>'+
        table(['ITEM','COMANDANTE','OCORRÊNCIAS','RESULTADOS OPERACIONAIS'],rows,{cls:'r2-commander-table',widths:['7%','29%','12%','52%'],total:totals})
      });
    });

    const oldDocs=Object.fromEntries(docsRelatorioGenerico(old,tcosOld));
    const product=[
      ['BOLETINS DE OCORRÊNCIAS',docs.find(x=>x[0]==='BO')?.[1]||0,oldDocs.BO||0],
      ['TCO',docs.find(x=>x[0]==='TCO')?.[1]||0,oldDocs.TCO||0],
      ['ARMAS DE FOGO APREENDIDAS',totaisCategoriasArmasRel(d).fogo,totaisCategoriasArmasRel(old).fogo],
      ['SIMULACROS APREENDIDOS',totaisCategoriasArmasRel(d).simulacro,totaisCategoriasArmasRel(old).simulacro],
      ['ARMAS/SIMULACROS SEM CLASSIFICAÇÃO (LEGADO)',totaisCategoriasArmasRel(d).legado,totaisCategoriasArmasRel(old).legado],
      ['ARMA BRANCA',white.total,oldWhite.total],
      ['VEÍCULOS RECUPERADOS',sum(d,'veiculos_recuperados'),sum(old,'veiculos_recuperados')],
      ['FORAGIDOS DA JUSTIÇA',sum(d,'foragidos'),sum(old,'foragidos')],
      ['DESCUMPRIMENTO DE CAUTELARES',d.filter(x=>S(x.ocorrencia).includes('DESCUMPRIMENTO')).length,old.filter(x=>S(x.ocorrencia).includes('DESCUMPRIMENTO')).length],
      ['OCORRÊNCIAS MARIA DA PENHA / VIOLÊNCIA DOMÉSTICA',d.filter(ehMariaDaPenhaRel).length,old.filter(ehMariaDaPenhaRel).length],
      ['CONDUÇÕES',sum(d,'conducoes_operacionais'),sum(old,'conducoes_operacionais')]
    ];
    bodyPages.push({key:'final',html:
      '<h1 class="r2-title">4. MÍDIAS DE DADOS ESTATÍSTICOS DE PRODUTIVIDADE</h1><h2 class="r2-section">PUBLICAÇÃO - COMPARATIVO DE PRODUTIVIDADE</h2>'+
      table(['PUBLICAÇÃO','PERÍODO ATUAL','PERÍODO COMPARADO','VARIAÇÃO'],product.map(x=>[x[0],x[1],x[2],variance(x[1],x[2])]),{cls:'r2-tight',widths:['52%','16%','16%','16%']})+
      '<div class="r2-signature">Boa Vista/RR, '+new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})+'.<br><br><strong>RESPONSÁVEL PELO RELATÓRIO</strong><br>'+assinaturaResponsavelRelatorio('Auxiliar da P2/P3 — 2º BPM')+'</div>'+
      '<p class="r2-source">Fonte: Sistema Interno de Banco de Dados - SIE-CPC / 2º BPM.</p>'
    });

    const total=bodyPages.length+2,keyPage={};
    bodyPages.forEach((p,i)=>{if(!keyPage[p.key])keyPage[p.key]=i+3});
    if(!keyPage['commanders']&&keyPage['commanders-cont'])keyPage['commanders']=keyPage['commanders-cont'];
    const toc=[
      ['1. DOCUMENTAÇÕES EMITIDAS PELA UNIDADE','docs'],['Documentos e indicadores operacionais','docs'],
      ['2. PRINCIPAIS TIPOS DE OCORRÊNCIAS NA UNIDADE OPERACIONAL','docs'],['Classificação das ocorrências - Top 15','docs'],
      ['Gráfico das principais ocorrências','occ-chart'],['Volume das ocorrências / principais bairros','occ-chart'],
      ['Gráfico dos principais bairros','hood-chart'],['Quadro por dias da semana / turno','hood-chart'],['Gráficos por dia e turno','hood-chart'],
      ['Ruas e avenidas com predominância de ocorrências','streets'],['Infratores e vítimas por nacionalidade','streets'],
      ['3. INFORMAÇÕES GERAIS SOBRE ATUAÇÕES DA UNIDADE','results'],
      ...(blocosArmasMunicoes.length?[['Armas e munições','results']]:[]),
      ...(temDetalhesApreensao?[['Entorpecentes, arma branca, trânsito e resistência','drugs']]:[]),
      ...(cmdData.length?[['Ocorrências por comandantes de viaturas',comandantesNaPaginaResultados?'results':'commanders']]:[]),
      ['4. MÍDIAS DE DADOS ESTATÍSTICOS DE PRODUTIVIDADE','final']
    ];

    const htmlPages=[];
    htmlPages.push(pageShell(coverHtml(periodo),1,total,{cover:true}));
    htmlPages.push(pageShell(tocHtml(toc,keyPage),2,total,{key:'summary'}));
    bodyPages.forEach((p,i)=>htmlPages.push(pageShell(p.html,i+3,total,{key:p.key,layout:p.layout||''})));
    doc.innerHTML=htmlPages.join('');
    await Promise.all([...doc.images].map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=img.onerror=r})));
    if(document.fonts?.ready)await document.fonts.ready;
  };
})();
