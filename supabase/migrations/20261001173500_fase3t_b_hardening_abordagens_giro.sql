create index giro_acessos_abordagem_unidade_idx
  on public.giro_acessos_abordagem (unidade_id);

drop policy if exists "giro_abordagens_select_escopo" on public.giro_abordagens;
create policy "giro_abordagens_select_escopo"
  on public.giro_abordagens
  for select
  to authenticated
  using (
    unidade_id = private.unidade_atual()
    or unidade_id = any(private.unidades_acessiveis_atual())
  );
