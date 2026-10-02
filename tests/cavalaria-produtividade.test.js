const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

const page=fs.readFileSync(path.join(root,'cavalaria-produtividade.html'),'utf8');
const auth=fs.readFileSync(path.join(root,'auth-config.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261002154000_fase3u_produtividade_cavalaria.sql'),'utf8');

assert.match(page,/Produtividade da Cavalaria/i);
assert.match(page,/POLICIAMENTO_MOTORIZADO/);
assert.match(page,/POLICIAMENTO_MONTADO/);
assert.match(page,/POLICIAMENTO_OPERACOES/);
assert.match(page,/POLICIAMENTO_COMUNITARIO/);
assert.match(page,/VISITA_TECNICA/);
assert.match(page,/REPRESENTACAO_INSTITUCIONAL/);
assert.match(page,/abordagens_pessoas/);
assert.match(page,/rops_produzidos/);
assert.match(page,/solipedes/);
assert.match(page,/viaturas/);

assert.match(auth,/"cavalaria-produtividade\.html":"cadastro"/);
assert.match(auth,/"cavalaria-produtividade\.html":"PRODUTIVIDADE_CAVALARIA"/);
assert.match(index,/data-module="PRODUTIVIDADE_CAVALARIA"/);

assert.match(migration,/create table if not exists public\.cavalaria_servicos_produtividade/i);
assert.match(migration,/enable row level security/i);
assert.match(migration,/upper\(u\.sigla\) = 'CAVALARIA'/i);
assert.match(migration,/revoke all on public\.cavalaria_servicos_produtividade from authenticated/i);
assert.match(migration,/grant select,insert,update,delete on public\.cavalaria_servicos_produtividade to authenticated/i);
assert.doesNotMatch(migration,/grant .* to anon/i);

console.log('Cavalaria: módulo e cadastro de produtividade preparados com isolamento por unidade.');
