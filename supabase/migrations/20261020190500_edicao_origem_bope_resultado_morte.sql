-- Acrescenta campos novos ao contrato de edição já existente sem mudar
-- permissões, regras de auditoria ou normalização de materiais.
DO $mig$
DECLARE
  f text;
  alterada text;
BEGIN
  SELECT pg_get_functiondef('public.atualizar_ocorrencia_publica(uuid,jsonb)'::regprocedure) INTO f;
  IF position('disparo=v.disparo,auto_resistencia=v.auto_resistencia,quantidade_autos_infracao' IN f)=0 THEN
    RAISE EXCEPTION 'Contrato de edição de resistência alterado; revisão manual necessária.';
  END IF;
  alterada := replace(f,
    'disparo=v.disparo,auto_resistencia=v.auto_resistencia,quantidade_autos_infracao',
    'disparo=v.disparo,auto_resistencia=v.auto_resistencia,auto_resistencia_resultou_morte=v.auto_resistencia_resultou_morte,origem_ocorrencia=v.origem_ocorrencia,origem_ocorrencia_detalhe=v.origem_ocorrencia_detalhe,quantidade_autos_infracao');
  EXECUTE alterada;
END
$mig$;
