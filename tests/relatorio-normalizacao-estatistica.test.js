const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const relatorio=fs.readFileSync(path.join(root,'relatorio.html'),'utf8');
const printRenderer=fs.readFileSync(path.join(root,'relatorio-print.js'),'utf8');

const inicio=relatorio.indexOf('function chaveEstatisticaRel');
const fim=relatorio.indexOf('function formaVisualEntorpecente');
assert.ok(inicio>=0&&fim>inicio,'Helpers de normalização não encontrados.');

const contexto={
  S:v=>(v??'').toString().trim(),
  N:v=>Number(v)||0,
  ehNaoInformadoRel:v=>{
    const z=(v??'').toString().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
    return !z||['NI','N/I','N','NA','NAO INFORMADO','NAO INFORMADA'].includes(z);
  },
  docsComTco:()=>[['BO',100],['TÁTICO SETORIAL',20],['AME',9]],
  eh2BpmRel:()=>true
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

assert.equal(contexto.normalizarNaturezaRel('Maria da Penha'),'MARIA DA PENHA / VIOLÊNCIA DOMÉSTICA');
assert.equal(contexto.normalizarNaturezaRel('Violência Doméstica'),'MARIA DA PENHA / VIOLÊNCIA DOMÉSTICA');
assert.equal(contexto.normalizarNaturezaRel('Maria da Penha / Violência Doméstica'),'MARIA DA PENHA / VIOLÊNCIA DOMÉSTICA');
const docs2bpm=contexto.docsRelatorioGenerico([
  {ocorrencia:'Maria da Penha'},
  {ocorrencia:'Violência Doméstica'},
  {ocorrencia:'Furto'}
],[]);
assert.equal(Object.fromEntries(docs2bpm).AME,2,'AME deve refletir todas as ocorrências de violência doméstica/Maria da Penha.');

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
  {comandante:'SARGENTO PM SILVA.'},
  {comandante:'CB PM A. FERREIRA'},
  {comandante:'CB PM A FERREIRA'}
]);
assert.equal(comandantes.length,2);
assert.equal(comandantes[0].registros.length,3);
assert.equal(comandantes[1].registros.length,2);

const resumoInicio=relatorio.indexOf('function resumoResultadosComandanteRel');
const resumoFim=relatorio.indexOf('function criarModeloRelatorio2Bpm',resumoInicio);
assert.ok(resumoInicio>=0&&resumoFim>resumoInicio,'Resumo estruturado dos resultados do comandante não encontrado.');
const resumoContexto={N:contexto.N};
vm.createContext(resumoContexto);
vm.runInContext(relatorio.slice(resumoInicio,resumoFim),resumoContexto);
const resumoComResultados=resumoContexto.resumoResultadosComandanteRel({
  armas_fogo:1,simulacros:0,legado:0,municoes:16,veiculos:1,
  foragidos_descumprimento:9,entorpecentes:6
});
assert.equal(resumoComResultados,'Armas: 1 · Munições: 16 · Veículos: 1 · Forag./Desc.: 9 · Drogas: 6');
assert.ok(!resumoComResultados.includes('Simulacros'),'Métricas zeradas não devem aparecer no resumo do comandante.');
assert.ok(!resumoComResultados.includes('Legado'),'Métricas zeradas não devem aparecer no resumo do comandante.');
assert.equal(resumoContexto.resumoResultadosComandanteRel({}), '—','Comandante sem resultado operacional deve usar travessão.');

assert.ok(relatorio.includes('const commanderRows=commanders.map'),'Modelo do 2º BPM deve fornecer todos os comandantes ao compositor, sem chunks fixos.');
assert.ok(printRenderer.includes("headers:['ITEM','COMANDANTE','OCORRÊNCIAS','RESULTADOS OPERACIONAIS']"),'Renderer deve usar o resumo compacto de resultados dos comandantes.');
assert.ok(printRenderer.includes('TOTAL COM CMT. IDENTIFICADO'),'Total de comandantes deve ser explícito na última parte da tabela.');
assert.ok(relatorio.includes("sum(g,'foragidos')+g.filter(y=>S(y.ocorrencia).toUpperCase().includes('DESCUMPRIMENTO')).length"),'Métrica de foragidos/descumprimento deve usar a mesma regra nas linhas.');

