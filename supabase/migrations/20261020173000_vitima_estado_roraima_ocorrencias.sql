-- Contrato explícito para vítima ente público, sem falsear nacionalidade/sexo/idade.
ALTER TABLE public.ocorrencias
  ADD COLUMN IF NOT EXISTS vitima_tipo text NOT NULL DEFAULT 'PESSOA_FISICA';
ALTER TABLE public.ocorrencias
  DROP CONSTRAINT IF EXISTS ocorrencias_vitima_tipo_check;
ALTER TABLE public.ocorrencias
  ADD CONSTRAINT ocorrencias_vitima_tipo_check
    CHECK (vitima_tipo IN ('PESSOA_FISICA','ESTADO_RORAIMA'));
ALTER TABLE public.ocorrencias
  DROP CONSTRAINT IF EXISTS ocorrencias_estado_vitima_sem_dados_fisicos_check;
ALTER TABLE public.ocorrencias
  ADD CONSTRAINT ocorrencias_estado_vitima_sem_dados_fisicos_check
    CHECK (vitima_tipo <> 'ESTADO_RORAIMA' OR
      (vitima_nacionalidade IS NULL AND vitima_sexo IS NULL AND vitima_idade IS NULL));
COMMENT ON COLUMN public.ocorrencias.vitima_tipo IS
  'Tipo da vítima principal. ESTADO_RORAIMA identifica ente público (Estado de Roraima); não deve compor estatísticas de pessoas físicas.';
