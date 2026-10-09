const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const codigo=fs.readFileSync(path.join(root,'cipg-dashboard.js'),'utf8');
const dashboard=fs.readFileSync(path.join(root,'dashboard.html'),'utf8');
const w={};
assert.doesNotThrow(()=>new Function('window',codigo)(w));
const cipg=w.CipgDashboard;
assert.ok(cipg,'Módulo CIPG não inicializado');
assert.match(dashboard,/cipg-dashboard\.js\?v=/);
assert.match(dashboard,/CipgDashboard\.render/);
assert.match(dashboard,/CipgDashboard\.filtros/);
assert.match(dashboard,/cipgLimparFiltros/);
assert.match(dashboard,/consultarEventosCipg/);
assert.match(dashboard,/cipgServicosComEventos/);
assert.match(dashboard,/cipgFiltroTurnoServico/);
assert.match(dashboard,/cipgFiltroGraduacao/);
assert.match(dashboard,/cipgFiltroSei/);
assert.match(dashboard,/cipgFiltroAlteracao/);
assert.match(dashboard,/tabCipgPostosDetalhado/);
assert.match(dashboard,/tabCipgComparativo/);
assert.match(dashboard,/tabCipgQualidade/);
assert.match(dashboard,/tabCipgDocumentos/);
for(const id of ['chartCipgModalidade','chartCipgRegimes','chartCipgTurnosServico',
'chartCipgTurnosEventos','chartCipgTipoLocal','chartCipgEvolucaoEfetivo',
'chartCipgEvolucaoEventos']){
 assert.ok(dashboard.includes(id),'Gráfico ausente: '+id);
}
assert.doesNotMatch(codigo,/campo.*nome_guerra|descricao_clinica|diagnostico/i);
const base=[
 {id:'s1',data_servico:'2026-08-23',numero_sei:'1001',posto_codigo:'PSE',instituicao:'HGR',
  situacao:'SEM ALTERACAO',turno_cipg:'1',tipo_local:'EDIFICIO_PUBLICO',modalidade:'GUARDA_FIXA',
  efetivo_ordinario:3,efetivo_svi:1,km_rodados:0,litros_abastecidos:0,rondas_realizadas:1,
  intercorrencias:0},
 {id:'s2',data_servico:'2026-08-24',numero_sei:'1002',posto_codigo:'PSE',instituicao:'HGR',
  situacao:'COM ALTERACAO',turno_cipg:'2',tipo_local:'EDIFICIO_PUBLICO',modalidade:'GUARDA_FIXA',
  efetivo_ordinario:2,efetivo_svi:2,km_rodados:40,litros_abastecidos:8,rondas_realizadas:2,
  saidas_autorizadas:1,intercorrencias:2,viatura:'VEI-01'},
 {id:'s3',data_servico:'2026-09-01',numero_sei:'1003',posto_codigo:'CSE',instituicao:'Centro socioeducativo',
  situacao:'COM ALTERACAO',alteracao_material:true,turno_cipg:'1',tipo_local:'EDIFICIO_PUBLICO',
  modalidade:'RONDA',efetivo_ordinario:1,efetivo_svi:0,km_rodados:null,litros_abastecidos:null,
  rondas_realizadas:1,intercorrencias:0}
];
const events=[
 {id:'e1',servico_id:'s2',tipo_evento:'ENTRADA DE PM NO HOSPITAL',hora_evento:'07:59:00',
  em_servico:'SIM',causa_motivo:'ACIDENTE DE TRÂNSITO',graduacao:'SD',desfecho:'INTERNADO'},
 {id:'e2',servico_id:'s2',tipo_evento:'ENTRADA DE PM NO HOSPITAL',hora_evento:'20:00:00',
  em_servico:'NÃO',causa_motivo:'QUEDA',graduacao:'CB',desfecho:'LIBERADO'},
 {id:'e3',servico_id:'s3',tipo_evento:'ÓBITO DE PM',hora_evento:'12:00:00',
  desfecho:'ÓBITO',causa_motivo:'OUTROS'}
];
assert.equal(cipg.turnoEvento('07:59:00'),'2');
assert.equal(cipg.turnoEvento('08:00:00'),'1');
assert.equal(cipg.turnoEvento('19:59:59'),'1');
assert.equal(cipg.turnoEvento('20:00:00'),'2');
assert.equal(cipg.turnoEvento('25:05:00'),'');
const conjuntos=cipg.selecionar(base,events,{});
const m=cipg.consolidar(conjuntos);
assert.equal(m.servicos,3);
assert.equal(m.sa,1);
assert.equal(m.ca,2);
assert.equal(m.efetivoOrdinario,6);
assert.equal(m.efetivoSvi,3);
assert.equal(m.efetivoTotal,9);
assert.equal(m.efetivoMedio,3);
assert.equal(m.hospital,2);
assert.equal(m.emServico,1);
assert.equal(m.foraServico,1);
assert.equal(m.internados,1);
assert.equal(m.liberados,1);
assert.equal(m.obitos,1,'O mesmo óbito não pode ser somado duas vezes por tipo e desfecho');
assert.equal(m.alteracaoMaterial,1);
assert.equal(m.rondas,4);
assert.equal(m.saidas,1);
assert.equal(m.quilometros,40);
assert.equal(m.abastecimento,8);
assert.equal(m.mediaConsumo,20);
assert.equal(m.faltaTurno,0);
assert.equal(m.faltaSei,0);
assert.equal(m.faltaPosto,0);
assert.equal(m.kmComRegistro,2);
assert.equal(m.servicosComEventos,2);
const hosp=cipg.selecionar(base,events,{cipgFiltroEvento:'ENTRADA DE PM NO HOSPITAL'});
assert.equal(hosp.servicos.length,1);
assert.equal(hosp.eventos.length,2);
assert.equal(cipg.consolidar(hosp).sa,0);
const hora=cipg.selecionar(base,events,{cipgFiltroTurno:'2'});
assert.equal(hora.eventos.length,2);
assert.equal(cipg.selecionar(base,events,{cipgFiltroTurnoServico:'1'}).servicos.length,2);
assert.equal(cipg.selecionar(base,events,{cipgFiltroSei:'1003'}).servicos.length,1);
assert.equal(cipg.selecionar(base,events,{cipgFiltroAlteracao:'MATERIAL'}).servicos.length,1);
assert.equal(cipg.selecionar(base,events,{cipgFiltroCausa:'trânsito'}).eventos.length,1);
assert.equal(cipg.tabelaPorPosto(conjuntos).length,2);
assert.equal(cipg.tabelaPorMes(conjuntos).length,2);
const grupos=cipg.categoriasSens({data:events,key:'graduacao'});
assert.ok(grupos.some(([nome,quantidade])=>nome.includes('poucos')&&quantidade===2));
const chartIds=[],rowIds=[],elementos={};
const get=id=>elementos[id]||(elementos[id]={textContent:'',value:''});
const render=cipg.render(
  {servicos:base,eventos:events},{servicos:[],eventos:[]},
  {seletores:{},get,chart:(id,t,labels,values)=>{chartIds.push(id);assert.equal(labels.length,values.length)},
    rows:(id,html)=>{rowIds.push(id);get(id).innerHTML=html},esc:s=>String(s).replace(/[&<>]/g,''),
    comparar:'nenhum',variacao:()=>'',cor:'#15803d'}
);
assert.equal(render.indicadores.servicos,3);
assert.equal(get('cipgServicos').textContent,'3');
assert.equal(get('cipgHospital').textContent,'2');
assert.equal(get('cipgObitos').textContent,'1');
assert.equal(chartIds.length,16,'Cada gráfico da CIPG deve receber dados');
assert.ok(rowIds.includes('tabCipgPostosDetalhado'));
assert.ok(rowIds.includes('tabCipgMensal'));
assert.ok(rowIds.includes('tabCipgComparativo'));
assert.ok(rowIds.includes('tabCipgQualidade'));
assert.ok(rowIds.includes('tabCipgDocumentos'));
const vazio=cipg.consolidar(cipg.selecionar([],[],{}));
assert.equal(vazio.servicos,0);
assert.equal(vazio.pctSa,null);
assert.equal(vazio.mediaConsumo,null);
console.log('PASS: dashboard CIPG completo, filtros, séries, taxas, privacidade, comparação e zero registros.');
