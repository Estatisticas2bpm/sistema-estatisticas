-- fase3m_a_territorio_oficial_decreto_22414
-- Estrutura territorial oficial do CPC baseada no Decreto nº 22.414-E/2017.


create table public.territorio_cpc_aisc (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  unidade_id uuid not null references public.unidades(id) on update restrict on delete restrict,
  unidade_referencia_decreto text not null,
  base_legal text not null default 'Decreto nº 22.414-E/2017',
  artigo_referencia text not null,
  ativo boolean not null default true
);

create table public.territorio_cpc_sisc (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  ordem smallint not null unique,
  aisc_id uuid not null references public.territorio_cpc_aisc(id) on update cascade on delete restrict,
  artigo_referencia text not null,
  ativo boolean not null default true
);

create table public.territorio_cpc_setores (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  sisc_id uuid not null references public.territorio_cpc_sisc(id) on update cascade on delete restrict,
  artigo_referencia text not null default 'Art. 14',
  ativo boolean not null default true
);

create table public.territorio_cpc_bairros (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  nome text not null,
  nome_decreto text not null,
  tipo_local text not null default 'BAIRRO' check (tipo_local in ('BAIRRO','LOTEAMENTO','DISTRITO_INDUSTRIAL')),
  setor_id uuid not null references public.territorio_cpc_setores(id) on update cascade on delete restrict,
  artigo_referencia text not null,
  ativo boolean not null default true
);

create table public.territorio_cpc_bairro_aliases (
  alias_chave text primary key,
  bairro_id uuid not null references public.territorio_cpc_bairros(id) on update cascade on delete cascade
);

create table public.territorio_cpc_excecoes (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  localidade text not null,
  municipio text not null,
  unidade_id uuid not null references public.unidades(id) on update restrict on delete restrict,
  unidade_referencia_decreto text not null,
  regra text not null,
  artigo_referencia text not null,
  ativo boolean not null default true
);

alter table public.territorio_cpc_aisc enable row level security;
alter table public.territorio_cpc_sisc enable row level security;
alter table public.territorio_cpc_setores enable row level security;
alter table public.territorio_cpc_bairros enable row level security;
alter table public.territorio_cpc_bairro_aliases enable row level security;
alter table public.territorio_cpc_excecoes enable row level security;

create policy territorio_cpc_aisc_select on public.territorio_cpc_aisc for select to authenticated using ((select private.usuario_ativo()));
create policy territorio_cpc_sisc_select on public.territorio_cpc_sisc for select to authenticated using ((select private.usuario_ativo()));
create policy territorio_cpc_setores_select on public.territorio_cpc_setores for select to authenticated using ((select private.usuario_ativo()));
create policy territorio_cpc_bairros_select on public.territorio_cpc_bairros for select to authenticated using ((select private.usuario_ativo()));
create policy territorio_cpc_aliases_select on public.territorio_cpc_bairro_aliases for select to authenticated using ((select private.usuario_ativo()));
create policy territorio_cpc_excecoes_select on public.territorio_cpc_excecoes for select to authenticated using ((select private.usuario_ativo()));

revoke all on table public.territorio_cpc_aisc,public.territorio_cpc_sisc,public.territorio_cpc_setores,public.territorio_cpc_bairros,public.territorio_cpc_bairro_aliases,public.territorio_cpc_excecoes from anon;
revoke insert,update,delete,truncate,references,trigger on table public.territorio_cpc_aisc,public.territorio_cpc_sisc,public.territorio_cpc_setores,public.territorio_cpc_bairros,public.territorio_cpc_bairro_aliases,public.territorio_cpc_excecoes from authenticated;
grant select on table public.territorio_cpc_aisc,public.territorio_cpc_sisc,public.territorio_cpc_setores,public.territorio_cpc_bairros,public.territorio_cpc_bairro_aliases,public.territorio_cpc_excecoes to authenticated;

insert into public.territorio_cpc_aisc(codigo,nome,unidade_id,unidade_referencia_decreto,artigo_referencia)
select 'AISC LESTE','Área Integrada de Segurança Comunitária - Leste',id,'1º BPC','Art. 12, I'
from public.unidades where sigla='1BPM'
union all
select 'AISC OESTE','Área Integrada de Segurança Comunitária - Oeste',id,'2º BPC','Art. 12, II'
from public.unidades where sigla='2BPM';

