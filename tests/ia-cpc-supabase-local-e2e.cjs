#!/usr/bin/env node
"use strict";
// Auth, PostgREST and Edge Function REAL, hosted only on Supabase CLI local.
// No credentials, identifiers or police data from the production project.
const assert=require("node:assert/strict");
const {spawnSync}=require("node:child_process");
const path=require("node:path");
const base=(process.env.API_URL||"").replace(/\/$/,"");
const anon=process.env.ANON_KEY||"";
const service=process.env.SERVICE_ROLE_KEY||"";
const pwd="Teste-Exclusivo-Ambiente-Isolado-2026!";
if(!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(base)||anon.length<60||service.length<60)
 throw Error("Recusado: a homologação só pode alcançar localhost:54321 e chaves locais.");
if(process.env.SUPABASE_ACCESS_TOKEN||process.env.SUPABASE_DB_PASSWORD)
 throw Error("Não é permitido fornecer credenciais de projetos remotos neste teste.");
function query(sql){
 const ret=spawnSync("psql",["-X","-q","-v","ON_ERROR_STOP=1"],{
  input:sql,encoding:"utf8",timeout:15000,
  env:{...process.env,PGHOST:"127.0.0.1",PGPORT:"54322",PGUSER:"postgres",
    PGPASSWORD:"postgres",PGDATABASE:"postgres"}
 });
 if(ret.status!==0)throw Error("Falha SQL local: "+(ret.stderr||"").slice(0,600));
}
function uuid(x){assert.match(x,/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);return x;}
async function api(route,{key=anon,token=key,method="POST",body,origin}={}){
 const headers={apikey:key,authorization:"Bearer "+token};
 if(origin)headers.Origin=origin;
 if(body!==undefined)headers["Content-Type"]="application/json";
 const r=await fetch(base+route,{method,headers,
   body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const t=await r.text();let data;
 try{data=JSON.parse(t);}catch{data={raw:t.slice(0,160)};}
 return {status:r.status,data};
}
async function main(){
 const casos=[
  ["admin-designado","ADMIN","00000000-0000-4000-8000-000000000102"],
  ["comandante-cpc","COMANDANTE","00000000-0000-4000-8000-000000000101"],
  ["outro-admin","ADMIN","00000000-0000-4000-8000-000000000102"],
  ["outro-comandante","COMANDANTE","00000000-0000-4000-8000-000000000103"],
  ["operador","OPERADOR","00000000-0000-4000-8000-000000000101"]
 ];
 const pessoas=[];
 for(const [nome,perfil,unidade] of casos){
  const email="ia-local-"+nome+"@example.invalid";
  const criado=await api("/auth/v1/admin/users",{key:service,body:{email,password:pwd,email_confirm:true}});
  assert.equal(criado.status,200,"GoTrue não criou "+nome+": "+JSON.stringify(criado.data));
  const id=uuid(criado.data.id);
  const login=await api("/auth/v1/token?grant_type=password",{body:{email,password:pwd}});
  assert.equal(login.status,200,"Login local falhou: "+nome);
  assert(login.data.access_token);
  const token=login.data.access_token;
  const jwt=JSON.parse(Buffer.from(token.split(".")[1],"base64url").toString("utf8"));
  const session=uuid(jwt.session_id);
  const user=await api("/auth/v1/user",{token,method:"GET"});
  assert.equal(user.status,200,"getUser local não retornou conta");
  assert.equal(user.data.id,id);
  pessoas.push({nome,perfil,unidade,id,session,token});
 }
 const lista=pessoas.map(p=>"('"+p.id+"'::uuid,'"+p.perfil+"','"+p.unidade+"'::uuid,true)").join(",");
 query("INSERT INTO public.perfis_usuarios(user_id,perfil,unidade_id,ativo) VALUES "+
   lista+"; INSERT INTO private.ia_cpc_usuarios(user_id,categoria,ativo) VALUES "+
   "('"+pessoas[0].id+"','ADMIN',true),('"+pessoas[1].id+"','COMANDANTE_CPC',true); "+
   "NOTIFY pgrst,'reload schema';");
 console.log("GoTrue real criou 5 contas fictícias e 2 entraram na lista privada.");
 for(let i=0;i<pessoas.length;i++){
  const p=pessoas[i];
  const v=await api("/rest/v1/rpc/ia_cpc_permitido",{token:p.token,body:{}});
  assert.equal(v.status,200,"PostgREST RPC inacessível: "+p.nome+" "+JSON.stringify(v.data));
  assert.equal(v.data,i<2,"Privilégio incorreto: "+p.nome);
 }
 const anonRpc=await api("/rest/v1/rpc/ia_cpc_permitido",{body:{}});
 assert.notEqual(anonRpc.status,200,"Anônimo não pode executar RPC de usuário");
 const financeiro=await api("/rest/v1/rpc/ia_cpc_reservar_orcamento",{
  token:pessoas[0].token,body:{p_usuario_id:pessoas[0].id,p_modelo:"gpt-5.6-luna",p_reserva_centavos:5}
 });
 assert([401,403,404].includes(financeiro.status),"Cota financeira indevidamente exposta!");
 console.log("PostgREST real: 2 identidades permitidas; demais e chamada financeira bloqueadas.");

 const origem="http://localhost:9999";
 const dados={pergunta:"Resuma as ocorrências do período.",
  data_inicio:"2026-01-01",data_fim:"2026-01-07",historico:[]};
 for(let i=0;i<pessoas.length;i++){
  const p=pessoas[i];
  const v=await api("/functions/v1/ia-cpc",{token:p.token,body:dados,origin:origem});
  if(i<2){
   assert.equal(v.status,200,"Edge local recusou permitido "+p.nome+": "+JSON.stringify(v.data));
   assert.equal(v.data.sem_cobranca,true,"Consulta vazia não deve chamar IA paga");
  } else assert.equal(v.status,403,"Edge permitiu não designado "+p.nome+": "+JSON.stringify(v.data));
 }
 console.log("Edge local: 2 contas admitidas sem cobrança, outras 3 rejeitadas.");
 // Exercita a página HTML e o auth-guard ORIGINAL em navegador Chromium real,
 // antes da revogação das sessões. Executa apenas em runner local.
 if(process.env.IA_CPC_BROWSER_E2E==="true"){
   const alvo=path.join(__dirname,"ia-cpc-browser-local.e2e.cjs");
   const teste=spawnSync(process.execPath,[alvo],{
     encoding:"utf8",timeout:100000,
     env:{...process.env,IA_CPC_BROWSER_E2E:"false"}
   });
   if(teste.stdout)process.stdout.write(teste.stdout);
   if(teste.status!==0)throw Error("Falha de navegador local: "+(teste.stderr||"").slice(-1200));
 }
 const admin=pessoas[0],comandante=pessoas[1];
 query("INSERT INTO public.sessoes_revogadas(session_id,user_id) VALUES "+
  "('"+admin.session+"','"+admin.id+"');");
 const revogado=await api("/functions/v1/ia-cpc",{token:admin.token,body:dados,origin:origem});
 assert.equal(revogado.status,401,"Sessão revogada não foi bloqueada");
 query("UPDATE public.perfis_usuarios SET ativo=false WHERE user_id='"+comandante.id+"';");
 const desativado=await api("/functions/v1/ia-cpc",{token:comandante.token,body:dados,origin:origem});
 assert.equal(desativado.status,403,"Perfil desativado não foi bloqueado");
 const cors=await api("/functions/v1/ia-cpc",{token:comandante.token,body:dados,
  origin:"https://origem-nao-permitida.invalid"});
 assert.equal(cors.status,403,"Origem não permitida não foi bloqueada");
 const anonEdge=await api("/functions/v1/ia-cpc",{body:dados,origin:origem});
 assert([401,403].includes(anonEdge.status),"Anônimo não foi bloqueado");
 console.log(JSON.stringify({
  status:"SUCESSO",ambiente:"Supabase local GoTrue+PostgREST+Edge",
  identidades_ficticias:5,identidades_permitidas:2,
  identidades_negadas:3,revogacao_bloqueada:true,
  usuario_desativado_bloqueado:true,anonimo_bloqueado:true,
  consultas_pagas:0,boletins_reais:0,alteracoes_producao:0
 },null,2));
}
main().catch(err=>{console.error("HOMOLOGAÇÃO LOCAL FALHOU: "+err.message);process.exitCode=1;});
