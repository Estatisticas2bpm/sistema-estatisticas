// Integração isolada da Edge Function real SIE-CPC.
// Não utiliza contas, Supabase, OpenAI ou boletins reais.
// Todas as chamadas HTTP são interceptadas, nenhuma rede é permitida no teste.
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";

// Captura a função Deno.serve sem abrir portas ou publicar endpoint.
type Handler = (req: Request) => Response | Promise<Response>;
const serveOriginal = Deno.serve;
let handler: Handler | null = null;
Object.defineProperty(Deno,"serve", {
  value: (h: Handler) => {handler=h;return {finished:Promise.resolve()};},
  configurable:true,writable:true
});
try { await import("../supabase/functions/ia-cpc/index.ts"); }
finally { Object.defineProperty(Deno,"serve",{value:serveOriginal,configurable:true,writable:true}); }
if(!handler) throw new Error("A Edge Function não registrou o manipulador HTTP.");
const atender = handler;

const ORIGEM="https://homologacao.sie-cpc.invalid";
const ID_ADMIN="00000000-0000-4000-8000-000000000001";
const ID_COMANDANTE="00000000-0000-4000-8000-000000000002";
const ID_OUTRO_ADMIN="00000000-0000-4000-8000-000000000003";
const ID_OUTRO_COMANDANTE="00000000-0000-4000-8000-000000000004";
const ID_OPERADOR="00000000-0000-4000-8000-000000000005";
const SESSAO="00000000-0000-4000-8000-000000000099";
const AUTORIZADOS=new Set([ID_ADMIN,ID_COMANDANTE]);
const RESPOSTA=(dados:unknown,status=200)=>new Response(JSON.stringify(dados),
 {status,headers:{"content-type":"application/json; charset=utf-8"}});

