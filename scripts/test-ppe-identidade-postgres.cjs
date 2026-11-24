'use strict';
// Integração em PostgreSQL 17 embarcado, sem rede e sem credenciais.
// PPE_PGLITE_PATH aponta para a instalação pinada de @electric-sql/pglite 0.3.14.
const {PGlite}=require(process.env.PPE_PGLITE_PATH||'@electric-sql/pglite');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.join(__dirname,'../supabase/migrations');
const arquivo=(nome)=>fs.readFileSync(path.join(dir,nome),'utf8');
const funcao=(sql,nome)=>{
 const inicio=new RegExp('create(?: or replace)? function '+nome.replaceAll('.','\\.')+'\\(','i').exec(sql)?.index;
 assert.notEqual(inicio,undefined,nome);
 const fonte=sql.slice(inicio);
 const delimitador=/\bas\s+(\$[a-z_]*\$)/i.exec(fonte);
 const fim=fonte.indexOf(delimitador[1],delimitador.index+delimitador[0].length);
 assert.ok(fim>0,nome);
 return fonte.slice(0,fim+delimitador[1].length)+';';
};
const tentativa='TENTATIVA DE IMPORTUNAÇÃO SEXUAL (ART. 215-A DO CPB) (VIOLÊNCIA DOMÉSTICA CONTRA A MULHER)';
const consumada='IMPORTUNAÇÃO SEXUAL (ART. 215-A DO CPB)';
const lei='ART. 215-A DO CPB';
const entrada=(codigo_ppe,descricao_original,fundamentacao_legal=null,meios_empregados=['Não Houve'])=>({codigo_ppe,descricao_original,fundamentacao_legal,meios_empregados});

