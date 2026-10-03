(function(){
  const cfg=window.SISTEMA_AUTH_CONFIG;
  const pathname=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  let contextoAtual=null;
  const permissoesEscritaOperacional=new Set(['cadastro','tco','acoes']);

  function esconderAdministracaoDesativada(){
    document.querySelectorAll('[data-auth-only],[data-module],[data-permission="usuarios"],[data-permission="configuracoes"],[data-permission="logs"]').forEach(el=>{el.hidden=true;});
  }

  if(!cfg||!cfg.enabled){
    document.addEventListener('DOMContentLoaded',esconderAdministracaoDesativada,{once:true});
    window.SistemaAuth={enabled:false,ready:Promise.resolve({enabled:false}),pode:()=>true,temModulo:()=>false,modulos:[],planilha:null,perfil:null,user:null,sair:async()=>{location.href='index.html';}};
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

  function permissaoDaPagina(){return cfg.pagePermissions[pathname]||null;}
  function moduloDaPagina(){return cfg.pageModules?.[pathname]||null;}

  function urlLogin(erro){
    const retorno=pathname&&pathname!==cfg.loginPage?pathname+location.search:'';
    const p=new URLSearchParams();
    if(retorno)p.set('retorno',retorno);
    if(erro)p.set('erro',erro);
    return cfg.loginPage+(p.toString()?'?'+p.toString():'');
  }

  function normalizarPerfil(v){return String(v||'').trim().toUpperCase();}
  function normalizarModulo(v){return String(v||'').trim().toUpperCase();}
  function formatarSiglaUnidade(v){const s=String(v||'').trim(),m=s.match(/^(\d+)BPM$/i);if(m)return m[1]+'º BPM';const mapa={FORCA_TATICA:'FORÇA TÁTICA'};return mapa[s.toUpperCase()]||s;}
  function ordenarUnidadesHierarquia(lista){
    const itens=[...(lista||[])],ids=new Set(itens.map(u=>String(u.id))),porPai=new Map();
    itens.forEach(u=>{const k=u.parent_id&&ids.has(String(u.parent_id))?String(u.parent_id):'';if(!porPai.has(k))porPai.set(k,[]);porPai.get(k).push(u);});
    const ordenar=a=>a.sort((x,y)=>formatarSiglaUnidade(x.sigla).localeCompare(formatarSiglaUnidade(y.sigla),'pt-BR',{numeric:true}));
    const saida=[];
    const visitar=(u,nivel)=>{saida.push({...u,_nivel:nivel});ordenar(porPai.get(String(u.id))||[]).forEach(f=>visitar(f,nivel+1));};
    ordenar(porPai.get('')||[]).forEach(u=>visitar(u,0));
    return saida;
  }
  function rotuloUnidade(u,lista=[]){
    const sigla=formatarSiglaUnidade(u?.sigla),nome=String(u?.nome||'').trim();
    const temFilhos=(lista||[]).some(x=>String(x.parent_id||'')===String(u?.id||''));
    const prefixo=u?._nivel>0?'↳ '.repeat(Math.min(u._nivel,2)):'':'';
    const nomeNorm=nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
    const siglaNorm=String(sigla||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
    return prefixo+sigla+(nome&&nomeNorm!==siglaNorm?' — '+nome:'')+(temFilhos?' · CONSOLIDADO':'');
  }

  function pode(perfil,permissao){
    if(!permissao)return true;
    if(contextoAtual?.somente_leitura_operacional&&permissoesEscritaOperacional.has(permissao))return false;
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

  function moduloPorHref(href){
    if(!href)return null;
    try{
      const u=new URL(href,location.href);
      if(u.origin!==location.origin)return null;
      const arq=(u.pathname.split('/').pop()||'index.html').toLowerCase();
      return cfg.pageModules?.[arq]||null;
    }catch(_){return null;}
  }

  function temModulo(modulos,codigo){
    if(!codigo)return true;
    return modulos.has(normalizarModulo(codigo));
  }

  async function carregarContextoUnidade(client,perfil){
    const r=await client.rpc('obter_contexto_unidade_usuario');
    if(r.error)throw r.error;
    const contexto=r.data;
    if(!contexto?.unidade_id)throw new Error('Não foi possível determinar a unidade de trabalho atual.');
    contextoAtual=contexto;
    perfil.unidade_principal_id=perfil.unidade_id;
    perfil.unidades_principal=perfil.unidades||null;
    perfil.unidade_id=contexto.unidade_id;
    perfil.unidades={id:contexto.unidade_id,sigla:contexto.sigla,nome:contexto.nome,tipo:contexto.tipo,ativo:true};
    return contexto;
  }

  async function carregarModulos(client){
    const r=await client.rpc('obter_modulos_usuario');
    if(r.error){
      console.error('Não foi possível carregar os módulos da unidade; acesso especializado bloqueado:',r.error);
      return new Set();
    }
    return new Set((r.data||[]).map(x=>normalizarModulo(x.codigo)).filter(Boolean));
  }

  async function carregarPlanilhaUsuario(client){
    const r=await client.rpc('obter_planilha_usuario');
    if(r.error){
      console.error('Não foi possível carregar a planilha da unidade; atalho bloqueado:',r.error);
      return null;
    }
    const linha=Array.isArray(r.data)?r.data[0]:r.data;
    return linha?.google_sheet_url?linha:null;
  }

  function aplicarPermissoes(perfil,modulos,planilha){
    document.querySelectorAll('[data-permission],[data-module],[data-planilha-unidade]').forEach(el=>{
      const permitidoPerfil=pode(perfil,el.getAttribute('data-permission'));
      const permitidoModulo=temModulo(modulos,el.getAttribute('data-module'));
      const precisaPlanilha=el.hasAttribute('data-planilha-unidade');
      const permitidoPlanilha=!precisaPlanilha||!!planilha?.google_sheet_url;
      if(precisaPlanilha){
        if(permitidoPlanilha){
          el.setAttribute('href',planilha.google_sheet_url);
          el.setAttribute('target','_blank');
          el.setAttribute('rel','noopener');
        }else{
          el.removeAttribute('href');
        }
      }
      el.hidden=!(permitidoPerfil&&permitidoModulo&&permitidoPlanilha);
    });
    document.querySelectorAll('a[href]').forEach(el=>{
      const p=permissaoPorHref(el.getAttribute('href'));
      const m=moduloPorHref(el.getAttribute('href'));
      if((p&&!pode(perfil,p))||(m&&!temModulo(modulos,m)))el.hidden=true;
    });
  }

  function aplicarIdentidadeVisual(perfil){
    const sigla=formatarSiglaUnidade(perfil.unidades?.sigla)||'UNIDADE NÃO IDENTIFICADA';
    const nomeUnidade=perfil.unidades?.nome||'';
    document.querySelectorAll('[data-sie-unit]').forEach(el=>{
      el.textContent='Unidade ativa · '+sigla;
      if(nomeUnidade)el.setAttribute('title',nomeUnidade);
    });
    document.querySelectorAll('[data-sie-unit-name]').forEach(el=>{el.textContent=nomeUnidade||sigla;});
    document.querySelectorAll('[data-sie-user]').forEach(el=>{el.textContent=perfil.nome_guerra||perfil.nome||perfil.email||'Usuário';});
    document.querySelectorAll('[data-sie-role]').forEach(el=>{el.textContent=normalizarPerfil(perfil.perfil);});

    if(!document.getElementById('sistemaUnidadeAtiva')){
      const badge=document.createElement('div');
      badge.id='sistemaUnidadeAtiva';
      badge.textContent='UNIDADE ATIVA · '+sigla;
      badge.title=nomeUnidade||sigla;
      badge.style.cssText='position:relative;z-index:20;width:100%;min-height:30px;background:#f7fafc;color:#43566a;border:0;border-bottom:1px solid #dbe4ec;padding:4px 12px;font:800 10px/1.2 Inter,Segoe UI,Arial,sans-serif;letter-spacing:.35px;text-transform:uppercase;display:flex;align-items:center;gap:7px;box-shadow:none';
      document.body.insertBefore(badge,document.body.firstChild);
    }
  }

  async function instalarSeletorUnidadeAdmin(perfil,client){
    if(normalizarPerfil(perfil.perfil)!=='ADMIN'||contextoAtual?.pode_alternar!==true)return;
    const badge=document.getElementById('sistemaUnidadeAtiva');
    if(!badge||badge.dataset.adminSelector==='1')return;

    const r=await client.rpc('listar_unidades_contexto_admin');
    if(r.error){console.error('Não foi possível carregar as unidades para o modo administrador:',r.error);return;}
    const unidades=ordenarUnidadesHierarquia(r.data||[]);
    if(!unidades.length)return;

    badge.dataset.adminSelector='1';
    badge.style.maxWidth='none';
    badge.style.textTransform='none';
    badge.style.letterSpacing='0';
    badge.style.padding='4px 12px';
    badge.style.borderBottomColor=contextoAtual?.somente_leitura_operacional?'#d8b66c':'#dbe4ec';
    badge.innerHTML='';

    const titulo=document.createElement('div');
    titulo.textContent='Unidade de trabalho:';
    titulo.style.cssText='font-size:9px;font-weight:900;letter-spacing:.45px;text-transform:uppercase;color:#66758a;white-space:nowrap';

    const select=document.createElement('select');
    select.setAttribute('aria-label','Unidade de trabalho do administrador');
    select.style.cssText='width:auto;max-width:min(72vw,520px);border:1px solid #d1dbe4;border-radius:6px;padding:3px 24px 3px 7px;background:#fff;color:#17324a;font:800 10px Inter,Segoe UI,Arial,sans-serif;cursor:pointer';
    unidades.forEach(u=>{
      const op=document.createElement('option');
      op.value=u.id;
      op.textContent=rotuloUnidade(u,unidades);
      select.appendChild(op);
    });
    select.value=contextoAtual.unidade_id;

    const detalhe=document.createElement('div');
    detalhe.setAttribute('aria-live','polite');
    detalhe.style.cssText='position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';
    detalhe.textContent=contextoAtual?.somente_leitura_operacional
      ? 'Contexto consolidado: consulta dos descendentes. Cadastro e alterações operacionais ficam bloqueados.'
      : 'Os registros e filtros usam esta unidade como contexto. Sua unidade principal não é alterada.';

    select.addEventListener('change',async()=>{
      const anterior=contextoAtual.unidade_id;
      select.disabled=true;
      detalhe.textContent='Alterando unidade de trabalho...';
      const troca=await client.rpc('definir_contexto_unidade_admin',{p_unidade_id:select.value});
      if(troca.error){
        console.error(troca.error);
        alert('Não foi possível alterar a unidade de trabalho: '+troca.error.message);
        select.value=anterior;
        select.disabled=false;
        detalhe.textContent='A unidade de trabalho não foi alterada.';
        return;
      }
      location.reload();
    });

    badge.title=detalhe.textContent;
    badge.append(titulo,select,detalhe);
  }

  function instalarIdentificacaoSessao(perfil,client){
    if(document.getElementById('sistemaUsuarioSessao'))return;

    const box=document.createElement('div');
    box.id='sistemaUsuarioSessao';
    box.setAttribute('aria-label','Usuário conectado');
    box.style.cssText='position:fixed;right:12px;bottom:12px;z-index:99999;max-width:min(88vw,330px);background:#071b33f2;color:#fff;border:1px solid #ffffff2e;border-radius:10px;box-shadow:0 6px 18px #0003;padding:7px 8px 7px 10px;font:11px/1.25 Inter,Segoe UI,Arial,sans-serif;display:flex;align-items:center;gap:9px;backdrop-filter:blur(5px)';

    const dados=document.createElement('div');
    dados.style.cssText='min-width:0;max-width:245px';

    const nome=document.createElement('strong');
    const identificacao=[perfil.posto_graduacao,perfil.nome_guerra].filter(Boolean).join(' ').trim();
    nome.textContent=identificacao||perfil.nome_guerra||perfil.nome||perfil.email||'Usuário';
    nome.title=nome.textContent;
    nome.style.cssText='display:block;font-size:11px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';

    const perfilLink=document.createElement('a');
    perfilLink.href=cfg.profilePage||'meu-perfil.html';
    perfilLink.textContent='Perfil';
    perfilLink.style.cssText='flex:0 0 auto;border:1px solid #ffffff44;background:#ffffff0d;color:#fff;text-decoration:none;border-radius:7px;padding:5px 8px;font:800 10px Inter,Segoe UI,Arial,sans-serif';

    const sair=document.createElement('button');
    sair.type='button';
    sair.id='sistemaSair';
    sair.textContent='Sair';
    sair.style.cssText='flex:0 0 auto;border:1px solid #ffffff55;background:transparent;color:#fff;border-radius:7px;padding:5px 8px;cursor:pointer;font:800 10px Inter,Segoe UI,Arial,sans-serif';
    sair.addEventListener('click',async()=>{
      sair.disabled=true;
      sair.textContent='Saindo...';
      try{await client.auth.signOut({scope:'local'});}catch(_){}
      location.replace(cfg.loginPage);
    });

    dados.append(nome);
    box.append(dados,perfilLink,sair);
    document.body.appendChild(box);
  }

  function mostrarAvisoDeAcesso(){
    const erro=new URLSearchParams(location.search).get('erro');
    if(erro!=='modulo-indisponivel'||document.getElementById('sistemaAvisoAcesso'))return;
    const aviso=document.createElement('div');
    aviso.id='sistemaAvisoAcesso';
    aviso.setAttribute('role','alert');
    aviso.style.cssText='position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:100000;width:min(92vw,680px);background:#fff7e6;color:#713f12;border:1px solid #f2c66d;border-radius:12px;box-shadow:0 8px 24px #0002;padding:12px 16px;font:600 13px/1.45 Arial,sans-serif;text-align:center';
    aviso.textContent='Esta funcionalidade não está habilitada para a sua unidade principal.';
    document.body.appendChild(aviso);
  }

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  async function carregarPerfil(client,user){
    const r=await client.from(cfg.profileTable)
      .select('user_id,nome,nome_guerra,posto_graduacao,matricula,email,perfil,ativo,senha_temporaria,unidade_id')
      .eq('user_id',user.id)
      .maybeSingle();
    if(r.error)throw r.error;
    if(!r.data)return null;
    let unidade=null;
    if(r.data.unidade_id){
      const u=await client.from('unidades').select('id,sigla,nome,ativo').eq('id',r.data.unidade_id).maybeSingle();
      if(!u.error)unidade=u.data||null;
    }
    return {...r.data,unidades:unidade};
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
      if(!perfil.unidade_id||!perfil.unidades||perfil.unidades.ativo!==true){
        await client.auth.signOut({scope:'local'}).catch(()=>{});
        location.replace(urlLogin('unidade-indisponivel'));
        return null;
      }

      if(perfil.senha_temporaria===true&&pathname!==cfg.passwordPage){
        location.replace(cfg.passwordPage);
        return null;
      }

      await carregarContextoUnidade(client,perfil);

      const pPagina=permissaoDaPagina();
      if(pPagina&&!pode(perfil.perfil,pPagina)){
        location.replace(cfg.homePage+'?erro=sem-permissao');
        return null;
      }

      const [modulos,planilha]=await Promise.all([
        carregarModulos(client),
        carregarPlanilhaUsuario(client)
      ]);
      const mPagina=moduloDaPagina();
      if(mPagina&&!temModulo(modulos,mPagina)){
        location.replace(cfg.homePage+'?erro=modulo-indisponivel');
        return null;
      }

      window.SistemaAuth={enabled:true,client,user,perfil,contexto:contextoAtual,modulos:[...modulos],planilha,pode:(p)=>pode(perfil.perfil,p),temModulo:(m)=>temModulo(modulos,m),ready:null,sair:async()=>{await client.auth.signOut({scope:'local'});location.replace(cfg.loginPage);}};

      const aplicar=()=>{aplicarIdentidadeVisual(perfil);aplicarPermissoes(perfil.perfil,modulos,planilha);instalarIdentificacaoSessao(perfil,client);instalarSeletorUnidadeAdmin(perfil,client).catch(e=>console.error('Falha ao instalar seletor administrativo:',e));mostrarAvisoDeAcesso();};
      if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',aplicar,{once:true});
      else aplicar();

      return window.SistemaAuth;
    }catch(e){
      console.error('Falha ao validar acesso ao sistema:',e);
      try{
        await carregarSupabase();
        const c=window.supabase.createClient(cfg.supabaseUrl,cfg.publishableKey);
        await c.auth.signOut({scope:'local'});
      }catch(_){}
      location.replace(urlLogin('falha-validacao'));
      return null;
    }finally{
      document.documentElement.style.visibility='';
    }
  })();

  window.SistemaAuth={enabled:true,ready,pode:()=>false,temModulo:()=>false,modulos:[],planilha:null,perfil:null,user:null};
})();
