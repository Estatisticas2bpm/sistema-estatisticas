/* Acesso individual e isolado do Caderno Digital CIPG.
 * A troca de senha é confirmada pelo Auth e pelo bloqueio no banco.
 */
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
function tela(modo){
 $('loginCipg').hidden=modo!=='login';
 $('trocaSenhaCipg').hidden=modo!=='troca';
 $('conteudoCipg').hidden=modo!=='caderno';
 $('sairCaderno').hidden=modo==='login';
 $('perfilCipg').hidden=modo!=='caderno';
}
async function validar(){
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user)return null;
 const r=await client.from('cipg_acessos_caderno').select('user_id,unidade_id,ativo,senha_temporaria').eq('user_id',user.id).eq('ativo',true).maybeSingle();
 if(r.error||!r.data||r.data.unidade_id!==unidadeCipg)return null;
 return {user,temporaria:r.data.senha_temporaria===true};
}
async function habilitar(acesso){
 if(acesso.temporaria){
   tela('troca');
   $('novaSenhaCipg').focus();
   return;
 }
 const user=acesso.user;
 window.SistemaAuth.user=user;
 window.SistemaAuth.perfil={perfil:'CADERNO_CIPG',nome_guerra:user.email,unidades:{sigla:'CIPG'}};
 window.SistemaAuth.contexto={unidade_id:unidadeCipg,sigla:'CIPG'};
 window.SistemaAuth.pode=p=>p==='caderno_cipg';
 window.SistemaAuth.temModulo=m=>m==='PRODUTIVIDADE_CIPG';
 tela('caderno');
 resolvido(window.SistemaAuth);
 await window.CipgCaderno.iniciar();
}
function statusTroca(m,ok=false){
 $('statusSenhaCipg').textContent=m||'';
 $('statusSenhaCipg').className='status '+(ok?'ok':'erro');
}
async function sair(){
 await client.auth.signOut({scope:'local'});
 window.location.replace('cipg-caderno-acesso.html');
}
document.addEventListener('DOMContentLoaded',async()=>{
 tela('login');
 $('formLoginCipg').addEventListener('submit',async e=>{
  e.preventDefault();erro('');
  const button=$('entrarCipg');button.disabled=true;
  try{
   const {error:loginError}=await client.auth.signInWithPassword({email:$('emailCipg').value.trim(),password:$('senhaCipg').value});
   if(loginError)throw Error('Credenciais inválidas ou acesso indisponível.');
   const acesso=await validar();
   $('senhaCipg').value='';
   if(!acesso){await client.auth.signOut({scope:'local'});throw Error('Sua conta não está autorizada para o Caderno Digital da CIPG.');}
   await habilitar(acesso);
  }catch(e){erro(e.message||'Não foi possível entrar.');tela('login')}
  finally{button.disabled=false}
 });
 $('formTrocaSenhaCipg').addEventListener('submit',async e=>{
  e.preventDefault();statusTroca('');
  const nova=$('novaSenhaCipg').value,confirmacao=$('confirmarSenhaCipg').value;
  if(nova.length<8){statusTroca('A senha deve ter pelo menos 8 caracteres.');return;}
  if(nova!==confirmacao){statusTroca('As senhas informadas são diferentes.');return;}
  const botao=$('salvarSenhaCipg');botao.disabled=true;
  try{
   const acesso=await validar();
   if(!acesso?.temporaria)throw Error('A sessão expirou ou a troca já foi concluída. Saia e entre novamente.');
   // O Supabase valida e altera a senha; o trigger confirma a mudança e revoga
   // as sessões anteriores no banco. Não há função pública para limpar a flag.
   const r=await client.auth.updateUser({password:nova});
   if(r.error)throw r.error;
   $('formTrocaSenhaCipg').reset();
   await client.auth.signOut({scope:'global'}).catch(()=>{});
   tela('login');
   $('senhaCipg').value='';
   erro('Senha alterada. Entre novamente com sua nova senha pessoal.');
   $('senhaCipg').focus();
  }catch(err){
   statusTroca('Não foi possível alterar a senha. Escolha uma senha diferente da temporária. '+(err.message||''));
  }finally{botao.disabled=false}
 });
 $('cancelarSenhaCipg').addEventListener('click',sair);
 $('sairCaderno').addEventListener('click',sair);
 try{const acesso=await validar();if(acesso)await habilitar(acesso);}
 catch(e){erro('Não foi possível validar o acesso: '+e.message)}
});
})();