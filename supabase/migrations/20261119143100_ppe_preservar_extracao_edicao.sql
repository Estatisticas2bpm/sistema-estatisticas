-- Preservar a evidência em edições que não enviam o novo campo.
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
