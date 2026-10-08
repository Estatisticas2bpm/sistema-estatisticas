-- CIPA: catálogo estatístico de animais. Não é ranking de tráfico ou crimes;
-- são opções iniciais que devem ser revisadas taxonomicamente quando necessário.
-- Referências de pesquisa: ICMBio (fauna de Roraima/Maracá e SALVE), IBAMA.
create table if not exists public.cipa_catalogo_animais (
  id uuid primary key default gen_random_uuid(),
  nome_popular text not null check (length(btrim(nome_popular)) between 2 and 100),
  nome_cientifico text check (nome_cientifico is null or length(btrim(nome_cientifico)) between 3 and 120),
  grupo text not null default 'OUTROS' check (grupo in ('AVES','MAMÍFEROS','RÉPTEIS','PEIXES','ANFÍBIOS','OUTROS')),
  origem text not null default 'USUARIO' check (origem in ('USUARIO','INICIAL')),
  revisao_taxonomica_pendente boolean not null default false,
  ativo boolean not null default true,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create unique index if not exists cipa_catalogo_animais_nome_unico
  on public.cipa_catalogo_animais (lower(btrim(nome_popular)));
create index if not exists cipa_catalogo_animais_busca
  on public.cipa_catalogo_animais (grupo,nome_popular);

alter table public.cipa_fauna
  add column if not exists animal_catalogo_id uuid
  references public.cipa_catalogo_animais(id) on delete restrict;

alter table public.cipa_catalogo_animais enable row level security;
revoke all on public.cipa_catalogo_animais from anon;
grant select,insert on public.cipa_catalogo_animais to authenticated;

drop policy if exists cipa_catalogo_animais_select on public.cipa_catalogo_animais;
create policy cipa_catalogo_animais_select on public.cipa_catalogo_animais
  for select to authenticated
  using (
    (select private.usuario_ativo()) and
    exists(select 1 from public.unidades u
      where u.id=(select private.unidade_atual()) and u.sigla='CIPA' and u.ativo=true)
  );

drop policy if exists cipa_catalogo_animais_insert on public.cipa_catalogo_animais;
create policy cipa_catalogo_animais_insert on public.cipa_catalogo_animais
  for insert to authenticated
  with check (
    (select private.pode_escrever_operacional()) and
    criado_por=(select auth.uid()) and
    origem='USUARIO' and
    exists(select 1 from public.unidades u
      where u.id=(select private.unidade_atual()) and u.sigla='CIPA' and u.ativo=true)
  );
-- Atualização e exclusão do catálogo não são expostas aos operadores:
-- a inclusão pelo "+" acrescenta espécies, sem sobrescrever as já aprovadas.

insert into public.cipa_catalogo_animais(nome_popular,nome_cientifico,grupo,origem)
values
  ('Galo','Gallus gallus domesticus','AVES','INICIAL'),
  ('Galinha','Gallus gallus domesticus','AVES','INICIAL'),
  ('Cachorro','Canis lupus familiaris','MAMÍFEROS','INICIAL'),
  ('Gato doméstico','Felis catus','MAMÍFEROS','INICIAL'),
  ('Cavalo','Equus caballus','MAMÍFEROS','INICIAL'),
  ('Curicaca','Theristicus caudatus','AVES','INICIAL'),
  ('Papagaio-do-mangue','Amazona amazonica','AVES','INICIAL'),
  ('Papagaio-moleiro','Amazona farinosa','AVES','INICIAL'),
  ('Arara-canindé','Ara ararauna','AVES','INICIAL'),
  ('Arara-piranga','Ara macao','AVES','INICIAL'),
  ('Arara-vermelha-grande','Ara chloropterus','AVES','INICIAL'),
  ('Tucano-de-papo-branco','Ramphastos tucanus','AVES','INICIAL'),
  ('Tucano-de-bico-preto','Ramphastos vitellinus','AVES','INICIAL'),
  ('Curió','Sporophila angolensis','AVES','INICIAL'),
  ('Canário-da-terra','Sicalis flaveola','AVES','INICIAL'),
  ('Mutum-poranga','Crax alector','AVES','INICIAL'),
  ('Gavião-real','Harpia harpyja','AVES','INICIAL'),
  ('Galo-da-serra','Rupicola rupicola','AVES','INICIAL'),
  ('Jabuti-tinga','Chelonoidis denticulatus','RÉPTEIS','INICIAL'),
  ('Jabuti-piranga','Chelonoidis carbonarius','RÉPTEIS','INICIAL'),
  ('Tracajá','Podocnemis unifilis','RÉPTEIS','INICIAL'),
  ('Tartaruga-da-amazônia','Podocnemis expansa','RÉPTEIS','INICIAL'),
  ('Jiboia','Boa constrictor','RÉPTEIS','INICIAL'),
  ('Sucuri-verde','Eunectes murinus','RÉPTEIS','INICIAL'),
  ('Iguana-verde','Iguana iguana','RÉPTEIS','INICIAL'),
  ('Jacaré-tinga','Caiman crocodilus','RÉPTEIS','INICIAL'),
  ('Jacaré-açu','Melanosuchus niger','RÉPTEIS','INICIAL'),
  ('Jacaré-diri-diri','Paleosuchus palpebrosus','RÉPTEIS','INICIAL'),
  ('Jacaré-pedra','Paleosuchus trigonatus','RÉPTEIS','INICIAL'),
  ('Cascavel-de-roraima','Crotalus ruruima','RÉPTEIS','INICIAL'),
  ('Onça-pintada','Panthera onca','MAMÍFEROS','INICIAL'),
  ('Onça-parda','Puma concolor','MAMÍFEROS','INICIAL'),
  ('Jaguatirica','Leopardus pardalis','MAMÍFEROS','INICIAL'),
  ('Anta','Tapirus terrestris','MAMÍFEROS','INICIAL'),
  ('Capivara','Hydrochoerus hydrochaeris','MAMÍFEROS','INICIAL'),
  ('Paca','Cuniculus paca','MAMÍFEROS','INICIAL'),
  ('Cutia-vermelha','Dasyprocta leporina','MAMÍFEROS','INICIAL'),
  ('Ariranha','Pteronura brasiliensis','MAMÍFEROS','INICIAL'),
  ('Lontra-neotropical','Lontra longicaudis','MAMÍFEROS','INICIAL'),
  ('Tamanduá-bandeira','Myrmecophaga tridactyla','MAMÍFEROS','INICIAL'),
  ('Tamanduá-mirim','Tamandua tetradactyla','MAMÍFEROS','INICIAL'),
  ('Tatu-canastra','Priodontes maximus','MAMÍFEROS','INICIAL'),
  ('Tatu-galinha','Dasypus novemcinctus','MAMÍFEROS','INICIAL'),
  ('Macaco-de-cheiro','Saimiri sciureus','MAMÍFEROS','INICIAL'),
  ('Macaco-prego','Sapajus apella','MAMÍFEROS','INICIAL'),
  ('Preguiça-de-três-dedos','Bradypus tridactylus','MAMÍFEROS','INICIAL'),
  ('Peixe-boi-da-amazônia','Trichechus inunguis','MAMÍFEROS','INICIAL'),
  ('Boto-cor-de-rosa','Inia geoffrensis','MAMÍFEROS','INICIAL'),
  ('Pirarucu','Arapaima gigas','PEIXES','INICIAL'),
  ('Aruanã-prateada','Osteoglossum bicirrhosum','PEIXES','INICIAL')
on conflict do nothing;
