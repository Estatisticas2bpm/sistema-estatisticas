-- CIPG: escala de 24 horas, sem alterar turnos existentes nem o turno do fato.
alter table public.cipg_servicos_guarda drop constraint cipg_livro_turno_check;
alter table public.cipg_servicos_guarda add constraint cipg_livro_turno_check check (turno_cipg is null or turno_cipg in ('1','2','24H'));
