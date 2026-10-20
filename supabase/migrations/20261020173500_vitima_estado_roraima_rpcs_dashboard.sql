-- Preserva integralmente os contratos de edição e dashboard existentes,
-- acrescentando apenas a classificação da vítima pessoa jurídica/ente público.
DO $mig$
DECLARE
  definicao text;
  alterada text;
BEGIN
  SELECT pg_get_functiondef('public.atualizar_ocorrencia_publica(uuid,jsonb)'::regprocedure)
    INTO definicao;
  IF position('vitima_nacionalidade=v.vitima_nacionalidade,' IN definicao)=0 THEN
    RAISE EXCEPTION 'Não foi localizado o ponto de atualização do tipo da vítima.';
  END IF;
  alterada := replace(definicao,
    'vitima_nacionalidade=v.vitima_nacionalidade,',
    'vitima_tipo=coalesce(v.vitima_tipo,''PESSOA_FISICA''), vitima_nacionalidade=v.vitima_nacionalidade,');
  EXECUTE alterada;

  SELECT pg_get_functiondef('public.obter_dados_dashboard(date,date)'::regprocedure)
    INTO definicao;
  IF position('''vitima_nacionalidade'',o.vitima_nacionalidade,' IN definicao)=0 THEN
    RAISE EXCEPTION 'Não foi localizado o campo da vítima no dashboard.';
  END IF;
  alterada := replace(definicao,
    '''vitima_nacionalidade'',o.vitima_nacionalidade,',
    '''vitima_tipo'',o.vitima_tipo, ''vitima_nacionalidade'',o.vitima_nacionalidade,');
  EXECUTE alterada;
END
$mig$;
