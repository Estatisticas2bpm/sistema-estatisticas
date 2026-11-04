'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const base=fs.readFileSync(path.join(root,'cadastro-base.html'),'utf8');
const rota=fs.readFileSync(path.join(root,'cadastro.html'),'utf8');
const consulta=fs.readFileSync(path.join(root,'consulta.html'),'utf8');
const parte=base.slice(
  base.indexOf('    const configuracaoResultados = ['),
  base.indexOf('    const modalTipoOcorrencia = document.getElementById("modalTipoOcorrencia");')
);
assert.ok(parte.startsWith('    const configuracaoResultados = [') && parte.includes('function providenciasDosResultados()'));

function modelo(comCipa){
  const ids=['resultadoConducao','campoQtdConducao','numeroConduzidos',
    'resultadoOrientacao','campoQtdOrientacao','orientacoes',
    'resultadoVeiculo','campoQtdVeiculo','veiculosRecuperados',
    'resultadoOutro','campoOutroResultado','outroResultadoDescricao'];
  if(comCipa)ids.push('resultadoInformativo','statusInformativoCipa');
  const elementos=Object.fromEntries(ids.map(id=>[id,{
    id,checked:false,hidden:false,required:false,value:'',textContent:'',type:['numeroConduzidos','orientacoes','veiculosRecuperados'].includes(id)?'number':'text',listeners:[],
    addEventListener(ev,fn){if(ev==='change')this.listeners.push(fn)},
    dispatchEvent(){for(const fn of this.listeners)fn()}
  }]));
  const documento={getElementById(id){return elementos[id]||null}};
  const ctx={document:documento};
  vm.createContext(ctx);vm.runInContext(parte,ctx);
  return {e:elementos,ctx,change(id,checked){
    elementos[id].checked=checked;elementos[id].dispatchEvent();
  },providencias:()=>Array.from(vm.runInContext('providenciasDosResultados()',ctx)),
    restaurar(reg){vm.runInContext('marcarResultadosExistentes('+JSON.stringify(reg)+')',ctx)}};
}

const cipa=modelo(true);
cipa.change('resultadoOrientacao',true);
assert.equal(cipa.e.orientacoes.value,'1');
assert.equal(cipa.e.campoQtdOrientacao.hidden,false);
cipa.change('resultadoVeiculo',true);
cipa.e.veiculosRecuperados.value='3';
cipa.change('resultadoConducao',true);
cipa.e.numeroConduzidos.value='2';
cipa.change('resultadoOutro',true);
cipa.e.outroResultadoDescricao.value='OUTRO TESTE FICTICIO';
cipa.change('resultadoInformativo',true);
for(const [check,container,valor] of [
  ['resultadoConducao','campoQtdConducao','numeroConduzidos'],
  ['resultadoOrientacao','campoQtdOrientacao','orientacoes'],
  ['resultadoVeiculo','campoQtdVeiculo','veiculosRecuperados'],
  ['resultadoOutro','campoOutroResultado','outroResultadoDescricao']
]){
  assert.equal(cipa.e[check].checked,false,check+' deve desmarcar');
  assert.equal(cipa.e[container].hidden,true,container+' deve ocultar');
  assert.equal(cipa.e[valor].required,false,valor+' nao obrigatorio');
  assert.equal(cipa.e[valor].value,'',valor+' nao pode inflar indicador');
}
assert.deepEqual(cipa.providencias(),['INFORMATIVO']);
cipa.change('resultadoOrientacao',true);
assert.equal(cipa.e.resultadoInformativo.checked,false);
assert.deepEqual(cipa.providencias(),['ORIENTAÇÃO']);

// Ao editar um BO informativo, restaurar a marcação sem criar quantidades.
const cipaEdicao=modelo(true);
cipaEdicao.restaurar({providencia_1:'INFORMATIVO',providencia_2:null,numero_conduzidos:null,numero_prisoes:0,orientacoes:0,veiculos_recuperados:0,detalhes:null});
assert.equal(cipaEdicao.e.resultadoInformativo.checked,true);
assert.deepEqual(cipaEdicao.providencias(),['INFORMATIVO']);
// Registro legado incoerente: evidenciar conflitos, nao apagar fatos silenciosamente.
const legado=modelo(true);
legado.restaurar({providencia_1:'INFORMATIVO',orientacoes:2});
assert.equal(legado.e.resultadoInformativo.checked,true);
assert.equal(legado.e.resultadoOrientacao.checked,true);
assert.match(legado.e.statusInformativoCipa.textContent,/Confira/i);

// Outras unidades mantêm os quatro resultados originais e nao recebem Informativo.
const outros=modelo(false);
outros.change('resultadoOrientacao',true);
assert.deepEqual(outros.providencias(),['ORIENTAÇÃO']);
outros.restaurar({providencia_1:'CONDUÇÃO',numero_conduzidos:2,orientacoes:0,veiculos_recuperados:0});
assert.equal(outros.e.resultadoConducao.checked,true);
assert.deepEqual(outros.providencias(),['CONDUÇÃO']);

assert.match(rota,/if\(ehCipaCadastro\)\{\s*\/\/ BO meramente informativo/);
assert.match(rota,/id="resultadoInformativo"/);
assert.match(rota,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
assert.match(rota,/resultadoOutroBase\+'<label class="resultado-opcao">/);
assert.match(base,/if \(resultadoInformativoCipa\) resultadoInformativoCipa\.checked = false;/);
assert.match(base,/resultadoInformativoCipa\?\.checked && configuracaoResultados\.some/);
assert.match(base,/providencia_1: providenciasSelecionadas\[0\] \|\| null/);
assert.match(base,/providencia_2: providenciasSelecionadas\[1\] \|\| null/);
assert.match(base,/numero_conduzidos: document\.getElementById\("resultadoConducao"\)\.checked/);
assert.match(base,/orientacoes: document\.getElementById\("resultadoOrientacao"\)\.checked/);
assert.match(base,/veiculos_recuperados: document\.getElementById\("resultadoVeiculo"\)\.checked/);
assert.match(consulta,/providencia_1','Resultado do atendimento 1/);
assert.match(consulta,/providencia_2','Resultado do atendimento 2/);
assert.match(consulta,/==='CIPA'\?'cadastro\.html':'cadastro-base\.html'/);
console.log('CIPA Informativo: opcao exclusiva, quantidades zeradas, edicao/consulta, importacao PDF e isolamento das demais unidades OK.');
