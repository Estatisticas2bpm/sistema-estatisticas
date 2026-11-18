CREATE OR REPLACE FUNCTION public.cipg_autoria_servicos(p_inicio date, p_fim date, p_policial uuid DEFAULT NULL::uuid)
 RETURNS TABLE(servico_id uuid, data_servico date, numero_sei text, turno text, criado_em timestamp with time zone, policial_id uuid, nome_completo text, posto_graduacao text, nome_guerra text, email text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select s.id,s.data_servico,coalesce(s.codigo_relatorio,s.numero_sei)::text,s.turno_cipg::text,s.criado_em,
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
$function$;
