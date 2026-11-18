-- Preserva os perfis institucionais e GIRO; autoriza apenas rotas do Caderno CIPG para suas contas exclusivas ativas.
CREATE OR REPLACE FUNCTION private.verificar_acesso_api()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := coalesce(auth.role()::text, '');
  v_uid uuid := auth.uid();
  v_path text := coalesce(nullif(current_setting('request.path', true),''),'');
  v_method text := upper(coalesce(nullif(current_setting('request.method', true),''),''));
  v_session_text text := auth.jwt()->>'session_id';
begin
  -- Mantém a exceção já existente para serviços confiáveis com JWT service_role.
  if v_role = 'service_role' then
    return;
  end if;

  -- Mantém os critérios originais do SIE-CPC (perfil ativo + sessão válida + não revogada).
  if v_role = 'authenticated' and private.usuario_ativo() then
    return;
  end if;

  -- Contas EXCLUSIVAS do GIRO não têm perfil no SIE-CPC por desenho.
  -- Permite SOMENTE o GET da autorização própria e o POST da RPC de abordagens.
  -- Esta exceção NÃO permite consultas aos dashboards, BOs nem outros recursos.
  if v_role = 'authenticated'
     and v_uid is not null
     and (
       (v_method = 'GET' and v_path in
          ('/giro_acessos_abordagem','/rest/v1/giro_acessos_abordagem'))
       or
       (v_method = 'POST' and v_path in
          ('/rpc/registrar_abordagem_giro','/rest/v1/rpc/registrar_abordagem_giro'))
     )
     and v_session_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and exists (
       select 1
       from auth.sessions s
       join public.giro_acessos_abordagem a
         on a.user_id = s.user_id and a.ativo = true
       join public.unidades u
         on u.id = a.unidade_id
        and u.ativo = true
        and upper(u.sigla) = 'GIRO'
        and u.aceita_registro_operacional = true
       where s.id = v_session_text::uuid
         and s.user_id = v_uid
         and (s.not_after is null or s.not_after > now())
         and nullif(btrim(a.nome_completo),'') is not null
         and nullif(btrim(a.nome_guerra),'') is not null
         and nullif(btrim(a.matricula),'') is not null
         -- Não ressuscita perfis institucionais revogados/bloqueados.
         and not exists (
           select 1 from public.perfis_usuarios p where p.user_id = v_uid
         )
         and not exists (
           select 1 from public.sessoes_revogadas r
           where r.user_id = v_uid and r.session_id = s.id
         )
     )
  then
    return;
  end if;

  -- CIPG: excecao limitada ao Caderno Digital; RLS de autoria permanece.
  if v_role = 'authenticated'
     and v_uid is not null
     and (
       (v_method = 'GET' and v_path in (
         '/cipg_acessos_caderno','/rest/v1/cipg_acessos_caderno',
         '/cipg_postos','/rest/v1/cipg_postos',
         '/cipg_servicos_guarda','/rest/v1/cipg_servicos_guarda',
         '/cipg_eventos_guarda','/rest/v1/cipg_eventos_guarda'
       ))
       or (v_method = 'POST' and v_path in (
         '/cipg_servicos_guarda','/rest/v1/cipg_servicos_guarda',
         '/cipg_eventos_guarda','/rest/v1/cipg_eventos_guarda'
       ))
     )
     and v_session_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and exists (
       select 1 from auth.sessions s
       join auth.users au on au.id=s.user_id
       join public.cipg_acessos_caderno a on a.user_id=s.user_id and a.ativo=true
       join public.unidades u on u.id=a.unidade_id
         and u.ativo=true and upper(u.sigla)='CIPG'
         and u.aceita_registro_operacional=true
       where s.id = v_session_text::uuid and s.user_id=v_uid
         and (s.not_after is null or s.not_after>now())
         and (au.banned_until is null or au.banned_until<=now())
         and not exists (select 1 from public.perfis_usuarios p where p.user_id=v_uid)
         and not exists (select 1 from public.sessoes_revogadas r where r.user_id=v_uid and r.session_id=s.id)
     )
  then
    return;
  end if;

  raise insufficient_privilege
    using message = 'Acesso ao sistema não autorizado.';
end;
$function$;
comment on function private.verificar_acesso_api() is 'Guarda REST: perfis institucionais ativos e exceções restritas ao GIRO e Caderno Digital CIPG, sempre com sessão válida e RLS.';
