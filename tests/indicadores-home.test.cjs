/* Regressão dos indicadores especializados da página inicial.
 * Executar na raiz do repositório: node tests/indicadores-home.test.cjs
 * Não usa banco, rede ou autenticação. A homologação real continua separada.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function modulo(arquivo,nome){
  const campos=new Map();
  const document={getElementById(id){
    if(!campos.has(id))campos.set(id,{textContent:'',innerHTML:''});
    return campos.get(id);
  }};
  const scope={window:{},document,console,
    nomeMes:d=>d.toLocaleDateString('pt-BR',{month:'long'}),
    itemComparativo:(label,a,b)=>label+': '+a+'/'+b+';'
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',arquivo),'utf8'),scope,{filename:arquivo});
  return {api:scope.window[nome],campos};
}
function compararCampos(obj,esperado){
  for(const [chave,valor] of Object.entries(esperado)){
    assert.equal(obj[chave],valor,'campo estatístico '+chave);
  }
}
const cipa=modulo('cipa-home.js','CipaHome');
const ocorrencias=[{id:'o1'},{id:'o2'}];
const cipaAtual={
  fauna:[{quantidade:2},{quantidade:3}],
  embargos:[{area_embargada_ha:1.5},{area_embargada_ha:2}],
  autos:[{valor_multa:600,area_embargada_ha:999},{valor_multa:150.5}]
};
const cipaEsperado={ocorrencias:2,animais:5,areaEmbargadaHa:3.5,valorMultas:750.5,termosEmbargo:2,autosInfracao:2};
compararCampos(cipa.api.indicadores(ocorrencias,cipaAtual),cipaEsperado);
compararCampos(cipa.api.indicadores([],{}),{ocorrencias:0,animais:0,areaEmbargadaHa:0,valorMultas:0,termosEmbargo:0,autosInfracao:0});
const hoje=new Date(2026,9,12),comparado=[new Date(2026,8,1),new Date(2026,8,12)];
cipa.api.renderizar(ocorrencias,[],cipaAtual,{fauna:[],embargos:[],autos:[]},hoje,comparado);
assert.equal(cipa.campos.get('total').textContent,2);
assert.equal(cipa.campos.get('conducoes').textContent,'5');
assert.equal(cipa.campos.get('tcosProduzidos').textContent,'3,5');
assert.ok(cipa.campos.get('veiculosRecuperadosKpi').textContent.includes('750,50'));
assert.ok(cipa.campos.get('periodoComparativo').textContent.includes('2026'));
assert.ok(cipa.campos.get('resumoInteligente').textContent.includes('Área embargada não representa necessariamente área desmatada'));

const cipg=modulo('cipg-home.js','CipgHome');
const cipgAtual={
  servicos:[
    {id:'s1',situacao:'SEM ALTERACAO',efetivo_ordinario:2,efetivo_svi:1,instituicao:'hospital'},
    {id:'s2',situacao:'SEM ALTERACAO',efetivo_ordinario:3,efetivo_svi:0,instituicao:'HOSPITAL'},
    {id:'s3',situacao:'COM ALTERACAO',efetivo_ordinario:1,efetivo_svi:1,instituicao:'Palácio'}
  ],
  eventos:[{servico_id:'s2',tipo_evento:'ENTRADA DE PM NO HOSPITAL'}]
};
const cipgEsperado={relatoriosServico:3,entradasPmHospital:1,servicosSemAlteracao:1,empregosEfetivo:8,instituicoesAtendidas:2};
compararCampos(cipg.api.indicadores(cipgAtual),cipgEsperado);
compararCampos(cipg.api.indicadores({servicos:[],eventos:[]}),{relatoriosServico:0,entradasPmHospital:0,servicosSemAlteracao:0,empregosEfetivo:0,instituicoesAtendidas:0});
cipg.api.renderizar(cipgAtual,{servicos:[],eventos:[]},hoje,comparado);
assert.equal(cipg.campos.get('total').textContent,'3');
assert.equal(cipg.campos.get('conducoes').textContent,'1');
assert.equal(cipg.campos.get('tcosProduzidos').textContent,'1');
assert.equal(cipg.campos.get('veiculosRecuperadosKpi').textContent,'8');
assert.ok(cipg.campos.get('periodoComparativo').textContent.includes('2026'));
assert.ok(cipg.campos.get('resumoInteligente').textContent.includes('não são somados às ocorrências policiais'));

console.log('OK: indicadores CIPA/CIPG, vazios, renderização e períodos comparativos.');
