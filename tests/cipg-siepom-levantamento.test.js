const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const list=fs.readdirSync(path.join(root,'supabase','migrations'));
const schemaFile=list.find(x=>x.endsWith('_cipg_livro_servicos_eventos_postos_siepom.sql'));
const turnoFile=list.find(x=>x.endsWith('_cipg_data_hora_evento_turno_proprio.sql'));
const triggerFile=list.find(x=>x.endsWith('_cipg_sincronizar_situacao_servico_por_evento.sql'));
assert.ok(schemaFile&&turnoFile&&triggerFile,'Migrações do levantamento SIEPOM CIPG devem existir');
const schema=read('supabase/migrations/'+schemaFile);
const turnoSql=read('supabase/migrations/'+turnoFile);
const trigger=read('supabase/migrations/'+triggerFile);
for(const text of ['cipg_postos','cipg_servicos_guarda','cipg_eventos_guarda','numero_sei',
 'efetivo_ordinario','efetivo_svi','km_rodados','litros_abastecidos',
 'situacao','EM OBSERVAÇÃO','INTERNADO','LIBERADO','ÓBITO','data_servico']){
 assert.ok(schema.includes(text),text+' ausente no schema CIPG');
}
assert.match(schema,/area_pendente_validacao/);
assert.ok(schema.includes("('CSE'"));
assert.ok(schema.includes("('PSE'"));
assert.match(schema,/row level security/);
assert.match(schema,/private\.pode_acessar_unidade/);
assert.match(schema,/private\.pode_escrever_operacional/);
assert.doesNotMatch(schema,/nome_guerra\s+text|lesao_quadro\s+text/i);
assert.match(turnoSql,/hora_evento time/);
assert.match(trigger,/cipg_evento_altera_status_servico/);

const servicos=read('cipg-produtividade.html');
const eventos=read('cipg-eventos.html');
const home=read('cipg-home.js');
const dash=read('dashboard.html'),index=read('index.html');
for(const x of ['id="posto"','id="situacao"','id="efetivoOrdinario"','id="efetivoSvi"',
'id="kmRodados"','id="litros"','id="documento"','cipg-eventos.html']){
 assert.ok(servicos.includes(x),x+' ausente do cadastro');
}
for(const x of ['servico_id','tipo_evento','graduacao','unidade_militar',
'em_servico','causa_motivo','conduzido_por','desfecho','hora_evento']){
 assert.ok(eventos.includes(x),x+' ausente do evento');
}
assert.doesNotMatch(eventos,/id="nomeGuerra"|id="lesao"|id="quadro"/);
assert.match(eventos,/Uma linha por militar/);
const inicio=eventos.indexOf('function turnoDeHora(');
const fim=eventos.indexOf(" $('horaEvento').addEventListener",inicio);
assert.ok(inicio>0&&fim>inicio);
const turno=new Function(eventos.slice(inicio,fim)+';return turnoDeHora;')();
assert.match(turno('08:00'),/1º TURNO/);
assert.match(turno('19:59'),/1º TURNO/);
assert.match(turno('20:00'),/2º TURNO/);
assert.match(turno('07:59'),/2º TURNO/);
assert.equal(turno(''),'');

for(const text of ['Relatórios de serviço','PMs atendidos no hospital','Serviços sem alteração','Efetivo empregado']){
 assert.ok(home.includes(text),text+' ausente da visão rápida');
}
assert.match(home,/cipg_eventos_guarda/);
for(const id of ['cipgHospital','cipgSemAlteracao','cipgInternados','cipgObservacao',
'cipgLiberados','cipgObitos','cipgEfetivoOrd','cipgEfetivoSvi',
'chartCipgCausas','chartCipgDesfechos','chartCipgGraduacoes',
'chartCipgUnidades','chartCipgConducoes','chartCipgPostos','tabCipgInstituicoes']){
 assert.ok(dash.includes(id),id+' ausente do dashboard');
}
assert.match(dash,/consultarEventosCipg/);
assert.match(dash,/function turnoCipg/);
assert.match(index,/modoCipg/);
assert.match(index,/rank\(rr\[5\]\.eventos,"tipo_evento"/);
assert.doesNotThrow(()=>new Function(home));
assert.doesNotThrow(()=>new Function(dash.slice(dash.lastIndexOf('<script>')+8,dash.lastIndexOf('</script>'))));
assert.doesNotThrow(()=>new Function(servicos.slice(servicos.lastIndexOf('<script>')+8,servicos.lastIndexOf('</script>'))));
assert.doesNotThrow(()=>new Function(eventos.slice(eventos.lastIndexOf('<script>')+8,eventos.lastIndexOf('</script>'))));
console.log('PASS: levantamento CIPG, S/A, SEI, eventos por militar, turnos e dados estatísticos reservados.');
