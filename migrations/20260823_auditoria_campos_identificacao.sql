create or replace function public.obter_dados_dashboard(data_inicio date default null, data_fim date default null)
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'data_ocorrencia',o.data_ocorrencia,'hora_inicial',o.hora_inicial,'turno',o.turno,
    'tipo_registro',o.tipo_registro,'numero_bo',o.numero_bo,'ocorrencia',o.ocorrencia,'crime',o.crime,
    'status_atendimento',o.status_atendimento,'motivo_repressao',o.motivo_repressao,'comandante',o.comandante,
    'municipio',o.municipio,'bairro',o.bairro,'sisc',o.sisc,'companhia',o.companhia,'endereco',o.endereco,
    'numero_prisoes',o.numero_prisoes,'numero_conduzidos',o.numero_conduzidos,
    'conducoes_operacionais',public.conducoes_estatisticas(o.numero_conduzidos,o.numero_prisoes),
    'orientacoes',o.orientacoes,
    'foragidos',o.foragidos,'veiculos_restricao',o.veiculos_restricao,'veiculos_recuperados',o.veiculos_recuperados,
    'bens_subtraidos',o.bens_subtraidos,
    'quantidade_armas',o.quantidade_armas,'armas',o.armas,'armas_itens',o.armas_itens,
    'quantidade_arma_branca',o.quantidade_arma_branca,'arma_branca',o.arma_branca,
    'quantidade_municoes',o.quantidade_municoes,'municoes',o.municoes,'municoes_itens',o.municoes_itens,
    'itens_recuperados',o.itens_recuperados,
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
    'maconha',0,'cocaina',0,'pasta_base',0,'crack',0,'skank',0,
    'vitima_nacionalidade',o.vitima_nacionalidade,'vitima_sexo',o.vitima_sexo,
    'infrator_nacionalidade',o.infrator_nacionalidade,'infrator_sexo',o.infrator_sexo,
    'disparo',o.disparo,'auto_resistencia',o.auto_resistencia,
    'quantidade_autos_infracao',o.quantidade_autos_infracao,'tatico_setorial',o.tatico_setorial
  ) || jsonb_build_object(
    'id',o.id,'latitude',o.latitude,'longitude',o.longitude,'endereco_formatado',o.endereco_formatado
  ) order by o.data_ocorrencia desc), '[]'::jsonb)
  from public.ocorrencias o
  where (data_inicio is null or o.data_ocorrencia >= data_inicio)
    and (data_fim is null or o.data_ocorrencia <= data_fim);
$function$;
