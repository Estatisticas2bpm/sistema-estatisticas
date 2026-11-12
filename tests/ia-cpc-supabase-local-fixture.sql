-- Somente homologação LOCAL do Supabase CLI. NÃO aplicar em produção.
-- O Supabase CLI já fornece auth.users, auth.sessions, auth.uid e roles.
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS public.unidades(
  id uuid PRIMARY KEY,
  sigla text NOT NULL UNIQUE,
  nome text NOT NULL DEFAULT 'Unidade fictícia',
  tipo text NOT NULL DEFAULT 'OPERACIONAL',
  ativo boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.perfis_usuarios(
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  perfil text NOT NULL,
  nome text,
  nome_guerra text,
  posto_graduacao text,
  matricula text,
  email text,
  senha_temporaria boolean NOT NULL DEFAULT false,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  ativo boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.sessoes_revogadas(
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.bairros(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.tipos_ocorrencia(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.ocorrencias(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_ocorrencia date NOT NULL,
  hora_inicial time,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  ocorrencia text,
  crime text,
  bairro text,
  status_registro text NOT NULL DEFAULT 'rascunho',
  numero_conduzidos integer DEFAULT 0,
  numero_prisoes integer DEFAULT 0,
  quantidade_armas integer DEFAULT 0,
  veiculos_recuperados integer DEFAULT 0,
  naturezas_itens jsonb DEFAULT '[]'::jsonb,
  crimes_itens jsonb DEFAULT '[]'::jsonb,
  historico_resumido text,
  detalhes text,
  observacao text,
  observacao_final text,
  ativo boolean NOT NULL DEFAULT true
);
-- RLS para dados sintéticos: somente o próprio perfil e catálogos de unidades.
-- Acesso operacional e tabelas financeiras continuam restritos ao backend.
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessoes_revogadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bairros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_ocorrencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.sessoes_presenca(
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ultimo_sinal timestamptz,
  atualizado_em timestamptz,
  user_agent text,
  pagina text
);
ALTER TABLE public.sessoes_presenca ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.perfis_usuarios, public.unidades TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.sessoes_presenca TO authenticated;
CREATE POLICY ia_teste_perfil_proprio ON public.perfis_usuarios
  FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id);
CREATE POLICY ia_teste_unidades_ativas ON public.unidades
  FOR SELECT TO authenticated USING (ativo);
CREATE POLICY ia_teste_presenca_propria ON public.sessoes_presenca
  FOR ALL TO authenticated
  USING ((SELECT auth.uid())=user_id)
  WITH CHECK ((SELECT auth.uid())=user_id);

CREATE OR REPLACE FUNCTION public.obter_contexto_unidade_usuario()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT jsonb_build_object(
   'unidade_id',u.id,'sigla',u.sigla,'nome',u.nome,'tipo',u.tipo,
   'somente_leitura_operacional',false,'pode_alternar',false
 ) FROM public.perfis_usuarios p
 JOIN public.unidades u ON u.id=p.unidade_id AND u.ativo
 WHERE p.user_id=(SELECT auth.uid()) AND p.ativo
$fn$;
REVOKE ALL ON FUNCTION public.obter_contexto_unidade_usuario()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.obter_contexto_unidade_usuario()
  TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.obter_modulos_usuario()
RETURNS TABLE(codigo text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT NULL::text WHERE false
$fn$;
REVOKE ALL ON FUNCTION public.obter_modulos_usuario()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.obter_modulos_usuario()
  TO authenticated,service_role;

GRANT USAGE ON SCHEMA private TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

CREATE OR REPLACE FUNCTION private.usuario_ativo()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT EXISTS (
  SELECT 1 FROM public.perfis_usuarios p
  WHERE p.user_id=(SELECT auth.uid()) AND p.ativo
 )
$fn$;
REVOKE ALL ON FUNCTION private.usuario_ativo() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.usuario_ativo() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.admin_validar_sessao(
 p_user_id uuid,p_session_id uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT p_user_id IS NOT NULL AND p_session_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM auth.sessions s
    WHERE s.id=p_session_id AND s.user_id=p_user_id
      AND (s.not_after IS NULL OR s.not_after>now()))
  AND NOT EXISTS (SELECT 1 FROM public.sessoes_revogadas r
    WHERE r.session_id=p_session_id AND r.user_id=p_user_id)
$fn$;
REVOKE ALL ON FUNCTION public.admin_validar_sessao(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_validar_sessao(uuid,uuid) TO service_role;

INSERT INTO public.unidades(id,sigla,nome,ativo) VALUES
('00000000-0000-4000-8000-000000000101','CPC','Comando de Policiamento da Capital',true),
('00000000-0000-4000-8000-000000000102','2BPM','2º BPM fictício',true),
('00000000-0000-4000-8000-000000000103','1BPM','1º BPM fictício',true);

INSERT INTO public.bairros(nome,ativo) VALUES ('CENTRO',true);
INSERT INTO public.tipos_ocorrencia(nome,ativo)
 VALUES ('FURTO',true),('ROUBO',true),('TENTATIVA DE FURTO',true);

NOTIFY pgrst,'reload schema';