insert into public.territorio_cpc_sisc(codigo,ordem,aisc_id,artigo_referencia)
select v.codigo,v.ordem,a.id,v.artigo
from (values
 ('SISC 1',1,'AISC LESTE','Art. 13, I'),
 ('SISC 2',2,'AISC LESTE','Art. 13, II'),
 ('SISC 3',3,'AISC LESTE','Art. 13, III'),
 ('SISC 4',4,'AISC OESTE','Art. 13, IV'),
 ('SISC 5',5,'AISC OESTE','Art. 13, V'),
 ('SISC 6',6,'AISC OESTE','Art. 13, VI')
) v(codigo,ordem,aisc,artigo)
join public.territorio_cpc_aisc a on a.codigo=v.aisc;

insert into public.territorio_cpc_setores(codigo,sisc_id)
select v.codigo,s.id
from (values
 ('1.1','SISC 1'),('1.2','SISC 1'),('1.3','SISC 1'),
 ('2.1','SISC 2'),('2.2','SISC 2'),('2.3','SISC 2'),
 ('3.1','SISC 3'),('3.2','SISC 3'),('3.3','SISC 3'),
 ('4.1','SISC 4'),('4.2','SISC 4'),('4.3','SISC 4'),
 ('5.1','SISC 5'),('5.2','SISC 5'),('5.3','SISC 5'),
 ('6.1','SISC 6'),('6.2','SISC 6'),('6.3','SISC 6')
) v(codigo,sisc)
join public.territorio_cpc_sisc s on s.codigo=v.sisc;

