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
const registrar=(lista,fonte,data,referencia,descricao,quantidade,unidade,criterio)=>lista.push({
  fonte:txt(fonte),data:txt(data),referencia:txt(referencia)||'Não informado',
  descricao:txt(descricao),quantidade:quantidade==null?'':num(quantidade),
  unidade:txt(unidade),criterio:txt(criterio)
});
function registros(tipo,ocorrencias,tcos,dados){
  const linhas=[],s=String(tipo||'').toUpperCase(),origem=dados||{},lista=Array.isArray(dados)?dados:[];
  for(const o of ocorrencias||[])registrar(linhas,'Ocorrência policial',o.data_ocorrencia,o.numero_bo||o.id,o.ocorrencia||o.crime||'Ocorrência',1,'ocorrência','data_ocorrencia');
  for(const t of tcos||[])registrar(linhas,'TCO',t.data_tco,t.numero_tco||t.id,'Termo circunstanciado',1,'TCO','data_tco');
  if(s==='CIPA'){
    for(const f of origem.fauna||[])registrar(linhas,'CIPA · fauna',f.data_registro,f.numero_tr||f.id,f.nome_comum||'Registro de fauna',f.quantidade,'animais','data_registro');
    for(const e of origem.embargos||[])registrar(linhas,'CIPA · embargo',e.data_embargo,e.numero||e.id,'Termo de embargo',e.area_embargada_ha,'ha','data_embargo');
    for(const a of origem.autos||[])registrar(linhas,'CIPA · auto de infração',a.data_autuacao,a.numero||a.id,a.descricao_infracao||'Multa ambiental',a.valor_multa,'R$','data_autuacao');
  }
  if(s==='CIPG'){
    const servicos=origem.servicos||[],porId=new Map(servicos.map(x=>[String(x.id),x]));
    for(const servico of servicos)registrar(linhas,'CIPG · serviço',servico.data_servico,servico.documento_referencia||servico.numero_sei||servico.id,
      [servico.posto_codigo||servico.instituicao,servico.situacao].filter(Boolean).join(' · ')||'Serviço de guarda',
      num(servico.efetivo_ordinario)+num(servico.efetivo_svi),'empregos de efetivo','data_servico');
    for(const evento of origem.eventos||[]){
      const servico=porId.get(String(evento.servico_id));
      registrar(linhas,'CIPG · evento',evento.data_evento||servico?.data_servico,servico?.documento_referencia||evento.id,
        evento.tipo_evento||'Evento de serviço',1,'evento','serviço vinculado');
    }
  }
  if(s==='CAVALARIA')for(const x of lista)registrar(linhas,'Cavalaria · serviço',x.data_servico,x.numero_documento||x.id,
    [x.tipo_policiamento,x.contexto_atividade,x.localidade||x.bairro].filter(Boolean).join(' · '),x.abordagens_pessoas,'pessoas abordadas','data_servico');
  if(s==='CIPTUR')for(const x of lista)registrar(linhas,'CIPTUR · auto de infração',x.data_infracao,x.codigo_infracao||x.id,
    'Código '+(x.codigo_infracao||'não informado')+(x.houve_remocao?' · auto com remoção indicada':''),1,'auto','data_infracao');
  if(s==='GIRO')for(const x of lista)registrar(linhas,'GIRO · abordagem',localGiro(x.registrado_em),x.id,
    [x.tipo_abordagem,x.bairro].filter(Boolean).join(' · ')||'Abordagem',x.quantidade_pessoas,'pessoas abordadas','registrado_em · UTC−04');
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
