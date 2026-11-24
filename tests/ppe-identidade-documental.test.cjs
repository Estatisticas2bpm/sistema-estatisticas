'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const w={};
new Function('window',readFileSync(join(__dirname,'../ppe-naturezas.js'),'utf8'))(w);
const {extrair,extrairLayout,classificar,temSecao}=w.PpeNaturezas;
const secao=(...linhas)=>['Natureza Meio(s) Empregado(s)',...linhas,'ENVOLVIDO(S)'].join('\n');
const natureza='IMPORTUNAÇÃO SEXUAL (ART. 215-A DO CPB)';
const tentativa='TENTATIVA DE '+natureza+' (VIOLÊNCIA DOMÉSTICA CONTRA A MULHER)';
const lesao='LESÃO CORPORAL DOLOSA (ART. 129 CAPUT DO CPB) (VIOLÊNCIA DOMÉSTICA CONTRA A MULHER)';
const catalogos={tipos:[
 {id:100,nome:tentativa,codigo_ppe:'20210',ppe_descricao_original:tentativa},
 {id:200,nome:natureza,codigo_ppe:null,ppe_descricao_original:natureza},
 {id:300,nome:'VIOLÊNCIA DOMÉSTICA CONTRA A MULHER'},
],subtipos:[{id:301,tipo_id:300,nome:'21: LESÃO CORPORAL DOLOSA',fundamento_legal:'ART. 129 CAPUT DO CPB'}]};

test('68643: o código repetido não seleciona a tentativa',()=>{
 const [item]=extrair(secao('20210: '+natureza+' Não Houve'));
 assert.deepEqual(item,{codigo_ppe:'20210',descricao_original:natureza,fundamentacao_legal:'ART. 215-A DO CPB',meios_empregados:['Não Houve']});
 assert.equal(classificar(item,catalogos,{tipo_id:200,situacao:'DISPONIVEL'}).tipo.id,200);
 assert.equal(classificar(item,catalogos,{tipo_id:null,situacao:'INDISPONIVEL'}),null);
 assert.equal(classificar(item,catalogos,null),null);
});

test('67420 e 67288: subtipo doméstico requer descrição e lei, e para em Motivação',()=>{
 for(const meio of ['Não Houve','Objeto Contundente']){
  const [item]=extrair(secao('21: '+lesao,meio,'Motivação: rótulo fora da seção'));
  assert.equal(item.descricao_original,lesao);
  assert.deepEqual(item.meios_empregados,[meio]);
  const resultado={tipo_id:null,situacao:'INDISPONIVEL'};
  assert.equal(classificar(item,catalogos,resultado).subtipo.id,301);
  assert.equal(classificar({...item,descricao_original:'TENTATIVA DE '+lesao},catalogos,resultado),null);
  assert.equal(classificar({...item,fundamentacao_legal:'ART. 129 § 9º DO CPB'},catalogos,resultado),null);
  assert.equal(classificar({...item,descricao_original:lesao+' (ATO INFRACIONAL)'},catalogos,resultado),null);
  assert.equal(classificar(item,catalogos,{...resultado,situacao:'REVISAO'}),null);
 }
});

test('67284: o leiaute preserva dois códigos e o meio de cada linha',()=>{
 const items=extrairLayout([[
  [{x:20,texto:'Natureza'},{x:420,texto:'Meio(s) Empregado(s)'}],
  [{x:20,texto:'1216: CONDUZIR VEÍCULO COM CAPACIDADE PSICOMOTORA ALTERADA'},{x:420,texto:'Veículo'}],
  [{x:20,texto:'1093: SINISTRO DE TRÂNSITO SEM FERIDOS'},{x:420,texto:'Não Houve'}],
  [{x:20,texto:'Motivação: outra informação'}],
 ]]);
 assert.deepEqual(items.map(i=>[i.codigo_ppe,i.meios_empregados]),[['1216',['Veículo']],['1093',['Não Houve']]]);
});

test('linha sem código e com meio identificado; seção duvidosa não vira classificação',()=>{
 const doc=secao(natureza,'Não Houve');
 assert.equal(temSecao(doc),true);
 const [item]=extrair(doc);
 assert.equal(item.codigo_ppe,null);
 assert.equal(item.descricao_original,natureza);
 assert.deepEqual(extrair(secao('123: DESCRIÇÃO SEM SEPARAÇÃO ARMA DE FOGO')),[]);
});

test('as operações dos botões (+) e a confirmação manual permanecem no cadastro',()=>{
 const base=readFileSync(join(__dirname,'../cadastro-base.html'),'utf8');
 const subtipo=readFileSync(join(__dirname,'../cadastro-subtipo.js'),'utf8');
 assert.match(base,/cadastrar_tipo_ocorrencia_publico/);
 assert.match(subtipo,/abrirNovoSubtipoOcorrencia/);
 assert.match(subtipo,/cadastrar_subtipo_ocorrencia_publico/);
 assert.match(base,/importacaoPdfPendente = true/);
 assert.match(base,/dados\.temSecaoPpe \? null : melhorItemCatalogo/);
});
