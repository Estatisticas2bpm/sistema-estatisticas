-- APENAS CI: instância efêmera PostgreSQL, com identidades fictícias.
-- Não conecta ao Supabase do SIE-CPC. Sem dados reais ou segredos.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS private;
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
GRANT USAGE ON SCHEMA public,auth,private TO authenticated,service_role;
GRANT USAGE ON SCHEMA public TO anon;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.unidades (id uuid PRIMARY KEY, sigla text NOT NULL, ativo boolean NOT NULL);
CREATE TABLE public.perfis_usuarios (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  perfil text NOT NULL,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  ativo boolean NOT NULL
);
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE SET search_path=''
AS $fn$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $fn$;

-- Para o teste isolado: substituto da checagem real da sessão; o teste de produção
-- de sessão autêntica/revogada é etapa separada de homologação.
CREATE OR REPLACE FUNCTION private.usuario_ativo()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
  SELECT EXISTS(SELECT 1 FROM public.perfis_usuarios p
                WHERE p.user_id=(SELECT auth.uid()) AND p.ativo)
$fn$;
GRANT EXECUTE ON FUNCTION private.usuario_ativo() TO authenticated;

INSERT INTO public.unidades(id,sigla,ativo) VALUES
 ('00000000-0000-4000-8000-000000000101','CPC',true),
 ('00000000-0000-4000-8000-000000000102','2BPM',true),
 ('00000000-0000-4000-8000-000000000103','1BPM',true);
INSERT INTO auth.users(id)
 SELECT ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid
 FROM generate_series(1,5) n;
INSERT INTO public.perfis_usuarios(user_id,perfil,unidade_id,ativo) VALUES
 ('00000000-0000-4000-8000-000000000001','ADMIN','00000000-0000-4000-8000-000000000102',true),
 ('00000000-0000-4000-8000-000000000002','COMANDANTE','00000000-0000-4000-8000-000000000101',true),
 ('00000000-0000-4000-8000-000000000003','ADMIN','00000000-0000-4000-8000-000000000102',true),
 ('00000000-0000-4000-8000-000000000004','COMANDANTE','00000000-0000-4000-8000-000000000103',true),
 ('00000000-0000-4000-8000-000000000005','OPERADOR','00000000-0000-4000-8000-000000000101',true);

CREATE OR REPLACE FUNCTION public.ci_assert(condicao boolean, mensagem text)
RETURNS void LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN IF condicao IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Falha de homologação SQL: %',mensagem;
END IF; END $fn$;
