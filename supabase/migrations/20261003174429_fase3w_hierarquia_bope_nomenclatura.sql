-- Fase 3W — nomenclatura institucional e hierarquia operacional BOPE/CPC.
-- CPC e BOPE passam a atuar como contextos agregadores somente leitura.
-- As subunidades do BOPE permanecem como destinos operacionais de BO/TCO.

alter table public.unidades
  add column if not exists aceita_registro_operacional boolean not null default true,
  add column if not exists agrega_descendentes boolean not null default false;

update public.unidades
set nome = case sigla
  when 'BOPE' then 'Batalhão de Operações Policiais Especiais'
  when 'CANIL' then '1ª Companhia de Cães do BOPE'
  when 'FORCA_TATICA' then '2ª Companhia de Força Tática do BOPE'
  when 'CHOQUE' then '3ª Companhia de Choque do BOPE'
  when 'GATE' then 'Grupo de Ações Táticas Especiais'
  when 'CAVALARIA' then '1º Esquadrão Independente de Polícia Montada'
  when 'CIPA' then 'Companhia Independente de Policiamento Ambiental Monte Roraima'
  when 'CIPG' then 'Companhia Independente de Policiamento de Guarda'
  when 'GIRO' then 'Grupamento Independente de Intervenção Rápida Ostensiva'
  else nome
end
where sigla in ('BOPE','CANIL','FORCA_TATICA','CHOQUE','GATE','CAVALARIA','CIPA','CIPG','GIRO');

update public.unidades
set aceita_registro_operacional = (sigla not in ('CPC','BOPE')),
    agrega_descendentes = (sigla in ('CPC','BOPE'));

create or replace function private.pode_escrever_operacional()
returns boolean
language sql
stable security definer
set search_path = ''
as $$
  select
    private.perfil_atual() in ('ADMIN','ESTATISTICA','OPERADOR')
    and exists (
      select 1
      from public.unidades u
      where u.id = private.unidade_atual()
        and u.ativo = true
        and u.aceita_registro_operacional = true
    )
$$;

create or replace function public.obter_contexto_unidade_usuario()
returns jsonb
language sql
stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'perfil', p.perfil,
    'unidade_principal_id', p.unidade_id,
    'unidade_principal_sigla', up.sigla,
    'unidade_principal_nome', up.nome,
    'unidade_id', uc.id,
    'sigla', uc.sigla,
    'nome', uc.nome,
    'tipo', uc.tipo,
    'pode_alternar', (p.perfil = 'ADMIN'),
    'aceita_registro_operacional', uc.aceita_registro_operacional,
    'agrega_descendentes', uc.agrega_descendentes,
    'somente_leitura_operacional', (not uc.aceita_registro_operacional)
  )
  from public.perfis_usuarios p
  join public.unidades up
    on up.id = p.unidade_id
   and up.ativo = true
  join public.unidades uc
    on uc.id = private.unidade_atual()
   and uc.ativo = true
  where p.user_id = (select auth.uid())
    and p.ativo = true
  limit 1
$$;

