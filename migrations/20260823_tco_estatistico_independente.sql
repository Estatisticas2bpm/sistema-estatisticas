begin;

-- TCO estatístico independente: permite contabilizar TCO produzido pelo batalhão
-- sem criar uma ocorrência fictícia e sem obrigar vínculo com BO.
create table if not exists public.tcos_estatisticos (
  id uuid primary key default gen_random_uuid(),
  numero_tco text not null,
  data_tco date not null default current_date,
  natureza text,
  bairro text,
  comandante text,
  vtr text,
  sisc text,
  companhia text,
  observacao text,
  created_at timestamptz not null default now()
);

create unique index if not exists tcos_estatisticos_numero_data_uidx
  on public.tcos_estatisticos (upper(trim(numero_tco)), data_tco);
create index if not exists tcos_estatisticos_data_idx on public.tcos_estatisticos (data_tco);

alter table public.tcos_estatisticos enable row level security;

create or replace function public.cadastrar_tco_estatistico(
  p_numero_tco text,
  p_data_tco date default current_date,
  p_natureza text default null,
  p_bairro text default null,
  p_comandante text default null,
  p_vtr text default null,
  p_sisc text default null,
  p_companhia text default null,
  p_observacao text default null
) returns jsonb
language plpgsql
security definer
set search_path='public'
as $function$
declare r public.tcos_estatisticos;
begin
  if nullif(trim(p_numero_tco),'') is null then
    raise exception 'Informe o número do TCO.';
  end if;
  insert into public.tcos_estatisticos(numero_tco,data_tco,natureza,bairro,comandante,vtr,sisc,companhia,observacao)
  values(trim(p_numero_tco),coalesce(p_data_tco,current_date),nullif(trim(p_natureza),''),nullif(trim(p_bairro),''),nullif(trim(p_comandante),''),nullif(trim(p_vtr),''),nullif(trim(p_sisc),''),nullif(trim(p_companhia),''),nullif(trim(p_observacao),''))
  returning * into r;
  return to_jsonb(r);
end;$function$;

create or replace function public.excluir_tco_estatistico(p_id uuid)
returns boolean language plpgsql security definer set search_path='public'
as $function$
begin
  delete from public.tcos_estatisticos where id=p_id;
  return found;
end;$function$;

create or replace function public.obter_tcos_estatisticos(
  data_inicio date default null::date,
  data_fim date default null::date
) returns jsonb language sql security definer set search_path='public'
as $function$
select coalesce(jsonb_agg(jsonb_build_object(
  'id',t.id,
  'data_tco',t.data_tco,
  'numero_tco',t.numero_tco,
  'ocorrencia',t.natureza,
  'crime',null,
  'bairro',t.bairro,
  'comandante',t.comandante,
  'vtr',t.vtr,
  'sisc',t.sisc,
  'companhia',t.companhia,
  'status_atendimento',null,
  'turno',null,
  'tipo_registro','TCO',
  'observacao',t.observacao,
  'origem','TCO ESTATÍSTICO INDEPENDENTE'
) order by t.data_tco desc,t.created_at desc),'[]'::jsonb)
from public.tcos_estatisticos t
where (data_inicio is null or t.data_tco>=data_inicio)
  and (data_fim is null or t.data_tco<=data_fim);
$function$;

-- Preserva a função atual dos TCOs vinculados ao BO e cria um contrato único.
do $do$
begin
  if to_regprocedure('public.obter_tcos_dashboard(date,date)') is not null
     and to_regprocedure('public.obter_tcos_dashboard_vinculados(date,date)') is null then
    execute 'alter function public.obter_tcos_dashboard(date,date) rename to obter_tcos_dashboard_vinculados';
  end if;
end $do$;

create or replace function public.obter_tcos_dashboard(
  data_inicio date default null::date,
  data_fim date default null::date
) returns jsonb language sql security definer set search_path='public'
as $function$
  select coalesce(public.obter_tcos_dashboard_vinculados(data_inicio,data_fim),'[]'::jsonb)
       || coalesce(public.obter_tcos_estatisticos(data_inicio,data_fim),'[]'::jsonb);
$function$;

grant execute on function public.cadastrar_tco_estatistico(text,date,text,text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.excluir_tco_estatistico(uuid) to anon, authenticated;
grant execute on function public.obter_tcos_estatisticos(date,date) to anon, authenticated;
grant execute on function public.obter_tcos_dashboard(date,date) to anon, authenticated;

commit;