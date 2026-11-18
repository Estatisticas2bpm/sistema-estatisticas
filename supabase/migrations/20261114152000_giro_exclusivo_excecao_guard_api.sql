-- SIE-CPC / GIRO: compatibilizar contas exclusivas do registro móvel com a guarda REST.
-- Causa da falha (14/11/2026): a guarda exigia perfil institucional em perfis_usuarios,
-- mas contas individuais de patrulhamento são, deliberadamente, somente GIRO.
-- Aplicada ao banco em 14/11/2026 e versionada aqui para evitar regressão.
--
-- Princípio: NÃO inserir perfil geral nas contas do GIRO e NÃO liberar todos os endpoints.
-- Permite apenas GET do próprio cadastro (RLS user_id = auth.uid())
-- e POST da RPC registrar_abordagem_giro (validação adicional na própria RPC/RLS).
create or replace function private.verificar_acesso_api()
returns void
language plpgsql security definer set search_path to ''
as $function$
declare
  v_role text := coalesce(auth.role()::text, '');
  v_uid uuid := auth.uid();
  v_path text := coalesce(nullif(current_setting('request.path', true),''),'');
  v_method text := upper(coalesce(nullif(current_setting('request.method', true),''),''));
  v_session_text text := auth.jwt()->>'session_id';
begin
  -- Inalterado: acesso interno de serviço.
  if v_role = 'service_role' then
    return;
  end if;
  -- Inalterado: usuário institucional com perfil ativo e sessão não revogada.
  if v_role = 'authenticated' and private.usuario_ativo() then
    return;
  end if;
  -- Exceção de superfície mínima: usuário exclusivo, perfil institucional inexistente.
  if v_role = 'authenticated'
     and v_uid is not null
     and (
       (v_method = 'GET' and v_path in (
         '/giro_acessos_abordagem','/rest/v1/giro_acessos_abordagem'
       )) or
       (v_method = 'POST' and v_path in (
         '/rpc/registrar_abordagem_giro','/rest/v1/rpc/registrar_abordagem_giro'
       ))
     )
     and v_session_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and exists (
       select 1 from auth.sessions s
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
  raise insufficient_privilege using message = 'Acesso ao sistema não autorizado.';
end;
$function$;

comment on function private.verificar_acesso_api() is
'Guarda REST: perfis SIE-CPC ativos como antes; exceção restrita às contas exclusivas do GIRO, GET giro_acessos_abordagem e POST registrar_abordagem_giro, com sessão válida.';
