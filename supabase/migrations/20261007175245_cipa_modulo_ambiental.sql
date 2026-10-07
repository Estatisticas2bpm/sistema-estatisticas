-- CIPA: módulo ambiental especializado. Um PPE/BO pode produzir vários documentos administrativos.
create table if not exists public.cipa_ocorrencias_ambientais (
  ocorrencia_id uuid primary key references public.ocorrencias(id) on delete cascade,
  ppe_original text, data_registro_inicio timestamptz, data_registro_fim timestamptz,
  area_tipo text check (area_tipo is null or area_tipo in ('URBANA','RURAL')),
  coordenadas_texto text, origem_atuacao text, documento_origem text, anexo_referencia text,
  criado_por uuid default auth.uid(), criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
create table if not exists public.cipa_autos_infracao (
  id uuid primary key default gen_random_uuid(), ocorrencia_id uuid not null references public.ocorrencias(id) on delete cascade,
  numero text not null, data_autuacao date, autuado text, tipo_sancao text, descricao_infracao text,
  art_lei_9605 text, art_dec_6514 text, outra_legislacao text,
  valor_multa numeric(14,2) check (valor_multa is null or valor_multa>=0),
  area_embargada_ha numeric(14,4) check (area_embargada_ha is null or area_embargada_ha>=0),
  fiscal_ambiental text, numero_notificacao text, processo_sei text,
  criado_por uuid default auth.uid(), criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
  unique(ocorrencia_id,numero)
);
create table if not exists public.cipa_termos_embargo (
  id uuid primary key default gen_random_uuid(), ocorrencia_id uuid not null references public.ocorrencias(id) on delete cascade,
  numero text not null, data_embargo date, auto_infracao_originario text, descricao text,
  area_embargada_ha numeric(14,4) check (area_embargada_ha is null or area_embargada_ha>=0),
  criado_por uuid default auth.uid(), criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
  unique(ocorrencia_id,numero)
);
create table if not exists public.cipa_autos_notificacao (
  id uuid primary key default gen_random_uuid(), ocorrencia_id uuid not null references public.ocorrencias(id) on delete cascade,
  numero text not null, data_notificacao date, hora_notificacao time, autuado text, descricao text, data_limite date, fiscal_ambiental text,
  criado_por uuid default auth.uid(), criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
  unique(ocorrencia_id,numero)
);
create table if not exists public.cipa_educacao_ambiental (
  id uuid primary key default gen_random_uuid(), ocorrencia_id uuid not null references public.ocorrencias(id) on delete cascade,
  data_acao date, publico_estimado integer check (publico_estimado is null or publico_estimado>=0), acao text, local_acao text,
  criado_por uuid default auth.uid(), criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
create table if not exists public.cipa_fauna (
  id uuid primary key default gen_random_uuid(), ocorrencia_id uuid not null references public.ocorrencias(id) on delete cascade,
  numero_tr text, data_registro date, procedencia text, nome_comum text not null, nome_cientifico text,
  quantidade integer not null default 1 check (quantidade>0),
  criado_por uuid default auth.uid(), criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
create table if not exists public.cipa_tdba (
  id uuid primary key default gen_random_uuid(), ocorrencia_id uuid not null references public.ocorrencias(id) on delete cascade,
  auto_infracao text, numero_tdba text, tipo text, apreensao text,
  quantidade numeric(14,3) check (quantidade is null or quantidade>=0), caracteristicas text,
  valor_bens numeric(14,2) check (valor_bens is null or valor_bens>=0), depositario_fiel text,
  criado_por uuid default auth.uid(), criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
create table if not exists public.cipa_tcos_ambientais (
  id uuid primary key default gen_random_uuid(), ocorrencia_id uuid not null references public.ocorrencias(id) on delete cascade,
  crime text, numero_processo_jecrim text, apreensoes text, responsavel text, autor text, vitima text,
  localidade text check (localidade is null or localidade in ('CAPITAL','INTERIOR')),
  criado_por uuid default auth.uid(), criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
create table if not exists public.cipa_pessoas_envolvidas (
  id uuid primary key default gen_random_uuid(), ocorrencia_id uuid not null references public.ocorrencias(id) on delete cascade,
  nome text not null, sexo_genero text, pais_origem text, situacao text, tipo_crime text,
  auto_resistencia_prisao boolean not null default false, numero_apf text, numero_arp text, conduzido boolean not null default false,
  criado_por uuid default auth.uid(), criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);

create index if not exists cipa_ai_ocorrencia_data_idx on public.cipa_autos_infracao(ocorrencia_id,data_autuacao);
create index if not exists cipa_embargo_ocorrencia_data_idx on public.cipa_termos_embargo(ocorrencia_id,data_embargo);
create index if not exists cipa_notificacao_ocorrencia_data_idx on public.cipa_autos_notificacao(ocorrencia_id,data_notificacao);
create index if not exists cipa_educacao_ocorrencia_data_idx on public.cipa_educacao_ambiental(ocorrencia_id,data_acao);
create index if not exists cipa_fauna_ocorrencia_data_idx on public.cipa_fauna(ocorrencia_id,data_registro);
create index if not exists cipa_tdba_ocorrencia_idx on public.cipa_tdba(ocorrencia_id);
create index if not exists cipa_tcos_ocorrencia_idx on public.cipa_tcos_ambientais(ocorrencia_id);
create index if not exists cipa_pessoas_ocorrencia_idx on public.cipa_pessoas_envolvidas(ocorrencia_id);

do $$
declare t text;
begin
 foreach t in array array['cipa_ocorrencias_ambientais','cipa_autos_infracao','cipa_termos_embargo','cipa_autos_notificacao','cipa_educacao_ambiental','cipa_fauna','cipa_tdba','cipa_tcos_ambientais','cipa_pessoas_envolvidas'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('revoke all on public.%I from anon',t);
  execute format('drop policy if exists auth_%s_select on public.%I',t,t);
  execute format('drop policy if exists auth_%s_insert on public.%I',t,t);
  execute format('drop policy if exists auth_%s_update on public.%I',t,t);
  execute format('drop policy if exists auth_%s_delete on public.%I',t,t);
  execute format('create policy auth_%1$s_select on public.%2$I for select to authenticated using ((select private.usuario_ativo()) and exists (select 1 from public.ocorrencias o where o.id=ocorrencia_id and private.pode_acessar_unidade(o.unidade_id)))',t,t);
  execute format('create policy auth_%1$s_insert on public.%2$I for insert to authenticated with check ((select private.pode_escrever_operacional()) and exists (select 1 from public.ocorrencias o join public.unidades u on u.id=o.unidade_id where o.id=ocorrencia_id and o.unidade_id=(select private.unidade_atual()) and u.sigla=''CIPA'' and u.ativo=true))',t,t);
  execute format('create policy auth_%1$s_update on public.%2$I for update to authenticated using (exists (select 1 from public.ocorrencias o join public.unidades u on u.id=o.unidade_id where o.id=ocorrencia_id and o.unidade_id=(select private.unidade_atual()) and u.sigla=''CIPA'' and u.ativo=true) and ((select private.pode_administrar_dados()) or criado_por=(select auth.uid()))) with check (exists (select 1 from public.ocorrencias o join public.unidades u on u.id=o.unidade_id where o.id=ocorrencia_id and o.unidade_id=(select private.unidade_atual()) and u.sigla=''CIPA'' and u.ativo=true) and ((select private.pode_administrar_dados()) or criado_por=(select auth.uid())))',t,t);
  execute format('create policy auth_%1$s_delete on public.%2$I for delete to authenticated using (exists (select 1 from public.ocorrencias o join public.unidades u on u.id=o.unidade_id where o.id=ocorrencia_id and o.unidade_id=(select private.unidade_atual()) and u.sigla=''CIPA'' and u.ativo=true) and ((select private.pode_administrar_dados()) or criado_por=(select auth.uid())))',t,t);
 end loop;
end $$;

create or replace function public.obter_dados_dashboard_territorial(data_inicio date default null::date, data_fim date default null::date)
returns jsonb language sql stable set search_path to 'public','private'
as $$
with base as materialized (select value item from jsonb_array_elements(public.obter_dados_dashboard(data_inicio,data_fim))),
mapa as materialized (
 select al.alias_chave,jsonb_build_object('bairro_id',b.id,'bairro',b.nome,'bairro_decreto',b.nome_decreto,'tipo_local',b.tipo_local,'setor',st.codigo,'sisc',si.codigo,'aisc',a.codigo,'unidade_id',a.unidade_id,'unidade_sigla',u.sigla,'unidade_nome',u.nome,'unidade_referencia_decreto',a.unidade_referencia_decreto,'base_legal',a.base_legal,'artigo_referencia',b.artigo_referencia) info
 from public.territorio_cpc_bairro_aliases al join public.territorio_cpc_bairros b on b.id=al.bairro_id and b.ativo=true
 join public.territorio_cpc_setores st on st.id=b.setor_id and st.ativo=true join public.territorio_cpc_sisc si on si.id=st.sisc_id and si.ativo=true
 join public.territorio_cpc_aisc a on a.id=si.aisc_id and a.ativo=true join public.unidades u on u.id=a.unidade_id),
enriquecido as (
 select b.item||jsonb_build_object('aisc',m.info->>'aisc','sisc',coalesce(nullif(b.item->>'sisc',''),m.info->>'sisc'),'setor',m.info->>'setor','territorio_bairro',m.info->>'bairro','unidade_territorial_id',m.info->>'unidade_id','unidade_territorial_sigla',m.info->>'unidade_sigla','unidade_id',o.unidade_id,'unidade_sigla',u.sigla,'unidade_nome',u.nome,'subunidade_operacional_id',o.subunidade_operacional_id,'subunidade_operacional_sigla',su.sigla,'subunidade_operacional_nome',su.nome,'cipa_area_tipo',ca.area_tipo,'cipa_origem_atuacao',ca.origem_atuacao,'cipa_coordenadas_texto',ca.coordenadas_texto,'cipa_documento_origem',ca.documento_origem,'cipa_ppe_original',ca.ppe_original,'cipa_data_registro_inicio',ca.data_registro_inicio) item
 from base b join public.ocorrencias o on o.id=(b.item->>'id')::uuid join public.unidades u on u.id=o.unidade_id
 left join public.unidades su on su.id=o.subunidade_operacional_id left join public.cipa_ocorrencias_ambientais ca on ca.ocorrencia_id=o.id
 left join mapa m on m.alias_chave=public.normalizar_bairro_sisc(b.item->>'bairro'))
select coalesce(jsonb_agg(item order by item->>'data_ocorrencia' desc),'[]'::jsonb) from enriquecido $$;

comment on table public.cipa_ocorrencias_ambientais is 'Extensão ambiental 1:1 do PPE/BO da CIPA.';
comment on table public.cipa_autos_infracao is 'Autos de Infração Ambiental produzidos pela CIPA; um PPE pode possuir vários autos.';
comment on table public.cipa_termos_embargo is 'Termos de Embargo/Interdição vinculados aos PPEs da CIPA.';
comment on table public.cipa_fauna is 'Registros de fauna/TR vinculados às ocorrências da CIPA.';
