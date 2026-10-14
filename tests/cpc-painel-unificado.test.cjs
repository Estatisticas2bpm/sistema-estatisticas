'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('dashboard-cpc.html'),home=read('index.html'),script=read('cpc-analise-integrada.js');
for(const id of ['cpcAnaliseIntegrada','cpcAnaliseCarregar','cpcAnaliseStatus','cpcAnaliseConteudo',
  'cpcAnaliseComandantes','cpcAnaliseBens','cpcAnaliseInfratoresSexo','cpcAnaliseVitimasSexo',
  'cpcAnaliseInfratoresIdade','cpcAnaliseVitimasIdade','cpcAnaliseInfratoresNacionalidade',
  'cpcAnaliseVitimasNacionalidade','cpcAnaliseArmasTipos','cpcAnaliseMunicoesCalibres',
  'cpcAnaliseDrogasTipos','cpcAnaliseComparar','cpcAnaliseCompararTipo','cpcAnaliseComparacaoTabela',
  'cpcAnaliseConferencia'])assert.match(html,new RegExp('id="'+id+'"'),id);
assert.match(html,/Painel Estatístico Integrado do CPC/);
assert.match(html,/cpc-analise-integrada\.js\?v=20261014-unificado1/);
assert.match(html,/CpcAnaliseIntegrada\.configurar\(db,args,hierarquiaUnidades,r\.data\.resumo\?\.total_ocorrencias\)/);
assert.match(html,/CpcAnaliseIntegrada\.resetar\(\)/);
assert.doesNotMatch(html,/<a href="dashboard\.html">/,'CPC não aponta para dashboard duplicado');
assert.match(home,/var antigo=nav\.querySelector\('a\[href\^="dashboard\.html"\]'\);if\(antigo\)antigo\.style\.display="none"/);
assert.match(home,/Painel Estatístico Integrado CPC/);
assert.doesNotMatch(script,/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.remove\(/,'análise é somente leitura');
assert.match(script,/\.rpc\('obter_dados_dashboard_territorial'/);
assert.match(script,/CpcDocumentoLeitura\?\.autorizado\(\)/);
const w={},dom={};
const element=id=>dom[id]||(dom[id]={id,hidden:false,disabled:false,textContent:'',innerHTML:'',value:'anterior',addEventListener(){}});
const doc={getElementById:element};
vm.runInNewContext(script,{window:w,document:doc,console,Date,Number,String,Set,Map});
const a=w.CpcAnaliseIntegrada;
const unidadeA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',unidadeB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const unidadeFilha='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const boA='11111111-2222-4333-8444-555555555555',boB='22222222-3333-4333-8444-666666666666';
const hierarquia=[{id:unidadeA,parent_id:null},{id:unidadeFilha,parent_id:unidadeA},{id:unidadeB,parent_id:null}];
const ids=a.hierarquiaIds(unidadeA,hierarquia);
assert.equal(ids.has(unidadeA),true);
assert.equal(ids.has(unidadeFilha),true);
assert.equal(ids.has(unidadeB),false);
const r1={id:boA,unidade_id:unidadeFilha,numero_bo:'BO 1',data_ocorrencia:'2026-10-01',
  ocorrencia:'FURTO',bairro:'CENTRO',aisc:'AISC 1',comandante:'PM Silva',conducoes_operacionais:2,numero_prisoes:1,
  quantidade_armas:1,armas:'PISTOLA',quantidade_municoes:4,municoes:'9MM',entorpecentes:'SIM',
  maconha:1,entorpecentes_tipos_legados:['MACONHA'],bens_subtraidos:[{categoria:'CELULAR',quantidade:2}],vitima_sexo:'F',vitima_idade:25,
  infrator_sexo:'M',infrator_idade:32};
const r2={id:boB,unidade_id:unidadeB,numero_bo:'BO 2',data_ocorrencia:'2026-10-02',ocorrencia:'ROUBO',bairro:'CENTRO'};
assert.equal(a.filtro(r1,{p_aisc:'AISC 1',p_bairro:'centro',p_ocorrencia:'furto'},ids),true);
assert.equal(a.filtro(r2,{},ids),false);
assert.equal(a.filtro(r1,{p_ocorrencia:'homicídio'},ids),false);
assert.equal(a.filtro(r1,{p_aisc:'AISC 2'},ids),false);
const sum=a.sumarizar([r1]);
assert.equal(sum.total,1);
assert.equal(sum.conducoes,2);
assert.equal(sum.prisoes,1);
assert.equal(sum.armas,1);
assert.equal(sum.municoes,4);
assert.equal(sum.bens,2);
assert.equal(sum.drogas,1);
const grupos=a.gerarGrupos([r1]);
const soma=k=>grupos.totais.get(k);
assert.equal(soma('Conduções operacionais'),2);
assert.equal(soma('Prisões informadas'),1);
assert.equal(soma('Armas registradas'),1);
assert.equal(soma('Armas por tipo · PISTOLA'),1);
assert.equal(soma('Munições por calibre · 9MM'),4);
assert.equal(soma('Entorpecentes por tipo · MACONHA'),1);
assert.equal(soma('Bens subtraídos · CELULAR'),2);
assert.equal(soma('Comandante · PM Silva'),1);
assert.equal(soma('Vítimas · Sexo · Feminino'),1);
assert.equal(soma('Infratores · Sexo · Masculino'),1);
assert.equal(soma('Vítimas · Idade · 18–29 anos'),1);
assert.equal(soma('Infratores · Idade · 30–44 anos'),1);
assert.equal(grupos.linhas.find(x=>x.indicadores.includes('Bens subtraídos · CELULAR')).registro_id,boA);
const datas=a.periodoAnterior({data_inicio:'2026-10-01',data_fim:'2026-10-14'},'anterior');
assert.equal(datas.inicio,'2026-09-17');
assert.equal(datas.fim,'2026-09-30');
const ano=a.periodoAnterior({data_inicio:'2026-10-01',data_fim:'2026-10-14'},'ano');
assert.equal(ano.inicio,'2025-10-01');
assert.equal(ano.fim,'2025-10-14');
let calls=0;
a.configurar({rpc(){calls++;return Promise.resolve({data:[],error:null})}},
  {data_inicio:'2026-10-01',data_fim:'2026-10-14',p_unidade_id:unidadeA},hierarquia,1);
assert.equal(calls,0,'carregamento aprofundado é sob demanda');
assert.equal(element('cpcAnaliseConteudo').hidden,true);
console.log('PASS: painel CPC unificado, filtro hierárquico, perfis agregados, bens, apreensões, períodos e consulta lazy sem escrita.');
