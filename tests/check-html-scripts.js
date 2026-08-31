const fs = require("node:fs");
const vm = require("node:vm");

for (const arquivo of process.argv.slice(2)) {
  const html = fs.readFileSync(arquivo, "utf8");
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  scripts.forEach((codigo, indice) => {
    try { new vm.Script(codigo, {filename:`${arquivo}#script-${indice + 1}`}); }
    catch (erro) { console.error(`${arquivo}: script ${indice + 1}\n${erro.stack}`); process.exitCode = 1; }
  });
  console.log(`${arquivo}: ${scripts.length} script(s) válido(s)`);
}
