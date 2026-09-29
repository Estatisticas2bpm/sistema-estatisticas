begin;

do $fase3o_pre$
declare
  v_ciptur public.unidades%rowtype;
  v_cpc_id uuid;
begin
  select * into v_ciptur
  from public.unidades
  where sigla='CIPTUR';

  if not found then
    raise exception 'FASE 3O abortada: CIPTUR não está cadastrada em public.unidades';
  end if;

  select id into v_cpc_id
  from public.unidades
  where sigla='CPC' and tipo='COMANDO' and ativo=true;

  if v_cpc_id is null then
    raise exception 'FASE 3O abortada: CPC ativo não encontrado';
  end if;

  if v_ciptur.parent_id is distinct from v_cpc_id
     or v_ciptur.tipo is distinct from 'UNIDADE' then
    raise exception 'FASE 3O abortada: hierarquia/tipo da CIPTUR divergiu do modelo aprovado';
  end if;

  if v_ciptur.ativo is distinct from false then
    raise exception 'FASE 3O abortada: CIPTUR já está ativa ou possui estado inesperado';
  end if;
end
$fase3o_pre$;

update public.unidades
set ativo=true
where sigla='CIPTUR';

do $fase3o_post$
begin
  if not exists (
    select 1
    from public.unidades u
    join public.unidades p on p.id=u.parent_id
    where u.sigla='CIPTUR'
      and u.tipo='UNIDADE'
      and u.ativo=true
      and p.sigla='CPC'
      and p.tipo='COMANDO'
      and p.ativo=true
  ) then
    raise exception 'FASE 3O falhou: CIPTUR não ficou ativa sob o CPC';
  end if;
end
$fase3o_post$;

commit;
