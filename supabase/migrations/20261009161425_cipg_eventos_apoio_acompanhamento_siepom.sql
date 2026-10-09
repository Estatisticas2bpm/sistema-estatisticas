-- Coluna BC do levantamento SIEPOM: apoio/acompanhamento do evento.
-- Informação administrativa resumida, sem identificação pessoal ou dados médicos.
alter table public.cipg_eventos_guarda
  add column if not exists apoio_acompanhamento text
  check(apoio_acompanhamento is null or char_length(apoio_acompanhamento)<=160);
comment on column public.cipg_eventos_guarda.apoio_acompanhamento is
'Descrição administrativa breve do apoio prestado. Não registrar nomes de terceiros, quadro clínico nem prontuário.';
