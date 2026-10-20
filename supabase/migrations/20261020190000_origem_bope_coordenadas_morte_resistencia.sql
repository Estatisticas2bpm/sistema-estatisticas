-- Campos institucionais adicionais; nenhum dado anterior é modificado.
-- Origem somente lançada pelo formulário do BOPE. 
ALTER TABLE public.ocorrencias
 ADD COLUMN IF NOT EXISTS origem_ocorrencia text,
 ADD COLUMN IF NOT EXISTS origem_ocorrencia_detalhe text,
 ADD COLUMN IF NOT EXISTS auto_resistencia_resultou_morte text;

ALTER TABLE public.ocorrencias
 DROP CONSTRAINT IF EXISTS ocorrencias_origem_ocorrencia_check;
ALTER TABLE public.ocorrencias
 ADD CONSTRAINT ocorrencias_origem_ocorrencia_check
 CHECK (origem_ocorrencia IS NULL OR origem_ocorrencia IN
   ('MISSAO','CCC','REDE_FALCAO','PATRULHAMENTO','OUTRA'));

ALTER TABLE public.ocorrencias
 DROP CONSTRAINT IF EXISTS ocorrencias_auto_resistencia_resultou_morte_check;
ALTER TABLE public.ocorrencias
 ADD CONSTRAINT ocorrencias_auto_resistencia_resultou_morte_check
 CHECK (auto_resistencia_resultou_morte IS NULL OR
  (auto_resistencia_resultou_morte IN ('SIM','NÃO')
   AND (auto_resistencia_resultou_morte <> 'SIM' OR auto_resistencia='SIM')));

COMMENT ON COLUMN public.ocorrencias.origem_ocorrencia IS 'Origem institucional da ocorrência (cadastro exclusivo BOPE): missão, CCC, Rede Falcão, patrulhamento ou outra.';
COMMENT ON COLUMN public.ocorrencias.origem_ocorrencia_detalhe IS 'Descrição complementar da origem BOPE, especialmente missão ou outra.';
COMMENT ON COLUMN public.ocorrencias.auto_resistencia_resultou_morte IS 'SIM/NÃO: morte decorrente de intervenção policial envolvendo auto de resistência; distinto de disparo ou auto de resistência sem morte. Registros anteriores continuam não informados.';