function token(userId:string, sessionId?:string):string {
 const parte=btoa(JSON.stringify({sub:userId,session_id:sessionId||SESSAO,role:"authenticated"}))
   .replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
 return "teste."+parte+".assinatura_sintetica";
}
function ambienteAtivo() {
 Deno.env.set("IA_CPC_ENABLED","true");
 Deno.env.set("IA_CPC_RELATOS_ENABLED","false");
 Deno.env.set("IA_CPC_ALLOWED_ORIGINS",ORIGEM);
 Deno.env.set("SUPABASE_URL","https://supabase-sintetico.invalid");
 Deno.env.set("SUPABASE_SERVICE_ROLE_KEY","SOMENTE_TESTE_SEM_VALIDACAO");
 Deno.env.set("OPENAI_API_KEY","CHAVE_FICTICIA_NAO_FATURAVEL");
 Deno.env.set("OPENAI_MODEL","gpt-5.6-luna");
 Deno.env.set("IA_CPC_BRL_USD_RESERVA","8");
}
type Situacao={
 userId:string; revogada?:boolean; authInvalida?:boolean;
 erroSessao?:boolean; erroPermissao?:boolean;
 falhaCatalogo?:boolean; recusarOrcamento?:boolean;
 registro?:boolean; permitirChamadaSimulada?:boolean;
}
function mockSupabase(s:Situacao) {
 const chamadas:string[]=[];
 let openAI:unknown=null;
 const fetchFake=async (input:RequestInfo|URL, init?:RequestInit):Promise<Response>=>{
   const req=input instanceof Request?input:new Request(input,init);
   const url=new URL(req.url);
   const rota=url.pathname;
   chamadas.push(url.host+rota);
   if(url.host==="api.openai.com"){
     if(!s.permitirChamadaSimulada) throw Error("A chamada paga foi bloqueada pelo teste");
     openAI=JSON.parse(await req.text());
     return RESPOSTA({output:[{content:[{type:"output_text",text:"Resumo sintético aprovado."}]}],
       usage:{input_tokens:200,output_tokens:50}});
   }
   if(url.host!=="supabase-sintetico.invalid")throw Error("Rede externa proibida: "+url.host);
   if(rota==="/auth/v1/user"){
     if(s.authInvalida)return RESPOSTA({error:"invalid_token",msg:"token fictício inválido"},401);
     return RESPOSTA({id:s.userId,role:"authenticated",aud:"authenticated",
       app_metadata:{provider:"email",providers:["email"]},user_metadata:{}});
   }
   if(rota==="/rest/v1/rpc/admin_validar_sessao"){
     if(s.erroSessao)return RESPOSTA({code:"42501",message:"simulado"},403);
     return RESPOSTA(!s.revogada);
   }
   if(rota==="/rest/v1/rpc/ia_cpc_acesso_usuario"){
     if(s.erroPermissao)return RESPOSTA({code:"PGRST202",message:"simulado"},404);
     return RESPOSTA(AUTORIZADOS.has(s.userId));
   }
   if(rota==="/rest/v1/rpc/ia_cpc_reservar_orcamento"){
     if(s.recusarOrcamento)return RESPOSTA({permitido:false,motivo:"limite_orcamento",
       restante_centavos:0});
     return RESPOSTA({permitido:true,reserva_id:"00000000-0000-4000-8000-000000000999",
       restante_dia:19,restante_mes_global:299,restante_centavos:9875,alerta_80:false});
   }
   if(rota==="/rest/v1/rpc/ia_cpc_finalizar_custo"){
     return RESPOSTA({ok:true,restante_centavos:9900,alerta_80:false});
   }
   if(rota==="/rest/v1/unidades")
     return RESPOSTA(s.falhaCatalogo?{message:"Erro em catálogo"}:
       [{id:"00000000-0000-4000-8000-000000000101",sigla:"CPC"}],
       s.falhaCatalogo?500:200);
   if(rota==="/rest/v1/bairros")return RESPOSTA([{nome:"CENTRO"}]);
   if(rota==="/rest/v1/tipos_ocorrencia")return RESPOSTA([{nome:"FURTO"},{nome:"ROUBO"}]);
   if(rota==="/rest/v1/ocorrencias"){
     // Só um BO fictício no período atual. O anterior permanece vazio.
     const de=url.searchParams.get("data_ocorrencia")||"";
     if(!s.registro || !de.includes("2026-10-01"))
       return RESPOSTA([]);
     return RESPOSTA([{
       id:"00000000-0000-4000-8000-000000000222",
       data_ocorrencia:"2026-10-03",hora_inicial:"09:40:00",
       unidade_id:"00000000-0000-4000-8000-000000000101",
       ocorrencia:"FURTO",crime:"FURTO",bairro:"CENTRO",
       status_registro:"rascunho",numero_conduzidos:1,numero_prisoes:0,
       quantidade_armas:0,veiculos_recuperados:0,
       naturezas_itens:[{nome:"FURTO"}],crimes_itens:[{tipo_nome:"FURTO"}]
     }]);
   }
   throw Error("Endpoint não esperado: "+rota);
 };
 return {fetchFake,chamadas,getPayload:()=>openAI};
}
async function requisitar(cenario:Situacao,opt?:{
  origem?:string; metodo?:string; auth?:string; corpo?:unknown
}) {
 ambienteAtivo();
 const mock=mockSupabase(cenario);
 const fetchOriginal=globalThis.fetch;
 globalThis.fetch=mock.fetchFake as typeof fetch;
 try{
   const headers=new Headers({"Content-Type":"application/json"});
   if(opt?.origem!==undefined) headers.set("Origin",opt.origem);
   else headers.set("Origin",ORIGEM);
   if(opt?.auth!==null) headers.set("Authorization",opt?.auth??"Bearer "+token(cenario.userId));
   const req=new Request("https://function-sintetica.invalid/ia-cpc",{
     method:opt?.metodo??"POST",headers,
     body: opt?.metodo==="OPTIONS"?undefined:JSON.stringify(opt?.corpo??{
       pergunta:"Resuma os indicadores das ocorrências de furto no período.",
       data_inicio:"2026-10-01",data_fim:"2026-10-07",historico:[]
     })
   });
   const resp=await atender(req);
   const dados=await resp.json();
   return {status:resp.status,dados,headers:resp.headers,chamadas:mock.chamadas,
     payload:mock.getPayload()};
 }finally {
   globalThis.fetch=fetchOriginal;
 }
}

Deno.test("Acesso: CORS externo, opção desabilitada e falta de JWT",async()=>{
 const c={userId:ID_ADMIN};
 const fora=await requisitar(c,{origem:"https://origem-maliciosa.invalid"});
 assertEquals(fora.status,403);assertEquals(fora.chamadas.length,0);
 ambienteAtivo();
 Deno.env.set("IA_CPC_ENABLED","false");
 // Em Deno a função ativa é conferida antes da autorização ou acesso ao banco.
 const fetchOriginal=globalThis.fetch;
 globalThis.fetch=()=>{throw Error("Rede proibida quando desativado");};
 try{
   const res=await atender(new Request("https://function-sintetica.invalid/ia-cpc",{
     method:"POST",headers:{"Origin":ORIGEM}
   }));
   assertEquals(res.status,503);
 }finally{globalThis.fetch=fetchOriginal;}
 const semToken=await requisitar(c,{auth:""});
 assertEquals(semToken.status,401);
 assertEquals(semToken.chamadas.length,0);
});

