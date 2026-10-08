const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const cipa=fs.readFileSync(path.join(root,'cipa-cadastro.js'),'utf8');
const cad=fs.readFileSync(path.join(root,'cadastro.html'),'utf8');
const migrations=fs.readdirSync(path.join(root,'supabase','migrations'));
const migrationFile=migrations.find(name=>name.endsWith('_cipa_catalogo_fauna_roraima.sql'));
assert.ok(migrationFile,'migração do catálogo ausente');
const sql=fs.readFileSync(path.join(root,'supabase','migrations',migrationFile),'utf8');

assert.match(sql,/create table if not exists public\.cipa_catalogo_animais/);
assert.match(sql,/add column if not exists animal_catalogo_id uuid/);
assert.match(sql,/alter table public\.cipa_catalogo_animais enable row level security/);
assert.match(sql,/revoke all on public\.cipa_catalogo_animais from anon/);
assert.match(sql,/grant select,insert on public\.cipa_catalogo_animais to authenticated/);
assert.match(sql,/private\.pode_escrever_operacional\(\)/);
assert.match(sql,/origem='USUARIO'/);
assert.match(sql,/on conflict do nothing/);
assert.match(sql,/Galo','Gallus gallus domesticus/);
assert.match(sql,/Tracajá','Podocnemis unifilis/);
assert.match(sql,/Arara-canindé','Ara ararauna/);
assert.match(sql,/Onça-pintada','Panthera onca/);

assert.doesNotThrow(()=>new Function(cipa),'cipa-cadastro.js compila');
assert.match(cipa,/Fauna \/ Animais Envolvidos/);
assert.match(cipa,/id="cipaFaunaOpcoes"/);
assert.match(cipa,/data-fauna-novo/);
assert.match(cipa,/id="cipaFaunaNovoPainel"/);
assert.match(cipa,/id="cipaFaunaNovoNome"/);
assert.match(cipa,/id="cipaFaunaNovoCientifico"/);
assert.match(cipa,/id="cipaFaunaNovoGrupo"/);
assert.match(cipa,/cipa_catalogo_animais/);
assert.match(cipa,/animal_catalogo_id/);
assert.match(cipa,/revisao_taxonomica_pendente:!cientifico/);
assert.match(cipa,/readonly value=/);
assert.match(cipa,/numero_tr/);
assert.match(cipa,/quantidade/);
assert.match(cipa,/Use o botão \+/);
assert.match(cad,/cipa-cadastro\.js/);

// Exercita a normalização efetivamente presente no módulo, sem mock do navegador.
const match=cipa.match(/^\s*const normalizarFauna=[^\n]+/m);
assert.ok(match,'normalizador de espécies não encontrado');
const normalizar=new Function(match[0]+';return normalizarFauna;')();
assert.equal(normalizar(' Tracajá  '),normalizar('TRACAJA'));
assert.equal(normalizar(' ONÇA-PINTADA '),normalizar('onça-pintada'));
assert.equal(normalizar(' Galo  doméstico '),normalizar('galo domestico'));

const seed=(sql.match(/,\s*'INICIAL'\)/g)||[]).length;
assert.equal(seed,50,'esperados 50 animais no catálogo inicial');
console.log('PASS: catálogo 50 animais, RLS, busca com acentos, vínculo fauna, campo científico e inclusão +.');