with dados(setor,nome,nome_decreto,tipo,artigo) as (values
 ('1.1','05 DE OUTUBRO','05 de Outubro','BAIRRO','Art. 13, I; Art. 14, I, a'),
 ('1.1','CAÇARI','Caçari','BAIRRO','Art. 13, I; Art. 14, I, a'),
 ('1.1','PARAVIANA','Paraviana','BAIRRO','Art. 13, I; Art. 14, I, a'),
 ('1.2','31 DE MARÇO','31 de Março','BAIRRO','Art. 13, I; Art. 14, I, b'),
 ('1.2','CANARINHO','Canarinho','BAIRRO','Art. 13, I; Art. 14, I, b'),
 ('1.2','CENTRO','Centro','BAIRRO','Art. 13, I; Art. 14, I, b'),
 ('1.2','DOS ESTADOS','Dos Estados','BAIRRO','Art. 13, I; Art. 14, I, b'),
 ('1.2','NOSSA SENHORA DA APARECIDA','Nossa Senhora da Aparecida','BAIRRO','Art. 13, I; Art. 14, I, b'),
 ('1.2','SÃO FRANCISCO','São Francisco','BAIRRO','Art. 13, I; Art. 14, I, b'),
 ('1.2','SÃO PEDRO','São Pedro','BAIRRO','Art. 13, I; Art. 14, I, b'),
 ('1.3','13 DE SETEMBRO','13 de Setembro','BAIRRO','Art. 13, I; Art. 14, I, c'),
 ('1.3','CALUNGÁ','Calungá','BAIRRO','Art. 13, I; Art. 14, I, c'),
 ('1.3','MECEJANA','Mecejana','BAIRRO','Art. 13, I; Art. 14, I, c'),
 ('1.3','SÃO VICENTE','São Vicente','BAIRRO','Art. 13, I; Art. 14, I, c'),
 ('2.1','CENTENÁRIO','Centenário','BAIRRO','Art. 13, II; Art. 14, II, a'),
 ('2.1','CINTURÃO VERDE','Cinturão Verde','BAIRRO','Art. 13, II; Art. 14, II, a'),
 ('2.1','PRICUMÃ','Pricumã','BAIRRO','Art. 13, II; Art. 14, II, a'),
 ('2.2','ASA BRANCA','Asa Branca','BAIRRO','Art. 13, II; Art. 14, II, b'),
 ('2.2','BURITIS','Buritis','BAIRRO','Art. 13, II; Art. 14, II, b'),
 ('2.2','LIBERDADE','Liberdade','BAIRRO','Art. 13, II; Art. 14, II, b'),
 ('2.3','CAIMBÉ','Caimbé','BAIRRO','Art. 13, II; Art. 14, II, c'),
 ('2.3','JARDIM FLORESTA','Jardim Floresta','BAIRRO','Art. 13, II; Art. 14, II, c'),
 ('2.3','TANCREDO NEVES','Tancredo Neves','BAIRRO','Art. 13, II; Art. 14, II, c'),
 ('3.1','AEROPORTO','Aeroporto','BAIRRO','Art. 13, III; Art. 14, III, a'),
 ('3.1','CAUAMÉ','Cauamé','BAIRRO','Art. 13, III; Art. 14, III, a'),
 ('3.1','JARDIM CARANÃ','Jardim Caranã','BAIRRO','Art. 13, III; Art. 14, III, a'),
 ('3.1','SAID SALOMÃO','Said Salomão','BAIRRO','Art. 13, III; Art. 14, III, a'),
 ('3.2','CARANÃ','Caranã','BAIRRO','Art. 13, III; Art. 14, III, b'),
 ('3.2','UNIÃO','União','BAIRRO','Art. 13, III; Art. 14, III, b'),
 ('3.3','CIDADE SATÉLITE','Cidade Satélite','BAIRRO','Art. 13, III; Art. 14, III, c'),
 ('3.3','MURILO TEIXEIRA CIDADE','Murilo Teixeira Cidade','BAIRRO','Art. 13, III; Art. 14, III, c'),
 ('3.3','JOÃO DE BARRO','João de Barro','LOTEAMENTO','Art. 13, III; Art. 14, III, c'),
 ('4.1','CAMBARÁ','Cambará','BAIRRO','Art. 13, IV; Art. 14, IV, a'),
 ('4.1','JÓQUEI CLUBE','Jóquei Clube','BAIRRO','Art. 13, IV; Art. 14, IV, a'),
 ('4.2','MARECHAL RONDON','Marechal Rondon','BAIRRO','Art. 13, IV; Art. 14, IV, b'),
 ('4.2','ARACELI','Profª Araceli Souto Maior','BAIRRO','Art. 13, IV; Art. 14, IV, b'),
 ('4.2','RAIAR DO SOL','Raiar do Sol','BAIRRO','Art. 13, IV; Art. 14, IV, b'),
 ('4.2','SÃO BENTO','São Bento','BAIRRO','Art. 13, IV; Art. 14, IV, b'),
 ('4.2','GOV AQUILINO MOTA DUARTE','Distrito Industrial Gov. Aquilino Mota Duarte','DISTRITO_INDUSTRIAL','Art. 13, IV; Art. 14, IV, b'),
 ('4.3','BELA VISTA','Bela Vista','BAIRRO','Art. 13, IV; Art. 14, IV, c'),
 ('4.3','DR AIRTON ROCHA','Dr. Airton Rocha','BAIRRO','Art. 13, IV; Art. 14, IV, c'),
 ('4.3','NOVA CIDADE','Nova Cidade','BAIRRO','Art. 13, IV; Art. 14, IV, c'),
 ('4.3','OPERÁRIO','Operário','BAIRRO','Art. 13, IV; Art. 14, IV, c'),
 ('5.1','DR SILVIO BOTELHO','Dr. Sílvio Botelho','BAIRRO','Art. 13, V; Art. 14, V, a'),
 ('5.1','JARDIM TROPICAL','Jardim Tropical','BAIRRO','Art. 13, V; Art. 14, V, a'),
 ('5.1','OLÍMPICO','Olímpico','BAIRRO','Art. 13, V; Art. 14, V, a'),
 ('5.2','PINTOLÂNDIA','Pintolândia','BAIRRO','Art. 13, V; Art. 14, V, b'),
 ('5.2','SANTA LUZIA','Santa Luzia','BAIRRO','Art. 13, V; Art. 14, V, b'),
 ('5.3','SENADOR HÉLIO CAMPOS','Sen. Hélio Campos','BAIRRO','Art. 13, V; Art. 14, V, c'),
 ('5.3','LAURA MOREIRA','Laura Moreira','BAIRRO','Art. 13, V; Art. 14, V, c'),
 ('6.1','JARDIM PRIMAVERA','Jardim Primavera','BAIRRO','Art. 13, VI; Art. 14, VI, a'),
 ('6.1','PISCICULTURA','Piscicultura','BAIRRO','Art. 13, VI; Art. 14, VI, a'),
 ('6.1','SANTA TERESA','Santa Teresa','BAIRRO','Art. 13, VI; Art. 14, VI, a'),
 ('6.2','CANAÃ','Canaã','BAIRRO','Art. 13, VI; Art. 14, VI, b'),
 ('6.2','DR SILVIO LEITE','Dr. Sílvio Leite','BAIRRO','Art. 13, VI; Art. 14, VI, b'),
 ('6.3','ALVORADA','Alvorada','BAIRRO','Art. 13, VI; Art. 14, VI, c'),
 ('6.3','EQUATORIAL','Equatorial','BAIRRO','Art. 13, VI; Art. 14, VI, c')
)
insert into public.territorio_cpc_bairros(chave,nome,nome_decreto,tipo_local,setor_id,artigo_referencia)
select public.normalizar_bairro_sisc(d.nome),d.nome,d.nome_decreto,d.tipo,s.id,d.artigo
from dados d join public.territorio_cpc_setores s on s.codigo=d.setor;

