"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,"..");
const source=fs.readFileSync(path.join(root,"indicadores-origem-envolvimento.js"),"utf8");
const context={};vm.createContext(context);vm.runInContext(source,context);
const mod=context.SIEIndicadoresEnvolvimento;
assert.ok(mod,"Módulo compartilhado carregado");
const marcador="[[PESSOAS_ENVOLVIDAS]]";
const bo=(id,origem,dados={})=>({
  id,origem_acionamento:origem,
  observacao_final:Object.keys(dados).length?"Relato documental\n"+marcador+JSON.stringify(dados):"Relato com referência à equipe policial e ao CICC."
});
const institucional=(situacao,tipo)=>({situacao,tipo});
const registros=[
  bo("a","CICC",{institucionaisPrincipais:{vitima:institucional("SIM","POLICIAL_MILITAR"),infrator:institucional("SIM","POLICIAL_CIVIL")}}),
  bo("b","PATRULHAMENTO",{institucionaisPrincipais:{vitima:institucional("NAO",""),infrator:institucional("NAO","")}}),
  bo("c","OPERACAO",{vitimas:[{institucional:institucional("SIM","POLICIAL_FEDERAL")},{institucional:institucional("SIM","POLICIAL_PENAL")}] }),
  bo("d","ABORDAGEM",{institucionaisPrincipais:{infrator:institucional("SIM","DELEGADO_POLICIA")}}),
  bo("e","MISSAO",{institucionaisPrincipais:{vitima:institucional("SIM","MAGISTRADO"),infrator:institucional("SIM","AUTORIDADE_POLITICA_ADMINISTRATIVA")}}),
  bo("f","OUTRA",{institucionaisPrincipais:{vitima:institucional("SIM","GUARDA_MUNICIPAL")}}),
  bo("g",null),
  bo("a","CICC",{institucionaisPrincipais:{vitima:institucional("SIM","POLICIAL_MILITAR")}}),
  bo("h",null,{infratores:[{institucional:institucional("SIM","OUTRO_POLICIAL")}]})
];
const dados=JSON.parse(JSON.stringify(mod.resumir(registros)));
assert.equal(dados.total,8,"Mesmo BO com múltiplos papéis ou repetição não deve duplicar");
for(const cat of ["CICC","PATRULHAMENTO","ABORDAGEM","MISSAO","OPERACAO","OUTRA"])assert.equal(dados.origens[cat],1,cat);
assert.equal(dados.origens.NAO_INFORMADA,2);
assert.equal(dados.origemInformada,6);
assert.equal(dados.policiais.total,4,"Policial em vítima e infrator no mesmo BO conta uma ocorrência");
assert.equal(dados.policiais.vitimas,2);
assert.equal(dados.policiais.infratores,3);
assert.equal(dados.policiais.classificados,7);
assert.equal(dados.policiais.semClassificacao,1);
assert.deepEqual(dados.ocorrenciasPoliciais.map(x=>x.id).sort(),["a","c","d","h"]);
assert.equal(mod.classificarOcorrencia(bo("s","CICC")).envolvePolicial,false,"Referência à guarnição não basta");
assert.equal(mod.classificarOcorrencia({observacao_final:marcador+"{INVALIDO"}).envolvePolicial,false,"JSON inválido não deve quebrar painel");
assert.equal(mod.classificarOcorrencia(bo("n","DESCONHECIDA")).origem,"NAO_INFORMADA");
assert.equal(mod.classificarOcorrencia(bo("q",null,{institucionaisPrincipais:{vitima:institucional("SIM","MILITAR_FORCAS_ARMADAS")}})).envolvePolicial,false,"Militar das forças armadas não é automaticamente policial");
assert.equal(mod.classificarOcorrencia(bo("x",null,{institucionaisPrincipais:{infrator:institucional("SIM","OUTRA_AUTORIDADE")}})).envolvePolicial,false,"Outra autoridade não é policial");
assert.equal(mod.resumir([]).total,0);

const routed=fs.readFileSync(path.join(root,"cadastro.html"),"utf8");
const cadastro=fs.readFileSync(path.join(root,"cadastro-base.html"),"utf8");
const dash=fs.readFileSync(path.join(root,"dashboard.html"),"utf8");
const cpc=fs.readFileSync(path.join(root,"dashboard-cpc.html"),"utf8");
assert.match(routed,/institucionaisPrincipais:\{vitima:/,"Roteador de cadastro deve preservar classificação da vítima principal");
assert.match(routed,/dados\.institucionaisPrincipais\.infrator\.situacao/,"Roteador deve persistir classificação principal");
assert.match(cadastro,/institucionaisPrincipais:/,"Cadastro direto também persiste a classificação");
assert.match(dash,/indicadores-origem-envolvimento\.js\?v=20261106-1/);
assert.match(dash,/id="chartOrigemAcionamento"/);
assert.doesNotMatch(dash,/id="kOcorrenciasPoliciais"/,"Dashboard das unidades não exibe policiais envolvidos");
assert.doesNotMatch(dash,/id="kVitimasPoliciais"/);
assert.doesNotMatch(dash,/id="kInfratoresPoliciais"/);
assert.doesNotMatch(dash,/ocorrenciasPoliciaisCobertura/);
assert.match(dash,/Origem das ocorrências/,"A origem deve continuar disponível nas unidades");
assert.match(dash,/renderOrigemPoliciais\(a\)/,"Dashboard de unidade deve respeitar os filtros locais");
assert.match(cpc,/id="chartCpcOrigemAtendimento"/);
assert.match(cpc,/id="cpcEnvolvimentoReservado" hidden/,"Indicadores sensíveis ficam ocultos por padrão");
assert.match(cpc,/payload\.pode_ver_envolvimento===true/,"Interface respeita autorização retornada pelo servidor");
assert.match(cpc,/id="cpcPoliciaisTotal"/);
assert.match(cpc,/id="cpcAutoridadesTotal"/);
assert.match(cpc,/id="cpcAutoridadesVitimas"/);
assert.match(cpc,/id="cpcAutoridadesInfratores"/);
assert.match(cpc,/id="cpcEnvolvidosTotal"/);
assert.match(cpc,/novos cadastros a partir de 06\/11\/2026/);
assert.match(cpc,/obter_indicadores_origem_envolvimento_cpc',args/,"CPC deve consultar escopo territorial no servidor");
assert.match(cpc,/renderOrigemPoliciaisCpc\(ocpi.data/);
assert.match(cpc,/sem classificação/,"Cobertura de origem e classificação deve ser comunicada");
assert.match(cpc,/Cadastros realizados desde 06\/11\/2026/);
console.log("Origens visíveis às unidades, envolvimento de policiais e autoridades exclusivo no CPC, classificação por BO e preservação de cadastros: OK.");
