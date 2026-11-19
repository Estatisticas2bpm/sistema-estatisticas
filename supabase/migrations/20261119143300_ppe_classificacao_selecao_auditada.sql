-- Fase de transição: IDs selecionados e auditados, sem alterar projeções antigas.
alter table public.ocorrencias add column ppe_naturezas_selecionadas uuid[],
 add column ppe_justificativa_classificacao text check(length(ppe_justificativa_classificacao)<=500);
alter table public.ocorrencias add constraint ppe_selecao_limite check(ppe_naturezas_selecionadas is null or cardinality(ppe_naturezas_selecionadas) between 1 and 30);

create function private.ppe_validar_selecao() returns trigger
language plpgsql security definer set search_path='' as $fn$
declare ids uuid[]; codigos_original text[]; codigos_validado text[]; anteriores uuid[];
begin
 if tg_op='UPDATE' then
  anteriores:=old.ppe_naturezas_selecionadas;
  if new.ppe_naturezas_selecionadas is not distinct from anteriores then
   new.ppe_justificativa_classificacao:=old.ppe_justificativa_classificacao;
   return new;
  end if;
  if anteriores is not null and new.ppe_naturezas_selecionadas is null then raise exception 'Não é permitido apagar a classificação PPe; selecione outra natureza.';end if;
  if anteriores is null and new.ppe_naturezas_selecionadas is not null and private.perfil_atual() is distinct from 'ADMIN' then raise exception 'A associação inicial de registro existente exige validação administrativa.' using errcode='42501';end if;
 end if;
 if new.ppe_naturezas_selecionadas is null then new.ppe_justificativa_classificacao:=null;return new;end if;
 if not private.usuario_ativo() or not private.pode_escrever_operacional() then raise insufficient_privilege;end if;
 if cardinality(new.ppe_naturezas_selecionadas) not between 1 and 30 or array_position(new.ppe_naturezas_selecionadas,null) is not null then raise exception 'Selecione de 1 a 30 naturezas válidas.'; end if;
 select array_agg(distinct x order by x) into ids from unnest(new.ppe_naturezas_selecionadas) x;
 if cardinality(ids)<>cardinality(new.ppe_naturezas_selecionadas) then raise exception 'Naturezas repetidas não são permitidas.';end if;
 -- As naturezas antigas podem ter sido inativadas; só aceitar nova inclusão ativa.
 if exists(select 1 from unnest(ids) x left join public.naturezas_ppe n on n.id=x
   where n.id is null or ((not n.ativo or n.status_validacao='DIVERGENTE') and not (x=any(coalesce(anteriores,array[]::uuid[]))))) then raise exception 'Existe natureza indisponível ou divergente na seleção.';end if;
 select array_agg(distinct x->>'codigo_ppe' order by x->>'codigo_ppe') into codigos_original from jsonb_array_elements(coalesce(new.ppe_naturezas_originais,'[]'::jsonb)) x;
 select array_agg(n.codigo_ppe order by n.codigo_ppe) into codigos_validado from public.naturezas_ppe n where n.id=any(ids);
 if (tg_op='UPDATE' or (codigos_original is not null and codigos_original is distinct from codigos_validado))
   and length(btrim(coalesce(new.ppe_justificativa_classificacao,''))) not between 5 and 500
 then raise exception 'Informe a justificativa da classificação/correção (5 a 500 caracteres).';end if;
 new.ppe_naturezas_selecionadas:=ids;
 new.ppe_justificativa_classificacao:=nullif(btrim(new.ppe_justificativa_classificacao),'');
 return new;
end $fn$;
revoke all on function private.ppe_validar_selecao() from public,anon,authenticated;
create trigger trg_ppe_validar_selecao before insert or update of ppe_naturezas_selecionadas,ppe_justificativa_classificacao on public.ocorrencias for each row execute function private.ppe_validar_selecao();
create function private.ppe_vincular_validada() returns trigger
language plpgsql security definer set search_path='' as $fn$
declare nid uuid; anterior jsonb;
begin
 if new.ppe_naturezas_selecionadas is null then return new;end if;
 if tg_op='UPDATE' and new.ppe_naturezas_selecionadas is not distinct from old.ppe_naturezas_selecionadas then return new;end if;
 if tg_op='UPDATE' then
  anterior:=jsonb_build_object('ids',old.ppe_naturezas_selecionadas,'ocorrencia_legada',old.ocorrencia,'crime_legado',old.crime,'naturezas_legadas',old.naturezas_itens);
 end if;
 delete from public.ocorrencias_naturezas_ppe where ocorrencia_id=new.id and origem='VALIDADA' and not (natureza_id=any(new.ppe_naturezas_selecionadas));
 foreach nid in array new.ppe_naturezas_selecionadas loop
  insert into public.ocorrencias_naturezas_ppe(ocorrencia_id,natureza_id,origem,associado_por)
  values(new.id,nid,'VALIDADA',auth.uid()) on conflict do nothing;
 end loop;
 insert into public.naturezas_ppe_auditoria(ocorrencia_id,usuario_id,acao,anterior,novo,justificativa)
 values(new.id,auth.uid(),case when tg_op='INSERT' then 'CLASSIFICACAO_INICIAL' else 'ALTERACAO_CLASSIFICACAO' end,anterior,jsonb_build_object('ids',new.ppe_naturezas_selecionadas,'originais',new.ppe_naturezas_originais),new.ppe_justificativa_classificacao);
 return new;
