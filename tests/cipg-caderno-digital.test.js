const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const pagina=read('cipg-produtividade.html');
const codigo=read('cipg-caderno.js');
const roteamento=read('cadastro.html');
const home=read('index.html');
const config=read('auth-config.js');
const migracoes=fs.readdirSync(path.join(root,'supabase','migrations'));
const campos=migracoes.find(x=>x.endsWith('_cipg_caderno_digital_campos_livro_servico.sql'));
assert.ok(campos,'A migração do livro digital CIPG deve existir');
const sql=read('supabase/migrations/'+campos);

for(const id of ['dia','documento','posto','instituicao','turnoServico','regime','tipoLocal','modalidade',
 'comandante','recebeuDe','passouPara','efetivoOrdinario','efetivoSvi',
 'viatura','kmInicial','kmFinal','kmRodados','litros','saidas',
 'alteracaoPessoal','alteracaoInstalacoes','alteracaoMaterial','outrosSolicitacoes',
 'houveEvento','situacao','listaEventos','adicionarEvento','recentes','salvar']){
 assert.ok(pagina.includes('id="'+id+'"'),'Falta campo '+id);
}
assert.match(pagina,/Caderno digital de serviço — CIPG/);
assert.match(pagina,/Não — relatório sem acontecimento/);
assert.match(pagina,/Sim — registrar acontecimento/);
assert.match(pagina,/1º turno — 08h às 20h/);
assert.match(pagina,/2º turno — 20h às 08h/);
assert.match(pagina,/cipg-caderno\.js\?v=/);
assert.doesNotMatch(pagina,/<input[^>]+type="file"|<input[^>]+accept="application\/pdf"/i);
assert.doesNotMatch(pagina,/id="tatico"|id="ano"|id="numero_bo"/i);
assert.match(roteamento,/siglaCadastro==='CIPG'/);
assert.match(roteamento,/window\.location\.replace\('cipg-produtividade\.html'/);
assert.match(home,/id="atalhoCadastroPrincipal"/);
assert.match(home,/linkCipg\.href='cipg-produtividade\.html'/);
assert.match(config,/"cipg-produtividade\.html":"cadastro"/);
assert.match(config,/"cipg-produtividade\.html":"PRODUTIVIDADE_CIPG"/);
assert.match(config,/"cipg-eventos\.html":"PRODUTIVIDADE_CIPG"/);

for(const col of ['turno_cipg','comandante','recebeu_de','passou_para',
 'km_inicial','km_final','outros_solicitacoes']){
 assert.ok(sql.includes(col),'Coluna do livro de serviço ausente: '+col);
}
assert.doesNotThrow(()=>new Function(codigo));
for(const ref of ['cipg_postos','cipg_servicos_guarda','cipg_salvar_relatorio','cipg_listar_efetivo_caderno',
  'solicitacaoId','documentoServico','eventoDeTela','linhasEventos','data_evento',
  'hora_evento','tipo_evento','causa_motivo','conduzido_por','desfecho']){
 assert.ok(codigo.includes(ref),'Integração com serviço/evento ausente: '+ref);
}
assert.doesNotMatch(pagina,/id="rondas"/);
assert.match(pagina,/<input id="documento" readonly/);
assert.match(pagina,/<select id="posto" required/);
assert.doesNotMatch(pagina,/<input id="instituicao"[^>]*required/);
assert.match(codigo,/rpc\('cipg_salvar_relatorio'/);
assert.match(codigo,/solicitacaoId=solicitacaoId\|\|crypto\.randomUUID\(\)/);
assert.match(codigo,/payloadPendente&&payloadPendente!==assinatura/);
const novo=read('supabase/migrations/20261118173000_cipg_relatorio_unificado.sql');
assert.match(novo,/create unique index if not exists cipg_codigo_relatorio_unico/);
assert.match(novo,/language plpgsql security invoker/);
assert.match(novo,/return jsonb_build_object\('id',p_id,'codigo_relatorio',v_codigo,'ja_salvo',true\)/);
assert.match(codigo,/tipo_evento/);
assert.match(codigo,/Não informar nome do militar, lesões, diagnóstico ou dados clínicos/);
const context={};
new Function('window','document',codigo)(context,{getElementById:()=>null});
const turno=context.CipgCaderno.turno;
assert.match(turno('08:00'),/1º turno/);
assert.match(turno('19:59'),/1º turno/);
assert.match(turno('20:00'),/2º turno/);
assert.match(turno('07:59'),/2º turno/);
assert.equal(turno('25:00'),'');
console.log('PASS: formulário CIPG próprio, móvel, sem PDF/BO, campos do caderno e eventos integrados ao código próprio.');
