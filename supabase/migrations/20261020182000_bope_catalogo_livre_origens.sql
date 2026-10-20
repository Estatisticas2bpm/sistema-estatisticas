-- Catálogo livre e persistente de origens para o BOPE.
-- Não inclui valores pré-definidos: as origens são criadas pelos operadores.
-- Preserva os registros existentes e elimina a antiga enumeração fixa.
ALTER TABLE public.ocorrencias
  DROP CONSTRAINT IF EXISTS ocorrencias_origem_ocorrencia_check;
ALTER TABLE public.ocorrencias
  ADD CONSTRAINT ocorrencias_origem_ocorrencia_check
  CHECK (origem_ocorrencia IS NULL OR
    (char_length(btrim(origem_ocorrencia)) BETWEEN 2 AND 120
     AND origem_ocorrencia !~ '[<>]'));

CREATE TABLE IF NOT EXISTS public.bope_origens_ocorrencia (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome text NOT NULL,
  criado_por uuid NOT NULL DEFAULT auth.uid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bope_origens_nome_valido
    CHECK (char_length(btrim(nome)) BETWEEN 2 AND 120 AND nome !~ '[<>[:cntrl:]]')
);
-- Uma única opção para grafias idênticas, mesmo com caixa/espaços diferentes.
CREATE UNIQUE INDEX IF NOT EXISTS bope_origens_nome_normalizado_uk
  ON public.bope_origens_ocorrencia
  (upper(regexp_replace(btrim(nome), '[[:space:]]+', ' ', 'g')));

ALTER TABLE public.bope_origens_ocorrencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY bope_origens_consulta ON public.bope_origens_ocorrencia
  FOR SELECT TO authenticated
  USING (
    private.usuario_ativo() AND
    EXISTS (
      SELECT 1 FROM public.unidades u
      WHERE u.id=private.unidade_atual()
        AND u.ativo IS TRUE AND u.sigla='BOPE'
    )
  );
CREATE POLICY bope_origens_cadastro ON public.bope_origens_ocorrencia
  FOR INSERT TO authenticated
  WITH CHECK (
    private.pode_escrever_operacional() AND
    criado_por=(SELECT auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.unidades u
      WHERE u.id=private.unidade_atual()
        AND u.ativo IS TRUE AND u.sigla='BOPE'
    )
  );

REVOKE ALL ON TABLE public.bope_origens_ocorrencia FROM PUBLIC,anon;
GRANT SELECT,INSERT ON TABLE public.bope_origens_ocorrencia TO authenticated;

CREATE OR REPLACE FUNCTION public.cadastrar_origem_ocorrencia_bope(p_nome text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_nome text:=upper(regexp_replace(btrim(coalesce(p_nome,'')), '[[:space:]]+', ' ', 'g'));
  v_chave text;
  v_registro public.bope_origens_ocorrencia%rowtype;
  v_novo boolean:=false;
BEGIN
  IF NOT private.pode_escrever_operacional() OR NOT EXISTS (
    SELECT 1 FROM public.unidades u
    WHERE u.id=private.unidade_atual()
      AND u.ativo IS TRUE AND u.sigla='BOPE'
  ) THEN
    RAISE EXCEPTION 'Somente operadores autorizados do BOPE podem cadastrar origens.'
      USING ERRCODE='42501';
  END IF;
  IF char_length(v_nome)<2 OR char_length(v_nome)>120 OR
     v_nome ~ '[<>[:cntrl:]]' THEN
    RAISE EXCEPTION 'Informe uma origem válida, com 2 a 120 caracteres.'
      USING ERRCODE='23514';
  END IF;
  v_chave:=upper(regexp_replace(btrim(v_nome), '[[:space:]]+', ' ', 'g'));
  INSERT INTO public.bope_origens_ocorrencia(nome)
    VALUES (v_nome)
    ON CONFLICT DO NOTHING
    RETURNING * INTO v_registro;
  IF FOUND THEN
    v_novo:=true;
  ELSE
    SELECT * INTO v_registro FROM public.bope_origens_ocorrencia
    WHERE upper(regexp_replace(btrim(nome), '[[:space:]]+', ' ', 'g'))=v_chave
    ORDER BY id LIMIT 1;
  END IF;
  IF v_registro.id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível confirmar a origem cadastrada.';
  END IF;
  RETURN jsonb_build_object('id',v_registro.id,'nome',v_registro.nome,
     'novo',v_novo);
END
$function$;
REVOKE ALL ON FUNCTION public.cadastrar_origem_ocorrencia_bope(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cadastrar_origem_ocorrencia_bope(text) TO authenticated;

COMMENT ON TABLE public.bope_origens_ocorrencia IS
  'Origens de ocorrência informadas manualmente e compartilhadas entre operadores do BOPE. Catálogo inicia vazio.';
