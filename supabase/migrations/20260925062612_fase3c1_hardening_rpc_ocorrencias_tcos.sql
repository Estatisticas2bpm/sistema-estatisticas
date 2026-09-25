-- FASE 3C.1 — fecha caminhos restantes de ocorrências/TCOs que ainda ignoravam RLS
-- Não altera dados, unidades ou escopos.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '2min';

alter function public.excluir_tco_publico(uuid)
  security invoker;

alter function public.editar_comandante_publico(text, text)
  security invoker;

alter function public.obter_comandantes_publicos()
  security invoker;

grant execute on function public.excluir_tco_publico(uuid)
  to authenticated, service_role;

grant execute on function public.editar_comandante_publico(text, text)
  to authenticated, service_role;

grant execute on function public.obter_comandantes_publicos()
  to authenticated, service_role;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'excluir_tco_publico',
        'editar_comandante_publico',
        'obter_comandantes_publicos'
      )
      and p.prosecdef = true
  ) then
    raise exception
      'Fase 3C.1 cancelada: uma função operacional permaneceu SECURITY DEFINER.';
  end if;
end
$$;

commit;