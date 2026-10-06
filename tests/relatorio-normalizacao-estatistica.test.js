const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const relatorio=fs.readFileSync(path.join(root,'relatorio.html'),'utf8');

const inicio=relatorio.indexOf('function chaveEstatisticaRel');
const fim=relatorio.indexOf('function formaVisualEntorpecente');
assert.ok(inicio>=0&&fim>inicio,'Helpers de normalização não encontrados.');

const contexto={
  S:v=>(v??'').toString().trim(),
  N:v=>Number(v)||0,
  ehNaoInformadoRel:v=>{
    const z=(v??'').toString().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
    return !z||['NI','N/I','N','NA','NAO INFORMADO','NAO INFORMADA'].includes(z);
  }
};
vm.createContext(contexto);
vm.runInContext(relatorio.slice(inicio,fim),contexto);

assert.equal(contexto.normalizarNacionalidadeRel('BR'),'BR — BRASILEIRA');
assert.equal(contexto.normalizarNacionalidadeRel('BR — Brasileira'),'BR — BRASILEIRA');
assert.equal(contexto.normalizarNacionalidadeRel('brasileiro'),'BR — BRASILEIRA');
assert.equal(contexto.normalizarNacionalidadeRel('VE'),'VE — VENEZUELANA');
assert.equal(contexto.normalizarNacionalidadeRel('VE - Venezuelana'),'VE — VENEZUELANA');
assert.equal(contexto.normalizarNacionalidadeRel('venezuelano'),'VE — VENEZUELANA');
assert.equal(contexto.normalizarNacionalidadeRel('GUI'),'GY — GUIANENSE');

assert.equal(contexto.normalizarSexoRel('Masculino'),'M');
assert.equal(contexto.normalizarSexoRel('feminino'),'F');
assert.equal(contexto.normalizarSexoRel('NI'),'NÃO INFORMADO');

assert.equal(contexto.tipoArmaBrancaRel('faca de açougueiro'),'FACA');
assert.equal(contexto.tipoArmaBrancaRel('Faca de mesa do cabo vermelho'),'FACA');
assert.equal(contexto.tipoArmaBrancaRel('Arma Branca do Cabo Vermelha'),'FACA');
assert.equal(contexto.tipoArmaBrancaRel('FACÃO TRAMONTINA DO CABO PRETO'),'FACÃO');
assert.equal(contexto.tipoArmaBrancaRel('CUTELOS Quantidade 2'),'CUTELO');
assert.equal(contexto.tipoArmaBrancaRel('00 Unidades'),'NÃO ESPECIFICADA');

const agrupadas=contexto.armasBrancasAgrupadasRel([
  {arma_branca:'FACA',quantidade_arma_branca:2},
  {arma_branca:'faca de açougueiro',quantidade_arma_branca:1},
  {arma_branca:'Facão',quantidade_arma_branca:1},
  {arma_branca:'CUTELOS Quantidade 2',quantidade_arma_branca:2},
  {arma_branca:'00 Unidades',quantidade_arma_branca:0}
]);
const mapa=Object.fromEntries(agrupadas.itens);
assert.equal(mapa.FACA,3);
assert.equal(mapa['FACÃO'],1);
assert.equal(mapa.CUTELO,2);
assert.equal(mapa['NÃO ESPECIFICADA'],undefined);
assert.equal(agrupadas.total,6);

const comandantes=contexto.comandantesAgrupadosRel([
  {comandante:'SGT PM SILVA'},
  {comandante:'sgt pm silva'},
  {comandante:'SGT PM SILVA.'},
  {comandante:'CB PM A. FERREIRA'},
  {comandante:'CB PM A FERREIRA'}
]);
assert.equal(comandantes.length,2);
assert.equal(comandantes[0].registros.length,3);
assert.equal(comandantes[1].registros.length,2);

assert.ok(relatorio.includes("cmdData.some(r=>N(r[x[0]])>0)"),'Colunas zeradas devem ser ocultadas.');
assert.ok(relatorio.includes('TOTAL COM CMT. IDENTIFICADO'),'Total de comandantes deve ser explícito.');
assert.ok(relatorio.includes("sum(g,'foragidos')+g.filter(y=>S(y.ocorrencia).toUpperCase().includes('DESCUMPRIMENTO')).length"),'Métrica de foragidos/descumprimento deve usar a mesma regra nas linhas.');

console.log('Relatório: nacionalidades, armas brancas e comandantes normalizados com sucesso.');
