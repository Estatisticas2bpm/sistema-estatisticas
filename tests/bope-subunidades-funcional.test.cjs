const assert = require('node:assert/strict');
const BopeSubunidades = require('../bope-subunidades.js');

const registros = [
  {id:'57a65a56-da3d-4cfb-8f17-9e11777b18e1',sigla:'CANIL',nome:'1ª Companhia de Cães do BOPE'},
  {id:'8cf04074-c670-491c-a1e1-c13d8afe4f33',sigla:'GATE',nome:'Grupo de Ações Táticas Especiais'},
  {id:'d9c0d4c3-e7f5-4a3b-ab8d-7aa3b40b1a53',sigla:'FORCA_TATICA',nome:'2ª Companhia de Força Tática do BOPE'},
  {id:'cbd0bb1c-76e0-46d2-bbaa-17e83e575ba8',sigla:'CHOQUE',nome:'3ª Companhia de Choque do BOPE'}
];

const normalizados = BopeSubunidades.validarRegistros(registros);
assert.deepEqual(normalizados.map(x=>x.sigla),['FORCA_TATICA','CHOQUE','CANIL','GATE']);
assert.deepEqual(normalizados.map(x=>x.nome),['FORÇA TÁTICA','CHOQUE','CANIL','GATE']);
assert.ok(normalizados.every(x=>/^[0-9a-f-]{36}$/i.test(x.id)));
assert.throws(()=>BopeSubunidades.validarRegistros(registros.slice(0,3)),/incompleta/);
assert.throws(()=>BopeSubunidades.validarRegistros([...registros,registros[0]]),/duplicadas/);
assert.throws(()=>BopeSubunidades.validarRegistros(registros.map((x,i)=>i?x:{...x,id:'uuid-ficticio'})),/UUID válido/);

function ambienteFormulario() {
  const documento = {
    createElement(tag) {
      assert.equal(tag,'option');
      return {value:'',textContent:'',disabled:false,dataset:{},title:''};
    }
  };
  const atributos = new Map();
  const select = {
    ownerDocument:documento,
    value:'',
    disabled:false,
    options:[],
    replaceChildren(...opcoes) { this.options=opcoes; },
    setAttribute(nome,valor) { atributos.set(nome,valor); },
    removeAttribute(nome) { atributos.delete(nome); }
  };
  return {
    documento,
    select,
    status:{textContent:'',style:{}},
    tentarNovamente:{hidden:true},
    atributos
  };
}

(async()=>{
  let rpcChamadas=0;
  const banco={
    async rpc(nome) {
      rpcChamadas++;
      assert.equal(nome,'listar_subunidades_operacionais_bope');
      return {data:registros,error:null};
    }
  };
  const ambiente=ambienteFormulario();
  const preferido=registros.find(x=>x.sigla==='CHOQUE').id;
  const configuracao={banco,...ambiente,valorPreferido:preferido};

  let resultado=await BopeSubunidades.carregarNoFormulario(configuracao);
  assert.equal(resultado.erro,null);
  assert.equal(resultado.selecionado,true);
  assert.equal(ambiente.select.value,preferido,'edição deve recuperar a seleção salva');
  assert.equal(ambiente.select.options.length,5,'placeholder + quatro unidades');
  assert.deepEqual(ambiente.select.options.slice(1).map(x=>x.dataset.sigla),['FORCA_TATICA','CHOQUE','CANIL','GATE']);
  assert.equal(ambiente.select.disabled,false);
  assert.equal(ambiente.tentarNovamente.hidden,true);
  assert.match(ambiente.status.textContent,/Força Tática, Choque, Canil e GATE/);

  resultado=await BopeSubunidades.carregarNoFormulario(configuracao);
  assert.equal(resultado.erro,null);
  assert.equal(ambiente.select.options.length,5,'recarregamento não pode duplicar opções');
  assert.equal(rpcChamadas,2);

  const falha=ambienteFormulario();
  const consoleError=console.error;
  console.error=()=>{};
  try {
    resultado=await BopeSubunidades.carregarNoFormulario({
      banco:{rpc:async()=>({data:null,error:{message:'RLS negou a consulta'}})},
      ...falha
    });
  } finally {
    console.error=consoleError;
  }
  assert.ok(resultado.erro,'a falha da RPC deve ser retornada ao chamador');
  assert.equal(falha.select.disabled,true);
  assert.equal(falha.select.options.length,1);
  assert.equal(falha.tentarNovamente.hidden,false,'deve oferecer nova tentativa');
  assert.match(falha.status.textContent,/Não foi possível carregar/);

  console.log('PASS: carregamento funcional das quatro unidades do BOPE, seleção em edição, recarga sem duplicação e erro recuperável.');
})().catch(erro=>{
  console.error(erro);
  process.exitCode=1;
});
