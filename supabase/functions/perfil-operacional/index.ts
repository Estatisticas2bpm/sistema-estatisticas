import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};
const respond=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:cors});
const url=Deno.env.get("SUPABASE_URL")||"";
const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||Deno.env.get("SUPABASE_SECRET_KEY")||"";
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const graduacoes=new Set(["CEL PM","TEN CEL PM","MAJ PM","CAP PM","1º TEN PM","2º TEN PM","ASP OF PM","AL OF PM","SUB TEN PM","1º SGT PM","2º SGT PM","3º SGT PM","CB PM","SD PM"]);
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return respond({error:"Método não permitido."},405);
 if(!url||!key)return respond({error:"Serviço indisponível."},503);
 try{
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return respond({error:"Faça login para editar seu perfil."},401);
  const {data:{user},error:authError}=await admin.auth.getUser(token);
  if(authError||!user||user.is_anonymous)return respond({error:"Sessão inválida."},401);
  const body=await req.json().catch(()=>({}));
  if(!body||typeof body!=="object"||Array.isArray(body))return respond({error:"Dados inválidos."},400);
  const unidade=String(body.unidade||"").trim().toUpperCase();
  if(!["GIRO","CIPG"].includes(unidade))return respond({error:"Unidade inválida."},400);
  const nomeGuerra=String(body.nome_guerra||"").trim().toUpperCase();
  const posto=String(body.posto_graduacao||"").trim().toUpperCase();
  if(nomeGuerra.length<2||nomeGuerra.length>100||/[<>]/.test(nomeGuerra))return respond({error:"Nome de guerra inválido (2 a 100 caracteres)."},400);
  if(!graduacoes.has(posto))return respond({error:"Selecione posto ou graduação válido."},400);
  const tabela=unidade==="GIRO"?"giro_acessos_abordagem":"cipg_acessos_caderno";
  const campos=unidade==="GIRO"?"user_id,ativo,matricula,posto_graduacao,nome_guerra":"user_id,ativo,unidade_id,posto_graduacao,nome_guerra";
  const {data:acesso,error:selectError}=await admin.from(tabela).select(campos).eq("user_id",user.id).eq("ativo",true).maybeSingle();
  if(selectError)throw selectError;
  if(!acesso)return respond({error:"Sua conta não está autorizada para esta unidade."},403);
  if(unidade==="GIRO"&&!acesso.matricula)return respond({error:"Conta individual do GIRO não identificada."},403);
  if(unidade==="CIPG"){
   const {data:u}=await admin.from("unidades").select("sigla,ativo").eq("id",acesso.unidade_id).maybeSingle();
   if(u?.sigla!=="CIPG"||u.ativo!==true)return respond({error:"Conta CIPG não autorizada."},403);
  }
  const anteriorNome=acesso.nome_guerra||null,anteriorPosto=acesso.posto_graduacao||null;
  if(anteriorNome===nomeGuerra&&anteriorPosto===posto)return respond({ok:true,alterado:false});
  const {data:atualizado,error:upError}=await admin.from(tabela).update({nome_guerra:nomeGuerra,posto_graduacao:posto}).eq("user_id",user.id).eq("ativo",true).select("user_id").single();
  if(upError||!atualizado)throw upError||new Error("Acesso indisponível.");
  const {error:logError}=await admin.from("auditoria_perfil_operacional").insert({
   user_id:user.id,unidade_sigla:unidade,nome_guerra_anterior:anteriorNome,nome_guerra_novo:nomeGuerra,
   posto_graduacao_anterior:anteriorPosto,posto_graduacao_novo:posto
  });
  if(logError){console.error("Falha ao auditar perfil:",logError.message);return respond({error:"Alteração aplicada, mas o registro de auditoria falhou. Contate a administração."},500);}
  return respond({ok:true,alterado:true});
 }catch(err){console.error("perfil-operacional:",err instanceof Error?err.message:String(err));return respond({error:"Não foi possível atualizar seu perfil."},500);}
});