insert into public.territorio_cpc_bairro_aliases(alias_chave,bairro_id)
select b.chave,b.id from public.territorio_cpc_bairros b;

with extras(alias_chave,nome) as (values
 ('AIRTON ROCHA','DR AIRTON ROCHA'),('DOUTOR AIRTON ROCHA','DR AIRTON ROCHA'),
 ('PROFA ARACELI SOUTO MAIOR','ARACELI'),('PROFESSORA ARACELI SOUTO MAIOR','ARACELI'),
 ('DISTRITO INDUSTRIAL GOV AQUILINO MOTA DUARTE','GOV AQUILINO MOTA DUARTE'),
 ('DISTRITO INDUSTRIAL GOVERNADOR AQUILINO MOTA DUARTE','GOV AQUILINO MOTA DUARTE'),
 ('DISTRITO INDUSTRIAL','GOV AQUILINO MOTA DUARTE'),('GOVERNADOR AQUILINO MOTA DUARTE','GOV AQUILINO MOTA DUARTE'),
 ('DOUTOR SILVIO BOTELHO','DR SILVIO BOTELHO'),('SILVIO BOTELHO','DR SILVIO BOTELHO'),('JARDIM OLIMPICO','OLÍMPICO'),
 ('SEN HELIO CAMPOS','SENADOR HÉLIO CAMPOS'),
 ('NOVA CANAA','CANAÃ'),('DOUTOR SILVIO LEITE','DR SILVIO LEITE'),('DRA SILVIO LEITE','DR SILVIO LEITE'),
 ('DOUTORA SILVIO LEITE','DR SILVIO LEITE'),('SILVIO LEITE','DR SILVIO LEITE'),('JARDIM EQUATORIAL','EQUATORIAL'),
 ('PSICULTURA','PISCICULTURA'),('SANTA TEREZA','SANTA TERESA'),
 ('MURILO TEIXEIRA','MURILO TEIXEIRA CIDADE'),('LOTEAMENTO JOAO DE BARRO','JOÃO DE BARRO'),
 ('NOSSA SENHORA APARECIDA','NOSSA SENHORA DA APARECIDA')
)
insert into public.territorio_cpc_bairro_aliases(alias_chave,bairro_id)
select public.normalizar_bairro_sisc(e.alias_chave),b.id
from extras e join public.territorio_cpc_bairros b on b.chave=public.normalizar_bairro_sisc(e.nome)
on conflict(alias_chave) do update set bairro_id=excluded.bairro_id;

