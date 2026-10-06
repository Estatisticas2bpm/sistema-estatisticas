import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {ocorrencias,ocorrenciasComparadas,tcos,tcosComparados,esperado} from './fixtures/relatorio-2bpm-q3-2026.fixture.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const pdfDir=path.join(root,'tmp','pdfs');
const shotDir=path.join(root,'tmp','screenshots');
const pdfPath=path.join(pdfDir,'relatorio-2bpm-q3-2026.pdf');
const metricsPath=path.join(pdfDir,'relatorio-2bpm-q3-2026-metricas.json');
const harnessPath=path.join(pdfDir,'relatorio-2bpm-q3-2026-harness.html');
fs.mkdirSync(pdfDir,{recursive:true});
fs.mkdirSync(shotDir,{recursive:true});

const nodeModules=process.env.CODEX_NODE_MODULES||'C:\\Users\\HOME\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules';
const require=createRequire(import.meta.url);
const {chromium}=require(path.join(nodeModules,'playwright'));
const chromePath=process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function chartStub(){return `<script>
window.Chart=class ChartQa {
  constructor(canvas,config){this.canvas=canvas;this.config=config;this.draw()}
  draw(){
    const c=this.canvas;c.width=c.width||1200;c.height=c.height||760;
    const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
    const values=this.config?.data?.datasets?.[0]?.data||[];
    const labels=this.config?.data?.labels||[];const max=Math.max(1,...values);
    x.fillStyle='#173b5e';x.font='bold 28px Arial';x.fillText('SIE-CPC / 2º BPM',34,45);
    values.slice(0,10).forEach((v,i)=>{
      const slot=(c.width-100)/Math.max(1,Math.min(10,values.length));const h=(Number(v)||0)/max*(c.height-180);
      x.fillStyle=['#2563eb','#168eaa','#059669','#d97706','#7c3aed','#dc2626'][i%6];
      x.fillRect(55+i*slot,c.height-90-h,Math.max(18,slot-18),h);
      x.save();x.translate(62+i*slot,c.height-62);x.rotate(-.35);x.fillStyle='#20384d';x.font='17px Arial';x.fillText(String(labels[i]||'').slice(0,18),0,0);x.restore();
    });
  }
  update(){this.draw()}
  toBase64Image(){return this.canvas.toDataURL('image/png')}
  destroy(){}
};
</script>`}

function dataStub(){return `<script>
const __qaAtual=${JSON.stringify(ocorrencias)};
const __qaAnterior=${JSON.stringify(ocorrenciasComparadas)};
const __qaTcos=${JSON.stringify(tcos)};
const __qaTcosAnterior=${JSON.stringify(tcosComparados)};
window.supabase={createClient(){return{rpc(nome,args={}){
  const anterior=String(args.data_inicio||'').startsWith('2025-');
  if(nome==='obter_dados_dashboard')return Promise.resolve({data:anterior?__qaAnterior:__qaAtual,error:null});
  if(nome==='obter_tcos_dashboard')return Promise.resolve({data:anterior?__qaTcosAnterior:__qaTcos,error:null});
  return Promise.resolve({data:[],error:null});
}}}};
window.SistemaAuth={
  contexto:{sigla:'2BPM',nome:'2º Batalhão de Polícia Militar'},
  perfil:{posto_graduacao:'SGT PM',nome:'SERVIDOR DE TESTE INSTITUCIONAL',nome_guerra:'TESTE'},
  client:{},user:{id:'visual-test'},ready:Promise.resolve()
};
</script>`}

function qaHtml(){
  const source=fs.readFileSync(path.join(root,'relatorio.html'),'utf8');
  return source
    .replace('<head>',`<head><base href="${pathToFileURL(root+path.sep).href}">`)
    .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>',chartStub())
    .replace('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',dataStub())
    .replace('<script src="auth-config.js"></script><script src="auth-guard.js"></script>','')
    .replace(/iniciarRelatorio\(\);\s*<\/script><\/body>/,'iniciarRelatorio().then(()=>{window.__qaDone=true}).catch(error=>{window.__qaError=String(error&&error.stack||error);console.error(error)});</script></body>');
}
fs.writeFileSync(harnessPath,qaHtml(),'utf8');
const browser=await chromium.launch({headless:true,executablePath:chromePath,args:['--no-sandbox','--disable-dev-shm-usage','--allow-file-access-from-files']});
const page=await browser.newPage({viewport:{width:1440,height:1200},deviceScaleFactor:1});
const consoleErrors=[];
page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
page.on('pageerror',error=>consoleErrors.push(error.stack||error.message));

