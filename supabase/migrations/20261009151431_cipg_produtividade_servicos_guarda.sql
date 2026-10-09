-- CIPG: produtividade estatística da guarda de instituições públicas.
-- Não registra posicionamento em tempo real, rotina sensível de vigilância ou efetivo nominal.
begin;
insert into public.modulos_sistema(codigo,nome,descricao,ativo,ordem)
values('PRODUTIVIDADE_CIPG','Produtividade da CIPG','Serviços de guarda, instituições cobertas, rondas e intercorrências.',true,46)
on conflict(codigo) do update set nome=excluded.nome,descricao=excluded.descricao,ativo=true,ordem=excluded.ordem;

insert into public.unidades_modulos(unidade_id,modulo_id,ativo)
select u.id,m.id,true from public.unidades u
join public.modulos_sistema m on m.codigo='PRODUTIVIDADE_CIPG'
where u.sigla='CIPG' and u.ativo=true
on conflict(unidade_id,modulo_id) do update set ativo=true;

create table if not exists public.cipg_servicos_guarda(
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete restrict,
  data_servico date not null,
  instituicao text not null check(length(btrim(instituicao)) between 3 and 160),
  tipo_local text not null check(tipo_local in('EDIFICIO_PUBLICO','ESTABELECIMENTO_PENAL','OUTRO')),
  modalidade text not null check(modalidade in('GUARDA_FIXA','RONDA','REFORCO','APOIO_OPERACIONAL','OUTRA')),
  rondas_realizadas integer not null default 0 check(rondas_realizadas between 0 and 10000),
  intercorrencias integer not null default 0 check(intercorrencias between 0 and 10000),
  documento_referencia text check(documento_referencia is null or length(documento_referencia)<=120),
  criado_por uuid not null default auth.uid() references auth.users(id) on delete restrict,
  atualizado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists cipg_servicos_guarda_unidade_data_idx
  on public.cipg_servicos_guarda(unidade_id,data_servico desc);
create index if not exists cipg_servicos_guarda_modalidade_idx
  on public.cipg_servicos_guarda(unidade_id,modalidade,data_servico desc);
create index if not exists cipg_servicos_guarda_criador_idx
  on public.cipg_servicos_guarda(criado_por);

drop trigger if exists cipg_servicos_guarda_atualizado_em on public.cipg_servicos_guarda;
create trigger cipg_servicos_guarda_atualizado_em
before update on public.cipg_servicos_guarda
for each row execute function public.atualizar_data_modificacao();

alter table public.cipg_servicos_guarda enable row level security;
revoke all on public.cipg_servicos_guarda from anon,authenticated;
grant select,insert,update,delete on public.cipg_servicos_guarda to authenticated;

drop policy if exists cipg_servicos_guarda_select on public.cipg_servicos_guarda;
create policy cipg_servicos_guarda_select
on public.cipg_servicos_guarda
for select to authenticated
using (
  (select private.usuario_ativo())
  and private.pode_acessar_unidade(unidade_id)
  and exists(select 1 from public.unidades u where u.id=unidade_id and u.sigla='CIPG' and u.ativo)
);

drop policy if exists cipg_servicos_guarda_insert on public.cipg_servicos_guarda;
create policy cipg_servicos_guarda_insert
on public.cipg_servicos_guarda
for insert to authenticated
with check (
  unidade_id=(select private.unidade_atual())
  and criado_por=(select auth.uid())
  and (select private.pode_escrever_operacional())
  and exists(select 1 from public.unidades u where u.id=unidade_id and u.sigla='CIPG' and u.ativo)
);

drop policy if exists cipg_servicos_guarda_update on public.cipg_servicos_guarda;
create policy cipg_servicos_guarda_update
on public.cipg_servicos_guarda
for update to authenticated
using(
  unidade_id=(select private.unidade_atual())
  and ((select private.pode_administrar_dados()) or (criado_por=(select auth.uid()) and (select private.perfil_atual())='OPERADOR'))
)
with check(
  unidade_id=(select private.unidade_atual())
  and atualizado_por=(select auth.uid())
  and ((select private.pode_administrar_dados()) or (criado_por=(select auth.uid()) and (select private.perfil_atual())='OPERADOR'))
);

drop policy if exists cipg_servicos_guarda_delete on public.cipg_servicos_guarda;
create policy cipg_servicos_guarda_delete
on public.cipg_servicos_guarda
for delete to authenticated
using (unidade_id=(select private.unidade_atual()) and (select private.pode_administrar_dados()));
commit;