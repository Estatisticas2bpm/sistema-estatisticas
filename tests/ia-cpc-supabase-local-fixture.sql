-- Somente homologação LOCAL do Supabase CLI. NÃO aplicar em produção.
-- O Supabase CLI já fornece auth.users, auth.sessions, auth.uid e roles.
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS public.unidades(
  id uuid PRIMARY KEY,
  sigla text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.perfis_usuarios(
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  perfil text NOT NULL,
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
-- Sem políticas abertas de leitura a anon ou authenticated; o backend
-- usa somente service_role após verificar identidade, sessão e allowlist.
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessoes_revogadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bairros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_ocorrencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;

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

INSERT INTO public.unidades(id,sigla,ativo) VALUES
('00000000-0000-4000-8000-000000000101','CPC',true),
('00000000-0000-4000-8000-000000000102','2BPM',true),
('00000000-0000-4000-8000-000000000103','1BPM',true);

INSERT INTO public.bairros(nome,ativo) VALUES ('CENTRO',true);
INSERT INTO public.tipos_ocorrencia(nome,ativo)
 VALUES ('FURTO',true),('ROUBO',true),('TENTATIVA DE FURTO',true);

NOTIFY pgrst,'reload schema';
