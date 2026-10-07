-- BOPE passa a ser a unidade lançadora; companhias/grupamentos internos viram origem operacional.
alter table public.ocorrencias
  add column if not exists subunidade_operacional_id uuid references public.unidades(id) on delete restrict;

create index if not exists ocorrencias_subunidade_operacional_data_idx
  on public.ocorrencias(subunidade_operacional_id,data_ocorrencia)
  where subunidade_operacional_id is not null;

update public.unidades
set aceita_registro_operacional=case when sigla='BOPE' then true when sigla in ('CANIL','FORCA_TATICA','CHOQUE','GATE') then false else aceita_registro_operacional end,
    agrega_descendentes=case when sigla='BOPE' then false else agrega_descendentes end
where sigla in ('BOPE','CANIL','FORCA_TATICA','CHOQUE','GATE');

with bope as (select id from public.unidades where sigla='BOPE' limit 1),
origem as (select id from public.unidades where sigla in ('CANIL','FORCA_TATICA','CHOQUE','GATE'))
update public.ocorrencias o
set subunidade_operacional_id=o.unidade_id, unidade_id=(select id from bope)
where o.unidade_id in (select id from origem);

create or replace function private.validar_subunidade_operacional_ocorrencia()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_sigla text; v_parent uuid;
begin
  select u.sigla into v_sigla from public.unidades u where u.id=new.unidade_id;
  if v_sigla='BOPE' then
    if new.subunidade_operacional_id is null then
      raise exception 'Informe a unidade operacional do BOPE: CANIL, FORÇA TÁTICA, CHOQUE ou GATE.' using errcode='23514';
    end if;
    select u.parent_id into v_parent from public.unidades u
    where u.id=new.subunidade_operacional_id and u.ativo=true and u.sigla in ('CANIL','FORCA_TATICA','CHOQUE','GATE');
    if v_parent is distinct from new.unidade_id then raise exception 'A unidade operacional informada não pertence ao BOPE.' using errcode='23514'; end if;
  elsif new.subunidade_operacional_id is not null then
    raise exception 'Subunidade operacional só pode ser informada em registros do BOPE.' using errcode='23514';
  end if;
  return new;
end $$;

drop trigger if exists trg_validar_subunidade_operacional_ocorrencia on public.ocorrencias;
create trigger trg_validar_subunidade_operacional_ocorrencia
before insert or update of unidade_id,subunidade_operacional_id on public.ocorrencias
for each row execute function private.validar_subunidade_operacional_ocorrencia();

create or replace function public.listar_subunidades_operacionais_bope()
returns table(id uuid,sigla text,nome text)
language sql stable security invoker set search_path=''
as $$
 select f.id,f.sigla,f.nome from public.unidades f join public.unidades b on b.id=f.parent_id
 where b.sigla='BOPE' and b.ativo=true and f.ativo=true and f.sigla in ('CANIL','FORCA_TATICA','CHOQUE','GATE')
 order by case f.sigla when 'FORCA_TATICA' then 1 when 'CHOQUE' then 2 when 'CANIL' then 3 when 'GATE' then 4 else 9 end
$$;
revoke all on function public.listar_subunidades_operacionais_bope() from public,anon;
grant execute on function public.listar_subunidades_operacionais_bope() to authenticated;

do $$
declare v_def text;
begin
 select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='atualizar_ocorrencia_publica'
 and pg_get_function_identity_arguments(p.oid)='p_id uuid, p_dados jsonb';
 if v_def is null then raise exception 'RPC atualizar_ocorrencia_publica não encontrada'; end if;
 if position('subunidade_operacional_id=v.subunidade_operacional_id' in v_def)=0 then
   v_def:=replace(v_def,'atualizado_em=now()','subunidade_operacional_id=v.subunidade_operacional_id, atualizado_em=now()');
   execute v_def;
 end if;
end $$;

create or replace function public.obter_dados_dashboard_territorial(data_inicio date default null::date,data_fim date default null::date)
returns jsonb language sql stable set search_path to 'public','private'
as $$
with base as materialized (select value item from jsonb_array_elements(public.obter_dados_dashboard(data_inicio,data_fim))),
mapa as materialized (
 select al.alias_chave,jsonb_build_object('bairro_id',b.id,'bairro',b.nome,'bairro_decreto',b.nome_decreto,'tipo_local',b.tipo_local,'setor',st.codigo,'sisc',si.codigo,'aisc',a.codigo,'unidade_id',a.unidade_id,'unidade_sigla',u.sigla,'unidade_nome',u.nome,'unidade_referencia_decreto',a.unidade_referencia_decreto,'base_legal',a.base_legal,'artigo_referencia',b.artigo_referencia) info
 from public.territorio_cpc_bairro_aliases al join public.territorio_cpc_bairros b on b.id=al.bairro_id and b.ativo=true
 join public.territorio_cpc_setores st on st.id=b.setor_id and st.ativo=true join public.territorio_cpc_sisc si on si.id=st.sisc_id and si.ativo=true
 join public.territorio_cpc_aisc a on a.id=si.aisc_id and a.ativo=true join public.unidades u on u.id=a.unidade_id),
