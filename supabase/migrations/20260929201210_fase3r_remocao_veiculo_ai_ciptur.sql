alter table public.ciptur_autos_infracao
  add column if not exists houve_remocao boolean not null default false,
  add column if not exists tipo_veiculo_removido text;

alter table public.ciptur_autos_infracao
  drop constraint if exists ciptur_autos_infracao_remocao_check;

alter table public.ciptur_autos_infracao
  add constraint ciptur_autos_infracao_remocao_check
  check (
    (houve_remocao = false and tipo_veiculo_removido is null)
    or
    (houve_remocao = true and tipo_veiculo_removido in ('CARRO','MOTO'))
  );
