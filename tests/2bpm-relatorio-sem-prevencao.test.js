const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const relatorio=fs.readFileSync(path.join(root,'relatorio.html'),'utf8');

assert.ok(relatorio.includes("const semProgramasPrevencao=eh2BpmRel();"));
assert.ok(relatorio.includes("if(!semProgramasPrevencao) toc.push('4. RESULTADOS DE PROGRAMAS DE PREVENÇÃO À CRIMINALIDADE','Visitas Comunitárias, Solidárias, Palestras e Anexos');"));
assert.ok(relatorio.includes("toc.push((semProgramasPrevencao?'4. ':'5. ')+'MÍDIAS DE DADOS ESTATÍSTICOS DE PRODUTIVIDADE'"));
assert.ok(relatorio.includes("let actionPage='',annexes='';"));
assert.ok(relatorio.includes("if(!semProgramasPrevencao){"));
assert.ok(relatorio.includes("if(!semProgramasPrevencao) product.push(['PALESTRAS'"));
assert.ok(relatorio.includes("let finalPage=page((semProgramasPrevencao?'4. ':'5. ')+'MÍDIAS DE DADOS ESTATÍSTICOS DE PRODUTIVIDADE'"));
assert.ok(relatorio.includes("eh2BpmRel()?Promise.resolve({data:[],error:null}):db.rpc('obter_acoes_preventivas'"));

// O bloco continua disponível para outras unidades que ainda possam usar o modelo genérico.
assert.ok(relatorio.includes("4. RESULTADOS DE PROGRAMAS DE PREVENÇÃO À CRIMINALIDADE"));
assert.ok(relatorio.includes("ANEXOS FOTOGRÁFICOS"));

console.log('2º BPM: relatório sem programas de prevenção/anexos e seção final renumerada para 4.');
