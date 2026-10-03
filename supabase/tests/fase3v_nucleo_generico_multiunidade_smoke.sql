-- Smoke test transacional da Fase 3V.
-- Não persiste ocorrências, TCOs, usuários ou alterações de contexto.

begin;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from public.perfis_usuarios where perfil='ADMIN' and ativo order by criado_em limit 1),
  true
);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

do $$
declare
  u record;
  v_id uuid;
  v_tco_id uuid;
  v_lida integer;
  v_total integer := 0;
  v_primeira uuid;
  v_dashboard jsonb;
begin
  for u in
    select id,sigla
    from public.unidades
    where ativo=true and tipo <> 'COMANDO'
    order by sigla
  loop
    perform public.definir_contexto_unidade_admin(u.id);

    insert into public.ocorrencias (
      data_ocorrencia,tipo_registro,numero_bo,hora_inicial,ocorrencia,
      status_atendimento,criado_por
    )
    values (
      current_date,'BO','HOMOLOG-'||u.sigla,'12:00',
      'HOMOLOGAÇÃO TÉCNICA TRANSACIONAL','ATENDIDA',(select auth.uid())
    )
    returning id into v_id;

    if (select unidade_id from public.ocorrencias where id=v_id) is distinct from u.id then
      raise exception 'Falha de unidade autoritativa em %.',u.sigla;
    end if;

    update public.ocorrencias set observacao='EDIÇÃO HOMOLOGADA' where id=v_id;
    if not exists (
      select 1 from public.ocorrencias where id=v_id and observacao='EDIÇÃO HOMOLOGADA'
    ) then
      raise exception 'Falha de leitura/edição própria em %.',u.sigla;
    end if;

    select public.obter_dados_dashboard(current_date-30,current_date) into v_dashboard;
    if jsonb_typeof(v_dashboard) <> 'array' then
      raise exception 'Dashboard genérico inválido em %.',u.sigla;
    end if;

    if v_primeira is null then
      v_primeira := v_id;
    else
      select count(*) into v_lida from public.ocorrencias where id=v_primeira;
      if v_lida <> 0 then
        raise exception 'Falha de isolamento: % leu ocorrência de outra unidade.',u.sigla;
      end if;
    end if;

    if u.sigla='CIPA' then
      insert into public.tcos (ocorrencia_id,numero_tco,data_tco,observacao,criado_por)
      values (v_id,'HOMOLOG-CIPA',current_date,'TESTE TRANSACIONAL',(select auth.uid()))
      returning id into v_tco_id;

      if (select unidade_id from public.tcos where id=v_tco_id) is distinct from u.id then
        raise exception 'Falha de unidade autoritativa do TCO.';
      end if;
    end if;

    v_total := v_total+1;
  end loop;

  if v_total <> 12 then
    raise exception 'Esperadas 12 unidades operacionais; testadas %.',v_total;
  end if;

  perform public.definir_contexto_unidade_admin((select id from public.unidades where sigla='CPC'));
  if coalesce((public.obter_home_cpc(current_date-30,current_date)->>'autorizado')::boolean,false) is not true then
    raise exception 'Consolidação CPC não autorizada no contexto correto.';
  end if;

  begin
    insert into public.ocorrencias (
      data_ocorrencia,tipo_registro,numero_bo,hora_inicial,ocorrencia,status_atendimento
    )
    values (current_date,'BO','HOMOLOG-CPC','12:00','ESCRITA CPC INDEVIDA','ATENDIDA');
    raise exception 'Falha: contexto CPC aceitou escrita operacional.';
  exception
    when insufficient_privilege or check_violation then null;
    when others then
      if sqlerrm like '%Falha: contexto CPC%' then raise; end if;
  end;
end
$$;

reset role;
rollback;

select
  'PASS' as resultado,
  12 as unidades_operacionais,
  true as isolamento_rls,
  true as dashboard_contextual,
  true as tco_multiunidade,
  0 as dados_persistidos;
