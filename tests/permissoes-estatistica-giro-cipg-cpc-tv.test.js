const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const config=read('auth-config.js'),guard=read('auth-guard.js'),home=read('index.html'),edge=read('supabase/functions/admin-users/index.ts');
const sandbox={window:{}};vm.runInNewContext(config,sandbox);const cfg=sandbox.window.SISTEMA_AUTH_CONFIG;
const start=guard.indexOf('  function pode(perfil,permissao){'),end=guard.indexOf('  function permissaoPorHref(',start);
assert.ok(start>=0&&end>start,'localizar guarda de autorização');
const fn=guard.slice(start,end);
function pode(sigla,perfil,permissao){
const contextoAtual={sigla,tipo:sigla==='CPC'?'COMANDO':'OPERACIONAL',somente_leitura_operacional:false};
const factory=new Function('cfg','contextoAtual','permissoesEscritaOperacional','normalizarPerfil',fn+';return pode;');
return factory(cfg,contextoAtual,new Set(['cadastro','tco','acoes']),x=>String(x||'').trim().toUpperCase())(perfil,permissao);
}
test('ESTATISTICA GIRO/CIPG tem ferramentas operacionais e não administra contas SIE',()=>{
 const operacionais=['cadastro','consulta','dashboard','auditoria','analise','mapa','tco','relatorio'];
 for(const unidade of ['GIRO','CIPG'])for(const k of operacionais)assert.equal(pode(unidade,'ESTATISTICA',k),true,unidade+':'+k);
 for(const unidade of ['GIRO','CIPG'])assert.equal(pode(unidade,'ESTATISTICA','usuarios'),false,unidade+' não pode criar conta SIE');
 assert.equal(pode('GIRO','ADMIN','usuarios'),true);
 assert.match(config,/"usuarios.html":"usuarios"/);
 assert.match(edge,/if \(!perfilCaller \|\| perfilCaller\.ativo !== true \|\| perfilCaller\.perfil !== "ADMIN"/);
});
test('ESTATISTICA gerencia apenas usuários móveis da unidade correspondente',()=>{
 assert.match(edge,/sigla === "GIRO" && perfil\.perfil === "ESTATISTICA"/);
 assert.match(edge,/upper\(perfilCaller\.unidades\?\.sigla\) === "CIPG" && perfilCaller\.perfil === "ESTATISTICA"/);
 assert.match(edge,/if\(acoesGiroIndividuais\.has\(action\)\)/);
 assert.match(edge,/if \(acoesCadernoCipg\.has\(action\)\)/);
 assert.match(home,/id="giroAccessShortcut" href="giro-acesso-abordagens\.html"/);
 assert.match(home,/id="cipgAccessShortcut" href="cipg-gerenciar-acessos\.html"/);
});
test('Modo TV só em contexto de comando CPC, mesmo por URL direta',()=>{
 for(const unidade of ['GIRO','CIPG','1BPM','2BPM','CIPA','CAVALARIA','BOPE'])for(const perfil of ['ADMIN','ESTATISTICA','GESTOR'])assert.equal(pode(unidade,perfil,'tv'),false);
 for(const perfil of ['ADMIN','ESTATISTICA','GESTOR'])assert.equal(pode('CPC',perfil,'tv'),true);
 assert.equal(pode('CPC','OPERADOR','tv'),false);
 for(const page of ['modo-tv.html','mapa-tv.html','painel-tv.html'])assert.equal(cfg.pagePermissions[page],'tv');
 assert.match(home,/id="modoTvSomenteCpc" href="modo-tv\.html" data-permission="tv" hidden/);
});
test('Fluxos da Seção estão desativados para todos os perfis e fora do menu',()=>{
 for(const unidade of ['GIRO','CIPG','CPC'])for(const perfil of Object.keys(cfg.permissions))assert.equal(pode(unidade,perfil,'fluxos'),false);
 assert.equal(cfg.pagePermissions['fluxos.html'],'fluxos');
 assert.doesNotMatch(home,/href="fluxos\.html"/);
});

test('A URL direta da gestão móvel não permite ESTATÍSTICA de outra unidade',()=>{
 const i=guard.indexOf('  function paginaEspecializadaPermitida(perfil){');
 const f=guard.indexOf('  function permissaoDaPagina()',i);
 assert.ok(i>=0&&f>i);
 const code=guard.slice(i,f);
 function acesso(unidade,pagina,perfil){
  return new Function('pathname','contextoAtual','normalizarPerfil',code+';return paginaEspecializadaPermitida;')(
    pagina,{sigla:unidade},x=>String(x||'').toUpperCase()
  )({perfil});
 }
 assert.equal(acesso('GIRO','giro-acesso-abordagens.html','ESTATISTICA'),true);
 assert.equal(acesso('CIPG','giro-acesso-abordagens.html','ESTATISTICA'),false);
 assert.equal(acesso('GIRO','giro-ranking-abordagens.html','ESTATISTICA'),true);
 assert.equal(acesso('GIRO','cipg-gerenciar-acessos.html','ESTATISTICA'),false);
 assert.equal(acesso('CIPG','cipg-gerenciar-acessos.html','ESTATISTICA'),true);
 assert.equal(acesso('GIRO','cipg-auditoria-caderno.html','ESTATISTICA'),false);
 assert.equal(acesso('GIRO','cipg-gerenciar-acessos.html','ADMIN'),true);
 assert.match(guard,/if\(!paginaEspecializadaPermitida\(perfil\)\)/);
});
