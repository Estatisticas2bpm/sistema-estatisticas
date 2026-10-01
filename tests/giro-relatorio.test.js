const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const report=fs.readFileSync(path.join(root,'relatorio.html'),'utf8');
const dashboard=fs.readFileSync(path.join(root,'dashboard.html'),'utf8');
const logo=fs.readFileSync(path.join(root,'assets/logos/giro-brasao.svg'),'utf8');

const a=report.indexOf('async function buildGiro()');
const b=report.indexOf('async function build(){',a);
assert.ok(a>=0&&b>a,'buildGiro deve existir antes do relatório genérico');
const giro=report.slice(a,b);

assert.match(report,/function ehGiroRel\(\)/);
assert.match(report,/if\(ehGiroRel\(\)\)return buildGiro\(\)/);
assert.match(report,/window\.SistemaAuth\?\.contexto/);
assert.match(report,/Grupamento Independente de Intervenção Rápida Ostensiva - GIRO/);
assert.match(report,/const arquivo=\x60\$\{titulo\} - \$\{unidadeRel\(\)\.sigla\}\x60/);
assert.match(report,/#sistemaUsuarioSessao\{display:none!important\}/);

assert.match(giro,/giro_abordagens/);
assert.match(giro,/T00:00:00-04:00/);
assert.match(giro,/T23:59:59\.999-04:00/);
assert.match(giro,/RELATÓRIO DE PRODUTIVIDADE OPERACIONAL - GIRO/);
assert.match(giro,/assets\/logos\/giro-brasao\.svg/);
assert.doesNotMatch(giro,/<div class="cover-brand">SIE-CPC<\/div>/);
assert.match(report,/\.cover-brand-img\{/);
assert.match(logo,/<svg[\s\S]*viewBox="94 172 407 532"/);
assert.match(giro,/ABORDAGENS DE RUA - PRODUTIVIDADE PREVENTIVA/);
assert.match(giro,/TOTAL DE ABORDAGENS/);
assert.match(giro,/PESSOAS ABORDADAS/);
assert.match(giro,/MOTOCICLETAS/);
assert.match(giro,/VEÍCULOS/);
assert.match(giro,/BAIRROS COM MAIS ABORDAGENS/);
assert.match(giro,/RUAS \/ LOGRADOUROS COM MAIS ABORDAGENS/);
assert.match(giro,/ABORDAGENS POR HORÁRIO/);
assert.match(giro,/ABORDAGENS POR DIA DA SEMANA/);
assert.match(giro,/PERFIL DAS PESSOAS ABORDADAS/);
assert.match(giro,/NACIONALIDADE/);
assert.match(giro,/FAIXA ETÁRIA/);
assert.match(giro,/RESULTADOS OPERACIONAIS E APREENSÕES/);
assert.match(giro,/COMPARATIVO DE PRODUTIVIDADE DO GIRO/);
assert.match(giro,/ABORDAGENS DE RUA/);
assert.match(giro,/PRISÕES/);

assert.doesNotMatch(giro,/TÁTICO SETORIAL/);
assert.doesNotMatch(giro,/AUTO DE INFRAÇÃO/);
assert.doesNotMatch(giro,/AUTO DE REMOÇÃO/);
assert.doesNotMatch(giro,/VTR AME/);
assert.doesNotMatch(giro,/PR6/);
assert.doesNotMatch(giro,/PROGRAMAS DE PREVENÇÃO À CRIMINALIDADE/);

assert.match(report,/if\(ehGiroRel\(\)\)\{[\s\S]*?siscWrap[\s\S]*?companhiaWrap/);
assert.match(dashboard,/relatorio\.html\?v=20261001-girorel2/);

console.log('GIRO: relatório estatístico específico validado.');