end $fn$;
revoke all on function private.ppe_vincular_validada() from public,anon,authenticated;
create trigger trg_ppe_vincular_validada after insert or update of ppe_naturezas_selecionadas on public.ocorrencias for each row execute function private.ppe_vincular_validada();

-- Consulta pontual para revisão administrativa, sem nomes ou relatos pessoais.
create function public.ppe_admin_buscar_historico(p_nome text,p_limite integer default 100) returns table(id uuid,numero_bo text,data_ocorrencia date,unidade_sigla text,ocorrencia text,crime text,naturezas_itens jsonb,ppe_naturezas_originais jsonb,ppe_naturezas_selecionadas uuid[])
language plpgsql stable security definer set search_path='' as $fn$
begin
 if not private.usuario_ativo() or private.perfil_atual() is distinct from 'ADMIN' then raise insufficient_privilege;end if;
 if length(btrim(coalesce(p_nome,'')))<3 then raise exception 'Informe pelo menos três caracteres.';end if;
 return query select o.id,o.numero_bo,o.data_ocorrencia,u.sigla,o.ocorrencia,o.crime,o.naturezas_itens,o.ppe_naturezas_originais,o.ppe_naturezas_selecionadas
 from public.ocorrencias o join public.unidades u on u.id=o.unidade_id
 where o.unidade_id=any(coalesce(private.unidades_acessiveis_atual(),array[]::uuid[]))
 and (strpos(upper(coalesce(o.ocorrencia,'')),upper(btrim(p_nome)))>0 or strpos(upper(coalesce(o.crime,'')),upper(btrim(p_nome)))>0 or o.numero_bo=btrim(p_nome))
 order by o.data_ocorrencia desc,o.id limit greatest(1,least(coalesce(p_limite,100),200));
end $fn$;
create function public.ppe_admin_associar_historico(p_ocorrencia uuid,p_ids uuid[],p_justificativa text) returns void
language plpgsql security definer set search_path='' as $fn$
begin
 if not private.usuario_ativo() or private.perfil_atual() is distinct from 'ADMIN' then raise insufficient_privilege;end if;
 if length(btrim(coalesce(p_justificativa,''))) not between 5 and 500 or cardinality(p_ids) not between 1 and 30 then raise exception 'Selecione a natureza e informe a justificativa.';end if;
 update public.ocorrencias set ppe_naturezas_selecionadas=p_ids,ppe_justificativa_classificacao=p_justificativa
 where id=p_ocorrencia and unidade_id=any(coalesce(private.unidades_acessiveis_atual(),array[]::uuid[]));
 if not found then raise exception 'Registro não encontrado ou fora do escopo.';end if;
end $fn$;
revoke all on function public.ppe_admin_buscar_historico(text,integer),public.ppe_admin_associar_historico(uuid,uuid[],text) from public,anon;
grant execute on function public.ppe_admin_buscar_historico(text,integer),public.ppe_admin_associar_historico(uuid,uuid[],text) to authenticated;

