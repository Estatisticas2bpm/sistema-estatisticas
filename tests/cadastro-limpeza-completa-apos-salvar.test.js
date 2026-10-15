const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname,'..');
const base = fs.readFileSync(path.join(raiz,'cadastro-base.html'),'utf8');
const integrador = fs.readFileSync(path.join(raiz,'cadastro.html'),'utf8');
const pdfCore = require('../pdf-importer-core.js');

assert.match(base,/<form id="formOcorrencia" novalidate autocomplete="off">/);
assert.match(base,/const dados = extrairDadosOcorrenciaPdf\(texto\)/);
assert.match(base,/await preencherRascunhoPdf\(dados\)/);
assert.match(base,/importacaoPdfPendente = true/);
assert.match(base,/if \(importacaoPdfPendente && !confirm\(/);
assert.match(base,/const itensEstruturados = sincronizarCamposLegadosEstruturados\(\)/);
assert.match(base,/function adicionarPessoa\(/);
assert.match(base,/function carregarItensEstruturados\(/);
assert.match(base,/const subunidadeOperacional = document\.getElementById\("subunidadeOperacional"\)/);
assert.match(base,/subunidadeOperacionalPendente = x\.subunidade_operacional_id/);
assert.match(base,/subunidadesBopeProntas/);
assert.match(integrador,/window\.CipaCadastro\?\.salvar/);

// Verifica que a extração do PDF ainda está disponível e que o catálogo pode
// associar o policial antes da conferência manual do operador.
assert.equal(typeof pdfCore.associarComandante,'function');
const comandante = pdfCore.associarComandante(
  'Comandante da Guarnição: SD PM SILVA',
  ['SD PM SILVA','SGT PM TESTE']
);
assert.equal(comandante.valor,'SD PM SILVA');

// Exercita a FUNÇÃO REAL de navegação extraída de cadastro-base.html.
const init=base.indexOf('    function abrirNovoFormularioAposSalvar() {');
const fim=base.indexOf('    let salvamentoEmAndamento = false;',init);
assert.ok(init>0&&fim>init,'Reinicializador independente do reset não encontrado');
const codigo=base.slice(init,fim);
function navegar(url){
  const chamadas=[],sessao={access_token:'sessao-ficticia'},contexto={sigla:'BOPE',unidade_id:'unidade-ficticia'};
  const window={location:{href:url,replace(destino){chamadas.push(destino)}},SistemaAuth:{sessao,contexto}};
  class TempoFixo extends Date {static now(){return 1792100000000}}
  const iniciar=new Function('window','URL','Date',codigo+'return abrirNovoFormularioAposSalvar;')(window,URL,TempoFixo);
  iniciar();
  assert.equal(chamadas.length,1,'Navegação deve ocorrer uma única vez');
  assert.equal(window.SistemaAuth.sessao,sessao,'Sessão deve continuar intacta');
  assert.equal(window.SistemaAuth.contexto,contexto,'Unidade ativa deve continuar intacta');
  return new URL(chamadas[0]);
}
const novoBOPE=navegar('https://site.exemplo/cadastro.html?id=antigo&retorno=auditoria.html&unidade=BOPE');
assert.equal(novoBOPE.pathname,'/cadastro.html');
assert.equal(novoBOPE.searchParams.has('id'),false);
assert.equal(novoBOPE.searchParams.has('retorno'),false);
assert.equal(novoBOPE.searchParams.get('novo'),'1792100000000');
assert.equal(novoBOPE.searchParams.get('unidade'),'BOPE');
assert.equal(novoBOPE.origin,'https://site.exemplo');
const novoBase=navegar('https://site.exemplo/cadastro-base.html?unidade=2BPM');
assert.equal(novoBase.pathname,'/cadastro-base.html');
assert.equal(novoBase.searchParams.get('unidade'),'2BPM');
assert.equal(novoBase.searchParams.has('novo'),true);
assert.equal(navegar('https://site.exemplo/cadastro.html?novo=anterior').searchParams.get('novo'),'1792100000000');

// A saída ocorre depois que o Supabase confirmou sucesso, jamais no erro.
// A edição mantém o redirecionamento anterior; nenhum form.reset() parcial.
const submit=base.slice(base.indexOf('    formulario.addEventListener("submit"'),base.lastIndexOf('  </script>'));
const pErro=submit.indexOf('        if (error) {');
const pEdicao=submit.indexOf('        if (idEdicao) {',pErro);
const pSucesso=submit.indexOf('        alert("Ocorrência salva com sucesso!");');
const pNavegar=submit.indexOf('        abrirNovoFormularioAposSalvar();');
assert.ok(pErro>0&&pEdicao>pErro&&pSucesso>pEdicao&&pNavegar>pSucesso);
assert.match(submit,/if \(error\) \{[\s\S]*?alert\("Erro ao salvar a ocorrência: " \+ error\.message\);\s*return;/);
assert.match(submit,/if \(idEdicao\) \{\s*importacaoPdfPendente = false;\s*alert\("Alterações salvas com sucesso!"\);\s*navegacaoAposGravacao = true;\s*location\.href = "consulta\.html\?q="/);
assert.match(submit,/if \(salvamentoEmAndamento\) return;/);
assert.match(submit,/salvamentoEmAndamento = true;/);
assert.match(submit,/finally \{\s*if \(!navegacaoAposGravacao\) \{\s*salvamentoEmAndamento = false;/);
assert.match(submit,/alert\("Ocorrência salva com sucesso!"\);\s*navegacaoAposGravacao = true;[\s\S]*?abrirNovoFormularioAposSalvar\(\)/);
assert.doesNotMatch(submit,/formulario\.reset\(\)/);
assert.doesNotMatch(submit,/replaceChildren\(\)[\s\S]*?Ocorrência salva com sucesso/);
assert.doesNotMatch(codigo,/localStorage|sessionStorage|signOut|setContexto/);

// Integração real: executa o transformador do cadastro com contexto institucional,
// preservando seletor específico BOPE e módulo ambiental da CIPA.
const integradorScript=integrador.slice(integrador.lastIndexOf('<script>')+8,integrador.lastIndexOf('</script>'));
async function construir(sigla){
  let htmlFinal=null;
  const win={SistemaAuth:{ready:Promise.resolve({contexto:{sigla}})},location:{replace(){throw Error('Redirecionamento indevido')}}};
  const doc={open(){},write(html){htmlFinal=html},close(){}};
  const buscar=async()=>({ok:true,text:async()=>base});
  await new Function('window','document','fetch','console','return '+integradorScript.trim())(
    win,doc,buscar,console);
  assert.ok(htmlFinal&&htmlFinal.includes('abrirNovoFormularioAposSalvar()'));
  assert.ok(htmlFinal.includes('<form id="formOcorrencia" novalidate autocomplete="off">'));
  return htmlFinal;
}
(async()=>{
 const bope=await construir('BOPE');
 assert.match(bope,/id="subunidadeOperacional"/);
 assert.match(bope,/Força Tática, Choque, Canil ou GATE/);
 assert.match(bope,/subunidade_operacional_id: subunidadeOperacional/);
 assert.match(bope,/sincronizarGrupamentoComTipo/);
 const cipa=await construir('CIPA');
 assert.match(cipa,/if \(window\.CipaCadastro\?\.salvar\) await window\.CipaCadastro\.salvar\(ocorrenciaSalvaId\)/);
 assert.ok(cipa.indexOf('await window.CipaCadastro.salvar(ocorrenciaSalvaId)')<cipa.indexOf('abrirNovoFormularioAposSalvar();'));
 const bpm=await construir('2BPM');
 assert.doesNotMatch(bpm,/id="subunidadeOperacional"/);
 assert.match(bpm,/abrirNovoFormularioAposSalvar\(\)/);
 console.log('PASS: importação/conferência preservadas, nova página após confirmação, contexto, falha, edição, BOPE, CIPA e BPM.');
})().catch(erro=>{console.error(erro);process.exitCode=1});
