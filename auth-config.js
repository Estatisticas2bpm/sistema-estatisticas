window.SISTEMA_AUTH_CONFIG = Object.freeze({
  enabled: true,
  supabaseUrl: "https://jppmhhukujigxupgskdk.supabase.co",
  publishableKey: "sb_publishable_ZVnU35i2x9zwppQqYg7UYw_mzaT43aG",
  profileTable: "perfis_usuarios",
  adminFunction: "admin-users",
  loginPage: "login.html",
  homePage: "index.html",
  passwordPage: "alterar-senha.html",
  permissions: Object.freeze({
    ADMIN: ["cadastro","consulta","dashboard","auditoria","analise","mapa","tco","relatorio","planilha","acoes","tv","fluxos","usuarios","logs","configuracoes"],
    ESTATISTICA: ["cadastro","consulta","dashboard","auditoria","analise","mapa","tco","relatorio","planilha","acoes","tv","fluxos","logs"],
    OPERADOR: ["cadastro","consulta","dashboard","mapa","tco","acoes"],
    GESTOR: ["consulta","dashboard","analise","mapa","relatorio","tv"],
    CONSULTA: ["consulta","dashboard","mapa","relatorio"]
  }),
  pagePermissions: Object.freeze({
    "cadastro.html":"cadastro",
    "cadastro-base.html":"cadastro",
    "consulta.html":"consulta",
    "dashboard.html":"dashboard",
    "auditoria.html":"auditoria",
    "analise-temporal.html":"analise",
    "mapa-criminal.html":"mapa",
    "mapa-tv.html":"tv",
    "tco.html":"tco",
    "tco-rapido.html":"tco",
    "relatorio.html":"relatorio",
    "acoes.html":"acoes",
    "modo-tv.html":"tv",
    "painel-tv.html":"tv",
    "fluxos.html":"fluxos",
    "usuarios.html":"usuarios"
  })
});
