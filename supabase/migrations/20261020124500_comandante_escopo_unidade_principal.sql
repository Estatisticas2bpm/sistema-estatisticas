-- COMANDANTE: visão hierárquica estritamente limitada à unidade principal
-- e descendentes ativos. Ignora escopos adicionais eventualmente herdados
-- de papéis anteriores; demais perfis permanecem com comportamento original.
CREATE OR REPLACE FUNCTION private.unidades_acessiveis_atual()
 RETURNS uuid[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_perfil text := private.perfil_atual();
  v_raiz uuid := private.unidade_atual();
  v_result uuid[];
begin
  if v_perfil IN ('ADMIN','COMANDANTE') then
    if v_raiz is null then
      return array[]::uuid[];
    end if;

    with recursive arvore as (
      select u.id, array[u.id]::uuid[] as caminho
      from public.unidades u
      where u.id = v_raiz
        and u.ativo = true

      union all

      select u.id, a.caminho || u.id
      from arvore a
      join public.unidades u
        on u.parent_id = a.id
      where u.ativo = true
        and not u.id = any(a.caminho)
    )
    select coalesce(array_agg(distinct id), array[]::uuid[])
      into v_result
    from arvore;
    return coalesce(v_result, array[]::uuid[]);
  end if;

  with recursive sementes as (
    select
      e.unidade_id,
      e.incluir_descendentes,
      array[e.unidade_id]::uuid[] as caminho
    from public.usuarios_unidades_escopo e
    join public.perfis_usuarios p
      on p.user_id = e.user_id
    where e.user_id = (select auth.uid())
      and p.ativo = true
  ), expandidas as (
    select
      s.unidade_id,
      s.incluir_descendentes,
      s.caminho
    from sementes s
    union all
    select
      u.id,
      e.incluir_descendentes,
      e.caminho || u.id
    from expandidas e
    join public.unidades u
      on u.parent_id = e.unidade_id
    where e.incluir_descendentes = true
      and not u.id = any(e.caminho)
  )
  select coalesce(array_agg(distinct unidade_id), array[]::uuid[])
    into v_result
  from expandidas;
  return coalesce(v_result, array[]::uuid[]);
end
$function$;
