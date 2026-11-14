-- GIRO — consulta administrativa por período, policial, auditoria e exclusão controlada.
-- Migration version of the changes applied on 2026-11-14.
-- Auditoria preserva o conteúdo original removido da tabela operacional;
-- rankings e demais consultas de produção não contabilizam registros excluídos.
create table if not exists public.giro_abordagens_exclusoes (
  id uuid primary key,
  abordagem jsonb not null,
  registrado_em timestamptz not null,
  criado_por uuid not null references auth.users(id) on delete restrict,
  unidade_id uuid not null references public.unidades(id) on delete restrict,
  tipo_abordagem text not null,
  quantidade_pessoas smallint not null,
  bairro text,
  municipio text,
  endereco text,
  excluida_por uuid not null references auth.users(id) on delete restrict,
  excluida_em timestamptz not null default now(),
  justificativa text not null check(char_length(btrim(justificativa)) between 10 and 500),
  constraint giro_abordagens_exclusoes_formato check (jsonb_typeof(abordagem) = 'object')
);
create index if not exists giro_abordagens_exclusoes_data_idx
  on public.giro_abordagens_exclusoes(registrado_em desc,criado_por);
alter table public.giro_abordagens_exclusoes enable row level security;
revoke all on public.giro_abordagens_exclusoes from public,anon,authenticated;
comment on table public.giro_abordagens_exclusoes is
'Arquivo de auditoria dos registros removidos por ADMIN do GIRO, contendo instantâneo original, justificativa e autor. Sem acesso direto a usuários comuns.';

