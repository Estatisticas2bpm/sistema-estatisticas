revoke all on public.giro_abordagens from anon, authenticated;
revoke all on public.giro_acessos_abordagem from anon, authenticated;
grant select, insert on public.giro_abordagens to authenticated;
grant select on public.giro_acessos_abordagem to authenticated;

create or replace function private.validar_abordagem_giro_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_unidade uuid;
  v_qtd integer;
begin
  if v_user is null then raise exception 'Sessão inválida.' using errcode='42501'; end if;

  select a.unidade_id into v_unidade
  from public.giro_acessos_abordagem a
  join public.unidades u on u.id=a.unidade_id
  where a.user_id=v_user and a.ativo=true and u.ativo=true and upper(u.sigla)='GIRO'
  limit 1;

  if v_unidade is null then
    raise exception 'Acesso de abordagem do GIRO não autorizado ou unidade ainda inativa.' using errcode='42501';
  end if;

  new.tipo_abordagem := upper(trim(coalesce(new.tipo_abordagem,'')));
  if new.tipo_abordagem not in ('A_PE','MOTO','VEICULO') then raise exception 'Selecione o tipo da abordagem.' using errcode='23514'; end if;
  if new.pessoas is null or jsonb_typeof(new.pessoas)<>'array' then raise exception 'Informe as pessoas abordadas.' using errcode='23514'; end if;

  v_qtd := jsonb_array_length(new.pessoas);
  if v_qtd<1 or v_qtd>20 then raise exception 'Informe entre 1 e 20 pessoas por abordagem.' using errcode='23514'; end if;

  if exists (
    select 1 from jsonb_array_elements(new.pessoas) p
    where coalesce(p->>'nacionalidade','') not in ('BR','VE','OUTRA')
       or coalesce(p->>'sexo','') not in ('M','F','NI')
       or coalesce(p->>'idade','') !~ '^[0-9]{1,3}$'
       or (p->>'idade')::integer not between 0 and 130
  ) then raise exception 'Há pessoa com nacionalidade, sexo ou idade inválida.' using errcode='23514'; end if;

  if new.latitude is null or new.longitude is null then raise exception 'Capture a localização antes de salvar.' using errcode='23514'; end if;

  new.unidade_id := v_unidade;
  new.criado_por := v_user;
  new.quantidade_pessoas := v_qtd;
  new.registrado_em := now();
  new.criado_em := now();
  return new;
end
$$;

drop trigger if exists trg_validar_abordagem_giro_insert on public.giro_abordagens;
create trigger trg_validar_abordagem_giro_insert
before insert on public.giro_abordagens
for each row execute function private.validar_abordagem_giro_insert();
