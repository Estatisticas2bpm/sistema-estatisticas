const assert=require("node:assert/strict");
const {avaliarRegistros}=require("../scripts/ia-cpc-avaliar-amostra-local.cjs");

(async()=>{
 const casos=[];
 for(let i=0;i<6;i++)casos.push({
   historico_resumido:"Segundo a testemunha, havia uma pistola. Dado fictício PESSOA_TESTE.",
   rotulos:{mencao_arma_fogo:"atribuida_a_relato"}
 });
 for(let i=0;i<6;i++)casos.push({
   historico_resumido:"A equipe não localizou uma pistola na área.",
   rotulos:{mencao_arma_fogo:"negada_ou_ausente_no_texto"}
 });
 casos.push({historico_resumido:"A equipe encontrou pistola de pintura.",
   rotulos:{}});
 const rel=await avaliarRegistros(casos);
 assert.equal(rel.registros,13);
 assert.equal(rel.geral.rotulos_esperados,12);
 assert.equal(rel.geral.falso_positivo,0);
 assert.equal(rel.geral.omissoes,0);
 assert.equal(rel.geral.precisao_pct,100);
 assert.equal(rel.geral.acerto_contextual_pct,100);
 assert.equal(rel.geral.afirmacoes_indevidas_como_constatada,0);
 assert.equal(rel.categorias.mencao_arma_fogo.rotulos_esperados,12);
 assert(!JSON.stringify(rel).includes("PESSOA_TESTE"),"Nunca expor conteúdo de relatos");
 assert(!JSON.stringify(rel).includes("testemunha"));
 const uma=await avaliarRegistros([{
   historico_resumido:"A equipe apreendeu pistola.",
   rotulos:{mencao_arma_fogo:"negada_ou_ausente_no_texto"}
 }]);
 assert.equal(uma.geral.afirmacoes_indevidas_como_constatada,1);
 assert.deepEqual(uma.categorias,{},"Categorias de baixo N não devem ser publicadas");
 await assert.rejects(avaliarRegistros([{
   historico_resumido:"Relato fictício",rotulos:{mencao_arma_fogo:"verdadeiro"}
 }]),/Rótulo não permitido/);
 await assert.rejects(avaliarRegistros([]),/limite de homologação/);
 console.log("OK — avaliação offline agrega resultados sem expor textos, com supressão de grupos pequenos.");
})().catch(e=>{console.error(e);process.exitCode=1;});
