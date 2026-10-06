const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const relatorio=fs.readFileSync(path.join(root,'relatorio.html'),'utf8');

assert.ok(relatorio.includes("const perfil=window.SistemaAuth?.perfil||{};"));
assert.ok(relatorio.includes("const posto=S(perfil.posto_graduacao);"));
assert.ok(relatorio.includes("const nome=S(perfil.nome);"));
assert.ok(relatorio.includes("const nomeGuerra=S(perfil.nome_guerra);"));
assert.ok(relatorio.includes("identificacao+=(identificacao?' — ':'')+nomeGuerra;"));
assert.ok(relatorio.includes("const funcao=eh2BpmRel()?'Auxiliar da P2/P3 — 2º BPM':funcaoPadrao;"));
assert.ok(relatorio.includes("return '<b>'+E(identificacao)+'</b><br>'+E(funcao);"));

// O responsável deve ser preenchido nos três modelos de relatório existentes.
assert.match(relatorio,/assinaturaResponsavelRelatorio\('Auxiliar da SIE-CPC \/ GIRO'\)/);
assert.match(relatorio,/assinaturaResponsavelRelatorio\('Auxiliar da SIE-CPC \/ CIPTUR'\)/);
assert.match(relatorio,/assinaturaResponsavelRelatorio\('Auxiliar da SIE-CPC \/ '\+unidadeRel\(\)\.sigla\)/);

console.log('Relatório: responsável preenchido a partir do usuário logado, com função específica do 2º BPM.');
