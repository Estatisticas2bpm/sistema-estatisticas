-- SIE-CPC: impedir INSERT de abordagens GIRO quando a unidade de trabalho ativa é COMANDO.
-- Preserva o compartilhamento legítimo do GIRO para usuários sem unidade operacional
-- principal (private.unidade_atual() IS NULL), e as demais condições originais.
-- O bloqueio é aplicado na política RLS do banco, não apenas na interface.
ALTER POLICY giro_abordagens_insert_acesso_compartilhado
  ON public.giro_abordagens
  WITH CHECK (
    ((criado_por = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM (giro_acessos_abordagem a
     JOIN unidades u ON ((u.id = a.unidade_id)))
  WHERE ((a.user_id = ( SELECT auth.uid() AS uid)) AND (a.ativo = true) AND (u.ativo = true) AND (upper(u.sigla) = 'GIRO'::text) AND (a.unidade_id = giro_abordagens.unidade_id)))))
    AND NOT COALESCE((
  SELECT u.tipo = 'COMANDO'
  FROM public.unidades u
  WHERE u.id = private.unidade_atual()
), false)
  );
