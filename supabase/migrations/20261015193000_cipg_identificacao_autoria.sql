alter table public.cipg_acessos_caderno add column if not exists nome_completo text;
alter table public.cipg_acessos_caderno add column if not exists posto_graduacao text;
alter table public.cipg_acessos_caderno add column if not exists nome_guerra text;
alter table public.cipg_acessos_caderno add constraint cipg_identificacao_obrigatoria check (
 length(trim(coalesce(nome_completo,'')))>=3 and length(trim(coalesce(posto_graduacao,'')))>=2 and length(trim(coalesce(nome_guerra,'')))>=2
 ) not valid;
create index if not exists cipg_servicos_criado_por_data_idx on public.cipg_servicos_guarda(criado_por,data_servico);
create index if not exists cipg_eventos_criado_por_idx on public.cipg_eventos_guarda(criado_por);
-- Consulta administrativa auditável: filtro por policial, data e turno, com identificação persistente.
create or replace function public.cipg_autoria_servicos(p_inicio date,p_fim date,p_policial uuid default null)
returns table(servico_id uuid,data_servico date,numero_sei text,turno text,criado_em timestamptz,
 policial_id uuid,nome_completo text,posto_graduacao text,nome_guerra text,email text)
language sql security definer set search_path='' as $$
 select s.id,s.data_servico,s.numero_sei::text,s.turno_cipg::text,s.criado_em,
 s.criado_por,a.nome_completo,a.posto_graduacao,a.nome_guerra,u.email::text
 from public.cipg_servicos_guarda s
 left join public.cipg_acessos_caderno a on a.user_id=s.criado_por
 left join auth.users u on u.id=s.criado_por
 where s.data_servico between p_inicio and p_fim
 and (p_policial is null or s.criado_por=p_policial)
 and exists (select 1 from public.perfis_usuarios p
 where p.user_id=(select auth.uid()) and p.ativo and
 (p.perfil='ADMIN' or (p.perfil='ESTATISTICA' and p.unidade_id=s.unidade_id)))
 order by s.data_servico desc,s.criado_em desc;
$$;
revoke all on function public.cipg_autoria_servicos(date,date,uuid) from public,anon;
grant execute on function public.cipg_autoria_servicos(date,date,uuid) to authenticated;