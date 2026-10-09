-- O livro de servico da CIPG usa turno 08h-20h e 20h-08h.
-- Data/hora do acontecimento podem diferir da data do relatorio SEI.
alter table public.cipg_eventos_guarda
  add column if not exists data_evento date,
  add column if not exists hora_evento time;
comment on column public.cipg_eventos_guarda.hora_evento is
'Classificacao CIPG: 1º turno 08:00-19:59; 2º turno 20:00-07:59.';
