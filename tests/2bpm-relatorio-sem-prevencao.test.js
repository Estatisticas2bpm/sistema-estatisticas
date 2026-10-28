const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const relatorio=fs.readFileSync(path.join(root,'relatorio.html'),'utf8');

assert.ok(relatorio.includes("const semProgramasPrevencao=!(window.SistemaAuth?.contexto?.tipo==='COMANDO'&&!unidadeSelecionadaRelCpc());"));
assert.ok(relatorio.includes("if(!semProgramasPrevencao)toc.push(['4. RESULTADOS DE PROGRAMAS DE PREVENÇÃO À CRIMINALIDADE','prevention'],['Visitas Comunitárias, Solidárias, Palestras e Anexos','prevention']);"));
assert.ok(relatorio.includes("toc.push([(semProgramasPrevencao?'4. ':'5. ')+'MÍDIAS DE DADOS ESTATÍSTICOS DE PRODUTIVIDADE','final']"));
assert.ok(relatorio.includes("let actionPage='',annexes='';"));
assert.ok(relatorio.includes("if(!semProgramasPrevencao){"));
assert.ok(relatorio.includes("if(!semProgramasPrevencao) product.push(['PALESTRAS'"));
assert.ok(relatorio.includes("let finalPage=page((semProgramasPrevencao?'4. ':'5. ')+'MÍDIAS DE DADOS ESTATÍSTICOS DE PRODUTIVIDADE'"));
assert.ok(relatorio.includes("(window.SistemaAuth?.contexto?.tipo==='COMANDO'&&!unidadeSelecionadaRelCpc())?db.rpc('obter_acoes_preventivas'"));

// Somente o CPC consolidado usa a fonte de prevenção que não identifica a unidade.
assert.ok(relatorio.includes("4. RESULTADOS DE PROGRAMAS DE PREVENÇÃO À CRIMINALIDADE"));
assert.ok(relatorio.includes("ANEXOS FOTOGRÁFICOS"));

console.log('Relatórios por unidade: prevenção sem atribuição indevida; 2º BPM sem seção de prevenção.');
