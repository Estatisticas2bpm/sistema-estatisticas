-- Histórico de alterações solicitadas pela própria conta operacional GIRO/CIPG.
-- Sem acesso direto por roles anon/authenticated; somente função administrativa validada escreve.
create table if not exists public.auditoria_perfil_operacional (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id),
 unidade_sigla text not null check(unidade_sigla in ('GIRO','CIPG')),
 nome_guerra_anterior text,
 nome_guerra_novo text not null,
 posto_graduacao_anterior text,
 posto_graduacao_novo text not null,
 alterado_em timestamptz not null default now()
);
alter table public.auditoria_perfil_operacional enable row level security;
revoke all on public.auditoria_perfil_operacional from anon,authenticated;
create index if not exists auditoria_perfil_operacional_usuario_data on public.auditoria_perfil_operacional(user_id,alterado_em desc);