enriquecido as (
 select b.item||jsonb_build_object('aisc',m.info->>'aisc','sisc',coalesce(nullif(b.item->>'sisc',''),m.info->>'sisc'),'setor',m.info->>'setor','territorio_bairro',m.info->>'bairro','unidade_territorial_id',m.info->>'unidade_id','unidade_territorial_sigla',m.info->>'unidade_sigla','unidade_id',o.unidade_id,'unidade_sigla',u.sigla,'unidade_nome',u.nome,'subunidade_operacional_id',o.subunidade_operacional_id,'subunidade_operacional_sigla',su.sigla,'subunidade_operacional_nome',su.nome) item
 from base b join public.ocorrencias o on o.id=(b.item->>'id')::uuid join public.unidades u on u.id=o.unidade_id
 left join public.unidades su on su.id=o.subunidade_operacional_id left join mapa m on m.alias_chave=public.normalizar_bairro_sisc(b.item->>'bairro'))
select coalesce(jsonb_agg(item order by item->>'data_ocorrencia' desc),'[]'::jsonb) from enriquecido $$;

create or replace function public.obter_tcos_dashboard_territorial(data_inicio date default null::date,data_fim date default null::date)
returns jsonb language sql stable set search_path to 'public','private'
as $$
with base as materialized (select value item from jsonb_array_elements(public.obter_tcos_dashboard(data_inicio,data_fim))),
mapa as materialized (
 select al.alias_chave,jsonb_build_object('bairro_id',b.id,'bairro',b.nome,'bairro_decreto',b.nome_decreto,'tipo_local',b.tipo_local,'setor',st.codigo,'sisc',si.codigo,'aisc',a.codigo,'unidade_id',a.unidade_id,'unidade_sigla',u.sigla,'unidade_nome',u.nome,'unidade_referencia_decreto',a.unidade_referencia_decreto,'base_legal',a.base_legal,'artigo_referencia',b.artigo_referencia) info
 from public.territorio_cpc_bairro_aliases al join public.territorio_cpc_bairros b on b.id=al.bairro_id and b.ativo=true
 join public.territorio_cpc_setores st on st.id=b.setor_id and st.ativo=true join public.territorio_cpc_sisc si on si.id=st.sisc_id and si.ativo=true
 join public.territorio_cpc_aisc a on a.id=si.aisc_id and a.ativo=true join public.unidades u on u.id=a.unidade_id),
enriquecido as (
 select b.item||jsonb_build_object('aisc',m.info->>'aisc','sisc',coalesce(nullif(b.item->>'sisc',''),m.info->>'sisc'),'setor',m.info->>'setor','territorio_bairro',m.info->>'bairro','unidade_territorial_id',m.info->>'unidade_id','unidade_territorial_sigla',m.info->>'unidade_sigla','unidade_id',o.unidade_id,'unidade_sigla',u.sigla,'unidade_nome',u.nome,'subunidade_operacional_id',o.subunidade_operacional_id,'subunidade_operacional_sigla',su.sigla,'subunidade_operacional_nome',su.nome) item
 from base b join public.ocorrencias o on o.id=(b.item->>'ocorrencia_id')::uuid join public.unidades u on u.id=o.unidade_id
 left join public.unidades su on su.id=o.subunidade_operacional_id left join mapa m on m.alias_chave=public.normalizar_bairro_sisc(b.item->>'bairro'))
select coalesce(jsonb_agg(item order by item->>'data_tco' desc),'[]'::jsonb) from enriquecido $$;

comment on column public.ocorrencias.subunidade_operacional_id is 'Origem operacional interna do BOPE. O registro pertence ao BOPE; valores válidos: FORCA_TATICA, CHOQUE, CANIL ou GATE.';

do $$
begin
 if not exists(select 1 from public.unidades where sigla='BOPE' and aceita_registro_operacional=true) then raise exception 'BOPE deve aceitar lançamento operacional.'; end if;
 if exists(select 1 from public.unidades where sigla in ('CANIL','FORCA_TATICA','CHOQUE','GATE') and aceita_registro_operacional=true) then raise exception 'Subunidades do BOPE não podem receber lançamento direto.'; end if;
 if exists(select 1 from public.ocorrencias o join public.unidades u on u.id=o.unidade_id where u.sigla in ('CANIL','FORCA_TATICA','CHOQUE','GATE')) then raise exception 'Ainda existem ocorrências pertencendo diretamente às subunidades do BOPE.'; end if;
end $$;
