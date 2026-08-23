begin;

-- Fonte de verdade do contrato consumido por index.html, dashboard.html e relatorio.html.
-- A extração via to_jsonb(o) mantém compatibilidade com instalações que ainda não
-- possuam algum campo opcional, retornando NULL em vez de quebrar a função.
create or replace function public.obter_dados_dashboard(
  data_inicio date default null::date,
  data_fim date default null::date
)
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',                    to_jsonb(o)->>'id',
        'data_ocorrencia',       o.data_ocorrencia,
        'hora_inicial',          to_jsonb(o)->>'hora_inicial',
        'hora_final',            to_jsonb(o)->>'hora_final',
        'turno',                 to_jsonb(o)->>'turno',
        'tipo_registro',         to_jsonb(o)->>'tipo_registro',
        'numero_bo',             to_jsonb(o)->>'numero_bo',
        'ocorrencia',            to_jsonb(o)->>'ocorrencia',
        'crime',                 to_jsonb(o)->>'crime',
        'status_atendimento',    to_jsonb(o)->>'status_atendimento',
        'motivo_repressao',      to_jsonb(o)->>'motivo_repressao',
        'municipio',             to_jsonb(o)->>'municipio',
        'sisc',                  to_jsonb(o)->>'sisc',
        'companhia',             to_jsonb(o)->>'companhia',
        'vtr',                   to_jsonb(o)->>'vtr',
        'comandante',            to_jsonb(o)->>'comandante',
        'bairro',                to_jsonb(o)->>'bairro',
        'endereco',              to_jsonb(o)->>'endereco',
        'latitude',              to_jsonb(o)->>'latitude',
        'longitude',             to_jsonb(o)->>'longitude',

        -- Compatibilidade operacional: registros antigos de prisão são tratados
        -- como condução, sem somar as duas métricas e gerar duplicidade.
        'numero_prisoes',        coalesce(to_jsonb(o)->'numero_prisoes', '0'::jsonb),
        'numero_conduzidos',     coalesce(to_jsonb(o)->'numero_conduzidos', '0'::jsonb),
        'conducoes_operacionais', greatest(
          case when coalesce(to_jsonb(o)->>'numero_conduzidos','') ~ '^[0-9]+([.][0-9]+)?$'
               then (to_jsonb(o)->>'numero_conduzidos')::numeric else 0 end,
          case when coalesce(to_jsonb(o)->>'numero_prisoes','') ~ '^[0-9]+([.][0-9]+)?$'
               then (to_jsonb(o)->>'numero_prisoes')::numeric else 0 end
        ),
        'orientacoes',           coalesce(to_jsonb(o)->'orientacoes', '0'::jsonb),
        'foragidos',             coalesce(to_jsonb(o)->'foragidos', '0'::jsonb),
        'veiculos_restricao',    coalesce(to_jsonb(o)->'veiculos_restricao', '0'::jsonb),
        'veiculos_recuperados',  coalesce(to_jsonb(o)->'veiculos_recuperados', '0'::jsonb),

        -- Materialidade estruturada. Os campos escalares permanecem somente para
        -- compatibilidade com registros históricos.
        'quantidade_armas',      coalesce(to_jsonb(o)->'quantidade_armas', '0'::jsonb),
        'armas',                 to_jsonb(o)->>'armas',
        'armas_itens',           coalesce(to_jsonb(o)->'armas_itens', '[]'::jsonb),
        'quantidade_arma_branca',coalesce(to_jsonb(o)->'quantidade_arma_branca', '0'::jsonb),
        'arma_branca',           to_jsonb(o)->>'arma_branca',
        'quantidade_municoes',   coalesce(to_jsonb(o)->'quantidade_municoes', '0'::jsonb),
        'municoes',              to_jsonb(o)->>'municoes',
        'municoes_itens',        coalesce(to_jsonb(o)->'municoes_itens', '[]'::jsonb),
        'itens_recuperados',     coalesce(to_jsonb(o)->'itens_recuperados', '[]'::jsonb),
        'bens_subtraidos',       coalesce(to_jsonb(o)->'bens_subtraidos', '[]'::jsonb),

        'entorpecentes',         to_jsonb(o)->>'entorpecentes',
        'entorpecentes_itens',   coalesce(to_jsonb(o)->'entorpecentes_itens', '[]'::jsonb),
        'maconha',               coalesce(to_jsonb(o)->'maconha', '0'::jsonb),
        'cocaina',               coalesce(to_jsonb(o)->'cocaina', '0'::jsonb),
        'pasta_base',            coalesce(to_jsonb(o)->'pasta_base', '0'::jsonb),
        'crack',                 coalesce(to_jsonb(o)->'crack', '0'::jsonb),
        'skank',                 coalesce(to_jsonb(o)->'skank', '0'::jsonb),

        'vitima_nacionalidade',  to_jsonb(o)->>'vitima_nacionalidade',
        'vitima_sexo',           to_jsonb(o)->>'vitima_sexo',
        'vitima_idade',          to_jsonb(o)->'vitima_idade',
        'infrator_nacionalidade',to_jsonb(o)->>'infrator_nacionalidade',
        'infrator_sexo',         to_jsonb(o)->>'infrator_sexo',
        'infrator_idade',        to_jsonb(o)->'infrator_idade',
        'observacao_final',      to_jsonb(o)->>'observacao_final',

        'disparo',               to_jsonb(o)->>'disparo',
        'auto_resistencia',      to_jsonb(o)->>'auto_resistencia',
        'quantidade_autos_infracao', coalesce(to_jsonb(o)->'quantidade_autos_infracao', '0'::jsonb),
        'auto_infracao',         to_jsonb(o)->>'auto_infracao',
        'tatico_setorial',       coalesce(to_jsonb(o)->'tatico_setorial', 'false'::jsonb)
      )
      order by o.data_ocorrencia desc
    ),
    '[]'::jsonb
  )
  from public.ocorrencias o
  where (data_inicio is null or o.data_ocorrencia >= data_inicio)
    and (data_fim is null or o.data_ocorrencia <= data_fim);
$function$;

commit;
