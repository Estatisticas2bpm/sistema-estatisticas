const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const relatorio=fs.readFileSync(path.join(root,'relatorio.html'),'utf8');

assert.ok(relatorio.includes("function eh2BpmRel(){return String(unidadeRel().sigla||'').toUpperCase()==='2º BPM'}"));
assert.match(relatorio,/const logo2BpmPdf='logo-2bpm-novo\.png';/);
assert.match(relatorio,/eh2BpmRel\(\)\?'<img src="'\+logo2BpmPdf\+'".*Brasão do 2º BPM/);

// A personalização das demais unidades permanece intacta.
assert.match(relatorio,/logoCipturPdf='assets\/logos\/ciptur-brasao\.png'/);
assert.match(relatorio,/assets\/logos\/giro-brasao\.svg/);
assert.match(relatorio,/<div class="cover-brand">SIE-CPC<\/div>/);

console.log('2º BPM: logo específica restaurada na capa do relatório PDF.');
