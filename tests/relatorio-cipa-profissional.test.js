const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const script=fs.readFileSync(path.join(root,'relatorio-cipa-profissional.js'),'utf8');
const css=fs.readFileSync(path.join(root,'relatorio-cipa-profissional.css'),'utf8');
const html=fs.readFileSync(path.join(root,'relatorio.html'),'utf8');
assert.doesNotThrow(()=>new Function(script));
assert.match(html,/relatorio-cipa-profissional\.js/);
assert.match(html,/relatorio-cipa-profissional\.css/);
assert.match(css,/@media print/);
assert.match(css,/\.cipa-report/);
assert.match(script,/COMPANHIA INDEPENDENTE DE POLICIAMENTO AMBIENTAL/);
assert.doesNotMatch(script,/MONTE RORAIMA/i);
assert.match(script,/brasao-pmrr\.png/);
assert.match(script,/cipa-cover-identificacao/);
assert.match(script,/cipa-toc/);
assert.match(script,/window\.finalizarLayoutRelatorio/);
assert.match(script,/Não se somam|não se somam/);
assert.match(script,/Desmatamento e embargo|desmatamento constatado/i);
assert.match(script,/DOCUMENTOS E PROCEDIMENTOS/);
assert.match(script,/METODOLOGIA, LIMITAÇÕES E VALIDAÇÃO/);
assert.match(script,/window\.assinaturaResponsavelRelatorio/);

function iniciar(dados){
 const campo=(v='')=>({value:v,innerHTML:'',classList:{add(){}},textContent:''});
 const els={ini:campo('2026-08-01'),fim:campo('2026-08-31'),document:campo()};
 const document={getElementById:n=>(els[n]||(els[n]=campo())),title:''};
 let paginaFinalizada=0,paginaSumario=0;
 const db={
   rpc:async (nome,{data_inicio})=>{
     if(nome==='obter_tcos_dashboard_territorial')
       return {data:data_inicio==='2026-08-01'?(dados.tcos||[]):[]};
     return {data:data_inicio==='2026-08-01'?(dados.oc||[]):[]};
   },
   from:tab=>{
     const cadeia={
       select(){return cadeia},gte(){return cadeia},lte(){return cadeia},order(){return cadeia},
       range(inicio,fim){return Promise.resolve({data:(dados[tab]||[]).slice(inicio,fim+1)})},
       in(field,values){return Promise.resolve({data:(dados[tab]||[]).filter(x=>values.includes(x[field]))})}
     };
     return cadeia;
   }
 };
 const window={
   SistemaAuth:{client:db},
   periodoRelatorio:()=>({titulo:'RELATÓRIO MENSAL — AGOSTO DE 2026',anos:'2026',arquivo:'RELATORIO_AGOSTO_2026_CIPA'}),
   comparisonRange:()=>['2026-07-01','2026-07-31'],
   assinaturaResponsavelRelatorio:()=>'<b>SGT PM EXEMPLO</b><br>Seção de Estatística - CIPA',
   atualizarSumarioRelatorio:()=>{paginaSumario++},
   finalizarLayoutRelatorio:()=>{paginaFinalizada++}
 };
 new Function('window','document','requestAnimationFrame',script)(window,document,fn=>fn());
 return {render:()=>window.buildRelatorioCipa(),doc:els.document,document,contagens:()=>({paginaFinalizada,paginaSumario})};
}
(async()=>{
 const sample={
   oc:[{id:'oc1',data_ocorrencia:'2026-08-23',ocorrencia:'MAUS-TRATOS CONTRA ANIMAIS',
        municipio:'BOA VISTA',cipa_area_tipo:'URBANA',cipa_origem_atuacao:'CICC'}],
   tcos:[{id:'t1',ocorrencia_id:'oc1',numero_tco:'00000096/2026'}],
   cipa_autos_infracao:[{id:'a1',ocorrencia_id:'oc1',numero:'2026454185',data_autuacao:'2026-08-23',
     tipo_infracao:'MAUS-TRATOS DE ANIMAIS',tipo_sancao:'MULTA',valor_multa:106500,
     area_embargada_ha:0,area_desmatada_constatada_ha:null}],
   cipa_termos_embargo:[{id:'e1',ocorrencia_id:'oc1',numero:'000045/2026',data_embargo:'2026-08-23',
     area_embargada_ha:12.5,auto_infracao_originario:'2026454185'}],
   cipa_autos_notificacao:[{id:'n1',numero:'N-08',data_notificacao:'2026-08-24',descricao:'Orientação ambiental'}],
   cipa_fauna:[{id:'f1',ocorrencia_id:'oc1',data_registro:'2026-08-23',nome_comum:'Galo',
     nome_cientifico:'Gallus gallus domesticus',quantidade:71,procedimento:'APREENSÃO',
     destinacao:'MANTIDOS NO LOCAL SOB DEPÓSITO',numero_tr:'-'}],
   cipa_educacao_ambiental:[{id:'u1',data_acao:'2026-08-27',acao:'PALESTRA',local_acao:'ESCOLA',
     publico_estimado:35}],
   cipa_tdba:[{id:'b1',ocorrencia_id:'oc1',numero:'0002217'}]
 };
 const fixture=iniciar(sample);
 await fixture.render();
 const out=fixture.doc.innerHTML;
 assert.match(out,/brasao-pmrr\.png/);
 assert.match(out,/ESTADO DE RORAIMA/);
 assert.match(out,/COMANDO DE POLICIAMENTO DA CAPITAL/);
 assert.match(out,/COMPANHIA INDEPENDENTE DE POLICIAMENTO AMBIENTAL/);
 assert.doesNotMatch(out,/MONTE RORAIMA/i);
 assert.match(out,/SUMÁRIO/);
 assert.match(out,/SÍNTESE EXECUTIVA/);
 assert.match(out,/DISTRIBUIÇÃO TERRITORIAL/);
 assert.match(out,/FAUNA: ESPÉCIES E DESTINAÇÃO/);
 assert.match(out,/106\.500,00/);
 assert.match(out,/00000096\/2026|TCOs vinculados/);
 assert.match(out,/71/);
 assert.match(out,/12,5 ha/);
 assert.match(out,/0002217|TDBAs dos PPEs/);
 assert.match(out,/Não informado/);
 assert.match(out,/ANEXO A/);
 assert.match(out,/ANEXO D/);
 assert.ok((out.match(/class="page/g)||[]).length>=12);
 assert.ok(fixture.contagens().paginaFinalizada>=1);
 const vazio=iniciar({oc:[],tcos:[]});
 await vazio.render();
 assert.match(vazio.doc.innerHTML,/Não há PPEs\/BOs/);
 assert.doesNotMatch(vazio.doc.innerHTML,/data-toc-target="cipa-anexo-auto"/);
 assert.doesNotMatch(vazio.doc.innerHTML,/data-toc-target="cipa-anexo-embargo"/);
 assert.doesNotMatch(vazio.doc.innerHTML,/MONTE RORAIMA/i);
 console.log('PASS: relatório institucional CIPA, síntese, capítulos, anexos, assinatura, ausência de dados e denominação oficial.');
})().catch(err=>{console.error(err);process.exitCode=1});
