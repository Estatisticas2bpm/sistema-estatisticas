-- Alinhar o filtro de bairro à identificação territorial oficial e suas variações de escrita.
-- O alias SANTA TEREZA e o nome oficial SANTA TERESA são o mesmo bairro_id.
-- Não altera boletins, dados, privilégios nem escopo autorizado por private.unidade_atual().

CREATE OR REPLACE FUNCTION public.obter_catalogo_territorial_cpc()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'private'
AS $function$
select jsonb_build_object(
  'base_legal','Decreto nº 22.414-E/2017',
  'aisc',coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',a.id,'codigo',a.codigo,'nome',a.nome,'unidade_id',a.unidade_id,'unidade_sigla',u.sigla,'unidade_nome',u.nome,
      'unidade_referencia_decreto',a.unidade_referencia_decreto,'artigo_referencia',a.artigo_referencia
    ) order by a.codigo)
    from public.territorio_cpc_aisc a join public.unidades u on u.id=a.unidade_id where a.ativo=true
  ),'[]'::jsonb),
  'sisc',coalesce((
    select jsonb_agg(jsonb_build_object('id',s.id,'codigo',s.codigo,'ordem',s.ordem,'aisc_id',s.aisc_id,'artigo_referencia',s.artigo_referencia) order by s.ordem)
    from public.territorio_cpc_sisc s where s.ativo=true
  ),'[]'::jsonb),
  'setores',coalesce((
    select jsonb_agg(jsonb_build_object('id',st.id,'codigo',st.codigo,'sisc_id',st.sisc_id,'artigo_referencia',st.artigo_referencia) order by string_to_array(st.codigo,'.')::int[])
    from public.territorio_cpc_setores st where st.ativo=true
  ),'[]'::jsonb),
  'bairros',coalesce((
    select jsonb_agg(jsonb_build_object('id',b.id,'nome',b.nome,'nome_decreto',b.nome_decreto,'tipo_local',b.tipo_local,'setor_id',b.setor_id,'artigo_referencia',b.artigo_referencia) order by b.nome)
    from public.territorio_cpc_bairros b where b.ativo=true
  ),'[]'::jsonb),
  'aliases',coalesce((
    select jsonb_agg(jsonb_build_object('alias_chave',al.alias_chave,'bairro_id',al.bairro_id) order by al.alias_chave)
    from public.territorio_cpc_bairro_aliases al
    join public.territorio_cpc_bairros b on b.id=al.bairro_id and b.ativo=true
  ),'[]'::jsonb),
  'excecoes',coalesce((
    select jsonb_agg(jsonb_build_object('id',e.id,'localidade',e.localidade,'municipio',e.municipio,'unidade_id',e.unidade_id,'unidade_referencia_decreto',e.unidade_referencia_decreto,'regra',e.regra,'artigo_referencia',e.artigo_referencia) order by e.localidade)
    from public.territorio_cpc_excecoes e where e.ativo=true
  ),'[]'::jsonb)
)
$function$
;

CREATE OR REPLACE FUNCTION public.obter_mapa_cpc_territorial(data_inicio date, data_fim date, p_unidade_id uuid DEFAULT NULL::uuid, p_tipo_filtro text DEFAULT NULL::text, p_aisc text DEFAULT NULL::text, p_sisc text DEFAULT NULL::text, p_setor text DEFAULT NULL::text, p_bairro text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, data_ocorrencia date, numero_bo text, ocorrencia text, crime text, bairro text, endereco text, latitude double precision, longitude double precision, aisc text, sisc text, setor text, companhia text, turno text, unidade_id uuid, unidade_sigla text, unidade_nome text, unidade_territorial_id uuid, unidade_territorial_sigla text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth', 'private'
AS $function$
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
    or o.subunidade_operacional_id=p_unidade_id
    or (
      coalesce((select s.agrega_descendentes from selecionada s),false)
      and p_unidade_id=any(d.caminho)
    )
  )
  and (p_tipo_filtro is null or btrim(p_tipo_filtro)='' or upper(btrim(coalesce(nullif(o.ocorrencia,''),o.crime,'')))=upper(btrim(p_tipo_filtro)))
  and (p_aisc is null or btrim(p_aisc)='' or upper(coalesce(t.info->>'aisc',''))=upper(btrim(p_aisc)))
  and (p_sisc is null or btrim(p_sisc)='' or upper(coalesce(nullif(o.sisc,''),t.info->>'sisc',''))=upper(btrim(p_sisc)))
  and (p_setor is null or btrim(p_setor)='' or upper(coalesce(t.info->>'setor',''))=upper(btrim(p_setor)))
  and (p_bairro is null or btrim(p_bairro)=''
    or public.normalizar_bairro_sisc(o.bairro)=public.normalizar_bairro_sisc(p_bairro)
    or (
      t.info->>'bairro_id' is not null
      and t.info->>'bairro_id'=public.territorio_por_bairro(p_bairro)->>'bairro_id'
    )
  )
order by o.data_ocorrencia desc,o.hora_inicial desc nulls last
$function$
;
