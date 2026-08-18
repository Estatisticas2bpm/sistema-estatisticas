begin;

alter table public.ocorrencias
  add column if not exists entorpecentes_itens jsonb not null default '[]'::jsonb;

alter table public.ocorrencias drop constraint if exists ocorrencias_entorpecentes_itens_array;
alter table public.ocorrencias add constraint ocorrencias_entorpecentes_itens_array check (jsonb_typeof(entorpecentes_itens) = 'array');

create or replace function public.atualizar_ocorrencia_publica(p_id uuid, p_dados jsonb)
returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare v public.ocorrencias;
begin
  select * into v from jsonb_populate_record(null::public.ocorrencias,p_dados);
  update public.ocorrencias set
    data_ocorrencia=v.data_ocorrencia,status_atendimento=v.status_atendimento,motivo_repressao=v.motivo_repressao,municipio=v.municipio,
    vtr=v.vtr,tipo_registro=v.tipo_registro,numero_bo=v.numero_bo,hora_inicial=v.hora_inicial,hora_final=v.hora_final,
    ocorrencia=v.ocorrencia,crime=v.crime,detalhes=v.detalhes,numero_prisoes=v.numero_prisoes,providencia_1=v.providencia_1,
    numero_conduzidos=v.numero_conduzidos,orientacoes=v.orientacoes,veiculos_recuperados=v.veiculos_recuperados,providencia_2=v.providencia_2,fe=v.fe,
    endereco=v.endereco,numero_endereco=v.numero_endereco,bairro=v.bairro,latitude=v.latitude,longitude=v.longitude,endereco_formatado=v.endereco_formatado,local_entrega=v.local_entrega,
    vitima_nacionalidade=v.vitima_nacionalidade,vitima_sexo=v.vitima_sexo,vitima_idade=v.vitima_idade,
    infrator_nacionalidade=v.infrator_nacionalidade,infrator_sexo=v.infrator_sexo,infrator_idade=v.infrator_idade,
    comandante=v.comandante,historico_resumido=v.historico_resumido,materialidade=v.materialidade,observacao=v.observacao,
    entorpecentes=v.entorpecentes,entorpecentes_itens=coalesce(v.entorpecentes_itens,'[]'::jsonb),maconha=v.maconha,cocaina=v.cocaina,pasta_base=v.pasta_base,crack=v.crack,skank=v.skank,
    quantidade_armas=v.quantidade_armas,armas_itens=coalesce(v.armas_itens,'[]'::jsonb),quantidade_arma_branca=v.quantidade_arma_branca,arma_branca=v.arma_branca,armas=v.armas,
    quantidade_municoes=v.quantidade_municoes,municoes_itens=coalesce(v.municoes_itens,'[]'::jsonb),municoes=v.municoes,
    veiculos_restricao=v.veiculos_restricao,itens_recuperados=coalesce(v.itens_recuperados,'[]'::jsonb),foragidos=v.foragidos,
    disparo=v.disparo,auto_resistencia=v.auto_resistencia,quantidade_autos_infracao=v.quantidade_autos_infracao,
    auto_infracao=v.auto_infracao,balanca_precisao=v.balanca_precisao,tatico_setorial=v.tatico_setorial,observacao_final=v.observacao_final,
    atualizado_em=now()
  where id=p_id;
  return found;
end;
$function$;

create or replace function public.obter_dados_dashboard(data_inicio date default null::date, data_fim date default null::date)
returns jsonb language sql security definer set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'data_ocorrencia',o.data_ocorrencia,'hora_inicial',o.hora_inicial,'turno',o.turno,
    'tipo_registro',o.tipo_registro,'numero_bo',o.numero_bo,'ocorrencia',o.ocorrencia,'crime',o.crime,
    'status_atendimento',o.status_atendimento,'motivo_repressao',o.motivo_repressao,'comandante',o.comandante,
    'municipio',o.municipio,'bairro',o.bairro,'endereco',o.endereco,
    'numero_prisoes',o.numero_prisoes,'numero_conduzidos',o.numero_conduzidos,'orientacoes',o.orientacoes,
    'foragidos',o.foragidos,'veiculos_restricao',o.veiculos_restricao,'veiculos_recuperados',o.veiculos_recuperados,
    'quantidade_armas',o.quantidade_armas,'armas',o.armas,'armas_itens',o.armas_itens,
    'quantidade_arma_branca',o.quantidade_arma_branca,'arma_branca',o.arma_branca,
    'quantidade_municoes',o.quantidade_municoes,'municoes',o.municoes,'municoes_itens',o.municoes_itens,
    'itens_recuperados',o.itens_recuperados,'entorpecentes',o.entorpecentes,'entorpecentes_itens',o.entorpecentes_itens,
    'maconha',o.maconha,'cocaina',o.cocaina,'pasta_base',o.pasta_base,'crack',o.crack,'skank',o.skank,
    'vitima_nacionalidade',o.vitima_nacionalidade,'vitima_sexo',o.vitima_sexo,
    'infrator_nacionalidade',o.infrator_nacionalidade,'infrator_sexo',o.infrator_sexo,
    'disparo',o.disparo,'auto_resistencia',o.auto_resistencia,
    'quantidade_autos_infracao',o.quantidade_autos_infracao,'tatico_setorial',o.tatico_setorial
  ) order by o.data_ocorrencia desc), '[]'::jsonb)
  from public.ocorrencias o
  where (data_inicio is null or o.data_ocorrencia >= data_inicio)
    and (data_fim is null or o.data_ocorrencia <= data_fim);
$function$;

commit;