Deno.test("Sessão expirada, revogada, JWT sem session_id ou Auth inválido: negar",async()=>{
 const u={userId:ID_ADMIN};
 for(const caso of [{...u,revogada:true},{...u,erroSessao:true},{...u,authInvalida:true}]){
   const r=await requisitar(caso);
   assertEquals(r.status,401);
   assert(!r.chamadas.some(x=>x.includes("ia_cpc_acesso_usuario")),
     "Não consultar permissão após sessão inválida");
   assert(!r.chamadas.some(x=>x.includes("ocorrencias")));
 }
 const jwtSemSessao="Bearer TESTE."+btoa(JSON.stringify({sub:ID_ADMIN}))
   .replace(/=/g,"")+".assinatura";
 const semSessao=await requisitar(u,{auth:jwtSemSessao});
 assertEquals(semSessao.status,401);
 assert(!semSessao.chamadas.some(x=>x.includes("admin_validar_sessao")));
});

Deno.test("Somente 1 ADMIN + 1 COMANDANTE CPC designados; demais perfis são negados",async()=>{
 for(const id of [ID_OUTRO_ADMIN,ID_OUTRO_COMANDANTE,ID_OPERADOR]){
   const x=await requisitar({userId:id});
   assertEquals(x.status,403);
   assert(!x.chamadas.some(t=>t.includes("ocorrencias")));
   assert(!x.chamadas.some(t=>t.includes("api.openai.com")));
 }
 for(const id of [ID_ADMIN,ID_COMANDANTE]){
   const x=await requisitar({userId:id});
   assertEquals(x.status,200);
   assertEquals(x.dados.sem_cobranca,true);
   assertEquals(x.dados.registros,0);
   assert(!x.chamadas.some(t=>t.includes("api.openai.com")));
 }
 const falha=await requisitar({userId:ID_ADMIN,erroPermissao:true});
 assertEquals(falha.status,403);
 assert(!falha.chamadas.some(t=>t.includes("ocorrencias")));
});

Deno.test("Falha dos catálogos: não libera consulta nem tenta chamar API",async()=>{
 const r=await requisitar({userId:ID_ADMIN,falhaCatalogo:true});
 assertEquals(r.status,500);
 assert(!r.chamadas.some(t=>t.includes("api.openai.com")));
});

Deno.test("Dados sintéticos: orçamento bloqueado impede OpenAI e mantém proteção",async()=>{
 const r=await requisitar({userId:ID_ADMIN,registro:true,recusarOrcamento:true});
 assertEquals(r.status,429);
 assert(r.chamadas.some(t=>t.includes("ia_cpc_reservar_orcamento")));
 assert(!r.chamadas.some(t=>t.includes("api.openai.com")));
 assertEquals(r.dados.cota.restante_centavos,0);
});

Deno.test("Fluxo autorizado: sessão, perfil, agregados, reserva e chamada SIMULADA nesta ordem",async()=>{
 const r=await requisitar({userId:ID_COMANDANTE,registro:true,permitirChamadaSimulada:true});
 assertEquals(r.status,200);
 assertEquals(r.dados.registros,1);
 assertEquals(r.dados.qualidade.exclusivamente_preliminar,true);
 assertStringIncludes(r.dados.resposta,"sintético");
 const idx=(needle:string)=>r.chamadas.findIndex(x=>x.includes(needle));
 assert(idx("/auth/v1/user")<idx("admin_validar_sessao"));
 assert(idx("admin_validar_sessao")<idx("ia_cpc_acesso_usuario"));
 assert(idx("ia_cpc_acesso_usuario")<idx("/rest/v1/ocorrencias"));
 assert(idx("ia_cpc_reservar_orcamento")<idx("api.openai.com"));
 assert(idx("api.openai.com")<idx("ia_cpc_finalizar_custo"));
 const json=r.payload as Record<string,unknown>;
 assertEquals(json.store,false);
 const entrada=JSON.stringify(json.input);
 assert(!entrada.includes("Resuma os indicadores das ocorrências"),
   "Pergunta literal nunca sai do sistema");
 assert(!entrada.includes("00000000-0000-4000-8000-000000000222"),
   "Identificadores fictícios de BOs também não saem do sistema");
 assert(!entrada.includes("historico_resumido"));
 assertStringIncludes(entrada,"exclusivamente_preliminar");
});
