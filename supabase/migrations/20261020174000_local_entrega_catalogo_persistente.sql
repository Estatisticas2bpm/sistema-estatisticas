-- Cadastro persistente de locais de entrega para todas as unidades, com RLS
-- e autorização de escrita por contexto. A configuração de até seis atalhos
-- permanece individualizada por unidade.
CREATE OR REPLACE FUNCTION public.cadastrar_local_entrega_unidade(p_nome text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $func$
DECLARE
  v_nome text := upper(trim(regexp_replace(coalesce(p_nome,''), '[[:space:]]+', ' ', 'g')));
  v_local public.locais_apresentacao%rowtype;
BEGIN
  IF NOT private.pode_escrever_operacional() THEN
    RAISE EXCEPTION 'Sua conta não tem permissão para cadastrar locais de entrega.'
      USING ERRCODE='42501';
  END IF;
  IF length(v_nome)<2 OR length(v_nome)>120 OR v_nome !~ '^[[:alnum:]]' THEN
    RAISE EXCEPTION 'Informe o nome ou a sigla do local (2 a 120 caracteres).'
      USING ERRCODE='23514';
  END IF;
  SELECT * INTO v_local
  FROM public.locais_apresentacao
  WHERE upper(trim(nome))=v_nome
  ORDER BY id LIMIT 1;
  IF FOUND THEN
    IF v_local.ativo IS NOT TRUE THEN
      RAISE EXCEPTION 'Este local está desativado. Solicite a reativação à administração.'
        USING ERRCODE='23514';
    END IF;
    RETURN jsonb_build_object('id',v_local.id,'nome',v_local.nome,'existente',true);
  END IF;
  INSERT INTO public.locais_apresentacao(nome,ativo)
  VALUES (v_nome,true)
  ON CONFLICT (nome) DO NOTHING
  RETURNING * INTO v_local;
  IF v_local.id IS NULL THEN
    SELECT * INTO v_local FROM public.locais_apresentacao
    WHERE upper(trim(nome))=v_nome ORDER BY id LIMIT 1;
  END IF;
  IF v_local.id IS NULL OR v_local.ativo IS NOT TRUE THEN
    RAISE EXCEPTION 'Não foi possível confirmar o cadastro do local de entrega.';
  END IF;
  RETURN jsonb_build_object('id',v_local.id,'nome',v_local.nome,'existente',false);
END
$func$;
REVOKE ALL ON FUNCTION public.cadastrar_local_entrega_unidade(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cadastrar_local_entrega_unidade(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.cadastrar_local_entrega_unidade(text) TO authenticated;

-- "CIPA" será uma opção institucional válida no catálogo; não altera os
-- atalhos já personalizados pela unidade CIPA nem pelas demais unidades.
INSERT INTO public.locais_apresentacao(nome,ativo)
VALUES('CIPA',true)
ON CONFLICT(nome) DO UPDATE SET ativo=true;
