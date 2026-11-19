-- Dados novos, sem backfill e sem modificar subtipos históricos.
alter table public.ocorrencias add column naturezas_meios jsonb;
alter table public.ocorrencias add constraint ocorrencias_naturezas_meios_array
 check(naturezas_meios is null or (jsonb_typeof(naturezas_meios)='array' and jsonb_array_length(naturezas_meios)<=30));
comment on column public.ocorrencias.naturezas_meios is
 'Classificação escolhida e meios por natureza. Array vazio de meios significa informação ausente; NÃO HOUVE é valor explícito. NULL no histórico não é ausência de meio.';

create function private.validar_naturezas_meios() returns trigger
language plpgsql security definer set search_path='' as $fn$
declare x jsonb; meio jsonb; tid bigint; cod text; visto bigint[]:=array[]::bigint[];
begin
 if tg_op='UPDATE' and new.naturezas_meios is not distinct from old.naturezas_meios then return new;end if;
 if new.naturezas_meios is null then return new;end if;
 if jsonb_typeof(new.naturezas_meios) is distinct from 'array' or jsonb_array_length(new.naturezas_meios)>30 then raise exception 'Naturezas e meios inválidos';end if;
 for x in select value from jsonb_array_elements(new.naturezas_meios) loop
  if jsonb_typeof(x) is distinct from 'object' or coalesce(x->>'tipo_id','') !~ '^[0-9]{1,18}$' or jsonb_typeof(x->'meios_empregados') is distinct from 'array' then raise exception 'Natureza ou meio inválido';end if;
  tid:=(x->>'tipo_id')::bigint; cod:=nullif(x->>'codigo','');
  if tid=any(visto) then raise exception 'Natureza repetida';end if;visto:=array_append(visto,tid);
  if not exists(select 1 from public.tipos_ocorrencia t where t.id=tid) then raise exception 'Natureza não cadastrada';end if;
  if cod is not null and not exists(select 1 from public.ppe_tipos_integracao m join public.naturezas_ppe n on n.id=m.natureza_id where m.tipo_id=tid and n.codigo_ppe=cod) then raise exception 'Código não corresponde à natureza';end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(new.crimes_itens,'[]'::jsonb)) c where c->>'tipo_id'=tid::text) then raise exception 'Meio sem natureza correspondente no BO';end if;
  if jsonb_array_length(x->'meios_empregados')>20 then raise exception 'Excesso de meios';end if;
  for meio in select value from jsonb_array_elements(x->'meios_empregados') loop
   if jsonb_typeof(meio) is distinct from 'string' or length(btrim(meio#>>'{}')) not between 1 and 160 then raise exception 'Meio empregado inválido';end if;
  end loop;
 end loop;
 return new;
end $fn$;
revoke all on function private.validar_naturezas_meios() from public,anon,authenticated;
create trigger trg_validar_naturezas_meios before insert or update of naturezas_meios on public.ocorrencias for each row execute function private.validar_naturezas_meios();
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
    naturezas_meios=case when p_dados ? 'naturezas_meios' then v.naturezas_meios else ocorrencias.naturezas_meios end,
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
CREATE OR REPLACE FUNCTION public.obter_dados_dashboard(data_inicio date DEFAULT NULL::date, data_fim date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'data_ocorrencia',o.data_ocorrencia,
      'criado_em',o.criado_em,
      'hora_inicial',o.hora_inicial,
      'turno',o.turno,
      'tipo_registro',o.tipo_registro,
      'numero_bo',o.numero_bo,
      'ocorrencia',o.ocorrencia,
      'crime',o.crime,
      'crimes_itens',coalesce(o.crimes_itens,'[]'::jsonb),
      'status_atendimento',o.status_atendimento,
      'motivo_repressao',o.motivo_repressao,
      'comandante',o.comandante,
      'vtr',o.vtr,
      'municipio',o.municipio,
      'bairro',o.bairro,
      'sisc',o.sisc,
      'companhia',o.companhia,
      'endereco',o.endereco,
      'numero_prisoes',o.numero_prisoes,
      'numero_conduzidos',o.numero_conduzidos,
      'conducoes_operacionais',public.conducoes_estatisticas(o.numero_conduzidos,o.numero_prisoes),
      'orientacoes',o.orientacoes,
      'foragidos',o.foragidos,
      'veiculos_restricao',o.veiculos_restricao,
      'veiculos_recuperados',o.veiculos_recuperados,
      'bens_subtraidos',o.bens_subtraidos,
      'quantidade_armas',o.quantidade_armas,
      'armas',o.armas,
      'armas_itens',o.armas_itens,
      'quantidade_arma_branca',o.quantidade_arma_branca,
      'arma_branca',o.arma_branca,
      'quantidade_municoes',o.quantidade_municoes,
      'municoes',o.municoes,
      'municoes_itens',o.municoes_itens,
      'itens_recuperados',o.itens_recuperados
    )
    ||
    jsonb_build_object(
      'entorpecentes',case when o.entorpecentes='SIM'
                            or (jsonb_typeof(o.entorpecentes_itens)='array' and jsonb_array_length(o.entorpecentes_itens)>0)
                            or coalesce(o.maconha,0)>0 or coalesce(o.cocaina,0)>0 or coalesce(o.pasta_base,0)>0 or coalesce(o.crack,0)>0 or coalesce(o.skank,0)>0
                           then 'SIM' else coalesce(o.entorpecentes,'NÃO') end,
      'entorpecentes_itens',coalesce((
        select jsonb_agg(
          case
            when coalesce(item->>'forma_apresentacao','')<>''
              then item || jsonb_build_object('unidade',item->>'forma_apresentacao')
            else item
          end
        )
        from jsonb_array_elements(case when jsonb_typeof(o.entorpecentes_itens)='array' then o.entorpecentes_itens else '[]'::jsonb end) item
      ),'[]'::jsonb),
      'entorpecentes_tipos_legados',(
        select coalesce(jsonb_agg(t.tipo),'[]'::jsonb)
        from (values
          ('MACONHA',coalesce(o.maconha,0)),
          ('COCAÍNA',coalesce(o.cocaina,0)),
          ('OUTROS',coalesce(o.pasta_base,0)),
          ('CRACK',coalesce(o.crack,0)),
          ('SKUNK',coalesce(o.skank,0))
        ) as t(tipo,valor)
        where t.valor>0
      ),
      'maconha',0,
      'cocaina',0,
      'pasta_base',0,
      'crack',0,
      'skank',0,
      'vitima_tipo',o.vitima_tipo, 'vitima_nacionalidade',o.vitima_nacionalidade,
      'vitima_sexo',o.vitima_sexo,
      'vitima_idade',o.vitima_idade,
      'infrator_nacionalidade',o.infrator_nacionalidade,
      'infrator_sexo',o.infrator_sexo,
      'infrator_idade',o.infrator_idade,
      'observacao_final',o.observacao_final,
      'origem_acionamento',o.origem_acionamento,
      'disparo',o.disparo,
      'auto_resistencia',o.auto_resistencia, 'auto_resistencia_resultou_morte',o.auto_resistencia_resultou_morte, 'origem_ocorrencia',o.origem_ocorrencia, 'origem_ocorrencia_detalhe',o.origem_ocorrencia_detalhe,
      'quantidade_autos_infracao',o.quantidade_autos_infracao,
      'tatico_setorial',o.tatico_setorial,
      'ame',o.ame
    )
    ||
    jsonb_build_object(
      'naturezas_itens',coalesce(o.naturezas_itens,'[]'::jsonb),
      'naturezas_meios',o.naturezas_meios,
      'id',o.id,
      'escola_id',o.escola_id,
      'cavalaria_classe_registro',o.cavalaria_classe_registro,'cavalaria_tipo_atividade',o.cavalaria_tipo_atividade,'cavalaria_esquadrao',o.cavalaria_esquadrao,'cavalaria_pelotao',o.cavalaria_pelotao,'cavalaria_data_elaboracao_ppe',o.cavalaria_data_elaboracao_ppe,'cavalaria_instituicao',o.cavalaria_instituicao,'escola_nome',o.escola_nome,
      'latitude',o.latitude,
      'longitude',o.longitude,
      'endereco_formatado',o.endereco_formatado
    )
    order by o.data_ocorrencia desc
  ), '[]'::jsonb)
  from public.ocorrencias o
  where (data_inicio is null or o.data_ocorrencia >= data_inicio)
    and (data_fim is null or o.data_ocorrencia <= data_fim);
$function$;
