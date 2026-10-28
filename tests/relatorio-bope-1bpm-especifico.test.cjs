'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','relatorio.html'),'utf8');
function extrair(ini,fim){
  const a=html.indexOf(ini),b=html.indexOf(fim,a);
  assert.ok(a>0&&b>a,'Função não localizada: '+ini);
  return html.slice(a,b);
}
const code=extrair('function paginaAnaliticaPorUnidadeRel(d){','async function build(){');
const filter=extrair('function filtrarTerritorio(base){','function page(');
let bope=true;
const input={value:'',options:[{text:'Todas'},{text:'Força Tática'}],selectedIndex:0};
const scope={
  ehBopeRel:()=>bope,eh1BpmRel:()=>!bope,unidadeSelecionadaRelCpc:()=>null,ini:{value:'2026-10-01'},fim:{value:'2026-10-12'},
  dateBR:v=>v.split('-').reverse().join('/'),
  escopoTerritorialVisivel:()=>'BOPE — todas as subunidades',
  $:()=>input,sisc:{value:''},companhia:{value:''},
  E:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;'),
  ehNaoInformadoRel:v=>!v||v==='NI',
  table:(head,rows,total='')=>'<table><thead>'+head.join('|')+'</thead><tbody>'+rows.join('')+total+'</tbody></table>',
  page:(titulo,body,sec)=>'<section data-section="'+sec+'"><h2>'+titulo+'</h2>'+body+'</section>',
  rank:(lista,campo)=>Object.entries(lista.reduce((m,x)=>{if(x[campo])m[x[campo]]=(m[x[campo]]||0)+1;return m;},{}))
};
vm.createContext(scope);
vm.runInContext(code+filter,scope);
const dados=[
  {subunidade_operacional_sigla:'FORCA_TATICA',sisc:'SISC 4',companhia:'1ª CIA'},
  {subunidade_operacional_sigla:'FORCA_TATICA',sisc:'SISC 4',companhia:'1ª CIA'},
  {subunidade_operacional_sigla:'CHOQUE',sisc:'SISC 5',companhia:'2ª CIA'},
  {subunidade_operacional_sigla:null,sisc:null,companhia:null}
];
let pagina=scope.paginaAnaliticaPorUnidadeRel(dados);
assert.match(pagina,/DISTRIBUIÇÃO DOS REGISTROS POR SUBUNIDADE DO BOPE/);
assert.match(pagina,/Força Tática/);
assert.match(pagina,/Choque/);
assert.match(pagina,/Canil/);
assert.match(pagina,/GATE/);
assert.match(pagina,/Sem subunidade operacional identificada/);
assert.match(pagina,/TOTAL DE OCORRÊNCIAS/);
assert.match(pagina,/subunidade operacional informada na ocorrência/);
input.value='FORCA_TATICA';
assert.equal(scope.filtrarTerritorio(dados).length,2,'BOPE deve ser filtrado por subunidade operacional do BO, não território');
bope=false;input.value='';scope.sisc.value='SISC 4';scope.companhia.value='';
assert.equal(scope.filtrarTerritorio(dados).length,2,'1º BPM mantém filtro SISC');
scope.sisc.value='';
pagina=scope.paginaAnaliticaPorUnidadeRel(dados);
assert.match(pagina,/DISTRIBUIÇÃO TERRITORIAL DO 1º BPM/);
assert.match(pagina,/REGISTROS POR SISC/);
assert.match(pagina,/REGISTROS POR COMPANHIA/);
assert.match(pagina,/sem SISC/);
assert.match(pagina,/não devem ser somados entre si/);
assert.match(html,/subunidadeBopeWrap'\)\.hidden=false/);
assert.match(html,/const semProgramasPrevencao=!\(window\.SistemaAuth/);
assert.match(html,/const falhaConsulta=res\.find\(x=>x\?\.error\)\?\.error/);
assert.doesNotMatch(html,/VISITAS REALIZADAS PELO POLÍCIA NA RUA PR6 E VTR AME/);
assert.match(html,/AÇÕES PREVENTIVAS CADASTRADAS NO CPC \(ORIGEM NÃO IDENTIFICADA\)/);
console.log('OK: relatório BOPE por subunidade e 1º BPM por SISC/CIA, com fontes e falhas explícitas.');
