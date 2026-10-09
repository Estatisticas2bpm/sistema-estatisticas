create or replace function private.cipg_marcar_servico_com_evento()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  update public.cipg_servicos_guarda
  set situacao='COM ALTERACAO',atualizado_em=now()
  where id=new.servico_id and unidade_id=(select id from public.unidades where sigla='CIPG' and ativo=true);
  return new;
end
$$;
drop trigger if exists cipg_evento_altera_status_servico on public.cipg_eventos_guarda;
create trigger cipg_evento_altera_status_servico
after insert on public.cipg_eventos_guarda for each row
execute function private.cipg_marcar_servico_com_evento();
revoke all on function private.cipg_marcar_servico_com_evento() from public,anon,authenticated;