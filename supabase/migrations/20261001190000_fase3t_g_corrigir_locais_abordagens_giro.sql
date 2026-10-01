grant update (endereco, bairro, municipio)
on public.giro_abordagens
to authenticated;

drop policy if exists "giro_abordagens_update_local_estatistica" on public.giro_abordagens;
create policy "giro_abordagens_update_local_estatistica"
on public.giro_abordagens
for update
to authenticated
using (
  unidade_id = private.unidade_atual()
  and private.perfil_atual() in ('ADMIN','ESTATISTICA')
)
with check (
  unidade_id = private.unidade_atual()
  and private.perfil_atual() in ('ADMIN','ESTATISTICA')
);
