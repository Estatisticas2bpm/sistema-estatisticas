(function(){
  'use strict';

  const state={readyPromise:Promise.resolve(),lastValidation:null,composer:null};
  const COLORS=['#2563eb','#168eaa','#059669','#d97706','#7c3aed','#dc2626','#64748b','#0ea5e9','#84cc16','#f97316'];

  function value(v){return v===null||v===undefined?'':String(v)}
  function printable(v){return value(v)}
  function create(tag,className,text){
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined)node.textContent=printable(text);
    return node;
  }
  function nextPaint(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))}
  async function waitForFonts(){if(document.fonts?.ready)await document.fonts.ready;await nextPaint()}
  async function waitForImages(root){
    await Promise.all([...root.querySelectorAll('img')].map(img=>{
      if(img.complete&&img.naturalWidth)return img.decode?img.decode().catch(()=>{}):Promise.resolve();
      return new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true})});
    }));
    await nextPaint();
  }

  function makeCell(spec,tag='td'){
    const cell=create(tag);
    const data=typeof spec==='object'&&spec!==null?spec:{text:spec};
    cell.textContent=printable(data.text??'');
    if(data.colspan)cell.colSpan=data.colspan;
    if(data.align)cell.dataset.align=data.align;
    if(data.className)cell.className=data.className;
    return cell;
  }

  function makeRow(cells,className=''){
    const row=create('tr',className);
    (cells||[]).forEach(cell=>row.appendChild(makeCell(cell)));
    return row;
  }

  function makeTable(headers,rows,{widths=[],className='',tableKey=''}={}){
    const table=create('table',className);
    if(tableKey)table.dataset.tableKey=tableKey;
    if(widths.length){
      const colgroup=create('colgroup');
      widths.forEach(width=>{const col=create('col');col.style.width=width;colgroup.appendChild(col)});
      table.appendChild(colgroup);
    }
    const thead=create('thead'),headRow=create('tr');
    headers.forEach(header=>headRow.appendChild(makeCell(header,'th')));
    thead.appendChild(headRow);table.appendChild(thead);
    const tbody=create('tbody');
    (rows||[]).forEach(row=>tbody.appendChild(makeRow(row)));
    table.appendChild(tbody);
    return table;
  }

  function chartConfig(spec){
    const type=spec.type||'bar';
    const dataset={
      data:spec.values||[],
      backgroundColor:type==='pie'?COLORS.slice(0,(spec.values||[]).length):(spec.color||'#168eaa'),
      borderColor:type==='line'?(spec.color||'#2563eb'):'#fff',
      borderWidth:type==='line'?3:1,
      pointRadius:type==='line'?4:0,
      tension:type==='line'?.25:0,
      fill:false
    };
    return{
      type,
      data:{labels:spec.labels||[],datasets:[dataset]},
      options:{
        responsive:false,
        animation:false,
        devicePixelRatio:2,
        layout:{padding:{top:18,right:20,bottom:18,left:20}},
        scales:type==='pie'?undefined:{
          x:{ticks:{font:{size:12},maxRotation:35,minRotation:0},grid:{display:false}},
          y:{beginAtZero:true,ticks:{precision:0,font:{size:12}},grid:{color:'#dce5eb'}}
        },
        plugins:{
          title:{display:false},
          legend:{display:type==='pie',position:'right',labels:{boxWidth:14,padding:12,font:{size:12}}}
        }
      }
    };
  }

  async function chartImage(spec){
    if(typeof window.Chart!=='function')throw new Error('Chart.js não está disponível para gerar as imagens do relatório.');
    const host=create('div');
    host.style.cssText='position:fixed;left:-20000px;top:0;width:1200px;height:760px;background:#fff;';
    const canvas=create('canvas');
    canvas.width=spec.width||1200;canvas.height=spec.height||760;
    host.appendChild(canvas);document.body.appendChild(host);
    const chart=new window.Chart(canvas,chartConfig(spec));
    chart.update('none');
    const src=typeof chart.toBase64Image==='function'?chart.toBase64Image('image/png',1):canvas.toDataURL('image/png');
    chart.destroy();host.remove();
    return src;
  }

  function createChartBlock(title,src,{small=false,source='',alt='Gráfico estatístico'}={}){
    const block=create('div','print-block print-block--chart');
    block.dataset.blockKind='chart';
    block.appendChild(create('h3','print-subtitle',title));
    const image=create('img','print-chart');image.src=src;image.alt=alt;
    if(small)image.dataset.size='small';
    block.appendChild(image);
    if(source)block.appendChild(create('p','print-source',source));
    return block;
  }

  function createChartPair(items){
    const block=create('div','print-block print-block--chart');
    block.dataset.blockKind='chart-pair';
    const grid=create('div','print-chart-grid');
    items.forEach(item=>{
      const panel=create('div','print-chart-panel');
      panel.appendChild(create('h3','print-subtitle',item.title));
      const image=create('img','print-chart');image.src=item.src;image.alt=item.alt||item.title;
      panel.appendChild(image);grid.appendChild(panel);
    });
    block.appendChild(grid);
    if(items[0]?.source)block.appendChild(create('p','print-source',items[0].source));
    return block;
  }

  class A4Composer{
    constructor(container,meta){this.container=container;this.meta=meta;this.current=null;this.pages=[];this.warnings=[]}

    reset(){this.container.replaceChildren();this.current=null;this.pages=[];this.warnings=[]}

    headerLines(){
      const lines=[printable(this.meta.periodTitle)];
      if(value(this.meta.scopeLabel).trim())lines.push(printable(this.meta.scopeLabel));
      lines.push(printable(this.meta.unitName).toUpperCase());
      return lines;
    }

    markSection(page,key){
      if(!key)return;
      const keys=new Set(value(page.dataset.sections).split(/\s+/).filter(Boolean));keys.add(key);page.dataset.sections=[...keys].join(' ');
    }

    createPage({kind='normal',sectionKey='',occupancyExempt=false}={}){
      const page=create('section','print-page'+(kind==='cover'?' print-page--cover':''));
      page.dataset.pageKind=kind;
      if(occupancyExempt)page.dataset.occupancyExempt='1';
      this.markSection(page,sectionKey);
      let content,footer;
      if(kind==='cover'){
        content=create('div','print-cover');page.appendChild(content);
      }else{
        const header=create('header','print-page__header');
        this.headerLines().forEach((line,index)=>{if(index)header.appendChild(document.createElement('br'));header.appendChild(document.createTextNode(line))});
        content=create('div','print-page__content');
        page.append(header,content);
      }
      footer=create('footer','print-page__footer');page.appendChild(footer);
      this.container.appendChild(page);
      const record={page,content,footer,kind};this.pages.push(record);this.current=record;
      return record;
    }

    createCover(model){
      const record=this.createPage({kind:'cover',occupancyExempt:true});
      const top=create('div','print-cover__institution');
      const pmrr=create('img');pmrr.src=model.logos.pmrr;pmrr.alt='Brasão da Polícia Militar de Roraima';
      const institution=create('div');
      ['ESTADO DE RORAIMA','POLÍCIA MILITAR DE RORAIMA','COMANDO DE POLICIAMENTO DA CAPITAL - CPC',model.unit.name,'“AMAZÔNIA: PATRIMÔNIO DOS BRASILEIROS”'].forEach((line,index)=>{if(index)institution.appendChild(document.createElement('br'));institution.appendChild(document.createTextNode(printable(line).toUpperCase()))});
      const unit=create('img');unit.src=model.logos.unit;unit.alt='Brasão do 2º Batalhão de Polícia Militar';
      top.append(pmrr,institution,unit);
      const title=create('div','print-cover__title');
      title.append(create('h1','',model.coverTitle),create('h2','',model.period.title));
      if(model.scopeLabel)title.appendChild(create('h3','print-cover__scope',model.scopeLabel));
      const place=create('div','print-cover__place');place.append(document.createTextNode('BOA VISTA - RR'),document.createElement('br'),document.createElement('br'),document.createTextNode(printable(model.period.years)));
      record.content.append(top,title,place);
    }

    createSummary(toc){
      const record=this.createPage({kind:'summary',sectionKey:'summary',occupancyExempt:true});
      record.content.appendChild(create('h2','print-section-title','SUMÁRIO'));
      const list=create('ol','print-toc');
      toc.forEach(item=>{
        const li=create('li');li.dataset.tocTarget=item.key;
        li.append(create('span','',item.label),create('span','print-toc__dots'),create('span','print-toc__page','-'));
        list.appendChild(li);
      });
      record.content.appendChild(list);
    }

    fits(record=this.current){return record.content.scrollHeight<=record.content.clientHeight+1}
    hasContent(record=this.current){return [...record.content.children].some(node=>value(node.textContent).trim()||node.matches('table,img,.print-chart-grid'))}

    ensurePage(sectionKey='',forceNew=false,occupancyExempt=false){
      if(forceNew||!this.current||this.current.kind!=='normal')this.createPage({sectionKey,occupancyExempt});
      this.markSection(this.current.page,sectionKey);return this.current;
    }

    addBlock(node,{sectionKey='',forceNew=false,occupancyExempt=false}={}){
      let record=this.ensurePage(sectionKey,forceNew,occupancyExempt),hadContent=this.hasContent(record);
      record.content.appendChild(node);
      if(!this.fits(record)&&hadContent){
        node.remove();record=this.ensurePage(sectionKey,true,occupancyExempt);record.content.appendChild(node);
      }
      if(!this.fits(record))this.warnings.push('Bloco maior que a área útil: '+(node.dataset.blockKind||node.className||node.tagName));
      return record;
    }

    tableSegment(config,{continuation=false,forceNew=false}={}){
      let record=this.ensurePage(config.sectionKey,forceNew);
      const segment=create('div','print-block print-table-segment');segment.dataset.blockKind='table';
      if(!continuation&&config.sectionTitle)segment.appendChild(create('h2','print-section-title',config.sectionTitle));
      const title=continuation?config.title+' - CONTINUAÇÃO':config.title;
      segment.appendChild(create('h3','print-subtitle',title));
      const table=makeTable(config.headers,[],{widths:config.widths,className:config.className||'',tableKey:config.tableKey||''});
      segment.appendChild(table);
      const hadContent=this.hasContent(record);record.content.appendChild(segment);
      if(!this.fits(record)&&hadContent){segment.remove();record=this.ensurePage(config.sectionKey,true);record.content.appendChild(segment)}
      this.markSection(record.page,config.sectionKey);
      return{record,segment,table,tbody:table.tBodies[0],continuation};
    }

    addTable(config){
      const rows=(config.rows||[]).length?config.rows:[[ {text:'SEM REGISTROS NO PERÍODO',colspan:config.headers.length,align:'center'} ]];
      let segment=this.tableSegment(config,{continuation:false,forceNew:!!config.forceNew});
      rows.forEach(cells=>{
        const row=makeRow(cells);segment.tbody.appendChild(row);
        if(this.fits(segment.record))return;
        row.remove();
        const pageHasOther=segment.record.content.children.length>1;
        if(segment.tbody.rows.length===0&&pageHasOther){
          segment.segment.remove();segment=this.tableSegment(config,{continuation:false,forceNew:true});segment.tbody.appendChild(row);
        }else{
          segment=this.tableSegment(config,{continuation:true,forceNew:true});segment.tbody.appendChild(row);
        }
        if(!this.fits(segment.record))this.warnings.push('Linha de tabela maior que a área útil: '+config.title);
      });

      if(config.totalRow){
        let total=makeRow(config.totalRow,'print-total');segment.tbody.appendChild(total);
        if(!this.fits(segment.record)){
          total.remove();
          const moved=segment.tbody.lastElementChild;
          if(moved)moved.remove();
          segment=this.tableSegment(config,{continuation:true,forceNew:true});
          if(moved)segment.tbody.appendChild(moved);
          total=makeRow(config.totalRow,'print-total');segment.tbody.appendChild(total);
        }
      }

      if(config.source){
        const source=create('p','print-source',config.source);segment.segment.appendChild(source);
        if(!this.fits(segment.record)){
          source.remove();
          const total=segment.tbody.querySelector('tr.print-total');if(total)total.remove();
          const moved=segment.tbody.lastElementChild;if(moved)moved.remove();
          segment=this.tableSegment(config,{continuation:true,forceNew:true});
          if(moved)segment.tbody.appendChild(moved);if(total)segment.tbody.appendChild(total);segment.segment.appendChild(source);
        }
      }
      return segment.record;
    }

    removeEmptyPages(){
      this.pages=[...this.pages].filter(record=>{
        if(record.kind==='cover'||record.kind==='summary')return true;
        if(this.hasContent(record))return true;
        record.page.remove();return false;
      });
      this.current=this.pages[this.pages.length-1]||null;
    }

    updateSummary(){
      this.container.querySelectorAll('[data-toc-target]').forEach(item=>{
        const key=item.dataset.tocTarget;
        const index=this.pages.findIndex(record=>value(record.page.dataset.sections).split(/\s+/).includes(key));
        item.querySelector('.print-toc__page').textContent=index>=0?String(index+1):'-';
      });
    }

    numberPages(){
      const total=this.pages.length;
      this.pages.forEach((record,index)=>{record.page.dataset.pageNumber=String(index+1);record.footer.textContent='Página '+(index+1)+' de '+total});
    }

    occupancy(record){
      if(record.kind==='cover')return 1;
      const children=[...record.content.children];if(!children.length)return 0;
      const base=record.content.getBoundingClientRect(),last=children[children.length-1].getBoundingClientRect();
      return Math.max(0,Math.min(1,(last.bottom-base.top)/Math.max(1,record.content.clientHeight)));
    }

    validate(){
      const pages=this.pages.map((record,index)=>{
        const overflow=record.kind!=='cover'&&record.content.scrollHeight>record.content.clientHeight+1;
        const occupied=this.occupancy(record);
        record.page.dataset.qaOverflow=overflow?'1':'0';record.page.dataset.qaOccupancy=occupied.toFixed(3);
        return{page:index+1,kind:record.kind,overflow,occupied,sections:value(record.page.dataset.sections)};
      });
      const empty=pages.filter((_,i)=>this.pages[i].kind==='normal'&&!this.hasContent(this.pages[i])).map(x=>x.page);
      const overflow=pages.filter(x=>x.overflow).map(x=>x.page);
      const unresolved=[...this.container.querySelectorAll('.print-toc__page')].filter(x=>x.textContent==='-').length;
      const canvases=this.container.querySelectorAll('canvas').length;
      const controls=this.container.querySelectorAll('button,input,select,.toolbar,#sistemaUsuarioSessao,#sistemaUnidadeAtiva,#sistemaAvisoAcesso').length;
      const banned=!value(this.meta.scopeLabel).trim()&&/\bTODAS?\b/i.test(this.container.textContent||'');
      const commanderPages=new Set([...this.container.querySelectorAll('table[data-table-key="commanders"]')].map(table=>table.closest('.print-page')?.dataset.pageNumber)).size;
      const commanderRows=this.container.querySelectorAll('table[data-table-key="commanders"] tbody tr:not(.print-total)').length;
      return{ok:!empty.length&&!overflow.length&&!unresolved&&!canvases&&!controls&&!banned&&!this.warnings.length,pageCount:pages.length,pages,emptyPages:empty,overflowPages:overflow,unresolvedToc:unresolved,canvasCount:canvases,controlCount:controls,bannedAllLabel:banned,commanderPages,commanderRows,warnings:[...this.warnings]};
    }
  }

  function signatureBlock(responsible){
    const block=create('div','print-block print-signature');block.dataset.blockKind='signature';
    block.append(document.createTextNode('Boa Vista/RR, '+printable(responsible.date)+'.'),create('div','print-signature__space'),create('strong','','RESPONSÁVEL PELO RELATÓRIO'),document.createElement('br'),create('strong','',responsible.identification),document.createElement('br'),document.createTextNode(printable(responsible.role)));
    return block;
  }

  function staticTableBlock({sectionTitle,title,headers,rows,totalRow,widths,tableKey,className}){
    const block=create('div','print-block');block.dataset.blockKind='final-table';
    if(sectionTitle)block.appendChild(create('h2','print-section-title',sectionTitle));
    if(title)block.appendChild(create('h3','print-subtitle',title));
    const table=makeTable(headers,rows,{widths,tableKey,className});
    if(totalRow)table.tBodies[0].appendChild(makeRow(totalRow,'print-total'));
    block.appendChild(table);return block;
  }

  async function renderDocument(model){
    const container=document.getElementById('relatorioPrint');
    if(!container)throw new Error('Container #relatorioPrint não encontrado.');
    document.body.classList.add('relatorio-print-2bpm');container.hidden=false;
    const legacy=document.getElementById('document');if(legacy)legacy.hidden=true;
    await waitForFonts();

    const chartSource='Fonte: Sistema Interno de Banco de Dados - SIE-CPC / 2º BPM.';
    const [occChart,hoodChart,daysChart,shiftsChart]=await Promise.all([
      chartImage({type:'pie',labels:model.charts.occurrences.labels,values:model.charts.occurrences.values}),
      chartImage({type:'pie',labels:model.charts.neighborhoods.labels,values:model.charts.neighborhoods.values}),
      chartImage({type:'line',labels:model.charts.days.labels,values:model.charts.days.values,color:'#2563eb',width:900,height:560}),
      chartImage({type:'bar',labels:model.charts.shifts.labels,values:model.charts.shifts.values,color:'#168eaa',width:900,height:560})
    ]);

    const composer=new A4Composer(container,{periodTitle:model.period.title,scopeLabel:model.scopeLabel,unitName:model.unit.name});
    state.composer=composer;composer.reset();composer.createCover(model);composer.createSummary(model.toc);

    composer.addTable({
      sectionKey:'docs',sectionTitle:'1. DOCUMENTAÇÕES EMITIDAS PELA UNIDADE (ROP, BO, TCO, AUTO DE INFRAÇÃO E ETC)',title:'DOCUMENTOS PRODUZIDOS',
      headers:['DOCUMENTO','QUANTIDADE'],widths:['76%','24%'],rows:model.documents.rows,totalRow:[{text:'TOTAL',align:'left'},{text:model.documents.total,align:'center'}]
    });
    composer.addTable({
      sectionKey:'occurrences',sectionTitle:'2. PRINCIPAIS TIPOS DE OCORRÊNCIAS NA UNIDADE OPERACIONAL',title:'TOP 20 CLASSIFICAÇÕES DE OCORRÊNCIAS',
      headers:['ITEM','DESCRIÇÃO','FREQUÊNCIA','BAIRROS RECORRENTES','FAIXA ETÁRIA DO INFRATOR'],widths:['7%','34%','12%','30%','17%'],rows:model.occurrences.rows,
      totalRow:[{text:'TOTAL',colspan:2},{text:model.occurrences.total,align:'center'},{text:'',colspan:2}],source:model.occurrences.source,tableKey:'occurrences'
    });
    composer.addBlock(createChartBlock('GRÁFICO DAS PRINCIPAIS OCORRÊNCIAS',occChart,{source:chartSource,alt:'Gráfico das principais ocorrências'}),{sectionKey:'occurrence-chart'});
    composer.addTable({
      sectionKey:'neighborhoods',title:'VOLUME DE OCORRÊNCIAS / PRINCIPAIS BAIRROS',headers:['ORDEM','BAIRRO','FREQUÊNCIA ATUAL','FREQUÊNCIA COMPARADA','VARIAÇÃO'],widths:['9%','37%','18%','20%','16%'],rows:model.neighborhoods.rows,
      totalRow:[{text:'TOTAL GERAL',colspan:2},{text:model.neighborhoods.currentTotal,align:'center'},{text:model.neighborhoods.comparedTotal,align:'center'},{text:model.neighborhoods.variance,align:'center'}]
    });
    composer.addBlock(createChartBlock('GRÁFICO DOS PRINCIPAIS BAIRROS',hoodChart,{source:chartSource,alt:'Gráfico dos principais bairros'}),{sectionKey:'neighborhood-chart'});
    composer.addTable({
      sectionKey:'temporal',title:'QUADRO COMPARATIVO DE OCORRÊNCIAS POR DIAS DA SEMANA / TURNO',headers:['ITEM','DESCRIÇÃO','MADRUGADA','MANHÃ','TARDE','NOITE','FREQUÊNCIA'],widths:['7%','27%','12%','12%','12%','12%','18%'],rows:model.temporal.matrix,
      totalRow:[{text:'TOTAL GERAL',colspan:2},...model.temporal.shiftTotals.map(v=>({text:v,align:'center'})),{text:model.temporal.total,align:'center'}]
    });
    composer.addBlock(createChartPair([
      {title:'OCORRÊNCIAS POR DIAS DA SEMANA',src:daysChart,source:chartSource,alt:'Gráfico de ocorrências por dia da semana'},
      {title:'OCORRÊNCIAS POR TURNOS',src:shiftsChart,alt:'Gráfico de ocorrências por turno'}
    ]),{sectionKey:'temporal'});
    composer.addTable({
      sectionKey:'streets',title:'RUAS E AVENIDAS COM PREDOMINÂNCIAS DE OCORRÊNCIAS',headers:['ORDEM','RUAS E AVENIDAS','FREQUÊNCIA','TURNO PREDOMINANTE','OCORRÊNCIAS PREDOMINANTES'],widths:['8%','31%','13%','20%','28%'],rows:model.streets.rows
    });
    composer.addTable({
      sectionKey:'people',title:'INFRATORES POR NACIONALIDADE',headers:['ITEM','STATUS','PAÍS DE ORIGEM','SEXO','FREQUÊNCIA'],widths:['8%','18%','43%','13%','18%'],rows:model.people.offenders.rows,totalRow:[{text:'TOTAL',colspan:4},{text:model.people.offenders.total,align:'center'}]
    });
    composer.addTable({
      sectionKey:'people',title:'VÍTIMAS POR NACIONALIDADE',headers:['ITEM','STATUS','PAÍS DE ORIGEM','SEXO','FREQUÊNCIA'],widths:['8%','18%','43%','13%','18%'],rows:model.people.victims.rows,totalRow:[{text:'TOTAL',colspan:4},{text:model.people.victims.total,align:'center'}]
    });
    composer.addTable({
      sectionKey:'results',sectionTitle:'3. INFORMAÇÕES GERAIS SOBRE ATUAÇÕES DA UNIDADE',title:'RESUMO DAS ATUAÇÕES DA UNIDADE',headers:['ESPECIFICAÇÃO','QUANTIDADE'],widths:['78%','22%'],rows:model.results.rows
    });
    composer.addTable({
      sectionKey:'weapons',title:'APREENSÕES DE ARMAS DE FOGO / FABRICAÇÃO CASEIRA / SIMULACROS / CARREGADORES',headers:['ESPECIFICAÇÃO','QUANTIDADE'],widths:['78%','22%'],rows:model.weapons.rows,totalRow:[{text:'TOTAL'},{text:model.weapons.total,align:'center'}]
    });
    composer.addTable({
      sectionKey:'weapons',title:'APREENSÕES DE MUNIÇÕES',headers:['ESPECIFICAÇÃO','QUANTIDADE'],widths:['78%','22%'],rows:model.ammunition.rows,totalRow:[{text:'TOTAL'},{text:model.ammunition.total,align:'center'}]
    });
    composer.addTable({
      sectionKey:'drugs',title:'ENTORPECENTES - INCIDÊNCIA POR OCORRÊNCIA',headers:['TIPO','OCORRÊNCIAS'],widths:['76%','24%'],rows:model.drugs.incidenceRows,totalRow:[{text:'TOTAL DE OCORRÊNCIAS COM ENTORPECENTES'},{text:model.drugs.totalOccurrences,align:'center'}]
    });
    composer.addTable({
      sectionKey:'drugs',title:'ENTORPECENTES - MATERIAIS REGISTRADOS POR APRESENTAÇÃO',headers:['TIPO','FORMA DE APRESENTAÇÃO','QUANTIDADE'],widths:['35%','43%','22%'],rows:model.drugs.materialRows,source:'A quantidade física é apresentada somente pela forma visual registrada na ocorrência; não são utilizados pesos ou medidas.'
    });
    composer.addTable({
      sectionKey:'other-results',title:'APREENSÕES DE ARMA BRANCA',headers:['ESPECIFICAÇÃO','QUANTIDADE'],widths:['78%','22%'],rows:model.whiteWeapons.rows,totalRow:[{text:'TOTAL'},{text:model.whiteWeapons.total,align:'center'}]
    });
    composer.addTable({
      sectionKey:'other-results',title:'AUTO DE INFRAÇÃO DE TRÂNSITO / AUTO DE REMOÇÃO',headers:['ESPECIFICAÇÃO','QUANTIDADE'],widths:['78%','22%'],rows:model.traffic.rows,totalRow:[{text:'TOTAL'},{text:model.traffic.total,align:'center'}]
    });
    composer.addTable({
      sectionKey:'other-results',title:'AUTO DE RESISTÊNCIA',headers:['ESPECIFICAÇÃO','QUANTIDADE'],widths:['78%','22%'],rows:model.resistance.rows
    });
    composer.addTable({
      sectionKey:'commanders',title:'OCORRÊNCIAS POR COMANDANTES DE VIATURAS',headers:['ITEM','COMANDANTE','OCORRÊNCIAS','RESULTADOS OPERACIONAIS'],widths:['7%','34%','14%','45%'],rows:model.commanders.rows,
      totalRow:[{text:'TOTAL COM CMT. IDENTIFICADO',colspan:2},{text:model.commanders.total,align:'center'},{text:model.commanders.resultSummary}],className:'print-commanders',tableKey:'commanders',forceNew:true
    });

    const final=staticTableBlock({
      sectionTitle:'4. MÍDIAS DE DADOS ESTATÍSTICOS DE PRODUTIVIDADE',title:'PUBLICAÇÃO - COMPARATIVO DE PRODUTIVIDADE',headers:['PUBLICAÇÃO','PERÍODO ATUAL','PERÍODO COMPARADO','VARIAÇÃO'],widths:['46%','18%','20%','16%'],rows:model.comparison.rows,tableKey:'comparison'
    });
    final.appendChild(signatureBlock(model.responsible));
    final.appendChild(create('p','print-source','Fonte: Sistema Interno de Banco de Dados - SIE-CPC / 2º BPM.'));
    composer.addBlock(final,{sectionKey:'final',forceNew:true});

    await waitForImages(container);
    composer.removeEmptyPages();composer.updateSummary();composer.numberPages();await nextPaint();
    const validation=composer.validate();state.lastValidation=validation;
    container.dataset.ready=validation.ok?'1':'0';container.dataset.pageCount=String(validation.pageCount);
    document.documentElement.dataset.relatorioPronto=validation.ok?'1':'0';
    if(!validation.ok)throw new Error('O compositor A4 encontrou inconsistências: '+JSON.stringify(validation));
    return validation;
  }

  function render2Bpm(model){
    state.readyPromise=renderDocument(model).catch(error=>{console.error('Falha ao compor relatório A4 do 2º BPM:',error);throw error});
    return state.readyPromise;
  }

  async function prepareForPrint(){
    const validation=await state.readyPromise;
    await waitForFonts();await waitForImages(document.getElementById('relatorioPrint'));
    const current=state.composer?.validate();state.lastValidation=current;
    if(!current?.ok)throw new Error('O documento não passou pela validação física A4.');
    return validation;
  }

  window.RelatorioPrint={render2Bpm,prepareForPrint,getLastValidation:()=>state.lastValidation,version:'2.0.0'};
})();
