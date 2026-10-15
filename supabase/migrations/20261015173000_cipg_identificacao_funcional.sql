-- Dados funcionais das contas exclusivas do Caderno Digital CIPG.
-- A identificação exibida é posto/graduação + nome de guerra; matrícula e nome completo permanecem administrativos.
alter table public.cipg_acessos_caderno
  add column if not exists nome_completo text,
  add column if not exists posto_graduacao text,
  add column if not exists nome_guerra text,
  add column if not exists matricula text;
create unique index if not exists cipg_acessos_matricula_unica
  on public.cipg_acessos_caderno (matricula) where matricula is not null;
comment on column public.cipg_acessos_caderno.nome_guerra is 'Identificação funcional abreviada para o livro de serviço.';
