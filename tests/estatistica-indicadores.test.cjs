/* node tests/estatistica-indicadores.test.cjs
 * Contratos puros e regressão sem consultar dados reais.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const box={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../estatistica-indicadores.js'),'utf8'),box);
const i=box.window.EstatisticaIndicadores;
assert.equal(i.giro([{quantidade_pessoas:3},{quantidade_pessoas:2}]).abordagens,2);
assert.equal(i.giro([{quantidade_pessoas:3},{quantidade_pessoas:2}]).pessoasAbordadas,5);
const cav=i.cavalaria([
 {tipo_policiamento:'POLICIAMENTO_MONTADO',contexto_atividade:'EVENTO',abordagens_pessoas:10},
 {tipo_policiamento:'POLICIAMENTO_OPERACOES',contexto_atividade:'EVENTO',abordagens_pessoas:2},
 {tipo_policiamento:'POLICIAMENTO_MONTADO',contexto_atividade:'OUTRO',abordagens_pessoas:5}
]);
assert.equal(cav.servicos,3);
assert.equal(cav.pessoasAbordadas,17);
assert.equal(cav.policiamentoMontado,2);
assert.equal(cav.eventosOperacoes,2,'evento e operação no mesmo registro contam uma atividade');
const infra=i.ciptur([
 {houve_remocao:true,tipo_veiculo_removido:'CARRO'},
 {houve_remocao:false,tipo_veiculo_removido:'MOTO'},
 {houve_remocao:true,tipo_veiculo_removido:'MOTO'}
]);
assert.equal(infra.autosInfracao,3);
assert.equal(infra.autosComRemocao,2);
assert.equal(infra.autosRemocaoCarro,1);
assert.equal(infra.autosRemocaoMoto,1);
const ocorr=[{conducoes_operacionais:2,veiculos_recuperados:1}];
const cardsG=i.cards('GIRO',ocorr,[],{status:'ok',data:[{quantidade_pessoas:4,unidade_id:'g'}]});
assert.equal(cardsG[2].valor,1);
assert.equal(cardsG[3].valor,4);
const cardsT=i.cards('CIPTUR',ocorr,[],{status:'ok',data:[{houve_remocao:true}]});
assert.equal(cardsT[2].valor,1);
assert.equal(cardsT[3].valor,1);
const cardsC=i.cards('CAVALARIA',ocorr,[],{status:'ok',data:[{abordagens_pessoas:5,tipo_policiamento:'POLICIAMENTO_MONTADO'}]});
assert.equal(cardsC[0].valor,1);
assert.equal(cardsC[1].valor,5);
assert.equal(cardsC[2].valor,1);
assert.equal(i.formatar(i.cards('CIPG',[],[],{status:'erro'})[0]),'—','erro não é zero');
assert.equal(i.formatar(i.cards('GIRO',[],[],{status:'carregando'})[2]),'—','carregando não é zero');
assert.equal(i.formatar(i.cards('GIRO',[],[],{status:'ok',data:[]})[2]),'0','consulta vazia válida é zero');
box.window.CipaHome={indicadores:(_,dados)=>({animais:7,areaEmbargadaHa:1.5,valorMultas:1500})};
box.window.CipgHome={indicadores:()=>({relatoriosServico:2,entradasPmHospital:1,servicosSemAlteracao:1,empregosEfetivo:4})};
assert.equal(i.cards('CIPA',[],[],{status:'ok',data:{}})[1].valor,7);
assert.equal(i.cards('CIPA',[],[],{status:'ok',data:{}})[2].valor,1.5);
assert.equal(i.cards('CIPA',[],[],{status:'ok',data:{}})[3].valor,1500);
assert.equal(i.cards('CIPG',[],[],{status:'ok',data:{}})[0].valor,2);
assert.ok(i.brasaoUnidade.GIRO.endsWith('.svg'));
assert.ok(i.corUnidade.CIPA);
console.log('OK: contratos GIRO, Cavalaria, CIPTUR, CIPA, CIPG e estados sem dados/erro.');
