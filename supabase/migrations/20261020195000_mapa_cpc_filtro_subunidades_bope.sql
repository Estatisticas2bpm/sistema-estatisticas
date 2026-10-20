-- Mantém o perímetro de leitura autorizado pelo contexto COMANDO,
-- mas permite filtrar pelo grupamento operacional vinculado ao BOPE.
-- Não muda a unidade que lançou o BO nem duplica pontos geográficos.
DO $mig$
DECLARE
  definition text;
  amended text;
BEGIN
  SELECT pg_get_functiondef('public.obter_mapa_cpc_territorial(date,date,uuid,text,text,text,text,text)'::regprocedure)
    INTO definition;
  IF definition IS NULL OR position('or o.unidade_id=p_unidade_id' IN definition)=0 THEN
    RAISE EXCEPTION 'Filtro territorial CPC não encontrado para atualização segura.';
  END IF;
  amended := replace(definition,
    'or o.unidade_id=p_unidade_id',
    'or o.unidade_id=p_unidade_id
    or o.subunidade_operacional_id=p_unidade_id');
  EXECUTE amended;
END
$mig$;
