-- SIE-CPC: perfil COMANDANTE para consulta estatística exclusivamente.
-- Não concede poderes de escrita, edição, exclusão ou administração.
-- GESTOR é substituído após garantir que não existe usuário com esse perfil.
DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM public.perfis_usuarios WHERE perfil='GESTOR') THEN
    RAISE EXCEPTION 'Existem usuários GESTOR. Migre-os de forma explícita antes de substituir o perfil.';
  END IF;
  ALTER TABLE public.perfis_usuarios DROP CONSTRAINT perfis_usuarios_perfil_check;
  ALTER TABLE public.perfis_usuarios
    ADD CONSTRAINT perfis_usuarios_perfil_check
    CHECK (perfil IN ('ADMIN','ESTATISTICA','OPERADOR','COMANDANTE','CONSULTA'));
END
$mig$;
