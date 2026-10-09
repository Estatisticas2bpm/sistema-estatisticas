-- CIPG: reproduzir colunas do livro de serviço da ficha SIEPOM.
-- Apenas militares envolvidos em evento têm registro de evento, sem dados clínicos identificáveis.
alter table public.cipg_servicos_guarda
 add column if not exists turno_cipg text,
 add column if not exists comandante text,
 add column if not exists recebeu_de text,
 add column if not exists passou_para text,
 add column if not exists km_inicial numeric(12,2),
 add column if not exists km_final numeric(12,2),
 add column if not exists outros_solicitacoes text;
alter table public.cipg_servicos_guarda
 drop constraint if exists cipg_livro_turno_check;
alter table public.cipg_servicos_guarda
 add constraint cipg_livro_turno_check check(turno_cipg is null or turno_cipg in ('1','2'));
alter table public.cipg_servicos_guarda
 drop constraint if exists cipg_livro_km_check;
alter table public.cipg_servicos_guarda
 add constraint cipg_livro_km_check check (
  (km_inicial is null or km_inicial >= 0)
  and (km_final is null or km_final >= 0)
  and (km_inicial is null or km_final is null or km_final >= km_inicial)
 );
alter table public.cipg_servicos_guarda
 drop constraint if exists cipg_livro_resumo_check;
alter table public.cipg_servicos_guarda
 add constraint cipg_livro_resumo_check check(
  (comandante is null or char_length(comandante)<=120)
  and (recebeu_de is null or char_length(recebeu_de)<=120)
  and (passou_para is null or char_length(passou_para)<=120)
  and (outros_solicitacoes is null or char_length(outros_solicitacoes)<=400)
 );
comment on column public.cipg_servicos_guarda.turno_cipg is 'Turno da CIPG: 1=08:00 a 19:59; 2=20:00 a 07:59. Informado pelo livro de serviço.';
comment on column public.cipg_servicos_guarda.comandante is 'Responsável pelo serviço, acesso restrito à unidade.';
comment on column public.cipg_servicos_guarda.recebeu_de is 'Transferência de serviço, acesso restrito à unidade.';
comment on column public.cipg_servicos_guarda.passou_para is 'Transferência de serviço, acesso restrito à unidade.';
comment on column public.cipg_servicos_guarda.outros_solicitacoes is 'Anotações administrativas sucintas. Não inserir dados médicos pessoais ou detalhes de segurança.';
