(function(){
  const cfg=window.SISTEMA_AUTH_CONFIG;
  const pathname=(location.pathname.split('/').pop()||'index.html').toLowerCase();

  function esconderAdministracaoDesativada(){
    document.querySelectorAll('[data-auth-only],[data-permission="usuarios"],[data-permission="configuracoes"],[data-permission="logs"]').forEach(el=>{el.hidden=true;});
  }

  if(!cfg||!cfg.enabled){
    document.addEventListener('DOMContentLoaded',esconderAdministracaoDesativada,{once:true});
    window.SistemaAuth={
      enabled:false,
      ready:Promise.resolve({enabled:false}),
      pode:()=>true,
      perfil:null,
      user:null,
      sair:async()=>{location.href='index.html';}
    };
    return;
  }

  document.documentElement.style.visibility='hidden';

  function carregarSupabase(){
    if(window.supabase)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload=resolve;
      s.onerror=()=>reject(new Error('Não foi possível carregar a biblioteca de autenticação.'));
      document.head.appendChild(s);
    });
  }

  function permissaoDaPagina(){
    return cfg.pagePermissions[pathname]||null;
  }

  function urlLogin(erro){
    const retorno=pathname&&pathname!==cfg.loginPage?pathname+location.search:'';
    const p=new URLSearchParams();
    if(retorno)p.set('retorno',retorno);
    if(erro)p.set('erro',erro);
    return cfg.loginPage+(p.toString()?'?'+p.toString():'');
  }

  function normalizarPerfil(v){return String(v||'').trim().toUpperCase();}

  function pode(perfil,permissao){
    if(!permissao)return true;
    const lista=cfg.permissions[normalizarPerfil(perfil)]||[];
    return lista.includes(permissao);
  }

  function permissaoPorHref(href){
    if(!href)return null;
    if(/^https:\/\/docs\.google\.com\/spreadsheets\//i.test(href))return 'planilha';
    try{
      const u=new URL(href,location.href);
      if(u.origin!==location.origin)return null;
      const arq=(u.pathname.split('/').pop()||'index.html').toLowerCase();
      return cfg.pagePermissions[arq]||null;
    }catch(_){return null;}
  }

  function aplicarPermissoes(perfil){
    document.querySelectorAll('[data-permission]').forEach(el=>{
      const p=el.getAttribute('data-permission');
      el.hidden=!pode(perfil,p);
    });
    document.querySelectorAll('a[href]').forEach(el=>{
      const p=permissaoPorHref(el.getAttribute('href'));
      if(p&&!pode(perfil,p))el.hidden=true;
    });
  }

  function instalarIdentificacao(perfil,client){
    if(document.getElementById('sistemaUsuarioSessao'))return;
    const box=document.createElement('div');
    box.id='sistemaUsuarioSessao';
    box.style.cssText='position:fixed;right:14px;bottom:14px;z-index:99999;background:#071b33;color:#fff;border:1px solid #ffffff33;border-radius:12px;box-shadow:0 8px 24px #0003;padding:10px 12px;font:12px Arial,sans-serif;display:flex;align-items:center;gap:10px;max-width:min(92vw,420px)';
    const nome=perfil.nome_guerra||perfil.nome||perfil.email||'Usuário';
    const unidade=perfil.unidades?.sigla||'';
    box.innerHTML='<div style="min-width:0"><strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(nome)+'</strong><span style="opacity:.8">'+esc(perfil.perfil)+(unidade?' · '+esc(unidade):'')+'</span></div><button type="button" id="sistemaSair" style="border:1px solid #ffffff55;background:transparent;color:#fff;border-radius:8px;padding:7px 9px;cursor:pointer;font-weight:700">Sair</button>';
    document.body.appendChild(box);
    document.getElementById('sistemaSair').addEventListener('click',async()=>{
      try{await client.auth.signOut({scope:'local'});}catch(_){}
      location.replace(cfg.loginPage);
    });
  }

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  async function carregarPerfil(client,user){
    let r=await client.from(cfg.profileTable)
      .select('user_id,nome,nome_guerra,matricula,email,perfil,ativo,senha_temporaria,unidade_id,unidades(sigla,nome)')
      .eq('user_id',user.id).maybeSingle();
    if(r.error)throw r.error;
    if(r.data)return r.data;

    const boot=await client.functions.invoke(cfg.adminFunction,{body:{action:'bootstrap'}});
    if(boot.error)throw boot.error;
    if(!boot.data?.profile)return null;

    r=await client.from(cfg.profileTable)
      .select('user_id,nome,nome_guerra,matricula,email,perfil,ativo,senha_temporaria,unidade_id,unidades(sigla,nome)')
      .eq('user_id',user.id).maybeSingle();
    if(r.error)throw r.error;
    return r.data||null;
  }

  const ready=(async()=>{
    try{
      await carregarSupabase();
      const client=window.supabase.createClient(cfg.supabaseUrl,cfg.publishableKey);
      const sess=await client.auth.getSession();
      if(sess.error)throw sess.error;
      const session=sess.data.session;
      if(!session){location.replace(urlLogin());return null;}

      const user=session.user;
      const perfil=await carregarPerfil(client,user);
      if(!perfil){
        await client.auth.signOut({scope:'local'}).catch(()=>{});
        location.replace(urlLogin('nao-autorizado'));
        return null;
      }
      if(perfil.ativo!==true){
        await client.auth.signOut({scope:'local'}).catch(()=>{});
        location.replace(urlLogin('bloqueado'));
        return null;
      }

      if(perfil.senha_temporaria===true&&pathname!==cfg.passwordPage){
        location.replace(cfg.passwordPage);
        return null;
      }

      const pPagina=permissaoDaPagina();
      if(pPagina&&!pode(perfil.perfil,pPagina)){
        location.replace(cfg.homePage+'?erro=sem-permissao');
        return null;
      }

      window.SistemaAuth={enabled:true,client,user,perfil,pode:(p)=>pode(perfil.perfil,p),ready:null,sair:async()=>{await client.auth.signOut({scope:'local'});location.replace(cfg.loginPage);}};

      document.addEventListener('DOMContentLoaded',()=>{
        aplicarPermissoes(perfil.perfil);
        instalarIdentificacao(perfil,client);
      },{once:true});
      if(document.readyState!=='loading'){
        aplicarPermissoes(perfil.perfil);
        instalarIdentificacao(perfil,client);
      }
      return window.SistemaAuth;
    }catch(e){
      console.error('Falha ao validar acesso ao sistema:',e);
      location.replace(urlLogin('falha-validacao'));
      return null;
    }finally{
      document.documentElement.style.visibility='';
    }
  })();

  window.SistemaAuth={enabled:true,ready,pode:()=>false,perfil:null,user:null};
})();
