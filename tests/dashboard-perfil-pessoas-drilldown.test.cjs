'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','dashboard.html'),'utf8');
const start=html.indexOf('function dadosPessoaInformados(');
const end=html.indexOf('async function consultarCipaPaginado(',start);
assert.ok(start>0&&end>start,'Funções de perfil devem existir no dashboard');
const source=html.slice(start,end);
const makes=()=>{
 const charts=[],links=[],details=[],boxes={perfilVitimas:{innerHTML:''},perfilInfratores:{innerHTML:''}};
 const valid=x=>!x||['NI','N/I','NÃO INFORMADO','NAO INFORMADO'].includes(String(x).toUpperCase());
 const rank=(arr,fn,limit=999)=>Object.entries(arr.reduce((acc,p)=>{
   const k=fn(p);if(!valid(k))acc[k]=(acc[k]||0)+1;return acc;
 },{})).sort((a,b)=>b[1]-a[1]).slice(0,limit);
 const ctx={
  chart:(id,type,labels,values,label,colors,callback)=>charts.push({id,type,labels,values,callback}),
  abrirDetalhes:(title,rows,options)=>details.push({title,rows,options}),
  drillNumero:(value,title,rows,options)=>{
   links.push({value,title,rows,options});return '<button type="button" class="drill-link">'+value+'</button>';
  },
  rank,
  normalizarNacionalidade:s=>({BR:'BR — Brasileira',VE:'VE — Venezuelana'}[s]||s),
  normalizarSexo:s=>['M','F'].includes(String(s))?s:'OUTRO',
  ehNaoInformado:valid,
  num:x=>Number(x)||0,
  esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),
  corSexo:()=> '#123',
  $:key=>boxes[key],
  console
 };
 vm.runInNewContext(source+';globalThis.pesquisar={listaPessoas,perfil};',ctx);
 return {api:ctx.pesquisar,charts,links,details,boxes};
};
const o1={id:'a',data_ocorrencia:'2026-10-01',numero_bo:'101/2026',
  vitima_nacionalidade:'BR',vitima_sexo:'F',vitima_idade:32,
  infrator_nacionalidade:'BR',infrator_sexo:'M',infrator_idade:28,
  observacao_final:'observação [[PESSOAS_ENVOLVIDAS]]'+JSON.stringify({
   vitimas:[{nacionalidade:'VE',sexo:'M',idade:19},{nacionalidade:'BR',sexo:'F',idade:null}],
   infratores:[{nacionalidade:'VE',sexo:'F',idade:18}]
  })
};
const o2={id:'b',data_ocorrencia:'2026-10-02',numero_bo:'102/2026',
  vitima_nacionalidade:'BR',vitima_sexo:'F',vitima_idade:25,
  infrator_nacionalidade:'BR',infrator_sexo:'M',infrator_idade:30};
const o3={id:'c',data_ocorrencia:'2026-10-03',numero_bo:'103/2026',
 vitima_nacionalidade:'VE',vitima_sexo:'M',vitima_idade:null,
 infrator_nacionalidade:'VE',infrator_sexo:'F',infrator_idade:null};

test('a lista conserva referências aos BOs filtrados, incluindo pessoas adicionais do JSON',()=>{
 const {api}=makes(),lista=api.listaPessoas([o1,o2],'vitima');
 assert.equal(lista.length,4);
 assert.equal(lista.filter(p=>p._ocorrencia.id==='a').length,3);
 assert.equal(lista.filter(p=>p._ocorrencia.id==='b').length,1);
 assert.equal(lista[1].nacionalidade,'VE');
 assert.equal(lista[3].sexo,'F');
});

test('perfil de vítimas torna clicáveis nacionalidade, total, idade e cada campo pendente',()=>{
 const {api,boxes,links,charts,details}=makes();
 api.perfil([o1,o2],'vitima','chartVitimas','perfilVitimas');
 const htmlBox=boxes.perfilVitimas.innerHTML;
 assert.match(htmlBox,/<button type="button" class="drill-link">3<\/button>/);
 assert.match(htmlBox,/<button type="button" class="drill-link">1<\/button>/);
 assert.match(htmlBox,/<button type="button" class="drill-link">4<\/button>/);
 assert.match(htmlBox,/<button type="button" class="drill-link">19 a 32 anos<\/button>/);
 const br=links.find(x=>x.title.includes('nacionalidade BR — Brasileira'));
 assert.equal(br.value,3);assert.equal(br.options.quantidadePessoas,3);
 assert.equal(br.rows.map(x=>x.id).join(','),'a,a,b');
 const pessoas=links.find(x=>x.title.endsWith('pessoas identificadas'));
 assert.equal(pessoas.value,4);assert.equal(pessoas.rows.length,4);
 const idade=links.find(x=>x.title.endsWith(' — idade pendente'));
 assert.equal(idade.value,1);assert.equal(idade.rows[0].id,'a');
 const chart=charts[0];assert.equal(chart.type,'doughnut');
 assert.equal(typeof chart.callback,'function');
 chart.callback(chart.labels.indexOf('F'));
 assert.equal(details.length,1);
 assert.equal(details[0].options.quantidadePessoas,3);
 assert.equal(details[0].rows.map(x=>x.id).join(','),'a,a,b');
});

test('perfil de infratores usa os dados dos infratores, sem misturar vítimas e sem escapar filtro',()=>{
 const {api,links,boxes}=makes();
 api.perfil([o1,o3],'infrator','chartInfratores','perfilInfratores');
 const all=links.find(x=>x.title.endsWith('pessoas identificadas'));
 assert.equal(all.value,3);
 assert.equal(all.rows.map(o=>o.id).join(','),'a,a,c');
 assert.match(boxes.perfilInfratores.innerHTML,/Pessoas identificadas/);
 const nacionalidadeBr=links.find(x=>x.title.includes('nacionalidade BR'));
 assert.equal(nacionalidadeBr.value,1);
 assert.equal(nacionalidadeBr.rows.map(o=>o.id).join(','),'a');
 const pending=links.find(x=>x.title.endsWith(' — idade pendente'));
 assert.equal(pending.value,1);
 assert.equal(pending.rows.map(o=>o.id).join(','),'c');
});

test('só consulta registros da seleção atual, sem criar outro RPC e sem mudar totais',()=>{
 assert.match(html,/perfil\(a,'infrator','chartInfratores','perfilInfratores'\);perfil\(a,'vitima','chartVitimas','perfilVitimas'\)/);
 assert.match(source,/const regs=grupo=>grupo\.map\(p=>p\._ocorrencia\)\.filter\(Boolean\)/);
 assert.doesNotMatch(source,/\.from\(|\.rpc\(|fetch\(/);
 const {api}=makes();
 assert.equal(api.listaPessoas([o1,o2],'vitima').length,4);
 assert.equal(api.listaPessoas([o1],'vitima').length,3);
});

test('modal informa diferença entre contagem de pessoas e de ocorrências',()=>{
 assert.match(html,/Number\.isInteger\(opcoes\.quantidadePessoas\)\?opcoes\.quantidadePessoas\+' pessoa\(s\) em '/);
 assert.match(html,/Uma ocorrência pode conter mais de uma pessoa\./);
 assert.match(html,/if\(!opcoes\.preservarDuplicados\)/); // mantem BO único no detalhe
 assert.match(html,/contextoCpcSomenteLeitura\(\)/);
});

test('JavaScript principal continua sintaticamente válido',()=>{
 for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
  if(match[1].trim())assert.doesNotThrow(()=>new Function(match[1]));
 }
});
