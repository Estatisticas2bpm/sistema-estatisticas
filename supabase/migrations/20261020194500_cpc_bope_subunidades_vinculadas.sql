-- Os BOs são registrados pelo BOPE (unidade_id), mas identificam a companhia
-- responsável em subunidade_operacional_id. O CPC precisa das duas dimensões.
-- A ocorrência permanece em uma única linha e não é duplicada no consolidado.
-- Os mesmos cuidados valem aos TCOs vinculados a esses BOs.
DO $mig$
DECLARE
  func text;
  original text;
BEGIN
  SELECT pg_get_functiondef('public.obter_home_cpc(date,date)'::regprocedure)
    INTO original;
  IF original IS NULL THEN
    RAISE EXCEPTION 'RPC de consolidação CPC não localizada.';
  END IF;
  IF strpos(original, 'o.unidade_id,d.sigla as unidade_sigla') = 0 OR
     strpos(original, '''unidade_id'',b.unidade_id') = 0 OR
     strpos(original, '''unidade_id'',t.unidade_id') = 0 THEN
    RAISE EXCEPTION 'Contrato do RPC CPC alterado; requer revisão antes da implantação.';
  END IF;
  func:=replace(original,
    'o.unidade_id,d.sigla as unidade_sigla',
    'o.unidade_id,o.subunidade_operacional_id,d.sigla as unidade_sigla');
  func:=replace(func,
    '''unidade_id'',b.unidade_id',
    '''unidade_id'',b.unidade_id,''subunidade_operacional_id'',b.subunidade_operacional_id');
  func:=replace(func,
    '''unidade_id'',t.unidade_id',
    '''unidade_id'',t.unidade_id,''subunidade_operacional_id'',t.subunidade_operacional_id');
  EXECUTE func;
END
$mig$;
