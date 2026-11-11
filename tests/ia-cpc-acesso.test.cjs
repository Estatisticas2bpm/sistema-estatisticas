const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const raiz=path.join(__dirname,"..");
const ler=(p)=>fs.readFileSync(path.join(raiz,p),"utf8");

const config=ler("auth-config.js");
const guard=ler("auth-guard.js");
const home=ler("index.html");
const dash=ler("dashboard-cpc.html");
const pagina=ler("ia-cpc.html");
const fn=ler("supabase/functions/ia-cpc/index.ts");
const sql=ler("docs/sql/ia_cpc_cota_pendente_aprovacao.sql");
const estatistica=ler("supabase/functions/ia-cpc/estatisticas.mjs");
const financeiro=ler("supabase/functions/ia-cpc/orcamento.mjs");

assert.match(config, /"ia-cpc\.html"\s*:\s*"ia_cpc"/);
assert.match(guard,/permissao==='ia_cpc'\)return acessoIaIndividual/);
assert.match(guard,/client\.rpc\('ia_cpc_permitido'\)/);
assert.match(guard,/acessoIaIndividual=false/);
assert.match(home,/href="ia-cpc\.html" data-permission="ia_cpc" hidden/);
assert.match(dash,/href="ia-cpc\.html" data-permission="ia_cpc" hidden/);
assert.match(pagina,/autorizado\.pode\('ia_cpc'\)/);
assert.match(pagina,/functions\.invoke\('ia-cpc'/);
assert.match(pagina,/data-resumo="7"/);
assert.match(pagina,/data-resumo="15"/);
assert.match(pagina,/data-resumo="30"/);
assert.doesNotMatch(pagina,/OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|sk-proj-/i);

assert.match(fn,/IA_CPC_ENABLED/);
assert.match(fn,/admin\.auth\.getUser\(token\)/);
assert.match(fn,/admin_validar_sessao/);
assert.match(fn,/ia_cpc_acesso_usuario/);
assert.match(fn,/ia_cpc_reservar_orcamento/);
assert.match(fn,/ia_cpc_finalizar_custo/);
assert.match(fn,/cota\?\.permitido!==true/);
assert.match(fn,/store:false/);
assert.match(fn,/MAX_REGISTROS = 10000/);
assert.match(fn,/MAX_BYTES_ENTRADA/);
assert.match(fn,/compararTotal/);
assert.match(fn,/mudancasSignificativas/);
assert.match(fn,/tipos_ocorrencia/);
assert.match(fn,/perguntaSegura/);
assert.match(fn,/intencaoEstatistica\(pergunta\)/);
assert.match(fn,/objetivo_estatistico:objetivo/);
assert.match(fn,/historico_de_intencoes:contexto/);
assert.doesNotMatch(fn,/input:JSON\.stringify\(\{pergunta[,}]/,
  "Pergunta literal não pode ser transmitida à OpenAI");
assert.match(fn,/qualidade\.atual\.exclusivamente_preliminar/);
assert.match(fn,/familias_natureza/);
assert.match(fn,/serieMensalSegura/);

assert.match(fn,/Conduções|conducoesOperacionaisPorOcorrencia/);
assert.match(estatistica,/quantidade >= 5/);
assert.match(financeiro,/MODELO_HOMOLOGAVEL = "gpt-5.6-luna"/);
assert.doesNotMatch(fn,/historico_resumido|numero_bo|endereco_formatado|vitima_nome|infrator_nome/);

assert.match(sql,/CREATE TABLE IF NOT EXISTS private\.ia_cpc_usuarios/);
assert.match(sql,/CREATE UNIQUE INDEX IF NOT EXISTS ia_cpc_um_ativo_por_categoria/);
assert.match(sql,/CREATE TABLE IF NOT EXISTS private\.ia_cpc_consumo/);
assert.match(sql,/pg_advisory_xact_lock\(208760, 12\)/);
assert.match(sql,/v_utilizado\+p_reserva_centavos>10000/);
assert.match(sql,/v_utilizado\+p_reserva_centavos>=8000/);
assert.match(sql,/REVOKE ALL ON FUNCTION public\.ia_cpc_reservar_orcamento/);
assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.ia_cpc_permitido\(\) TO authenticated, service_role/);
assert.match(sql,/REVOKE ALL ON private\.ia_cpc_consumo FROM PUBLIC, anon, authenticated/);
console.log("OK — acesso individual, proteção financeira e isolamento de dados.");