insert into public.territorio_cpc_excecoes(chave,localidade,municipio,unidade_id,unidade_referencia_decreto,regra,artigo_referencia)
select public.normalizar_bairro_sisc('SANTA CECÍLIA'),'SANTA CECÍLIA','CANTÁ',id,'1º BPC',
       'Fatos típicos e atípicos ocorridos no bairro Santa Cecília, pertencente ao município do Cantá, serão atendidos pelo 1º BPC e despachados na delegacia competente.',
       'Art. 14, parágrafo único'
from public.unidades where sigla='1BPM';

insert into public.bairros(nome,ativo)
select b.nome,true from public.territorio_cpc_bairros b
on conflict(nome) do update set ativo=true;

create or replace function public.territorio_por_bairro(valor text)
returns jsonb
language sql
stable
security invoker
set search_path = 'public','private'
as $function$
  select jsonb_build_object(
    'bairro_id',b.id,'bairro',b.nome,'bairro_decreto',b.nome_decreto,'tipo_local',b.tipo_local,
    'setor',st.codigo,'sisc',si.codigo,'aisc',a.codigo,
    'unidade_id',a.unidade_id,'unidade_sigla',u.sigla,'unidade_nome',u.nome,
    'unidade_referencia_decreto',a.unidade_referencia_decreto,'base_legal',a.base_legal,'artigo_referencia',b.artigo_referencia
  )
  from public.territorio_cpc_bairro_aliases al
  join public.territorio_cpc_bairros b on b.id=al.bairro_id and b.ativo=true
  join public.territorio_cpc_setores st on st.id=b.setor_id and st.ativo=true
  join public.territorio_cpc_sisc si on si.id=st.sisc_id and si.ativo=true
  join public.territorio_cpc_aisc a on a.id=si.aisc_id and a.ativo=true
  join public.unidades u on u.id=a.unidade_id
  where al.alias_chave=public.normalizar_bairro_sisc(valor)
  limit 1
$function$;

create or replace function public.sisc_por_bairro(valor text)
returns text language sql stable security invoker set search_path='public','private'
as $function$ select public.territorio_por_bairro(valor)->>'sisc' $function$;

create or replace function public.aisc_por_bairro(valor text)
returns text language sql stable security invoker set search_path='public','private'
as $function$ select public.territorio_por_bairro(valor)->>'aisc' $function$;

create or replace function public.setor_por_bairro(valor text)
returns text language sql stable security invoker set search_path='public','private'
as $function$ select public.territorio_por_bairro(valor)->>'setor' $function$;

create or replace function public.obter_catalogo_territorial_cpc()
returns jsonb
language sql
stable
security invoker
set search_path='public','private'
as $function$
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
  'excecoes',coalesce((
    select jsonb_agg(jsonb_build_object('id',e.id,'localidade',e.localidade,'municipio',e.municipio,'unidade_id',e.unidade_id,'unidade_referencia_decreto',e.unidade_referencia_decreto,'regra',e.regra,'artigo_referencia',e.artigo_referencia) order by e.localidade)
    from public.territorio_cpc_excecoes e where e.ativo=true
  ),'[]'::jsonb)
)
$function$;

revoke execute on function public.territorio_por_bairro(text),public.sisc_por_bairro(text),public.aisc_por_bairro(text),public.setor_por_bairro(text),public.obter_catalogo_territorial_cpc() from public,anon;
grant execute on function public.territorio_por_bairro(text),public.sisc_por_bairro(text),public.aisc_por_bairro(text),public.setor_por_bairro(text),public.obter_catalogo_territorial_cpc() to authenticated;

create or replace function public.classificar_territorio_ocorrencia()
returns trigger
language plpgsql
security invoker
set search_path='public'
as $function$
declare v_sisc text;
begin
  v_sisc:=public.sisc_por_bairro(new.bairro);
  if v_sisc is not null then
    new.sisc:=v_sisc;
    if new.companhia is null then new.companhia:=public.companhia_por_sisc(v_sisc); end if;
  end if;
  return new;
end
$function$;

drop trigger if exists trg_territorio_oficial_ocorrencia on public.ocorrencias;
create trigger trg_territorio_oficial_ocorrencia
before insert or update of bairro on public.ocorrencias
for each row execute function public.classificar_territorio_ocorrencia();

revoke execute on function public.classificar_territorio_ocorrencia() from public,anon,authenticated;
