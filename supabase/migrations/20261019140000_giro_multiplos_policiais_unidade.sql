-- Giro Abordagens: permitir um acesso individual por policial na mesma unidade.
-- A restrição UNIQUE (unidade_id) era herança do antigo acesso compartilhado
-- e impedia o registro de dois policiais do GIRO.
-- Preservam-se PRIMARY KEY (user_id), chave estrangeira para auth.users,
-- índice giro_matricula_unica, RLS e todos os registros de abordagens.
ALTER TABLE public.giro_acessos_abordagem
  DROP CONSTRAINT IF EXISTS giro_acessos_abordagem_unidade_key;
