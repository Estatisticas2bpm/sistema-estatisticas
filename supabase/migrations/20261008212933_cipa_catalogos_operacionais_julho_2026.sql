-- Catálogos operacionais encontrados nas colunas R/S e K da planilha da CIPA (julho/2026).
-- Idempotente; o valor de relator é um candidato de catálogo, não uma afirmação
-- de que ele era comandante naquela ocorrência.
insert into public.comandantes(nome)
select p.nome from (values
  ('CB PM ANDSON'),
  ('CB PM FERRAZ'),
  ('CB PM JOHNSON'),
  ('CB PM K. FERREIRA'),
  ('CB PM PAULINELLI'),
  ('CB PM RALDEFRANK'),
  ('CB PM TUPINAMBÁ'),
  ('SGT PM DHIONY'),
  ('SGT PM FABIANA'),
  ('SGT PM GONDIN'),
  ('SGT PM JONAS VIEIRA'),
  ('SGT PM LEIA SANTIAGO'),
  ('SGT PM VALDECIR'),
  ('SGT PM VILCIMAR'),
  ('TEN PM FRANCISCA'),
  ('TEN PM SOBRAL')
) p(nome)
on conflict (nome) do nothing;

insert into public.tipos_ocorrencia(nome,categoria,ativo,ordem)
select t.nome,t.categoria,true,110 from (values
  ('DESMATAMENTO', 'Meio ambiente'),
  ('RESGATE DE ANIMAL', 'Assistencial'),
  ('SALVAMENTO TERRESTRE', 'Assistencial'),
  ('PATRULHAMENTO FLUVIAL', 'Patrulhamento'),
  ('PATRULHAMENTO PREVENTIVO', 'Patrulhamento'),
  ('EDUCAÇÃO AMBIENTAL', 'Meio ambiente'),
  ('POLUIÇÃO SONORA', 'Meio ambiente'),
  ('EXTRAÇÃO DE MINERAIS', 'Meio ambiente'),
  ('QUEBRA DE EMBARGO', 'Meio ambiente'),
  ('NOTIFICAÇÃO DE EMBARGO', 'Meio ambiente'),
  ('NOTIFICAÇÃO DE DESMATAMENTO', 'Meio ambiente'),
  ('OMISSÃO DE CAUTELA DE ANIMAL', 'Meio ambiente'),
  ('AÇÃO SOCIAL', 'Assistencial'),
  ('USO DO FOGO', 'Meio ambiente')
) t(nome,categoria)
on conflict (nome) do nothing;

-- Alias de digitação não gera novo tipo:
-- MAUS TRATOS = MAUS-TRATOS; PERTUBAÇÃO DO SOSSEGO =
-- PERTURBAÇÃO DO TRABALHO OU SOSSEGO ALHEIOS.
-- BR 174 é descrição de local e não natureza criminal.