create or replace function public.definir_contexto_unidade_admin(p_unidade_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_perfil text := private.perfil_atual();
  v_anterior uuid := private.unidade_atual();
  v_unidade public.unidades%rowtype;
  v_principal uuid;
begin
  if v_uid is null or v_perfil is distinct from 'ADMIN' then
    raise exception 'Somente administradores podem alternar a unidade de trabalho.'
      using errcode = '42501';
  end if;

  select p.unidade_id into v_principal
  from public.perfis_usuarios p
  where p.user_id = v_uid and p.ativo = true
  limit 1;

  if v_principal is null then
    raise exception 'Administrador sem unidade principal ativa.'
      using errcode = '42501';
  end if;

  select * into v_unidade
  from public.unidades u
  where u.id = p_unidade_id and u.ativo = true;

  if not found then
    raise exception 'A unidade selecionada não existe ou está inativa.'
      using errcode = '23503';
  end if;

  insert into private.admin_contextos_unidade(user_id, unidade_id, atualizado_em)
  values (v_uid, v_unidade.id, now())
  on conflict (user_id)
  do update set unidade_id=excluded.unidade_id, atualizado_em=excluded.atualizado_em;

  if v_anterior is distinct from v_unidade.id then
    insert into public.logs_sistema(usuario_id, acao, entidade, entidade_id, detalhes)
    values (
      v_uid,'TROCA_CONTEXTO_UNIDADE','unidades',v_unidade.id::text,
      jsonb_build_object(
        'unidade_anterior_id',v_anterior,
        'unidade_contexto_id',v_unidade.id,
        'unidade_contexto_sigla',v_unidade.sigla,
        'somente_leitura_operacional',not v_unidade.aceita_registro_operacional
      )
    );
  end if;

  return jsonb_build_object(
    'unidade_principal_id',v_principal,
    'unidade_id',v_unidade.id,
    'sigla',v_unidade.sigla,
    'nome',v_unidade.nome,
    'tipo',v_unidade.tipo,
    'pode_alternar',true,
    'aceita_registro_operacional',v_unidade.aceita_registro_operacional,
    'agrega_descendentes',v_unidade.agrega_descendentes,
    'somente_leitura_operacional',not v_unidade.aceita_registro_operacional
  );
end
$$;

create or replace function public.obter_mapa_cpc_territorial(
  data_inicio date,
  data_fim date,
  p_unidade_id uuid default null::uuid,
  p_tipo_filtro text default null::text,
  p_aisc text default null::text,
  p_sisc text default null::text,
  p_setor text default null::text,
  p_bairro text default null::text
)
returns table(
  id uuid, data_ocorrencia date, numero_bo text, ocorrencia text, crime text,
  bairro text, endereco text, latitude double precision, longitude double precision,
  aisc text, sisc text, setor text, companhia text, turno text, unidade_id uuid,
  unidade_sigla text, unidade_nome text, unidade_territorial_id uuid,
  unidade_territorial_sigla text
)
language sql
stable
set search_path to 'public','auth','private'
as $$
with recursive
ctx as (
  select private.unidade_atual() comando_id,
         exists(
           select 1 from public.unidades u
           where u.id=private.unidade_atual() and u.ativo=true and u.tipo='COMANDO'
         ) autorizado
  where private.usuario_ativo()
),
descendentes as (
  select u.id,u.sigla,u.nome,u.tipo,u.parent_id,u.agrega_descendentes,array[u.id]::uuid[] caminho
  from public.unidades u
  join ctx c on u.parent_id=c.comando_id
  where c.autorizado=true and u.ativo=true
  union all
  select u.id,u.sigla,u.nome,u.tipo,u.parent_id,u.agrega_descendentes,d.caminho||u.id
  from public.unidades u
  join descendentes d on u.parent_id=d.id
  where u.ativo=true and not u.id=any(d.caminho)
),
selecionada as (
  select d.id,d.agrega_descendentes
  from descendentes d
  where d.id=p_unidade_id
)
select
  o.id,o.data_ocorrencia,o.numero_bo,o.ocorrencia,o.crime,o.bairro,
  coalesce(o.endereco_formatado,o.endereco),
  o.latitude,o.longitude,t.info->>'aisc',
  coalesce(nullif(o.sisc,''),t.info->>'sisc'),t.info->>'setor',
  o.companhia,o.turno,o.unidade_id,d.sigla,d.nome,
  nullif(t.info->>'unidade_id','')::uuid,t.info->>'unidade_sigla'
from public.ocorrencias o
join descendentes d on d.id=o.unidade_id
left join lateral (select public.territorio_por_bairro(o.bairro) info) t on true
where o.data_ocorrencia between data_inicio and data_fim
  and o.latitude is not null and o.longitude is not null
  and (
    p_unidade_id is null
    or o.unidade_id=p_unidade_id
    or (
      coalesce((select s.agrega_descendentes from selecionada s),false)
      and p_unidade_id=any(d.caminho)
    )
  )
  and (p_tipo_filtro is null or btrim(p_tipo_filtro)='' or upper(btrim(coalesce(nullif(o.ocorrencia,''),o.crime,'')))=upper(btrim(p_tipo_filtro)))
  and (p_aisc is null or btrim(p_aisc)='' or upper(coalesce(t.info->>'aisc',''))=upper(btrim(p_aisc)))
  and (p_sisc is null or btrim(p_sisc)='' or upper(coalesce(nullif(o.sisc,''),t.info->>'sisc',''))=upper(btrim(p_sisc)))
  and (p_setor is null or btrim(p_setor)='' or upper(coalesce(t.info->>'setor',''))=upper(btrim(p_setor)))
  and (p_bairro is null or btrim(p_bairro)='' or public.normalizar_bairro_sisc(o.bairro)=public.normalizar_bairro_sisc(p_bairro))
order by o.data_ocorrencia desc,o.hora_inicial desc nulls last
$$;

comment on column public.unidades.aceita_registro_operacional is
  'Indica se a unidade pode ser destino de lançamentos operacionais. CPC e BOPE são contextos agregadores e permanecem somente leitura.';
comment on column public.unidades.agrega_descendentes is
  'Indica que a unidade representa visão consolidada dos descendentes na interface administrativa e no painel CPC.';

do $$
begin
  if exists(select 1 from public.unidades where sigla in ('CPC','BOPE') and aceita_registro_operacional) then
    raise exception 'CPC/BOPE não podem aceitar registro operacional.';
  end if;
  if exists(select 1 from public.unidades where sigla in ('CANIL','FORCA_TATICA','CHOQUE','GATE') and not aceita_registro_operacional) then
    raise exception 'Subunidades do BOPE precisam aceitar registro operacional.';
  end if;
  if not exists (
    select 1
    from public.unidades filha
    join public.unidades bope on bope.id=filha.parent_id
    where bope.sigla='BOPE' and filha.sigla in ('CANIL','FORCA_TATICA','CHOQUE','GATE')
    group by bope.id
    having count(*)=4
  ) then
    raise exception 'Hierarquia do BOPE incompleta.';
  end if;
end
$$;
