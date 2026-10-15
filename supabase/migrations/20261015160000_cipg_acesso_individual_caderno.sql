-- 2026-10-15 — CIPG: caderno digital com credenciais individuais, sem perfil CPC
create table if not exists public.cipg_acessos_caderno (
  user_id uuid primary key references auth.users(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint cipg_acesso_unidade_valida check (unidade_id='5c73f100-cd5d-415a-be39-1f8816bccbc9'::uuid)
);
alter table public.cipg_acessos_caderno enable row level security;
revoke all on public.cipg_acessos_caderno from anon, authenticated;
grant select on public.cipg_acessos_caderno to authenticated;
drop policy if exists cipg_acesso_proprio on public.cipg_acessos_caderno;
create policy cipg_acesso_proprio on public.cipg_acessos_caderno for select to authenticated
using (user_id=(select auth.uid()) and ativo=true);

alter table public.cipg_servicos_guarda alter column criado_por set default auth.uid();
alter table public.cipg_eventos_guarda alter column criado_por set default auth.uid();
-- Respeitar as políticas anteriores de operadores e administradores; sem substituí-las.
drop policy if exists cipg_servicos_caderno_ler on public.cipg_servicos_guarda;
create policy cipg_servicos_caderno_ler on public.cipg_servicos_guarda for select to authenticated
using (criado_por=(select auth.uid()) and exists (
 select 1 from public.cipg_acessos_caderno a where a.user_id=(select auth.uid()) and a.ativo and a.unidade_id=unidade_id
));
drop policy if exists cipg_servicos_caderno_inserir on public.cipg_servicos_guarda;
create policy cipg_servicos_caderno_inserir on public.cipg_servicos_guarda for insert to authenticated
with check (criado_por=(select auth.uid()) and exists (
 select 1 from public.cipg_acessos_caderno a where a.user_id=(select auth.uid()) and a.ativo and a.unidade_id=unidade_id
));
drop policy if exists cipg_postos_caderno_ler on public.cipg_postos;
create policy cipg_postos_caderno_ler on public.cipg_postos for select to authenticated using (
 exists (select 1 from public.cipg_acessos_caderno a where a.user_id=(select auth.uid()) and a.ativo)
);
drop policy if exists cipg_eventos_caderno_ler on public.cipg_eventos_guarda;
create policy cipg_eventos_caderno_ler on public.cipg_eventos_guarda for select to authenticated using (
 criado_por=(select auth.uid()) and exists (
 select 1 from public.cipg_servicos_guarda s where s.id=servico_id and s.criado_por=(select auth.uid())
 ));
drop policy if exists cipg_eventos_caderno_inserir on public.cipg_eventos_guarda;
create policy cipg_eventos_caderno_inserir on public.cipg_eventos_guarda for insert to authenticated with check (
 criado_por=(select auth.uid()) and exists (
 select 1 from public.cipg_servicos_guarda s where s.id=servico_id and s.criado_por=(select auth.uid())
 ));
-- Remover somente políticas transitórias amplas; não alterar as políticas originais.
drop policy if exists cipg_servicos_operadores_ler on public.cipg_servicos_guarda;
drop policy if exists cipg_servicos_operadores_inserir on public.cipg_servicos_guarda;
drop policy if exists cipg_postos_operadores_ler on public.cipg_postos;
drop policy if exists cipg_eventos_operadores_ler on public.cipg_eventos_guarda;
drop policy if exists cipg_eventos_operadores_inserir on public.cipg_eventos_guarda;
