'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','dashboard-cpc.html'),'utf8');
function extract(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,'Não encontrou '+a);return html.slice(i,j)}
const unidades=[
  {id:'cpc',sigla:'CPC'},
  {id:'giro',sigla:'GIRO'},
  {id:'cav',sigla:'CAVALARIA'},
  {id:'bope',sigla:'BOPE'}
];
const giro=[{id:'g1',unidade_id:'giro',quantidade_pessoas:2},{id:'g2',unidade_id:'giro',quantidade_pessoas:3}];
const cav=[{id:'c1',unidade_id:'cav',abordagens_pessoas:11},{id:'c2',unidade_id:'cav',abordagens_pessoas:4}];
const ctx={
 hierarquiaUnidades:unidades,unidadeH:id=>unidades.find(u=>u.id===id),n:Number,
};
vm.createContext(ctx);
vm.runInContext(extract('function produtividadeAbordagensCpc(','function renderAbordagensGiroCpc(){'),ctx);
let c=ctx.produtividadeAbordagensCpc('',giro,cav);
assert.equal(c.abordagensGiro,2,'Uma abordagem GIRO é um registro de abordagem, não uma pessoa');
assert.equal(c.pessoasGiro,5);
assert.equal(c.pessoasCavalaria,15);
assert.equal(c.pessoas,20,'Pessoas somadas por fonte estruturada e sem somar abordagens com pessoas');
c=ctx.produtividadeAbordagensCpc('giro',giro,cav);
assert.equal(c.pessoas,5,'Unidade GIRO deve excluir Cavalaria');
c=ctx.produtividadeAbordagensCpc('cav',giro,cav);
assert.equal(c.pessoas,15,'Unidade Cavalaria deve excluir GIRO');
assert.equal(c.dispGiro,false);
c=ctx.produtividadeAbordagensCpc('bope',giro,cav);
assert.equal(c.pessoas,null,'BOPE não possui fonte estruturada homologada: não pode exibir zero falso');
assert.equal(c.dispGiro,false,'BOPE não deve apresentar zero do GIRO como seu indicador');
c=ctx.produtividadeAbordagensCpc('',giro,null);
assert.equal(c.pessoas,null,'Falha de consulta Cavalaria não pode transformar o total combinado em valor parcial');
c=ctx.produtividadeAbordagensCpc('giro',giro,null);
assert.equal(c.pessoas,5,'Falha Cavalaria não afeta indicador independente de GIRO');
c=ctx.produtividadeAbordagensCpc('cav',giro,[]);
assert.equal(c.pessoas,0,'Com fonte consultada e sem lançamentos, zero é legítimo');

assert.match(html,/function consultarCavalariaCpcPaginado\(inicio,fim\)/);
assert.match(html,/\.from\('cavalaria_servicos_produtividade'\)/);
assert.match(html,/\.select\('id,unidade_id,data_servico,abordagens_pessoas'\)/);
assert.match(html,/\.gte\('data_servico',inicio\)\.lte\('data_servico',fim\)/);
assert.match(html,/\.order\('id',\{ascending:true\}\)\.range\(pagina\*passo,\(pagina\+1\)\*passo-1\)/);
assert.match(html,/consultarGiroCpcPaginado\(inicio,fim\),consultarCavalariaCpcPaginado\(inicio,fim\)/);
assert.match(html,/servicosCavalariaCpc=cv\.error\?null:\(cv\.data\|\|\[\]\)/);
assert.match(html,/Sem fonte estruturada de abordagens para a unidade selecionada/);
assert.match(html,/Pessoas abordadas — fontes disponíveis/);
assert.match(html,/Operações documentadas<\/small><strong id="kOperacoesDocumentadas">N\/D/);
assert.match(html,/Apresentações documentadas<\/small><strong id="kApresentacoesDocumentadas">N\/D/);
console.log('CPC: indicador rastreável GIRO + Cavalaria com unidade, período, fonte e N/D por ausência de dados.');
