const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const cadastro=fs.readFileSync(path.join(root,'cadastro.html'),'utf8');
const base=fs.readFileSync(path.join(root,'cadastro-base.html'),'utf8');
const cipa=fs.readFileSync(path.join(root,'cipa-cadastro.js'),'utf8');

assert.match(cadastro,/Data de elaboração do PPE/);
assert.match(cadastro,/dataRegistroPpe/);
assert.match(cadastro,/dados\.dataFatoOriginal=dados\.data/);
assert.match(base,/cabecalho do mapa situacional/);
assert.match(base,/fotoInicial\?0:ehMapa\?1/);
assert.match(base,/cipaLocalCoordenadas/);
assert.match(cipa,/Coordenada sugerida pelo OCR/);
assert.match(cipa,/const datasPpe=/);
assert.match(cipa,/data_registro_inicio:datasPpe\.inicio/);
assert.match(cipa,/data_registro_fim:datasPpe\.fim/);

// Executa a transformação real emitida pelo wrapper, não apenas um regex de contrato.
const anchor="        '        const dados = extrairDadosOcorrenciaPdf(texto);\\n";
const start=cadastro.indexOf(anchor);
assert.ok(start>=0,'transformação específica da data CIPA ausente');
const literal=cadastro.slice(start+8,cadastro.indexOf('\n      );',start));
const codigo=Function('return '+literal)();
const importar=Function('texto','extrairDadosOcorrenciaPdf','dataIso',codigo+';return dados;');
const convertido=importar(
  'BOLETIM DE OCORRÊNCIA\nData/Hora Início do Registro: 07/08/2026 09:01\nData/Hora do Fato Início: 03/08/2026 10:50',
  ()=>({data:'2026-08-03'}),
  valor=>{const [d,m,a]=valor.split('/');return a+'-'+m+'-'+d;}
);
assert.equal(convertido.data,'2026-08-07');
assert.equal(convertido.dataFatoOriginal,'2026-08-03');

const inicio=cipa.indexOf('  const coordCampo='),fim=cipa.indexOf('  const style=',inicio);
assert.ok(inicio>=0&&fim>inicio);
const funcs=Function('const $=()=>null;\n'+cipa.slice(inicio,fim)+'\nreturn {parseCoordenadas,coordenadasDoTexto};')();
const fotos=funcs.coordenadasDoTexto("3 de agosto de 2026 10:57\n2°22'13\"N 61°44'42\"W");
assert.ok(fotos);
assert.ok(Math.abs(fotos.lat-2.37027777777778)<0.000001);
assert.ok(Math.abs(fotos.lon+61.745)<0.000001);
const mapa=funcs.coordenadasDoTexto('2.36892,-61.74645 - FAZENDA EXEMPLO - CAR');
assert.ok(mapa);
assert.equal(mapa.lat,2.36892);
assert.equal(mapa.lon,-61.74645);
const separado=funcs.coordenadasDoTexto('LATITUDE 2.36892\nLONGITUDE -61.74645');
assert.ok(separado);
assert.equal(separado.lat,2.36892);
assert.equal(separado.lon,-61.74645);
console.log('PASS: data de elaboração, data do fato preservada na extração, GPS da foto e GPS do mapa.');
