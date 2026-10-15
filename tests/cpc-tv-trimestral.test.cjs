'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const dadosJs=read('cpc-tv-dados.js'),visJs=read('cpc-tv-apresentacao.js'),rtJs=read('cpc-tv-runtime.js');
const painel=read('painel-tv.html'),mapa=read('mapa-tv.html'),menu=read('modo-tv.html');
const box={window:{CipaHome:{consultar:async()=>({fauna:[],embargos:[],autos:[]})},CipgHome:{consultar:async()=>({servicos:[],eventos:[]})},
 EstatisticaIndicadores:{brasaoUnidade:{'1BPM':'1.png','GIRO':'giro.svg'},corUnidade:{'1BPM':'#2563eb'}}},
 console,Intl,Date,Map,Set};
vm.runInNewContext(dadosJs,box);
vm.runInNewContext(visJs,box);
const D=box.window.CpcTvDados,A=box.window.CpcTvApresentacao;
test('JS da tela e componentes possui sintaxe válida',()=>{
 for(const s of [dadosJs,visJs,rtJs])assert.doesNotThrow(()=>new Function(s));
 for(const h of [painel,mapa])for(const m of h.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())assert.doesNotThrow(()=>new Function(m[1]));
});
test('trimestre em curso e anterior com mesmo número de dias, hora de Boa Vista',()=>{
 const p=D.periodos(new Date('2026-10-15T20:30:00Z'),'atual');
 assert.equal(p.inicio,'2026-10-01');assert.equal(p.fim,'2026-10-15');
 assert.equal(p.antInicio,'2026-07-01');assert.equal(p.antFim,'2026-07-15');
 assert.equal(p.anoInicio,'2025-10-01');assert.equal(p.anoFim,'2025-10-15');
 assert.equal(p.dias,15);
 const q=D.periodos(new Date('2026-10-15T20:30:00Z'),'encerrado');
 assert.equal(q.inicio,'2026-07-01');assert.equal(q.fim,'2026-09-30');
 assert.equal(q.antInicio,'2026-04-01');assert.equal(q.antFim,'2026-06-30');
 assert.equal(q.anoInicio,'2025-07-01');assert.equal(q.anoFim,'2025-09-30');
 const boundary=D.periodos(new Date('2026-01-01T02:00:00Z'),'atual');
 assert.equal(boundary.inicio,'2025-10-01');
});
test('dashboard usa contratos territoriais, paginacao, contexto autorizado e separação de especialidades',()=>{
 assert.match(dadosJs,/obter_home_cpc_territorial/);
 assert.match(dadosJs,/obter_dados_dashboard_territorial/);
 assert.match(dadosJs,/obter_tcos_dashboard_territorial/);
 assert.match(dadosJs,/if\(home\?\.autorizado!==true\)/);
 assert.match(dadosJs,/MAX_PAGINAS=200/);
 for(const tabela of ['giro_abordagens','ciptur_autos_infracao','cavalaria_servicos_produtividade','cipa_autos_notificacao'])
  assert.ok(dadosJs.includes(tabela),tabela);
 assert.match(dadosJs,/global\.CipaHome\.consultar/);
 assert.match(dadosJs,/global\.CipgHome\.consultar/);
 assert.match(dadosJs,/scope\(oc,ids\)/);
 assert.match(rtJs,/auth\.client/);
 assert.match(rtJs,/auth\.contexto\?\.tipo!=='COMANDO'/);
 assert.match(rtJs,/auth\.pode\('tv'\)!==true/);
});
test('gera telas de todas as unidades, sem somar serviços com BOs e sem expor dados pessoais',()=>{
 const p=D.periodos(new Date('2026-10-15T20:30:00Z'),'atual');
 const mk=(id,sigla,parent_id='')=>({id,sigla,parent_id});
 const units=[mk('1','1BPM'),mk('2','2BPM'),mk('3','BOPE'),mk('4','GIRO'),mk('5','CIPTUR'),mk('6','CIPA'),mk('7','CAVALARIA'),mk('8','CIPG')];
 const bo=[
  {id:'a',unidade_id:'1',ocorrencia:'FURTO',data_ocorrencia:p.inicio,bairro:'CENTRO',status_atendimento:'ATENDIDA',conducoes_operacionais:1},
  {id:'b',unidade_id:'2',ocorrencia:'ROUBO',data_ocorrencia:p.inicio,bairro:'CENTRO',status_atendimento:'ATENDIDA',conducoes_operacionais:0},
  {id:'c',unidade_id:'3',ocorrencia:'ROUBO',data_ocorrencia:p.inicio,bairro:'OUTRO',subunidade_operacional_sigla:'CHOQUE'}];
 const model={periodo:p,unidades:units,
  atual:{ocorrencias:bo,tcos:[]},
  anterior:{ocorrencias:bo.slice(0,1),tcos:[]},anoAnterior:{ocorrencias:[],tcos:[]},
  especializados:{
   GIRO:{status:'ok',data:[{id:'gi',quantidade_pessoas:3,tipo_abordagem:'MOTO',registrado_em:p.inicio+'T18:30:00-04:00',bairro:'CENTRO'}]},
   CIPTUR:{status:'ok',data:[{id:'ai',houve_remocao:true,tipo_veiculo_removido:'CARRO',gravidade_snapshot:'GRAVE'}]},
   CIPA:{status:'ok',data:{fauna:[{quantidade:2}],embargos:[],autos:[],notificacoes:[]}},
   CAVALARIA:{status:'ok',data:[{id:'ca',abordagens_pessoas:4,tipo_policiamento:'MONTADO'}]},
   CIPG:{status:'ok',data:{servicos:[{id:'cp',rondas_realizadas:3,modalidade:'GUARDA',instituicao:'A'}],eventos:[]}}
  }};
 const slides=A.slides(model);
 assert.ok(slides.length>=12&&slides.length<=15,slides.length);
 for(const token of ['GIRO','CIPTUR','CIPA','CAVALARIA','CIPG','BOPE','TERRITORIAL','CRIMINAL','TRIMESTRAL']){
  assert.ok(slides.some(s=>s.title.includes(token)),token);
 }
 const apresentacao=slides.map(x=>x.html).join('\n');
 assert.match(apresentacao,/1º BPM/);assert.match(apresentacao,/2º BPM/);
 assert.match(apresentacao,/3 pessoa/); // Verifica o indicador isolado das abordagens
 assert.doesNotMatch(apresentacao,/nome_completo|cpf|nome_guerra/);
 assert.match(A.rankHtml([['Teste',3]]),/Teste/);
 assert.ok(D.metrics(model.atual).ocorrencias===3);
});
test('painel e mapa conservam logo original para a intervenção isolada do Codex',()=>{
 for(const h of [painel,mapa])assert.match(h,/<img src="brasao-pmrr\.png"/);
 assert.doesNotMatch(painel,/logo-cpc\.png/);
 assert.doesNotMatch(mapa,/logo-cpc\.png/);
});
test('mapa deixou a referência fixa ao 2 BPM e consulta mapa CPC territorial',()=>{
 assert.match(mapa,/obter_mapa_cpc_territorial/);
 assert.match(mapa,/MapaCpcProfissional\.criarMarcador/);
 assert.match(mapa,/Map[a-zA-Z]+UnidadeProfissional\.criarMarcador/);
 assert.doesNotMatch(mapa,/['"]2BPM['"]\)\)/);
 assert.match(mapa,/giro_abordagens/);
 assert.match(menu,/trimestral/i);
 assert.doesNotMatch(menu,/semestre atual em sete slides/);
});
test('rotacao e consulta com parcimonia',()=>{
 assert.match(rtJs,/PROXIMO_MS=23000,ATUALIZAR_MS=300000/);
 assert.match(rtJs,/document\.hidden/);
 assert.match(rtJs,/if\(carregando\|\|!db\)return/);
 assert.match(painel,/id="tvTrimestre"/);
 assert.match(painel,/id="tvPausar"/);
});
