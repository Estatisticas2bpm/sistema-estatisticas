const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

const contrato=read('estatistica-indicadores.js');
const home=read('index.html');
const mapa=read('mapa-criminal.html');
const brasao=read('assets/logos/ciptur-brasao.svg');

// O brasão deve ser uma imagem real, publicada e usada por ambas as telas.
assert.match(brasao,/<svg\s[^>]*viewBox=/);
assert.match(brasao,/data:image\/jpeg;base64,/);
assert.match(contrato,/'CIPTUR':'assets\/logos\/ciptur-brasao\.svg'/);
assert.doesNotMatch(contrato,/ciptur-escudo-v2\.png/);

for(const [pagina,codigo] of [['Home CPC',home],['Mapa criminal completo',mapa]]){
  assert.match(codigo,/estatistica-indicadores\.js\?v=20261012-ciptur-escudo3/,
    pagina+' deve invalidar o cache do mapeamento de imagens');
  assert.match(codigo,/cpcUnitPin/);
  assert.match(codigo,/sigla==='CIPTUR'\?'CT'|unidade==='CIPTUR'\?'CT'/,
    pagina+' deve identificar a CIPTUR mesmo sem carregamento do arquivo');
  assert.match(codigo,/onerror="this\.remove\(\)"/,
    pagina+' deve retirar imagem quebrada para liberar fallback visível');
}
assert.match(home,/function iconeUnidadeCpc\(sigla\)/);
assert.match(mapa,/function iconeUnidade\(siglaOrigem\)/);
console.log('OK: os dois mapas CPC usam o brasão vetorial da CIPTUR e possuem fallback.');
