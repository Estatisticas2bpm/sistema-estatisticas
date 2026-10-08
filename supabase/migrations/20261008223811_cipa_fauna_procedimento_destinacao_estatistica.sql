-- CIPA: dados estritamente estatísticos preservando os formulários históricos.
-- A data/procedência/TR e campos administrativos existentes permanecem no banco.
alter table public.cipa_fauna
  add column if not exists procedimento text,
  add column if not exists destinacao text;

alter table public.cipa_autos_infracao
  add column if not exists tipo_infracao text;

alter table public.cipa_fauna
  drop constraint if exists cipa_fauna_procedimento_check;
alter table public.cipa_fauna
  add constraint cipa_fauna_procedimento_check check (
    procedimento is null or procedimento in
    ('APREENSÃO','RESGATE','RECOLHIMENTO','SOLTURA','CONSTATAÇÃO','OUTRO')
  );

alter table public.cipa_fauna
  drop constraint if exists cipa_fauna_destinacao_check;
alter table public.cipa_fauna
  add constraint cipa_fauna_destinacao_check check (
    destinacao is null or destinacao in
    ('MANTIDOS NO LOCAL SOB DEPÓSITO','CETAS','SOLTOS NA NATUREZA',
     'ENTREGUES A ÓRGÃO COMPETENTE','OUTRA DESTINAÇÃO')
  );

comment on column public.cipa_fauna.procedimento is
'Procedimento estatístico sobre o grupo de animais da ocorrência. Não representa somatório separado de indivíduos.';
comment on column public.cipa_fauna.destinacao is
'Destino ou custódia informados no PPE. NULL significa não informado, não presumir soltura nem CETAS.';
comment on column public.cipa_autos_infracao.tipo_infracao is
'Classificação estatística resumida da infração, independente da descrição e dos artigos legais.';

-- As tabelas já possuem RLS e privilégios específicos da CIPA.
revoke all on public.cipa_fauna,public.cipa_autos_infracao from anon;
grant select,insert,update,delete on public.cipa_fauna,public.cipa_autos_infracao to authenticated;
