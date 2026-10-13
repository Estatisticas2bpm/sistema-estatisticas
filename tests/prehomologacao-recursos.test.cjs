'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const pages=['index.html','dashboard.html','dashboard-cpc.html','mapa-criminal.html','relatorio.html','auditoria.html','mapa-tv.html'];
const locals=new Set(),errors=[];
for(const file of pages){
 const html=fs.readFileSync(path.join(root,file),'utf8');
 for(const m of html.matchAll(/<(?:script|img|link|a)\b[^>]*?(?:src|href)="([^"]+)"/gi)){
  const uri=m[1].trim().split('?')[0].split('#')[0];
  if(!uri||/^(https?:|data:|javascript:|mailto:|tel:|#|\/\/)/i.test(uri)||uri.includes(String.fromCharCode(36,123))||uri.startsWith("'+")||uri.includes("+'")||uri.startsWith('/'))continue;
  const target=path.resolve(root,uri);
  if(!target.startsWith(root+path.sep)||!fs.existsSync(target))errors.push(file+' → '+uri);
  else locals.add(uri);
 }
 const inline=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).filter(x=>x.trim());
 for(const s of inline){try{new Function(s)}catch(e){errors.push(file+' → erro sintático JS: '+e.message)}}
}
const modules=['cpc-rastreabilidade.js','cpc-indicadores-dashboard.js','estatistica-indicadores.js','mapa-cpc-profissional.js','mapa-unidade-profissional.js','auditoria-exportacao.js','relatorio-especializado.js','relatorio-cipa-profissional.js','relatorio-2bpm-profissional.js'];
for(const file of modules){
 const code=fs.readFileSync(path.join(root,file),'utf8');
 try{new Function(code)}catch(e){errors.push(file+' → '+e.message)}
 for(const m of code.matchAll(/['"](assets\/[^'"]+\.(?:png|svg|jpg|jpeg|webp))['"]/gi)){
  const target=path.join(root,m[1]);
  if(!fs.existsSync(target))errors.push(file+' → '+m[1]);
  else locals.add(m[1]);
 }
}
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
for(const [page,fragment] of [
 ['index.html','mapa-unidade-profissional.js'],
 ['mapa-criminal.html','mapa-unidade-profissional.js'],
 ['dashboard-cpc.html','cpc-rastreabilidade.js'],
 ['relatorio.html','relatorio-especializado.js'],
 ['auditoria.html','auditoria-exportacao.js']
]){
 if(!read(page).includes(fragment))errors.push(page+' → sem integração de '+fragment);
}
for(const s of ['1BPM','2BPM','BOPE','CAVALARIA','CIPA','CIPG','CIPTUR','GIRO']){
 if(!read('estatistica-indicadores.js').includes("'"+s+"'"))errors.push('Falta contrato de unidade '+s);
}
assert.deepEqual(errors,[],errors.join('\n'));
assert.ok(locals.size>=20,'Verificação de recursos muito superficial: '+locals.size+' caminhos');
console.log('OK: pré-homologação estática ('+pages.length+' páginas, '+modules.length+' módulos e '+locals.size+' dependências locais).');