CREATE OR REPLACE FUNCTION public.giro_excluir_abordagem_admin(p_abordagem_id uuid, p_justificativa text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_registro public.giro_abordagens%rowtype;
  v_justificativa text := btrim(coalesce(p_justificativa,''));
  v_id uuid := auth.uid();
begin
  if auth.role() is distinct from 'authenticated'
    or private.perfil_atual() is distinct from 'ADMIN'
    or not private.usuario_ativo() then
    raise exception 'Somente administrador ativo pode excluir abordagens do GIRO.' using errcode='42501';
  end if;
  if p_abordagem_id is null or char_length(v_justificativa) not between 10 and 500 then
    raise exception 'Informe a abordagem e justificativa de 10 a 500 caracteres.' using errcode='22023';
  end if;

  select b.* into v_registro from public.giro_abordagens b
  join public.unidades u on u.id=b.unidade_id and upper(u.sigla)='GIRO'
  where b.id=p_abordagem_id
  for update of b;
  if not found then
    raise exception 'Registro do GIRO não encontrado ou já excluído.' using errcode='P0002';
  end if;

  insert into public.giro_abordagens_exclusoes (
    id,abordagem,registrado_em,criado_por,unidade_id,
    tipo_abordagem,quantidade_pessoas,bairro,municipio,endereco,
    excluida_por,justificativa
  ) values (
    v_registro.id,to_jsonb(v_registro),v_registro.registrado_em,v_registro.criado_por,v_registro.unidade_id,
    v_registro.tipo_abordagem,v_registro.quantidade_pessoas,v_registro.bairro,v_registro.municipio,v_registro.endereco,
    v_id,v_justificativa
  );

  delete from public.giro_abordagens b where b.id=v_registro.id;
  if not found then
    raise exception 'Falha ao excluir registro; transação revertida.' using errcode='P0001';
  end if;
  return jsonb_build_object('excluida',true,'abordagem_id',v_registro.id,'auditada',true);
end
$function$
;

CREATE OR REPLACE FUNCTION public.giro_listar_abordagens_admin(p_inicio timestamp with time zone, p_fim timestamp with time zone, p_usuario_id uuid DEFAULT NULL::uuid, p_pagina integer DEFAULT 1, p_tamanho integer DEFAULT 50, p_situacao text DEFAULT 'ATIVAS'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_resultado jsonb;
  v_situacao text := upper(btrim(coalesce(p_situacao,'ATIVAS')));
begin
  if auth.role() is distinct from 'authenticated'
     or private.perfil_atual() is distinct from 'ADMIN'
     or not private.usuario_ativo() then
    raise exception 'Somente administrador ativo pode consultar todas as abordagens do GIRO.' using errcode='42501';
  end if;
  if p_inicio is null or p_fim is null or p_fim<=p_inicio or p_fim>p_inicio+interval '10 years'
     or coalesce(p_pagina,0)<1 or p_pagina>100000
     or coalesce(p_tamanho,0) not between 1 and 100
     or v_situacao not in ('ATIVAS','EXCLUIDAS','TODAS') then
    raise exception 'Filtros de pesquisa inválidos.' using errcode='22023';
  end if;

  with fonte as (
    select b.id, b.registrado_em, b.criado_por,
           b.tipo_abordagem,b.quantidade_pessoas,b.bairro,b.municipio,b.endereco,
           false as excluida,null::timestamptz as excluida_em,
           null::text as justificativa_exclusao
      from public.giro_abordagens b
      join public.unidades u on u.id=b.unidade_id and upper(u.sigla)='GIRO'
      where v_situacao in ('ATIVAS','TODAS')
    union all
    select x.id,x.registrado_em,x.criado_por,
           x.tipo_abordagem,x.quantidade_pessoas,x.bairro,x.municipio,x.endereco,
           true,x.excluida_em,x.justificativa
      from public.giro_abordagens_exclusoes x
      join public.unidades u on u.id=x.unidade_id and upper(u.sigla)='GIRO'
      where v_situacao in ('EXCLUIDAS','TODAS')
  ),
  filtradas as (
    select f.*,coalesce(nullif(a.nome_guerra,''),nullif(per.nome_guerra,''),nullif(per.nome,''),'Conta antiga / não identificada') nome_guerra,
           coalesce(nullif(a.nome_completo,''),nullif(per.nome,''),'Não informado') nome_completo,
           coalesce(nullif(a.matricula,''),nullif(per.matricula,''),'—') matricula
    from fonte f
    left join public.giro_acessos_abordagem a on a.user_id=f.criado_por
    left join public.perfis_usuarios per on per.user_id=f.criado_por
    where f.registrado_em>=p_inicio and f.registrado_em<p_fim
    and (p_usuario_id is null or f.criado_por=p_usuario_id)
  ),
  pagina as (
    select * from filtradas order by registrado_em desc,id desc
    limit p_tamanho offset (p_pagina-1)*p_tamanho
  ),
  autores as (
    select b.criado_por user_id
      from public.giro_abordagens b
      join public.unidades u on u.id=b.unidade_id and upper(u.sigla)='GIRO'
    union
    select x.criado_por
      from public.giro_abordagens_exclusoes x
      join public.unidades u on u.id=x.unidade_id and upper(u.sigla)='GIRO'
  ),
  lista_usuarios as (
    select autores.user_id,
      coalesce(nullif(a.nome_guerra,''),nullif(per.nome_guerra,''),nullif(per.nome,''),'Conta antiga / não identificada') nome_guerra,
      coalesce(nullif(a.nome_completo,''),nullif(per.nome,''),'Não informado') nome_completo,
      coalesce(nullif(a.matricula,''),nullif(per.matricula,''),'—') matricula
    from autores
    left join public.giro_acessos_abordagem a on a.user_id=autores.user_id
    left join public.perfis_usuarios per on per.user_id=autores.user_id
  )
  select jsonb_build_object(
    'total',(select count(*) from filtradas),
    'total_pessoas',coalesce((select sum(quantidade_pessoas) from filtradas),0),
    'pagina',p_pagina,'tamanho',p_tamanho,
    'itens',coalesce((select jsonb_agg(to_jsonb(p) order by p.registrado_em desc,p.id desc) from pagina p),'[]'::jsonb),
    'usuarios',coalesce((
      select jsonb_agg(jsonb_build_object('id',l.user_id,'nome_guerra',l.nome_guerra,'nome_completo',l.nome_completo,'matricula',l.matricula)
        order by l.nome_guerra,l.nome_completo) from lista_usuarios l
    ),'[]'::jsonb)
  ) into v_resultado;
  return v_resultado;
end
$function$
;

CREATE OR REPLACE FUNCTION public.giro_ranking_militares(p_inicio timestamp with time zone, p_fim timestamp with time zone)
 RETURNS TABLE(policial_id uuid, nome_completo text, nome_guerra text, matricula text, quantidade_abordagens bigint, pessoas_abordadas bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select b.criado_por,
    coalesce(nullif(a.nome_completo,''),nullif(p.nome,''),'Conta anterior / sem identificação')::text,
    coalesce(nullif(a.nome_guerra,''),nullif(p.nome_guerra,''),nullif(p.nome,''),'Conta anterior / sem identificação')::text,
    coalesce(nullif(a.matricula,''),nullif(p.matricula,''),'—')::text,
    count(b.id)::bigint,
    coalesce(sum(b.quantidade_pessoas),0)::bigint
  from public.giro_abordagens b
  join public.unidades g on g.id=b.unidade_id and upper(g.sigla)='GIRO'
  left join public.giro_acessos_abordagem a on a.user_id=b.criado_por
  left join public.perfis_usuarios p on p.user_id=b.criado_por
  where b.registrado_em>=p_inicio and b.registrado_em<p_fim
  and exists (
    select 1 from public.perfis_usuarios c
    join public.unidades u on u.id=c.unidade_id
    where c.user_id=(select auth.uid()) and c.ativo=true and u.ativo=true
      and c.perfil in ('ADMIN','ESTATISTICA')
      and (c.perfil='ADMIN' or upper(u.sigla)='GIRO')
  )
  group by b.criado_por,a.nome_completo,a.nome_guerra,a.matricula,p.nome,p.nome_guerra,p.matricula
  order by count(b.id) desc,coalesce(sum(b.quantidade_pessoas),0) desc,3;
$function$
;

revoke all on function public.giro_listar_abordagens_admin(timestamptz,timestamptz,uuid,integer,integer,text) from public,anon;
revoke all on function public.giro_excluir_abordagem_admin(uuid,text) from public,anon;
revoke all on function public.giro_ranking_militares(timestamptz,timestamptz) from public,anon;
grant execute on function public.giro_listar_abordagens_admin(timestamptz,timestamptz,uuid,integer,integer,text) to authenticated;
grant execute on function public.giro_excluir_abordagem_admin(uuid,text) to authenticated;
grant execute on function public.giro_ranking_militares(timestamptz,timestamptz) to authenticated;
comment on function public.giro_excluir_abordagem_admin(uuid,text) is
'Exclusão do GIRO permitida apenas ADMIN com sessão válida: arquiva o registro original de forma auditável antes de remover da estatística, em uma única transação.';
