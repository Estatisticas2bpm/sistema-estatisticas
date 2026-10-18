-- CIPTUR: resposta Sim/Não sobre realização do teste de etilômetro no A.I.
-- NULL preserva corretamente o estado "não informado" dos autos antigos.
-- Os novos lançamentos exigem resposta no formulário; não alterar dados históricos.
alter table public.ciptur_autos_infracao
  add column if not exists houve_teste_etilometro boolean;

comment on column public.ciptur_autos_infracao.houve_teste_etilometro is
  'Teste de etilômetro realizado: true = sim; false = não; NULL = não informado (registros legados).';
