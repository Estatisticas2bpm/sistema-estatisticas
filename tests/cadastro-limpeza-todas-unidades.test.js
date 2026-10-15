const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const base = fs.readFileSync(path.join(raiz, 'cadastro-base.html'), 'utf8');
const entrada = fs.readFileSync(path.join(raiz, 'cadastro.html'), 'utf8');
const script = entrada.slice(entrada.lastIndexOf('<script>') + 8, entrada.lastIndexOf('</script>'));

async function montar(sigla) {
  let html = null;
  let destino = null;
  const contexto = { sigla, unidade_id: 'unidade-' + sigla };
  const sessao = { access_token: 'token-de-teste' };
  const window = {
    SistemaAuth: { ready: Promise.resolve({ contexto, sessao }) },
    location: { search: '', replace(url) { destino = url; } }
  };
  const document = { open() {}, write(texto) { html = texto; }, close() {} };
  const fetch = async () => ({ ok: true, text: async () => base });
  await new Function('window', 'document', 'fetch', 'console',
    'return ' + script.trim())(window, document, fetch, console);
  return { html, destino, contexto, sessao };
}

(async () => {
  const unidadesConvencionais = [
    '1BPM', '2BPM', 'CIPA', 'CIPTUR', 'BOPE', 'GIRO', 'CAVALARIA',
    'CANIL', 'CHOQUE', 'GATE', 'FORCA_TATICA'
  ];
  for (const sigla of unidadesConvencionais) {
    const { html, destino, contexto, sessao } = await montar(sigla);
    assert.equal(destino, null, sigla + ': nao deve desviar cadastro convencional');
    assert.ok(html, sigla + ': deve montar formulario');
    assert.match(html, /function abrirNovoFormularioAposSalvar\(\)/,
      sigla + ': deve receber reinicializador');
    assert.match(html, /abrirNovoFormularioAposSalvar\(\);/,
      sigla + ': deve chamar reinicializador apos salvar');
    assert.match(html, /const novaPagina = new URL\(window.location.href\)/);
    assert.match(html, /novaPagina.searchParams.delete\("id"\)/);
    assert.match(html, /novaPagina.searchParams.set\("novo", String\(Date.now\(\)\)\)/);
    assert.match(html, /window.location.replace\(novaPagina.toString\(\)\)/);
    assert.match(html, /autocomplete="off"/);
    assert.doesNotMatch(html, /formulario\.reset\(\)/);
    assert.match(html, /if \(salvamentoEmAndamento\) return;/);
    assert.match(html, /if \(!navegacaoAposGravacao\)/);
    assert.equal(contexto.sigla, sigla);
    assert.equal(sessao.access_token, 'token-de-teste');
    if (sigla === 'BOPE') {
      assert.match(html, /id="subunidadeOperacional"/);
      assert.match(html, /<option value="">Selecione a unidade respons<\/option>/i);
    } else {
      assert.doesNotMatch(html, /id="subunidadeOperacional"/);
    }
    if (sigla === 'CIPTUR') assert.match(html, /id="grupamentoTor"/);
    if (sigla === 'CIPA') assert.match(html, /CipaCadastro\.salvar/);
  }
  const cipg = await montar('CIPG');
  assert.match(cipg.destino, /^cipg-produtividade\.html/);
  assert.equal(cipg.html, null, 'CIPG usa fluxo especializado; nao alterar');
  for (const especializado of ['cavalaria-produtividade.html', 'giro-abordagem.html', 'cipg-produtividade.html']) {
    assert.ok(fs.existsSync(path.join(raiz, especializado)), especializado);
  }
  console.log('PASS: todas as 11 unidades convencionais recebem nova instancia, sessao e contexto preservados; CIPG isolada.');
})().catch(error => { console.error(error); process.exitCode = 1; });
