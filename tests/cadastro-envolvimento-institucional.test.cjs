'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const raiz=path.join(__dirname,'..');
const leitor=fs.readFileSync(path.join(raiz,'pdf-envolvimento-institucional.js'),'utf8');
const ctx={};vm.createContext(ctx);vm.runInContext(leitor,ctx);
const mod=ctx.PdfEnvolvimentoInstitucional;
assert.ok(mod,'Modulo de reconhecimento institucional disponivel');
const pessoa=(nome,bloco)=>({nome,bloco});
const analise=(p,papel,relato='',quantidade=1)=>JSON.parse(JSON.stringify(mod.analisarPessoa(p,papel,relato,quantidade)));

const vitima=analise(pessoa('Ana Exemplo','Sexo: F\nProfissão: Policial Militar\nIdade: 30'), 'vitima',
  'A EQUIPE DA POLICIA MILITAR ATENDEU A VITIMA');
assert.equal(vitima.situacao,'SIM');assert.equal(vitima.tipo,'POLICIAL_MILITAR');
const penal=analise(pessoa('Carlos Ficticio','Cargo: Policial Penal\nSexo: M'),'infrator');
assert.equal(penal.tipo,'POLICIAL_PENAL');
const autoridade=analise(pessoa('Lucia Teste','Profissão: Vereadora\nIdade: 55'),'vitima');
assert.equal(autoridade.tipo,'AUTORIDADE_POLITICA_ADMINISTRATIVA');
const guarnicao=analise(pessoa('Bia Teste','Profissão: Comerciante\nSexo: F'),'vitima',
 'A POLICIA MILITAR E A GUARNICAO DO SGT PM JOAO ATENDERAM A VITIMA BIA TESTE. O POLICIAL MILITAR FEZ O RELATO.');
assert.equal(guarnicao.situacao,'');assert.equal(guarnicao.tipo,'');
const semQualificacao=analise(pessoa('Mario Teste','Sexo: M'),'infrator',
 'O INFRATOR ERA DELEGADO DE POLICIA E FOI CONDUZIDO.');
assert.equal(semQualificacao.tipo,'DELEGADO_POLICIA');
const narrativa=analise(pessoa('Laura Ficticia','Nacionalidade: Brasileira'),'vitima',
 'A VITIMA, POLICIAL MILITAR, ENCONTRAVA-SE NO LOCAL.');
assert.equal(narrativa.tipo,'POLICIAL_MILITAR');
const homonimos=analise(pessoa('Laura Ficticia','Nacionalidade: Brasileira'),'vitima',
 'A VITIMA, POLICIAL MILITAR, ENCONTRAVA-SE NO LOCAL.',2);
assert.equal(homonimos.situacao,'','Várias vítimas: menção genérica não identifica qual pessoa');
const mencao=analise(pessoa('Teresa Teste','Profissão: Professora'),'vitima',
 'A VITIMA INFORMOU QUE UM POLICIAL MILITAR A SOCORREU.');
assert.equal(mencao.situacao,'','Guarnição não é a vítima');
const desconhecido=analise(pessoa('Joao Teste','Sexo: M'),'vitima');
assert.equal(desconhecido.situacao,'','Ausência de prova não significa NÃO');
const conflito=analise(pessoa('Rita Teste','Cargo: Policial Civil'),'infrator',
 'O INFRATOR ERA POLICIAL MILITAR.');
assert.equal(conflito.situacao,'');assert.equal(conflito.conflito,true);
assert.equal(mod.CATEGORIAS.some(c=>c.value==='POLICIAL_RODOVIARIO_FEDERAL'),true);
assert.equal(mod.CATEGORIAS.some(c=>c.value==='MEMBRO_MINISTERIO_PUBLICO'),true);
const extra=JSON.parse(JSON.stringify(mod.analisarPessoas({
 vitimas:[pessoa('Alice Teste','Profissão: Policial Militar'),pessoa('Bruna Teste','Profissão: Professora')],
 infratores:[pessoa('Felipe Teste','Cargo: Policial Civil')]
},'')));
assert.equal(extra.vitimas[0].tipo,'POLICIAL_MILITAR');
assert.equal(extra.vitimas[1].situacao,'');
assert.equal(extra.infratores[0].tipo,'POLICIAL_CIVIL');

const html=fs.readFileSync(path.join(raiz,'cadastro-base.html'),'utf8');
for(const p of ['Vitima','Infrator']){
 assert.ok(html.includes('id="institucionalSituacao'+p+'"'));
 assert.ok(html.includes('id="institucionalTipo'+p+'"'));
}
assert.match(html,/pdf-envolvimento-institucional\.js\?v=20261106-2/);
assert.match(html,/pessoa\.institucional=instituicoes\[papel\]/);
assert.match(html,/preencherInstitucional\(prefixo==="vitima"\?"Vitima":"Infrator",pessoa\?\.institucional\)/);
assert.match(html,/institucionaisPrincipais:dados\.institucionaisPrincipais/);
assert.match(html,/dados\.institucionaisPrincipais\.vitima\.situacao/);
assert.match(html,/pessoasSalvas\.institucionaisPrincipais\?\.infrator/);
assert.match(html,/data-pessoa="institucionalSituacao"/);
assert.match(html,/data-pessoa="institucionalTipo"/);
assert.match(html,/if\(situacao\.value!=="SIM"\)categoria\.value=""/);
assert.match(html,/delete pessoa\.bloco/);
assert.match(html,/Informe o tipo de policial ou autoridade antes de salvar/);
console.log('Identificação institucional em vítimas e infratores: detecção, conflitos, segurança documental, múltiplas pessoas e persistência OK.');
