-- Reversão manual: restaurar o predicado original da política de INSERT compartilhado GIRO.
ALTER POLICY giro_abordagens_insert_acesso_compartilhado
  ON public.giro_abordagens
  WITH CHECK (((criado_por = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM (giro_acessos_abordagem a
     JOIN unidades u ON ((u.id = a.unidade_id)))
  WHERE ((a.user_id = ( SELECT auth.uid() AS uid)) AND (a.ativo = true) AND (u.ativo = true) AND (upper(u.sigla) = 'GIRO'::text) AND (a.unidade_id = giro_abordagens.unidade_id))))));
