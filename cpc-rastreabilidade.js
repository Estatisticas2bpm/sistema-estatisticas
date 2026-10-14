/* SIE-CPC — trilha de origem dos indicadores no dashboard executivo.
 * Monta evidências a partir das mesmas consultas autorizadas que alimentam
 * os cartões; nenhuma linha é modificada e não há dados pessoais sensíveis.
 */
(function(global){
'use strict';
const txt=v=>String(v??'').trim();
const num=v=>Number(v)||0;
const localGiro=v=>{
  if(!v)return '';
  const d=new Date(v);
  if(Number.isNaN(d.getTime()))return '';
  return new Date(d.getTime()-4*3600000).toISOString().slice(0,16).replace('T',' ');
};
const registrar=(lista,fonte,data,referencia,descricao,quantidade,unidade,criterio,indicadores=[],origem={})=>lista.push({
  fonte:txt(fonte),data:txt(data),referencia:txt(referencia)||'Não informado',
  descricao:txt(descricao),quantidade:quantidade==null?'':num(quantidade),
  unidade:txt(unidade),criterio:txt(criterio),indicadores,
  registro_id:txt(origem.id),origem_tabela:txt(origem.tabela),ocorrencia_id:txt(origem.ocorrencia_id),servico_id:txt(origem.servico_id)
});
function registros(tipo,ocorrencias,tcos,dados){
  const linhas=[],s=String(tipo||'').toUpperCase(),origem=dados||{},lista=Array.isArray(dados)?dados:[];
  for(const o of ocorrencias||[])registrar(linhas,'Ocorrência policial',o.data_ocorrencia,o.numero_bo||o.id,o.ocorrencia||o.crime||'Ocorrência',1,'ocorrência','data_ocorrencia',
    ['Ocorrências',...(num(o.conducoes_operacionais)>0?['Conduções']:[]),...(num(o.veiculos_recuperados)>0?['Veículos recuperados']:[])],{id:o.id,tabela:'ocorrencias'});
  for(const t of tcos||[])registrar(linhas,'TCO',t.data_tco,t.numero_tco||t.id,'Termo circunstanciado',1,'TCO','data_tco',['TCOs'],{id:t.id,tabela:'tcos',ocorrencia_id:t.ocorrencia_id});
  if(s==='CIPA'){
    for(const f of origem.fauna||[])registrar(linhas,'CIPA · fauna',f.data_registro,f.numero_tr||f.id,f.nome_comum||'Registro de fauna',f.quantidade,'animais','data_registro',['Animais envolvidos'],{id:f.id,tabela:'cipa_fauna',ocorrencia_id:f.ocorrencia_id});
    for(const e of origem.embargos||[])registrar(linhas,'CIPA · embargo',e.data_embargo,e.numero||e.id,'Termo de embargo',e.area_embargada_ha,'ha','data_embargo',['Área embargada (ha)'],{id:e.id,tabela:'cipa_termos_embargo',ocorrencia_id:e.ocorrencia_id});
    for(const a of origem.autos||[])registrar(linhas,'CIPA · auto de infração',a.data_autuacao,a.numero||a.id,a.descricao_infracao||'Multa ambiental',a.valor_multa,'R$','data_autuacao',['Multas aplicadas (R$)'],{id:a.id,tabela:'cipa_autos_infracao',ocorrencia_id:a.ocorrencia_id});
  }
  if(s==='CIPG'){
    const servicos=origem.servicos||[],porId=new Map(servicos.map(x=>[String(x.id),x]));
    const comEvento=new Set((origem.eventos||[]).map(x=>String(x.servico_id)));
    for(const servico of servicos)registrar(linhas,'CIPG · serviço',servico.data_servico,servico.documento_referencia||servico.numero_sei||servico.id,
      [servico.posto_codigo||servico.instituicao,servico.situacao].filter(Boolean).join(' · ')||'Serviço de guarda',
      num(servico.efetivo_ordinario)+num(servico.efetivo_svi),'empregos de efetivo','data_servico',
      ['Relatórios de serviço','Empregos de efetivo',...(servico.situacao==='SEM ALTERACAO'&&!comEvento.has(String(servico.id))?['Serviços sem alteração']:[])],{id:servico.id,tabela:'cipg_servicos_guarda'});
    for(const evento of origem.eventos||[]){
      const servico=porId.get(String(evento.servico_id));
      registrar(linhas,'CIPG · evento',evento.data_evento||servico?.data_servico,servico?.documento_referencia||evento.id,
        evento.tipo_evento||'Evento de serviço',1,'evento','serviço vinculado',
        evento.tipo_evento==='ENTRADA DE PM NO HOSPITAL'?['Entradas de PM no hospital']:[],{id:evento.id,tabela:'cipg_eventos_guarda',servico_id:evento.servico_id});
    }
  }
  if(s==='CAVALARIA')for(const x of lista)registrar(linhas,'Cavalaria · serviço',x.data_servico,x.numero_documento||x.id,
    [x.tipo_policiamento,x.contexto_atividade,x.localidade||x.bairro].filter(Boolean).join(' · '),x.abordagens_pessoas,'pessoas abordadas','data_servico',
    ['Serviços realizados',...(num(x.abordagens_pessoas)>0?['Pessoas abordadas']:[]),...(x.tipo_policiamento==='POLICIAMENTO_MONTADO'?['Policiamento montado']:[]),...(x.contexto_atividade==='EVENTO'||x.tipo_policiamento==='POLICIAMENTO_OPERACOES'?['Eventos / operações']:[])],{id:x.id,tabela:'cavalaria_servicos_produtividade'});
  // Código de infração = tipificação, NÃO número exclusivo do auto.
  // A tabela de autos ainda não possui número do auto: usar chave técnica (UUID)
  // para identificar cada linha sem confundir códigos repetidos com duplicidades.
  if(s==='CIPTUR')for(const x of lista)registrar(linhas,'CIPTUR · auto de infração',x.data_infracao,x.id,
    'Código da infração: '+(x.codigo_infracao||'não informado')+(x.houve_remocao?' · auto com remoção indicada':''),1,'auto','data_infracao',['Autos de infração',...(x.houve_remocao===true?['Autos com remoção']:[])],{id:x.id,tabela:'ciptur_autos_infracao'});
  if(s==='GIRO')for(const x of lista)registrar(linhas,'GIRO · abordagem',localGiro(x.registrado_em),x.id,
    [x.tipo_abordagem,x.bairro].filter(Boolean).join(' · ')||'Abordagem',x.quantidade_pessoas,'pessoas abordadas','registrado_em · UTC−04',['Abordagens',...(num(x.quantidade_pessoas)>0?['Pessoas abordadas']:[])],{id:x.id,tabela:'giro_abordagens'});
  return linhas.sort((a,b)=>b.data.localeCompare(a.data)||a.fonte.localeCompare(b.fonte)||a.referencia.localeCompare(b.referencia));
}
const titulos=['Fonte de origem','Data de referência','Documento/ID','Registro','Quantidade','Unidade de medida','Critério temporal'];
function csv(linhas){
  const seguro=v=>{
    let t=txt(v).replace(/[\r\n]+/g,' ');
    if(/^[\s]*[=+@\-]/.test(t))t="'"+t;
    return '"'+t.replace(/"/g,'""')+'"';
  };
  const conteudo=[titulos,...(linhas||[]).map(x=>[x.fonte,x.data,x.referencia,x.descricao,x.quantidade,x.unidade,x.criterio])];
  return '\uFEFF'+conteudo.map(l=>l.map(seguro).join(';')).join('\r\n');
}
global.CpcRastreabilidade=Object.freeze({registros,csv,titulos,localGiro});
})(window);
