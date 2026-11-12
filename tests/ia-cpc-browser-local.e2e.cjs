#!/usr/bin/env node
"use strict";
// Chromium REAL + auth-guard.js ORIGINAL + Supabase GoTrue/PostgREST/Edge LOCAL.
// Todos os dados/credenciais desta rotina são fictícios e destinados ao runner.
// Sem internet no navegador; NÃO substitui teste em hospedagem ou domínio final.
const fs=require("node:fs");
const path=require("node:path");
const http=require("node:http");
const assert=require("node:assert/strict");
const playwright=require(process.env.PLAYWRIGHT_CORE_PATH||"playwright-core");

const API=(process.env.API_URL||"").replace(/\/$/,"");
const KEY=process.env.ANON_KEY||"";
const BUNDLE=process.env.BROWSER_SDK_BUNDLE||"";
const senha="Teste-Exclusivo-Ambiente-Isolado-2026!";
const HOST="http://localhost:9999";
const RAIZ=path.join(__dirname,"..");
if(!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(API)||KEY.length<60||
   !BUNDLE||!fs.existsSync(BUNDLE)||process.env.SUPABASE_ACCESS_TOKEN)
 throw Error("Proibido testar fora do Supabase local com SDK empacotado.");
const original=fs.readFileSync(path.join(RAIZ,"auth-config.js"),"utf8");
const authConfig=original.replace(
 /supabaseUrl:\s*"https:\/\/[^"]+"/,
 'supabaseUrl: "'+API+'"'
).replace(/publishableKey:\s*"[^"]+"/,
 'publishableKey: "'+KEY+'"');
assert(authConfig.includes('supabaseUrl: "'+API+'"'));
assert(!authConfig.includes("jppmhhukujigxupgskdk.supabase.co"));
const paginas={
 "/ia-cpc.html":fs.readFileSync(path.join(RAIZ,"ia-cpc.html"),"utf8"),
 "/auth-guard.js":fs.readFileSync(path.join(RAIZ,"auth-guard.js"),"utf8"),
 "/auth-config.js":authConfig,
 "/login.html":'<!doctype html><html lang="pt-BR"><title>Login local fictício</title><body>Login sintético local</body></html>',
 "/index.html":'<!doctype html><html lang="pt-BR"><title>Sem permissão</title><body id="acessoNegado">Painel local de testes</body></html>'
};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,HOST).pathname;
 const corpo=paginas[pathname];
 if(!corpo){res.writeHead(404);res.end("Não encontrado");return;}
 res.setHeader("Cache-Control","no-store");
 res.setHeader("Content-Type",pathname.endsWith(".js")?
  "application/javascript; charset=utf-8":"text/html; charset=utf-8");
 res.end(corpo);
});
const callback=()=>new Promise(resolve=>server.listen(9999,"127.0.0.1",resolve));
const url=path=>HOST+path;
let browser;
async function caso(tipo,permissaoEsperada){
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 // A biblioteca é servida do pacote instalado no runner, não da CDN.
 await context.addInitScript({path:BUNDLE});
 await context.route("**/*",route=>{
   const u=new URL(route.request().url());
   if(u.hostname==="cdn.jsdelivr.net"&&u.pathname.includes("@supabase/supabase-js"))
     return route.fulfill({contentType:"application/javascript",body:"/* SDK carregado localmente */"});
   if(!["localhost","127.0.0.1"].includes(u.hostname))
     return route.abort("blockedbyclient");
   return route.continue();
 });
 const page=await context.newPage();
 page.setDefaultTimeout(12000);
 try{
   await page.goto(url("/login.html"),{waitUntil:"domcontentloaded"});
   const resultado=await page.evaluate(async ({base,key,email,password})=>{
     const client=window.supabase.createClient(base,key);
     const r=await client.auth.signInWithPassword({email,password});
     return {id:r.data?.user?.id||null,error:r.error?.message||null};
   },{base:API,key:KEY,email:"ia-local-"+tipo+"@example.invalid",password:senha});
   assert(resultado.id&&!resultado.error,"Falhou login pelo navegador: "+tipo+" "+resultado.error);
   await page.goto(url("/ia-cpc.html"),{waitUntil:"domcontentloaded"});
   if(permissaoEsperada){
     await page.locator("#conteudo").waitFor({state:"visible",timeout:14000});
     assert.equal(await page.evaluate(()=>window.SistemaAuth?.pode?.("ia_cpc")),true);
     assert.equal(await page.locator("#sistemaUsuarioSessao").count(),1);
     await page.locator("#dataInicio").fill("2026-01-01");
     await page.locator("#dataFim").fill("2026-01-07");
     await page.locator("#pergunta").fill("Resuma as ocorrências do período.");
     await page.locator("#enviar").click();
     await page.waitForFunction(()=>document.getElementById("situacao")?.textContent?.includes("Consulta concluída:"),null,{timeout:14000});
     const situacao=await page.locator("#situacao").innerText();
     assert.match(situacao,/0 registros ativos/);
     assert.equal(await page.locator("#enviar").isDisabled(),false);
   }else{
     await page.waitForURL(/\/index\.html\?erro=sem-permissao/,{timeout:14000});
     assert.equal(await page.locator("#conteudo").count(),0);
     const requests=await page.evaluate(()=>window.SistemaAuth?.pode?.("ia_cpc"));
     assert.notEqual(requests,true);
   }
   console.log("BROWSER CHROMIUM "+tipo+": "+(permissaoEsperada?"PERMITIDO sem custo":"BLOQUEADO"));
 }finally{
   await context.close();
 }
}
async function semSessao(){
 const context=await browser.newContext();
 await context.addInitScript({path:BUNDLE});
 await context.route("**/*",route=>{
   const u=new URL(route.request().url());
   if(u.hostname==="cdn.jsdelivr.net")return route.fulfill({contentType:"application/javascript",body:""});
   if(!["localhost","127.0.0.1"].includes(u.hostname))return route.abort();
   return route.continue();
 });
 const page=await context.newPage();
 try{
   await page.goto(url("/ia-cpc.html"),{waitUntil:"domcontentloaded"});
   await page.waitForURL(/\/login\.html/,{timeout:14000});
   assert.equal(await page.locator("#conteudo").count(),0);
   console.log("BROWSER CHROMIUM sem sessão: REDIRECIONADO");
 }finally{await context.close();}
}
(async()=>{
 await callback();
 const candidatos=[process.env.CHROME_PATH,"/usr/bin/google-chrome","/usr/bin/chromium"];
 const executablePath=candidatos.find(p=>p&&fs.existsSync(p));
 if(!executablePath)throw Error("Chromium/Chrome não encontrado no runner (sem acesso a navegador remoto).");
 browser=await playwright.chromium.launch({executablePath,headless:true,args:["--no-sandbox"]});
 await semSessao();
 await caso("admin-designado",true);
 await caso("comandante-cpc",true);
 await caso("outro-admin",false);
 await caso("outro-comandante",false);
 await caso("operador",false);
 console.log("SUCESSO — navegador Chromium com auth-guard original, RPCs e Edge locais; 2 permitidos, 3 bloqueados, sem login redirecionado; API paga não utilizada.");
})().catch(e=>{console.error("BROWSER E2E FALHOU: "+e.message);process.exitCode=1;})
 .finally(async()=>{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));});
