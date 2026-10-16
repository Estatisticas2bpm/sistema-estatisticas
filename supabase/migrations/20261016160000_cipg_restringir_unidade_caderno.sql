-- CIPG: corrigir escopo da política do Caderno Digital.
-- A relação anterior "a.unidade_id=unidade_id" qualificava ambas as colunas
-- como a.unidade_id, permitindo a condição tautológica; comparar a unidade
-- do acesso com a unidade do relatório explicitamente.
drop policy if exists cipg_servicos_caderno_inserir on public.cipg_servicos_guarda;
create policy cipg_servicos_caderno_inserir
on public.cipg_servicos_guarda for insert to authenticated
with check (
  criado_por=(select auth.uid())
  and unidade_id='5c73f100-cd5d-415a-be39-1f8816bccbc9'::uuid
  and exists (
    select 1 from public.cipg_acessos_caderno a
    where a.user_id=(select auth.uid())
      and a.ativo=true
      and a.unidade_id=cipg_servicos_guarda.unidade_id
  )
);
drop policy if exists cipg_servicos_caderno_ler on public.cipg_servicos_guarda;
create policy cipg_servicos_caderno_ler
on public.cipg_servicos_guarda for select to authenticated
using (
  criado_por=(select auth.uid())
  and unidade_id='5c73f100-cd5d-415a-be39-1f8816bccbc9'::uuid
  and exists (
    select 1 from public.cipg_acessos_caderno a
    where a.user_id=(select auth.uid())
      and a.ativo=true
      and a.unidade_id=cipg_servicos_guarda.unidade_id
  )
);