try{
  await page.goto(`${pathToFileURL(harnessPath).href}?ini=2026-07-01&fim=2026-09-30&comparar=ano`,{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>window.__qaDone||window.__qaError,null,{timeout:120000});
  const qaError=await page.evaluate(()=>window.__qaError||'');
  assert.equal(qaError,'',`Falha na composição A4: ${qaError}`);
  await page.waitForFunction(()=>document.documentElement.dataset.relatorioPronto==='1',null,{timeout:30000});

  const metrics=await page.evaluate(()=>{
    const report=document.getElementById('relatorioPrint');
    const pages=[...report.querySelectorAll('.print-page')];
    const px=element=>{const r=element.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
    const pageMetrics=pages.map((sheet,index)=>{
      const content=sheet.querySelector('.print-page__content,.print-cover');
      const blocks=content?[...content.children].map(node=>({tag:node.tagName,className:node.className,text:(node.textContent||'').trim().slice(0,90),rect:px(node)})):[];
      return{
        page:index+1,kind:sheet.dataset.pageKind,sections:sheet.dataset.sections||'',rect:px(sheet),
        scrollWidth:sheet.scrollWidth,clientWidth:sheet.clientWidth,
        scrollHeight:sheet.scrollHeight,clientHeight:sheet.clientHeight,
        contentScrollWidth:content?.scrollWidth||0,contentClientWidth:content?.clientWidth||0,
        contentScrollHeight:content?.scrollHeight||0,contentClientHeight:content?.clientHeight||0,
        occupied:Number(sheet.dataset.qaOccupancy||0),text:(content?.textContent||'').trim(),blocks
      };
    });
    const commanderTables=[...report.querySelectorAll('table[data-table-key="commanders"]')];
    const occurrenceTables=[...report.querySelectorAll('table[data-table-key="occurrences"]')];
    const dataRows=table=>[...table.tBodies[0].rows].filter(row=>!row.classList.contains('print-total'));
    const occurrenceRows=occurrenceTables.flatMap(dataRows);
    const frequencies=occurrenceRows.map(row=>Number(row.cells[2]?.textContent||0));
    return{
      validation:window.RelatorioPrint.getLastValidation(),
      pageMetrics,
      text:report.textContent||'',
      canvases:report.querySelectorAll('canvas').length,
      controls:report.querySelectorAll('button,input,select,.toolbar').length,
      images:[...report.querySelectorAll('img')].map(img=>({alt:img.alt,complete:img.complete,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,rect:px(img)})),
      footers:pages.map(sheet=>sheet.querySelector('.print-page__footer')?.textContent||''),
      toc:[...report.querySelectorAll('[data-toc-target]')].map(item=>({key:item.dataset.tocTarget,page:item.querySelector('.print-toc__page')?.textContent||''})),
      commander:{
        pages:[...new Set(commanderTables.map(table=>Number(table.closest('.print-page')?.dataset.pageNumber)))],
        rows:commanderTables.flatMap(dataRows).length,
        rowsPerPage:commanderTables.map(table=>dataRows(table).length),
        headers:commanderTables.map(table=>[...table.tHead.rows[0].cells].map(cell=>cell.textContent)),
        totals:commanderTables.reduce((n,table)=>n+table.querySelectorAll('tr.print-total').length,0),
        titles:commanderTables.map(table=>table.previousElementSibling?.textContent||'')
      },
      occurrences:{rows:occurrenceRows.length,sum:frequencies.reduce((a,b)=>a+b,0),other:occurrenceRows.find(row=>row.cells[1]?.textContent==='OUTRAS OCORRÊNCIAS')?.cells[2]?.textContent||'',totals:occurrenceTables.reduce((n,table)=>n+table.querySelectorAll('tr.print-total').length,0)}
    };
  });

  assert.equal(metrics.validation.ok,true,'Validação interna do compositor deve ser aprovada.');
  assert.equal(metrics.canvases,0,'PDF não pode conter canvas responsivo.');
  assert.equal(metrics.controls,0,'Documento A4 não pode conter controles administrativos.');
  assert.ok(!/\bTODAS?\b/i.test(metrics.text),'A palavra “Todas” não pode aparecer sem filtro territorial.');
  assert.equal(metrics.commander.rows,esperado.comandantes,'Todos os 98 comandantes devem aparecer.');
  assert.ok(metrics.commander.pages.length>=3&&metrics.commander.pages.length<=4,`Comandantes ocuparam ${metrics.commander.pages.length} páginas; esperado: 3 ou 4.`);
  assert.ok(metrics.commander.rowsPerPage.every(rows=>rows>=30&&rows<=34),`Densidade dos comandantes fora de 30–34 linhas: ${metrics.commander.rowsPerPage.join(', ')}.`);
  assert.equal(metrics.commander.totals,1,'Total dos comandantes deve aparecer somente no último segmento.');
  assert.ok(metrics.commander.titles.slice(1).every(title=>title.includes('CONTINUAÇÃO')),'Continuações dos comandantes devem estar identificadas.');
  assert.ok(metrics.commander.headers.every(headers=>headers.join('|')==='ITEM|COMANDANTE|OCORRÊNCIAS|RESULTADOS OPERACIONAIS'),'Cabeçalho dos comandantes deve repetir em todas as páginas.');
  assert.equal(metrics.occurrences.rows,21,'Tabela principal deve conter TOP 20 + Outras.');
  assert.equal(metrics.occurrences.sum,esperado.ocorrencias,'TOP 20 + Outras deve preservar as 711 ocorrências.');
  assert.equal(Number(metrics.occurrences.other),esperado.outras,'Outras ocorrências deve somar as 42 classificações restantes.');
  assert.equal(metrics.occurrences.totals,1,'Total das ocorrências deve existir uma única vez.');
  assert.ok(metrics.images.every(image=>image.complete&&image.naturalWidth>0),'Todas as imagens devem estar carregadas antes da impressão.');
  assert.ok(metrics.toc.every(item=>/^\d+$/.test(item.page)),'Sumário deve conter páginas físicas reais.');
  assert.ok(metrics.pageMetrics.every(sheet=>sheet.clientWidth>=790&&sheet.clientWidth<=795&&sheet.clientHeight>=1120&&sheet.clientHeight<=1124),'Cada folha deve medir 210 × 297 mm no navegador.');
  assert.ok(metrics.pageMetrics.every(sheet=>sheet.scrollWidth<=sheet.clientWidth+1&&sheet.scrollHeight<=sheet.clientHeight+1),'Nenhuma folha pode ter overflow.');
  assert.ok(metrics.pageMetrics.every(sheet=>sheet.contentScrollWidth<=sheet.contentClientWidth+1&&sheet.contentScrollHeight<=sheet.contentClientHeight+1),'Conteúdo deve permanecer dentro da área útil.');
  assert.ok(metrics.pageMetrics.every(sheet=>sheet.text.length>0),'Nenhuma página pode ficar vazia.');
  const subutilizadas=metrics.pageMetrics.slice(2,-1).filter(sheet=>sheet.occupied<.60).map(sheet=>`${sheet.page}:${sheet.occupied.toFixed(3)}`);
  assert.deepEqual(subutilizadas,[],`Páginas comuns abaixo de 60% de ocupação: ${subutilizadas.join(', ')}.`);
  assert.ok(metrics.pageMetrics.every(sheet=>sheet.blocks.every((block,index,blocks)=>index===0||blocks[index-1].rect.bottom<=block.rect.y+1)),'Blocos de conteúdo não podem se sobrepor.');
  assert.ok(metrics.footers.every((footer,index)=>footer===`Página ${index+1} de ${metrics.pageMetrics.length}`),'Rodapés devem corresponder ao total físico.');

  for(const file of fs.readdirSync(shotDir))if(/^relatorio-2bpm-q3-2026-page-\d+\.png$/.test(file))fs.rmSync(path.join(shotDir,file));
  await page.emulateMedia({media:'print'});
  const sheets=page.locator('#relatorioPrint .print-page');
  for(let index=0;index<metrics.pageMetrics.length;index+=1){
    await sheets.nth(index).screenshot({path:path.join(shotDir,`relatorio-2bpm-q3-2026-page-${String(index+1).padStart(2,'0')}.png`)});
  }

  await page.pdf({path:pdfPath,format:'A4',printBackground:true,preferCSSPageSize:true,margin:{top:'0',right:'0',bottom:'0',left:'0'}});
  const info=spawnSync('pdfinfo',[pdfPath],{encoding:'utf8'});
  assert.equal(info.status,0,`pdfinfo falhou: ${info.stderr}`);
  const pdfPages=Number((info.stdout.match(/^Pages:\s+(\d+)/m)||[])[1]);
  assert.equal(pdfPages,metrics.pageMetrics.length,'PDF deve conter exatamente uma folha para cada .print-page.');

  const result={...metrics,expected:esperado,pdfPages,consoleErrors,generatedAt:new Date().toISOString()};
  fs.writeFileSync(metricsPath,JSON.stringify(result,null,2),'utf8');
  assert.equal(consoleErrors.length,0,`Erros no console: ${consoleErrors.join('\n')}`);
  console.log(JSON.stringify({pdfPath,metricsPath,screenshots:metrics.pageMetrics.length,pageCount:pdfPages,commanderPages:metrics.commander.pages,rowsPerCommanderPage:metrics.commander.rowsPerPage,occupancy:metrics.pageMetrics.map(p=>p.occupied)},null,2));
}finally{
  await browser.close();
}
