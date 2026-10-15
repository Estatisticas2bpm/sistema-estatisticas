/* Acesso individual e isolado do Caderno Digital CIPG. Não usa o guardião dos painéis. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const unidadeCipg='5c73f100-cd5d-415a-be39-1f8816bccbc9';
const config=window.SISTEMA_AUTH_CONFIG;
const client=window.supabase.createClient(config.supabaseUrl,config.publishableKey,{
 auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sie-cipg-caderno-auth'}
});
let resolvido;
const ready=new Promise(resolve=>{resolvido=resolve});
window.SistemaAuth={ready,client,perfil:null,contexto:null,user:null,pode:()=>false,temModulo:()=>false};
function erro(m){$('erroLoginCipg').textContent=m||''}
function tela(autorizado){
 $('loginCipg').hidden=autorizado;
 $('conteudoCipg').hidden=!autorizado;
 $('sairCaderno').hidden=!autorizado;
}
async function validar(){
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user)return null;
 const r=await client.from('cipg_acessos_caderno').select('user_id,unidade_id,ativo,posto_graduacao,nome_guerra').eq('user_id',user.id).eq('ativo',true).maybeSingle();
 if(r.error||!r.data||r.data.unidade_id!==unidadeCipg)return null;
 return {...user, identificacao:((r.data.posto_graduacao||'')+' '+(r.data.nome_guerra||'')).trim()};
}
async function habilitar(user){
 window.SistemaAuth.user=user;
 window.SistemaAuth.perfil={perfil:'CADERNO_CIPG',nome_guerra:user.identificacao||'Policial CIPG',unidades:{sigla:'CIPG'}};
 window.SistemaAuth.contexto={unidade_id:unidadeCipg,sigla:'CIPG'};
 window.SistemaAuth.pode=p=>p==='caderno_cipg';
 window.SistemaAuth.temModulo=m=>m==='PRODUTIVIDADE_CIPG';
 tela(true);
 resolvido(window.SistemaAuth);
 await window.CipgCaderno.iniciar();
}
document.addEventListener('DOMContentLoaded',async()=>{
 tela(false);
 $('formLoginCipg').addEventListener('submit',async e=>{
  e.preventDefault();erro('');
  const button=$('entrarCipg');button.disabled=true;
  try{
   const {error:loginError}=await client.auth.signInWithPassword({email:$('emailCipg').value.trim(),password:$('senhaCipg').value});
   if(loginError)throw Error('Credenciais inválidas ou acesso indisponível.');
   const user=await validar();
   if(!user){await client.auth.signOut({scope:'local'});throw Error('Sua conta não está autorizada para o Caderno Digital da CIPG.');}
   $('senhaCipg').value='';
   await habilitar(user);
  }catch(e){erro(e.message||'Não foi possível entrar.');tela(false)}
  finally{button.disabled=false}
 });
 $('sairCaderno').addEventListener('click',async()=>{
  await client.auth.signOut({scope:'local'});window.location.replace('cipg-caderno-acesso.html');
 });
 try{const user=await validar();if(user)await habilitar(user);}
 catch(e){erro('Não foi possível validar o acesso: '+e.message)}
});
})();
