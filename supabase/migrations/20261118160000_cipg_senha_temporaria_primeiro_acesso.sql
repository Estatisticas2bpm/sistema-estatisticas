
alter table public.cipg_acessos_caderno add column if not exists senha_temporaria boolean not null default false;
comment on column public.cipg_acessos_caderno.senha_temporaria is
'Conta exclusiva CIPG deve trocar a senha administrativa antes de acessar o caderno. Contas institucionais preservam sua regra principal.';

create or replace function private.cipg_sincronizar_troca_senha()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare
  v_reset boolean := (new.raw_app_meta_data->>'cipg_reset_nonce') is distinct from (old.raw_app_meta_data->>'cipg_reset_nonce');
begin
  if not v_reset and new.encrypted_password is not distinct from old.encrypted_password then return new; end if;
  if exists(select 1 from public.perfis_usuarios p where p.user_id=new.id) then return new; end if;
  if not exists(select 1 from public.cipg_acessos_caderno a where a.user_id=new.id) then return new; end if;
  -- Alteração administrativa usa marcador protegido em app_metadata; alteração
  -- pessoal/recovery efetiva é confirmada pela mudança do hash no Auth.
  update public.cipg_acessos_caderno
     set senha_temporaria=v_reset
   where user_id=new.id;
  -- Impede que sessões anteriores reutilizem uma credencial temporária.
  insert into public.sessoes_revogadas(session_id,user_id,motivo)
  select s.id,s.user_id,case when v_reset then 'CIPG_SENHA_TEMPORARIA_REDEFINIDA' else 'CIPG_SENHA_ALTERADA' end
    from auth.sessions s where s.user_id=new.id
  on conflict(session_id) do nothing;
  return new;
end $fn$;
revoke all on function private.cipg_sincronizar_troca_senha() from public,anon,authenticated;
drop trigger if exists trg_cipg_sincronizar_troca_senha on auth.users;
create trigger trg_cipg_sincronizar_troca_senha
 after update of encrypted_password,raw_app_meta_data on auth.users
 for each row execute function private.cipg_sincronizar_troca_senha();

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
         and (not a.senha_temporaria or (v_method='GET' and v_path in
             ('/cipg_acessos_caderno','/rest/v1/cipg_acessos_caderno')))
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
