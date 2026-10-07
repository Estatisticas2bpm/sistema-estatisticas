create or replace function public.admin_sessoes_snapshot()
returns table (
  session_id uuid,
  user_id uuid,
  nome text,
  nome_guerra text,
  posto_graduacao text,
  perfil text,
  unidade_sigla text,
  criado_em timestamptz,
  auth_atualizado_em timestamptz,
  auth_refrescado_em timestamp,
  user_agent text,
  ip text,
  aal text,
  ultimo_sinal timestamptz,
  pagina text,
  revogada boolean,
  online boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.user_id,
    p.nome,
    p.nome_guerra,
    p.posto_graduacao,
    p.perfil,
    u.sigla,
    s.created_at,
    s.updated_at,
    s.refreshed_at,
    s.user_agent,
    s.ip::text,
    s.aal::text,
    pr.ultimo_sinal,
    pr.pagina,
    (rv.session_id is not null) as revogada,
    coalesce(rv.session_id is null and pr.ultimo_sinal >= now() - interval '90 seconds', false) as online
  from auth.sessions s
  join public.perfis_usuarios p on p.user_id = s.user_id
  left join public.unidades u on u.id = p.unidade_id
  left join public.sessoes_presenca pr on pr.session_id = s.id
  left join public.sessoes_revogadas rv on rv.session_id = s.id
  where p.ativo = true
    and (s.not_after is null or s.not_after > now())
  order by online desc, coalesce(pr.ultimo_sinal,s.updated_at) desc, p.nome;
$$;

revoke all on function public.admin_sessoes_snapshot() from public, anon, authenticated;
grant execute on function public.admin_sessoes_snapshot() to service_role;