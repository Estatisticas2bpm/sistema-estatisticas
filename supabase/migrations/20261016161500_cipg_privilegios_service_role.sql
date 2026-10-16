-- CIPG: restaurar privilégios estritamente necessários à função administrativa admin-users.
-- A tabela foi criada com REVOKE para usuários finais; isso também deixou service_role
-- sem SELECT/INSERT/UPDATE (causando "permission denied for table cipg_acessos_caderno").
-- A Edge Function usa service_role apenas após validar JWT, sessão e perfil autorizado.
-- Não conceder escrita a anon nem authenticated; RLS do acesso individual permanece ativa.
grant select, insert, update on table public.cipg_acessos_caderno to service_role;