CREATE OR REPLACE FUNCTION public.atualizar_ocorrencia_publica(p_id uuid, p_dados jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v public.ocorrencias;
  v_dados jsonb := p_dados;
  v_lat_legado boolean := coalesce(p_dados->>'latitude','')='__LEGADO_SEM_COORDENADA__';
  v_lon_legado boolean := coalesce(p_dados->>'longitude','')='__LEGADO_SEM_COORDENADA__';
  v_ent_in jsonb := coalesce(p_dados->'entorpecentes_itens','[]'::jsonb);
  v_ent_valid jsonb := '[]'::jsonb;
  v_ent_final jsonb := '[]'::jsonb;
  v_ent_original jsonb := '[]'::jsonb;
  v_maconha numeric;
  v_cocaina numeric;
  v_pasta numeric;
  v_crack numeric;
  v_skank numeric;
  v_ent_flag text;
begin
  if v_lat_legado then v_dados := v_dados - 'latitude'; end if;
  if v_lon_legado then v_dados := v_dados - 'longitude'; end if;

  select * into v from jsonb_populate_record(null::public.ocorrencias,v_dados);

  select coalesce(entorpecentes_itens,'[]'::jsonb), maconha, cocaina, pasta_base, crack, skank, entorpecentes
    into v_ent_original, v_maconha, v_cocaina, v_pasta, v_crack, v_skank, v_ent_flag
  from public.ocorrencias
  where id=p_id;

  if not found then return false; end if;

  if p_dados ? 'entorpecentes_itens' and jsonb_typeof(v_ent_in)='array' then
    if jsonb_array_length(v_ent_in)=0 then
      v_ent_final := '[]'::jsonb;
    else
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'tipo', case upper(trim(coalesce(item->>'tipo','')))
            when 'SKANK' then 'SKUNK'
            when 'PASTA BASE' then 'OUTROS'
            when 'LSD' then 'OUTROS'
            when 'OUTRO' then 'OUTROS'
            else upper(trim(coalesce(item->>'tipo','OUTROS')))
          end,
          'forma_apresentacao', case upper(trim(coalesce(item->>'forma_apresentacao',item->>'forma',item->>'unidade','')))
            when 'INVOLUCRO' then 'INVÓLUCRO'
            when 'INVÓLUCRO' then 'INVÓLUCRO'
            when 'PORCAO' then 'PORÇÃO'
            when 'PORÇÃO' then 'PORÇÃO'
            when 'TABLETE' then 'TABLETE'
            when 'TIJOLO' then 'TIJOLO'
            when 'PAPELOTE' then 'PAPELOTE'
            when 'PINO' then 'PINO'
            when 'COMPRIMIDO' then 'COMPRIMIDO'
            when 'SACOLA' then 'SACOLA'
            when 'UNIDADE' then 'OUTROS'
            when 'OUTRO' then 'OUTROS'
            when 'OUTROS' then 'OUTROS'
          end,
          'quantidade', (item->>'quantidade')::integer,
          'detalhes', nullif(item->>'detalhes','')
        )
      ),'[]'::jsonb)
      into v_ent_valid
      from jsonb_array_elements(v_ent_in) item
      where coalesce(item->>'quantidade','') ~ '^[0-9]+$'
        and (item->>'quantidade')::integer > 0
        and upper(trim(coalesce(item->>'forma_apresentacao',item->>'forma',item->>'unidade',''))) in
          ('INVOLUCRO','INVÓLUCRO','PORCAO','PORÇÃO','TABLETE','TIJOLO','PAPELOTE','PINO','COMPRIMIDO','SACOLA','UNIDADE','OUTRO','OUTROS');

      if jsonb_array_length(v_ent_valid)>0 then v_ent_final := v_ent_valid;
      else v_ent_final := v_ent_original;
      end if;
    end if;
  else
    v_ent_final := v_ent_original;
  end if;

  update public.ocorrencias set
    data_ocorrencia=v.data_ocorrencia,status_atendimento=v.status_atendimento,motivo_repressao=v.motivo_repressao,municipio=v.municipio,
    vtr=v.vtr,tipo_registro=v.tipo_registro,numero_bo=v.numero_bo,cia_unidade_apuracao=v.cia_unidade_apuracao,hora_inicial=v.hora_inicial,hora_final=v.hora_final,
    ocorrencia=v.ocorrencia,crime=v.crime,crimes_itens=coalesce(v.crimes_itens,'[]'::jsonb),naturezas_itens=coalesce(v.naturezas_itens,'[]'::jsonb),detalhes=v.detalhes,
    ppe_naturezas_originais=case when p_dados ? 'ppe_naturezas_originais' then v.ppe_naturezas_originais else ocorrencias.ppe_naturezas_originais end,
    ppe_naturezas_selecionadas=case when p_dados ? 'ppe_naturezas_selecionadas' then v.ppe_naturezas_selecionadas else ocorrencias.ppe_naturezas_selecionadas end,
    ppe_justificativa_classificacao=case when p_dados ? 'ppe_justificativa_classificacao' then v.ppe_justificativa_classificacao else ocorrencias.ppe_justificativa_classificacao end,
    numero_prisoes=ocorrencias.numero_prisoes,
    providencia_1=v.providencia_1,
    numero_conduzidos=greatest(coalesce(v.numero_conduzidos,0),coalesce(ocorrencias.numero_prisoes,0)),
    orientacoes=v.orientacoes,veiculos_recuperados=v.veiculos_recuperados,providencia_2=v.providencia_2,fe=v.fe,
    endereco=v.endereco,numero_endereco=v.numero_endereco,bairro=v.bairro,
    escola_nome=case when p_dados ? 'escola_nome' then nullif(btrim(v.escola_nome),'') else ocorrencias.escola_nome end,
    latitude=case when v_lat_legado then ocorrencias.latitude else v.latitude end,
    longitude=case when v_lon_legado then ocorrencias.longitude else v.longitude end,
    endereco_formatado=v.endereco_formatado,local_entrega=v.local_entrega,
    vitima_tipo=coalesce(v.vitima_tipo,'PESSOA_FISICA'), vitima_nacionalidade=v.vitima_nacionalidade,vitima_sexo=v.vitima_sexo,vitima_idade=v.vitima_idade,
    infrator_nacionalidade=v.infrator_nacionalidade,infrator_sexo=v.infrator_sexo,infrator_idade=v.infrator_idade,
    comandante=v.comandante,historico_resumido=v.historico_resumido,materialidade=v.materialidade,observacao=v.observacao,
    bens_subtraidos=coalesce(v.bens_subtraidos,'[]'::jsonb),
    entorpecentes=case when jsonb_array_length(v_ent_final)>0 or coalesce(v_maconha,0)+coalesce(v_cocaina,0)+coalesce(v_pasta,0)+coalesce(v_crack,0)+coalesce(v_skank,0)>0 then 'SIM' else coalesce(v.entorpecentes,v_ent_flag) end,
    entorpecentes_itens=v_ent_final,
    maconha=v_maconha,cocaina=v_cocaina,pasta_base=v_pasta,crack=v_crack,skank=v_skank,
    quantidade_armas=v.quantidade_armas,armas_itens=coalesce(v.armas_itens,'[]'::jsonb),quantidade_arma_branca=v.quantidade_arma_branca,arma_branca=v.arma_branca,armas=v.armas,
    quantidade_municoes=v.quantidade_municoes,municoes_itens=coalesce(v.municoes_itens,'[]'::jsonb),municoes=v.municoes,
    veiculos_restricao=v.veiculos_restricao,itens_recuperados=coalesce(v.itens_recuperados,'[]'::jsonb),foragidos=v.foragidos,
    disparo=v.disparo,auto_resistencia=v.auto_resistencia,auto_resistencia_resultou_morte=v.auto_resistencia_resultou_morte,origem_acionamento=case when p_dados ? 'origem_acionamento' then v.origem_acionamento else origem_acionamento end,
    origem_acionamento_detalhe=case when p_dados ? 'origem_acionamento_detalhe' then v.origem_acionamento_detalhe else origem_acionamento_detalhe end,
    origem_ocorrencia=v.origem_ocorrencia,origem_ocorrencia_detalhe=v.origem_ocorrencia_detalhe,quantidade_autos_infracao=v.quantidade_autos_infracao,
    auto_infracao=v.auto_infracao,balanca_precisao=v.balanca_precisao,tatico_setorial=v.tatico_setorial,cavalaria_classe_registro=case when p_dados ? 'cavalaria_classe_registro' then nullif(btrim(v.cavalaria_classe_registro),'') else ocorrencias.cavalaria_classe_registro end,cavalaria_tipo_atividade=case when p_dados ? 'cavalaria_tipo_atividade' then nullif(btrim(v.cavalaria_tipo_atividade),'') else ocorrencias.cavalaria_tipo_atividade end,cavalaria_esquadrao=case when p_dados ? 'cavalaria_esquadrao' then nullif(btrim(v.cavalaria_esquadrao),'') else ocorrencias.cavalaria_esquadrao end,cavalaria_pelotao=case when p_dados ? 'cavalaria_pelotao' then nullif(btrim(v.cavalaria_pelotao),'') else ocorrencias.cavalaria_pelotao end,cavalaria_data_elaboracao_ppe=case when p_dados ? 'cavalaria_data_elaboracao_ppe' then v.cavalaria_data_elaboracao_ppe else ocorrencias.cavalaria_data_elaboracao_ppe end,cavalaria_instituicao=case when p_dados ? 'cavalaria_instituicao' then nullif(btrim(v.cavalaria_instituicao),'') else ocorrencias.cavalaria_instituicao end,observacao_final=v.observacao_final,
    subunidade_operacional_id=v.subunidade_operacional_id, atualizado_em=now()
  where id=p_id;
  return found;
end;
$function$;
