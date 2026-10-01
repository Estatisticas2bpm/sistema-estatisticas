const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const mobile=read('giro-abordagem.html');
const dashboard=read('dashboard.html');
const cpc=read('dashboard-cpc.html');
const mapa=read('mapa-criminal.html');
const usuarios=read('usuarios.html');
const edge=read('supabase/functions/admin-users/index.ts');
const home=read('index.html');
const acesso=read('giro-acesso-abordagens.html');
const authConfig=read('auth-config.js');

// Mobile: fluxo rápido e restrito.
assert.match(mobile,/GIRO ABORDAGENS/);
assert.match(mobile,/storageKey:'sie-cpc-giro-abordagem-auth'/);
assert.match(mobile,/data-tipo="A_PE"/);
assert.match(mobile,/data-tipo="MOTO"/);
assert.match(mobile,/data-tipo="VEICULO"/);
assert.match(mobile,/data-value="BR"[^>]*>BRASILEIRA/);
assert.match(mobile,/data-value="M"[^>]*>MASCULINO/);
assert.match(mobile,/data-idade/);
assert.match(mobile,/Adicionar pessoa/);
assert.match(mobile,/navigator\.geolocation\.getCurrentPosition/);
assert.match(mobile,/registrar_abordagem_giro/);
assert.doesNotMatch(mobile,/auth-guard\.js/);
assert.match(mobile,/geocodePromise/);
assert.match(mobile,/id="localManualBox"/);
assert.match(mobile,/id="bairroManual"/);
assert.match(mobile,/id="logradouroManual"/);
assert.match(mobile,/reverseGeocodeOsm/);
assert.match(mobile,/OpenStreetMap contributors/);
assert.match(mobile,/Para manter as estatísticas territoriais/);

// Painel GIRO.
assert.match(dashboard,/id="secGiroAbordagens" hidden/);
assert.match(dashboard,/Total de abordagens/);
assert.match(dashboard,/Pessoas abordadas/);
assert.match(dashboard,/function renderGiroAbordagens\(\)/);
assert.match(dashboard,/db\.from\('giro_abordagens'\)/);
assert.match(dashboard,/Registro mobile ↗/);
assert.match(dashboard,/id="giroFiltroBairro"/);
assert.match(dashboard,/id="giroFiltroLogradouro"/);
assert.match(dashboard,/id="giroFiltroHoraInicio"/);
assert.match(dashboard,/id="tabGiroBairros"/);
assert.match(dashboard,/id="tabGiroLogradouros"/);
assert.match(dashboard,/id="tabGiroHorarios"/);
assert.match(dashboard,/id="chartGiroAbordagemDia"/);
assert.match(dashboard,/id="chartGiroAbordagemHora"/);
assert.match(dashboard,/id="giroCorrigirLocais"/);
assert.match(dashboard,/corrigirLocaisPendentesGiro/);
assert.match(dashboard,/reverseOsmGiro/);
assert.match(dashboard,/Geocodificação complementar: © OpenStreetMap contributors/);
assert.match(dashboard,/function filtrarAbordagensGiro\(lista\)/);
assert.match(dashboard,/function normalizarFiltroLivre\(v\)/);
assert.doesNotMatch(dashboard,/const b=norm\(\$\('giroFiltroBairro'\)/);
assert.match(dashboard,/T00:00:00-04:00/);
assert.match(dashboard,/T23:59:59\.999-04:00/);
assert.match(dashboard,/Motocicletas abordadas/);
assert.match(dashboard,/\(ehCiptur\(\)\|\|ehGiro\(\)\)\?\[\]/);

// CPC.
assert.match(cpc,/Abordagens preventivas — GIRO/);
assert.match(cpc,/id="cpcGiroAbordagens"/);
assert.match(cpc,/function renderAbordagensGiroCpc\(\)/);
assert.match(cpc,/db\.from\('giro_abordagens'\)/);

// Mapa: camadas separadas.
assert.match(mapa,/Somente abordagens GIRO/);
assert.match(mapa,/ABORDAGEM GIRO/);
assert.match(mapa,/function filtrarAbordagens\(\)/);
assert.match(mapa,/baseAbordagens/);
assert.match(mapa,/giro-moto-marker/);
assert.match(mapa,/gruposAbordagens/);
assert.match(mapa,/deslocamento=grupo\.length>1/);
assert.match(mapa,/L\.divIcon/);
assert.match(mapa,/🏍️/);

// Administração do acesso compartilhado.
assert.match(usuarios,/Acesso compartilhado — GIRO Abordagens/);
assert.match(usuarios,/giro_access_create/);
assert.match(usuarios,/giro_access_reset_password/);
assert.match(usuarios,/Promise\.allSettled/);
assert.match(usuarios,/listaResult\.status==='fulfilled'/);
assert.match(usuarios,/giroResult\.status==='fulfilled'/);
assert.match(edge,/GIRO_ABORDAGENS_EMAIL/);
assert.match(edge,/giro_access_deactivate/);
assert.match(edge,/giro_acessos_abordagem/);
assert.doesNotMatch(dashboard,/id="secGiroAcesso"/);
assert.doesNotMatch(dashboard,/navGiroAcesso/);
assert.doesNotMatch(dashboard,/giro_access_status/);
assert.match(acesso,/Acesso Compartilhado — Abordagens/);
assert.match(acesso,/giro_access_status/);
assert.match(acesso,/giro_access_create/);
assert.match(acesso,/giro_access_reset_password/);
assert.match(acesso,/giro_access_deactivate/);
assert.match(acesso,/giro_access_reactivate/);
assert.match(acesso,/sigla==='GIRO'/);
assert.match(acesso,/perfil==='ADMIN'\|\|perfil==='ESTATISTICA'/);
assert.match(authConfig,/"giro-acesso-abordagens\.html":"dashboard"/);
assert.match(edge,/function podeGerenciarAcessoGiro/);
assert.match(edge,/sigla === "GIRO" && perfil\.perfil === "ESTATISTICA"/);
assert.match(edge,/Somente ADMIN ou ESTATÍSTICA do GIRO podem gerenciar/);
assert.match(edge,/Somente administradores ativos de uma unidade ativa podem gerenciar usuários/);

assert.match(home,/id="giroAccessShortcut"/);
assert.match(home,/Gerenciar acesso das abordagens/);
assert.match(home,/perfilGiro==='ADMIN'\|\|perfilGiro==='ESTATISTICA'/);
assert.match(home,/giro-acesso-abordagens\.html/);
assert.doesNotMatch(home,/giroAccessShortcut[^>]+dashboard\.html/);
assert.match(home,/id="camadaGiroMapa"/);
assert.match(home,/Ocorrências \+ abordagens/);
assert.match(home,/abordagensMapaAtuais/);
assert.match(home,/db\.from\("giro_abordagens"\)/);
assert.match(home,/ABORDAGEM GIRO/);
assert.match(home,/camadaGiroMapa\.onchange=renderizarMapa/);
assert.match(home,/giro-moto-marker/);
assert.match(home,/gruposAbordagens/);
assert.match(home,/deslocamento=grupo\.length>1/);
assert.match(home,/iconAnchor:\[13-deslocamento,13\]/);
assert.match(home,/typeof pt\.setRadius==="function"/);
assert.match(home,/🏍️/);

console.log('GIRO: módulo de abordagens mobile, painéis, mapa e acesso validados.');
