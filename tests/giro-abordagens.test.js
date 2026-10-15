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
assert.match(mobile,/id="emailPolicial" type="email"/);
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
assert.match(mapa,/Abordagem GIRO/);
assert.match(mapa,/function filtrarAbordagens\(\)/);
assert.match(mapa,/baseAbordagens/);
assert.match(mapa,/MapaUnidadeProfissional\.criarMarcador/);
assert.match(mapa,/grupoProfissionalUnidade/);
assert.match(mapa,/MapaUnidadeProfissional\.agregador/);
assert.match(mapa,/mapa-unidade-profissional\.js/);
assert.match(mapa,/abords\.forEach/);

// Gestão individual do GIRO; a conta compartilhada foi descontinuada.
assert.match(usuarios,/GIRO — Acesso individual às abordagens/);
assert.match(usuarios,/giroIndividualPanel/);
assert.match(edge,/giro_users_create/);
assert.match(edge,/giro_users_toggle/);
assert.match(edge,/giro_acessos_abordagem/);
assert.match(acesso,/name="nome_completo"/);
assert.match(acesso,/name="nome_guerra"/);
assert.match(acesso,/name="matricula"/);
assert.match(acesso,/giro_users_list/);
assert.match(authConfig,/giro-acesso-abordagens/);
assert.match(edge,/function podeGerenciarAcessoGiro/);
assert.doesNotMatch(dashboard,/id="secGiroAcesso"/);
assert.match(home,/id="giroAccessShortcut"/);
assert.ok(home.includes('Cadastrar/gerenciar policiais das abordagens — GIRO'));
assert.match(home,/perfilGiro==='ADMIN'\|\|perfilGiro==='ESTATISTICA'/);
assert.match(home,/giro-acesso-abordagens\.html/);
assert.doesNotMatch(home,/<a[^>]*id="giroAccessShortcut"[^>]*href="dashboard\.html"/);
assert.match(home,/id="camadaGiroMapa"/);
assert.match(home,/Ocorrências \+ abordagens/);
assert.match(home,/abordagensMapaAtuais/);
assert.match(home,/consultarRegistrosHome\("giro_abordagens"/);
assert.match(home,/Abordagem GIRO/);
assert.match(home,/camadaGiroMapa\.onchange=function\(\)\{if\(modoCpc\)carregarMapa\(\);else renderizarMapa\(\)\}/);
assert.match(home,/MapaUnidadeProfissional\.criarMarcador/);
assert.match(home,/marcadoresUnidadeAtuais/);
assert.match(home,/MapaUnidadeProfissional\.agregador/);
assert.match(home,/camadaAgrupadaUnidade/);
assert.match(home,/if\(!mapaCalor\)/);
assert.match(home,/rotuloAbordagemGiro/);

console.log('GIRO: módulo de abordagens mobile, painéis, mapa e acesso validados.');