const escopoInicio=relatorio.indexOf('function escopoTerritorialSelecionado');
const escopoFim=relatorio.indexOf('function escopoTerritorial()',escopoInicio);
assert.ok(escopoInicio>=0&&escopoFim>escopoInicio,'Função de escopo territorial selecionado não encontrada.');
const escopoContexto={
  sisc:{value:''},
  companhia:{value:'',selectedIndex:0,options:[{text:'Todas'},{text:'1ª Companhia'}]}
};
vm.createContext(escopoContexto);
vm.runInContext(relatorio.slice(escopoInicio,escopoFim),escopoContexto);
assert.equal(escopoContexto.escopoTerritorialSelecionado(),'','Opção vazia “Todas” não pode virar rótulo na capa do 2º BPM.');
escopoContexto.companhia.value='1ª CIA';escopoContexto.companhia.selectedIndex=1;
assert.equal(escopoContexto.escopoTerritorialSelecionado(),'1ª Companhia','Filtro territorial real deve continuar visível.');
assert.ok(relatorio.includes('scopeLabel:escopoTerritorialSelecionado()'),'Modelo do 2º BPM deve receber apenas o filtro territorial efetivamente selecionado.');
assert.ok(printRenderer.includes("!value(this.meta.scopeLabel).trim()&&/\\bTODAS?\\b/i"),'Validação física deve rejeitar “Todas” quando não existe filtro.');
assert.ok(relatorio.includes("if(c==='NÃO INFORMADA'||!['M','F'].includes(sx))return;"),'Nacionalidades sem sexo M/F não devem entrar na estatística.');

const drugInicio=relatorio.indexOf('function normalizarTipoEntorpecenteRel');
const drugFim=relatorio.indexOf('function totalEstruturadoOuLegado');
assert.ok(drugInicio>=0&&drugFim>drugInicio,'Helpers de entorpecentes não encontrados.');
const drogas={
  S:contexto.S,N:contexto.N,ehNaoInformadoRel:contexto.ehNaoInformadoRel,
  chaveEstatisticaRel:contexto.chaveEstatisticaRel,
  formaVisualEntorpecente:item=>(item&&item.forma_apresentacao)||''
};
vm.createContext(drogas);
vm.runInContext(relatorio.slice(drugInicio,drugFim),drogas);
assert.equal(drogas.normalizarTipoEntorpecenteRel('SKANK'),'SKUNK');
assert.equal(drogas.normalizarTipoEntorpecenteRel('skunk'),'SKUNK');
const inc=drogas.incidenciaEntorpecentes([
  {entorpecentes_itens:[{tipo:'SKANK',quantidade:1}]},
  {entorpecentes_itens:[{tipo:'skunk',quantidade:1}]},
  {entorpecentes:'SIM'}
]);
assert.deepEqual(JSON.parse(JSON.stringify(inc)),[['SKUNK',2]],'SKANK e SKUNK devem virar uma única droga e tipo não informado não deve aparecer.');

const ammoInicio=relatorio.indexOf('function normalizarCalibreRel');
const ammoFim=relatorio.indexOf('function ocorrenciaComArmasOuMunicoes');
assert.ok(ammoInicio>=0&&ammoFim>ammoInicio,'Helpers de munição não encontrados.');
const municoes={S:contexto.S,N:contexto.N,ehNaoInformadoRel:contexto.ehNaoInformadoRel,chaveEstatisticaRel:contexto.chaveEstatisticaRel};
vm.createContext(municoes);
vm.runInContext(relatorio.slice(ammoInicio,ammoFim),municoes);
const ammo=municoes.detalhesMunicoesRel([
  {municoes_itens:[{calibre:'9 MM',quantidade:17}]},
  {municoes_itens:[{calibre:'9 mm',quantidade:15}]},
  {municoes_itens:[{calibre:'Calibre não informado',quantidade:8}]}
]);
assert.deepEqual(JSON.parse(JSON.stringify(ammo)),[['Calibre 9 MM',32]],'9 MM/9 mm devem ser consolidados e calibre não informado removido.');

const comboInicio=relatorio.indexOf('function pessoaRelTemDado');
const comboFim=relatorio.indexOf('function tipoAbordagemRel');
assert.ok(comboInicio>=0&&comboFim>comboInicio,'Helpers de nacionalidade não encontrados.');
const pessoas={
  S:contexto.S,E:v=>String(v),ehNaoInformadoRel:contexto.ehNaoInformadoRel,
  normalizarNacionalidadeRel:contexto.normalizarNacionalidadeRel,
  normalizarSexoRel:contexto.normalizarSexoRel
};
vm.createContext(pessoas);
vm.runInContext(relatorio.slice(comboInicio,comboFim),pessoas);
const combo=pessoas.comboRows([
  {infrator_nacionalidade:'BR',infrator_sexo:'M'},
  {infrator_nacionalidade:'BR — Brasileira',infrator_sexo:'Masculino'},
  {infrator_nacionalidade:'VE',infrator_sexo:'F'},
  {infrator_nacionalidade:'BR',infrator_sexo:'Outro'},
  {infrator_nacionalidade:'VE',infrator_sexo:'NI'},
  {infrator_nacionalidade:'NI',infrator_sexo:'M'}
],'infrator','Infrator');
assert.equal(combo.total,3,'Somente nacionalidade conhecida com sexo M/F deve ser computada.');
assert.ok(!combo.rows.join('').includes('OUTRO'));
assert.ok(!combo.rows.join('').includes('NÃO INFORM'));

console.log('Relatório: consolidação estatística validada para nacionalidades, AME, naturezas, drogas, munições, armas brancas e comandantes.');
