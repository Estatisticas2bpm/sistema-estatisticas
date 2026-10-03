const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const ler = arquivo => fs.readFileSync(path.join(raiz, arquivo), 'utf8');
const index = ler('index.html');
const painel = ler('dashboard-cpc.html');
const migrations = fs.readdirSync(path.join(raiz, 'supabase', 'migrations'))
  .filter(nome => nome.endsWith('_fase3l_cockpit_executivo_cpc.sql'));

assert.equal(migrations.length, 1, 'deve existir uma única migration da Fase 3L');
const sql = ler(path.join('supabase', 'migrations', migrations[0]));
const territorial = ler(path.join('supabase', 'migrations', '20260928230846_fase3m_c_painel_cpc_territorial.sql'));

assert.match(index, /Panorama Operacional do CPC/);
assert.match(index, /id="cpcUnidadesPanel"/);
assert.match(index, /id="unidadeMapa"/);
assert.match(index, /id="areaTipoMapa"/);
assert.match(index, /id="areaValorMapa"/);
assert.match(index, /obter_home_cpc/);
assert.match(index, /obter_mapa_cpc/);
assert.match(index, /auth\.contexto&&auth\.contexto\.tipo==="COMANDO"/);
assert.match(index, /cpcPrimary/);
assert.match(index, /Todas as unidades subordinadas/);

assert.match(painel, /Central Executiva do CPC/);
assert.match(painel, /id="unidade"/);
assert.match(painel, /id="ocorrencia"/);
assert.match(painel, /id="bairro"/);
assert.match(painel, /id="sisc"/);
assert.match(painel, /id="companhia"/);
assert.match(painel, /id="turno"/);
assert.match(painel, /obter_painel_cpc_territorial/);
assert.match(painel, /Principais bairros/);
assert.match(painel, /Leitura executiva do período/);

assert.match(sql, /create or replace function public\.obter_home_cpc/i);
assert.match(sql, /create or replace function public\.obter_mapa_cpc/i);
assert.match(sql, /create or replace function public\.obter_painel_cpc_filtrado/i);
assert.match(territorial, /create or replace function public\.obter_painel_cpc_territorial/i);
assert.match(sql, /private\.unidade_atual\(\)/i);
assert.match(sql, /u\.tipo='COMANDO'/i);
assert.match(sql, /join descendentes d on d\.id=o\.unidade_id/i);
assert.match(sql, /p_unidade_id/i);
assert.match(sql, /p_area_tipo/i);
assert.match(sql, /top_bairros/i);
assert.doesNotMatch(sql, /security definer/i);
assert.doesNotMatch(index + painel + sql, /fe74963f-c11a-4d6f-84be-7dcd8e15ff59/i);
assert.doesNotMatch(index + painel + sql, /f09a10df-cd1d-48d1-a093-bf731906e175/i);

console.log('Fase 3L: contratos do cockpit executivo do CPC validados.');
