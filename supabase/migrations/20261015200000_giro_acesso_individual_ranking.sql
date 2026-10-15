alter table public.giro_acessos_abordagem add column if not exists nome_completo text;
alter table public.giro_acessos_abordagem add column if not exists nome_guerra text;
alter table public.giro_acessos_abordagem add column if not exists matricula text;
alter table public.giro_acessos_abordagem add column if not exists email text;
create unique index if not exists giro_matricula_unica on public.giro_acessos_abordagem (lower(trim(matricula))) where matricula is not null;
create index if not exists giro_abordagens_autor_data_idx on public.giro_abordagens (criado_por,registrado_em);
create or replace function public.giro_ranking_militares(p_inicio timestamptz,p_fim timestamptz)
returns table(policial_id uuid,nome_completo text,nome_guerra text,matricula text,quantidade_abordagens bigint,pessoas_abordadas bigint)
language sql security definer set search_path='' as $$
select a.user_id,a.nome_completo,a.nome_guerra,a.matricula,
 count(b.id)::bigint,coalesce(sum(b.quantidade_pessoas),0)::bigint
from public.giro_acessos_abordagem a
join public.giro_abordagens b on b.criado_por=a.user_id and b.registrado_em>=p_inicio and b.registrado_em<p_fim
where a.nome_completo is not null and a.matricula is not null
and exists (select 1 from public.perfis_usuarios p join public.unidades u on u.id=p.unidade_id
 where p.user_id=(select auth.uid()) and p.ativo and u.ativo
 and p.perfil in ('ADMIN','ESTATISTICA') and (p.perfil='ADMIN' or upper(u.sigla)='GIRO'))
group by a.user_id,a.nome_completo,a.nome_guerra,a.matricula
order by count(b.id) desc,coalesce(sum(b.quantidade_pessoas),0) desc,a.nome_guerra;
$$;
revoke all on function public.giro_ranking_militares(timestamptz,timestamptz) from public,anon;
grant execute on function public.giro_ranking_militares(timestamptz,timestamptz) to authenticated;