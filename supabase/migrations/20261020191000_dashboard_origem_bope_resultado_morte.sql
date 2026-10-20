-- Disponibiliza os novos indicadores nos JSONs consumidos pelos painéis,
-- relatórios e análise estatística, preservando contratos anteriores.
DO $mig$
DECLARE f text; modificado text;
BEGIN
 SELECT pg_get_functiondef('public.obter_dados_dashboard(date,date)'::regprocedure) INTO f;
 IF position('''auto_resistencia'',o.auto_resistencia,' IN f)=0 THEN
   RAISE EXCEPTION 'Ponto do dashboard não encontrado para novo indicador.';
 END IF;
 modificado:=replace(f,
   '''auto_resistencia'',o.auto_resistencia,',
   '''auto_resistencia'',o.auto_resistencia, ''auto_resistencia_resultou_morte'',o.auto_resistencia_resultou_morte, ''origem_ocorrencia'',o.origem_ocorrencia, ''origem_ocorrencia_detalhe'',o.origem_ocorrencia_detalhe,');
 EXECUTE modificado;
END
$mig$;
