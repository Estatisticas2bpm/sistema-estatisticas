-- A área de desmatamento constatada não é sinônimo da área embargada.
-- Só preencher a partir de medição expressamente registrada no PPE/auto.
alter table public.cipa_autos_infracao
  add column if not exists area_desmatada_constatada_ha numeric(14,4)
    check(area_desmatada_constatada_ha is null or area_desmatada_constatada_ha >= 0);
comment on column public.cipa_autos_infracao.area_desmatada_constatada_ha is
'Área desmatada explicitamente constatada no documento em hectares; NULL = não informada. Independente da área embargada.';