(async()=>{
 const db=new PGlite();
 try {
  await db.exec(`
   create schema auth; create schema private;
   create role anon; create role authenticated;
   create table auth.users(id uuid primary key);
   create table public.unidades(id uuid primary key);
   create table public.ocorrencias(id uuid primary key default gen_random_uuid(),unidade_id uuid,ocorrencia text,crime text,naturezas_itens jsonb,crimes_itens jsonb);
   create table public.tipos_ocorrencia(id bigint generated always as identity primary key,nome text unique,categoria text,ativo boolean default true,ordem integer default 0);
   create table public.subtipos_ocorrencia(id bigint generated always as identity,tipo_id bigint,nome text,ativo boolean default true,fundamento_legal text);
   create table public.bairros(nome text,ativo boolean); create table public.locais_apresentacao(nome text,ativo boolean);
   create table public.enderecos_padronizados(logradouro text,bairro text,latitude numeric,longitude numeric,ativo boolean);
   create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
   create function private.usuario_ativo() returns boolean language sql stable as $$ select coalesce(current_setting('fixture.perfil',true),'') in ('ADMIN','OPERADOR','LEITURA') $$;
   create function private.perfil_atual() returns text language sql stable as $$ select current_setting('fixture.perfil',true) $$;
   create function private.unidades_acessiveis_atual() returns uuid[] language sql stable as $$ select array[]::uuid[] $$;
   create function private.pode_escrever_operacional() returns boolean language sql stable as $$ select coalesce(current_setting('fixture.perfil',true),'') in ('ADMIN','OPERADOR') $$;
   grant usage on schema private to authenticated;
   grant insert,select,update on public.ocorrencias to authenticated;
   alter table public.ocorrencias enable row level security;
   create policy isolamento_fixture on public.ocorrencias for all to authenticated
    using (unidade_id::text=current_setting('fixture.unidade',true))
    with check (unidade_id::text=current_setting('fixture.unidade',true));
  `);
  await db.exec(arquivo('20261119143000_ppe_catalogo_documental_fase1.sql'));
  const f=arquivo('20261119143200_ppe_fundamento_original_e_inclusao_admin.sql');
  await db.exec('alter table public.naturezas_ppe add column fundamentacao_original text check(length(fundamentacao_original)<=300);');
  for(const nome of ['public.ppe_admin_criar','public.ppe_catalogar_extracao'])await db.exec(funcao(f,nome));
  await db.exec(arquivo('20261119143300_ppe_classificacao_selecao_auditada.sql').split(/-- RPC administrativa/i)[0].split(/create (?:or replace )?function public\.ppe_admin_associar_historico/i)[0]);
  const p=arquivo('20261119150000_ppe_integrar_catalogo_tipo_ocorrencia.sql');
  await db.exec(p.slice(0,p.indexOf('create function private.ppe_integrar_tipo')));
  await db.exec('alter table public.ppe_tipos_integracao add column nome_tipo_vinculado text;');
  const i=arquivo('20261119151000_ppe_vinculo_ortografico_1095.sql');
  await db.exec(funcao(i,'private.ppe_integrar_tipo'));
  await db.exec(funcao(p,'private.ppe_integrar_tipo_trigger'));
  await db.exec('create trigger trg_ppe_integrar_tipo after insert or update of descricao_padronizada,status_validacao,ativo on public.naturezas_ppe for each row execute function private.ppe_integrar_tipo_trigger();');
  await db.exec(funcao(i,'public.obter_catalogos_cadastro'));
  const m=arquivo('20261119153000_naturezas_meios_por_ocorrencia.sql');
  await db.exec('alter table public.ocorrencias add column naturezas_meios jsonb;');
  await db.exec(funcao(m,'private.validar_naturezas_meios'));
  await db.exec('create trigger validar_naturezas_meios before insert or update on public.ocorrencias for each row execute function private.validar_naturezas_meios();');
  const [unidade,outra]=['00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000012'];
  await db.exec(`set fixture.perfil='OPERADOR'; set fixture.unidade='${unidade}';`);
  const um=async(sql,args)=> (await db.query(sql,args)).rows[0];
  const catalogar=async(...itens)=>(await um('select public.ppe_catalogar_extracao($1::jsonb) as res',[JSON.stringify(itens)])).res;
  const [existente]=await catalogar(entrada('20210',tentativa,lei));
  const legado=await um(`insert into public.ocorrencias(unidade_id,ocorrencia,ppe_naturezas_originais) values($1,$2,$3) returning id`,[unidade,tentativa,JSON.stringify([entrada('20210',tentativa,lei)])]);
  await catalogar(entrada('20210',consumada,lei)); // reproduz a quarentena antiga
  const estados=()=>um(`select
    (select jsonb_agg(to_jsonb(o) order by o.id) from public.ocorrencias o) as bos,
    (select jsonb_agg(to_jsonb(v) order by v.ocorrencia_id,v.natureza_id,v.origem) from public.ocorrencias_naturezas_ppe v) as vinculos,
    (select to_jsonb(n) from public.naturezas_ppe n where codigo_ppe='20210') as original`);
  const antes=await estados();
  assert.equal(antes.original.status_validacao,'DIVERGENTE');
  const migracao=fs.readdirSync(dir).find(n=>n.endsWith('_ppe_identidade_por_descricao.sql'));
  await db.exec('begin;\n'+arquivo(migracao)+'\ncommit;');
  assert.deepEqual(await estados(),antes,'a migração não escreve no histórico nem reativa a tentativa');
  const [nova]=await catalogar(entrada('20210',consumada,lei));
  assert.equal(nova.situacao,'DISPONIVEL');assert.notEqual(nova.id,existente.id);
  assert.equal((await um('select codigo_ppe from public.naturezas_ppe where id=$1',[nova.id])).codigo_ppe,null);
  const [reemissao,semCodigo]=await catalogar(entrada('999000',consumada.toLowerCase(),lei),entrada(null,consumada,lei));
  assert.equal(reemissao.id,nova.id);assert.equal(semCodigo.id,nova.id);
  assert.deepEqual((await catalogar(entrada('20210',consumada,lei)))[0],nova);
  const [incompativel]=await catalogar(entrada('20210',consumada,'ART. 217-A DO CPB'));
  assert.equal(incompativel.situacao,'REVISAO');assert.equal(incompativel.id,null);
  const [ativoA,ativoB]=await catalogar(entrada('99101','LESÃO SIMPLES'),entrada('99101','TENTATIVA DE LESÃO SIMPLES'));
  assert.equal(ativoA.situacao,'DISPONIVEL');assert.equal(ativoB.situacao,'DISPONIVEL');assert.notEqual(ativoA.tipo_id,ativoB.tipo_id);
  assert.equal((await um('select count(*)::int n from public.naturezas_ppe where id=any($1) and ativo',[[ativoA.id,ativoB.id]])).n,2);
  assert.equal((await um('select quantidade_registros n from public.naturezas_ppe where id=$1',[nova.id])).n,0);
  const tipos=(await um('select public.obter_catalogos_cadastro() as res')).res.tipos;
  assert.ok(tipos.some(t=>t.id===nova.tipo_id&&t.codigo_ppe===null&&t.nome===consumada));
  assert.ok(tipos.some(t=>t.id===ativoA.tipo_id));assert.ok(tipos.some(t=>t.id===ativoB.tipo_id));
  await assert.rejects(um('insert into public.ocorrencias(ppe_naturezas_originais,ppe_naturezas_selecionadas) values($1,$2) returning id',[JSON.stringify([entrada('99101','LESÃO SIMPLES')]),[ativoB.id]]),/justificativa/);
  await db.exec('set role authenticated;');
  const bo=await um(`insert into public.ocorrencias(unidade_id,ppe_naturezas_originais,ppe_naturezas_selecionadas,crimes_itens,naturezas_meios)
   values($1,$2,$3,$4,$5) returning id`,[unidade,JSON.stringify([entrada('999000',consumada,lei)]),[nova.id],
   JSON.stringify([{tipo_id:nova.tipo_id}]),JSON.stringify([{tipo_id:nova.tipo_id,codigo:null,meios_empregados:['Não Houve']}])]);
  await assert.rejects(um('insert into public.ocorrencias(unidade_id,ocorrencia) values($1,$2) returning id',[outra,consumada]),/row-level security/);
  assert.equal((await um('select count(*)::int n from public.naturezas_ppe_fontes')).n,0);
  await assert.rejects(db.exec("insert into public.naturezas_ppe_fontes(descricao_documento) values('TENTATIVA DE ESCRITA DIRETA');"),/permission denied/);
  await assert.rejects(um('update public.ocorrencias set ppe_naturezas_originais=$1 where id=$2 returning id',['[]',legado.id]),/preservada/);
  await db.exec("set fixture.perfil='LEITURA';");
  await assert.rejects(catalogar(entrada('99103','LEITURA NÃO PODE CATALOGAR')),/privilege/i);
  await db.exec("set fixture.perfil='ADMIN';");
  assert.ok((await um('select count(*)::int n from public.naturezas_ppe_fontes')).n>=6);
  await db.exec('reset role; set role anon;');
  await assert.rejects(catalogar(entrada('99104','ANÔNIMO NÃO PODE CATALOGAR')),/permission denied/);
  await db.exec('reset role;');
  const salvos=(await db.query('select natureza_id,origem from public.ocorrencias_naturezas_ppe where ocorrencia_id=$1 order by origem',[bo.id])).rows;
  assert.deepEqual(salvos,[{natureza_id:nova.id,origem:'ORIGINAL'},{natureza_id:nova.id,origem:'VALIDADA'}]);
  assert.equal((await um('select quantidade_registros n from public.naturezas_ppe where id=$1',[nova.id])).n,1);
  console.log('PASS PostgreSQL: descrição, colisões, reenvio, revisão, vínculo, meios, histórico e papéis.');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
