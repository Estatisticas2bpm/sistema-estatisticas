-- Fase 3V — núcleo genérico multiunidade do SIE-CPC.
-- Ativa a estrutura organizacional já cadastrada, torna TCO multiunidade
-- e aplica hardening objetivo sem criar usuários ou dados operacionais.

do $$
declare
  v_total integer;
  v_2bpm uuid;
begin
  select count(*) into v_total from public.unidades;
  if v_total <> 13 then
    raise exception 'Preflight abortado: esperadas 13 unidades, encontradas %.', v_total;
  end if;

  select id into v_2bpm from public.unidades where sigla = '2BPM';
  if v_2bpm is distinct from 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid then
    raise exception 'Preflight abortado: UUID institucional do 2BPM divergente.';
  end if;

  if exists (select 1 from public.unidades where sigla = 'GAT') then
    raise exception 'Preflight abortado: a sigla incorreta GAT ainda existe.';
  end if;

  if not exists (
    select 1
    from public.unidades gate
    join public.unidades bope on bope.id = gate.parent_id
    where gate.sigla = 'GATE' and bope.sigla = 'BOPE'
  ) then
    raise exception 'Preflight abortado: GATE não está subordinado ao BOPE.';
  end if;

  if exists (select 1 from public.ocorrencias where unidade_id is null) then
    raise exception 'Preflight abortado: existem ocorrências sem unidade.';
  end if;
end
$$;

update public.unidades
set nome = 'Companhia Independente de Policiamento de Trânsito Urbano e Rodoviário — CIPTUR'
where sigla = 'CIPTUR';

update public.unidades
set ativo = true
where sigla in (
  'CPC','1BPM','2BPM','GIRO','CIPTUR','CIPA','CIPG',
  'CAVALARIA','BOPE','CANIL','FORCA_TATICA','CHOQUE','GATE'
);

do $$
begin
  if (select count(*) from public.unidades where ativo) <> 13 then
    raise exception 'Ativação abortada: nem todas as 13 unidades ficaram ativas.';
  end if;
end
$$;

alter table public.ocorrencias
  drop constraint ocorrencias_tipo_registro_check;

alter table public.ocorrencias
  add constraint ocorrencias_tipo_registro_check
  check (tipo_registro = any (array[
    'BO'::text,'ROP'::text,'TS'::text,'AME'::text,
    'TOR'::text,'TCO'::text,'NI'::text
  ]));

alter table public.tcos
  add column unidade_id uuid;

update public.tcos t
set unidade_id = o.unidade_id
from public.ocorrencias o
where o.id = t.ocorrencia_id;

do $$
begin
  if exists (select 1 from public.tcos where unidade_id is null) then
    raise exception 'Backfill de TCO abortado: há TCO sem unidade derivada da ocorrência.';
  end if;
end
$$;

alter table public.tcos
  alter column unidade_id set not null,
  add constraint tcos_unidade_id_fkey
    foreign key (unidade_id)
    references public.unidades(id)
    on update restrict
    on delete restrict;

create index tcos_unidade_data_idx
  on public.tcos (unidade_id, data_tco);

drop index public.tcos_numero_ano_uq;

create unique index tcos_unidade_numero_ano_uq
  on public.tcos (
    unidade_id,
    upper(btrim(numero_tco)),
    extract(year from data_tco)
  );

create or replace function private.definir_unidade_tco()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unidade uuid;
begin
  select o.unidade_id
    into v_unidade
  from public.ocorrencias o
  where o.id = new.ocorrencia_id;

  if v_unidade is null then
    raise exception 'A ocorrência vinculada ao TCO não existe ou não possui unidade.';
  end if;

  new.unidade_id := v_unidade;
  return new;
end
$$;

drop trigger if exists trg_definir_unidade_tco on public.tcos;
create trigger trg_definir_unidade_tco
before insert or update of ocorrencia_id, unidade_id
on public.tcos
for each row
execute function private.definir_unidade_tco();

create or replace function private.sincronizar_escopo_principal_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_incluir_descendentes boolean := false;
begin
  if tg_op = 'UPDATE'
     and old.unidade_id is distinct from new.unidade_id then
    delete from public.usuarios_unidades_escopo
    where user_id = new.user_id
      and origem = 'PRINCIPAL';
  end if;

  if new.unidade_id is not null then
    select exists (
      select 1
      from public.unidades filha
      where filha.parent_id = new.unidade_id
        and filha.ativo = true
    )
    into v_incluir_descendentes;

    insert into public.usuarios_unidades_escopo (
      user_id, unidade_id, origem, incluir_descendentes
    )
    values (
      new.user_id, new.unidade_id, 'PRINCIPAL', v_incluir_descendentes
    )
    on conflict (user_id, unidade_id, origem)
    do update set incluir_descendentes = excluded.incluir_descendentes;
  end if;

  return new;
end
$$;

update public.usuarios_unidades_escopo e
set incluir_descendentes = exists (
  select 1
  from public.unidades filha
  where filha.parent_id = e.unidade_id
    and filha.ativo = true
)
where e.origem = 'PRINCIPAL';

alter function public.normalizar_bairro_estatistica(text) set search_path = public;
alter function public.normalizar_nacionalidade_estatistica(text) set search_path = public;
alter function public.normalizar_campos_estatisticos_ocorrencia() set search_path = public;
alter function public.chave_comandante_estatistica(text) set search_path = public;
alter function public.validar_entorpecentes_itens_sem_peso() set search_path = public;
alter function public.conducoes_estatisticas(integer, integer) set search_path = public;
alter function public.normalizar_prisao_para_conducao_novo_registro() set search_path = public;
alter function public.normalizar_historico_resumido_caixa_alta() set search_path = public;

revoke execute on function public.cadastrar_subtipo_ocorrencia_publico(bigint, text, text)
  from public, anon;
grant execute on function public.cadastrar_subtipo_ocorrencia_publico(bigint, text, text)
  to authenticated, service_role;

create index if not exists acoes_preventivas_criado_por_idx
  on public.acoes_preventivas (criado_por);
create index if not exists acoes_preventivas_atualizado_por_idx
  on public.acoes_preventivas (atualizado_por);
create index if not exists ocorrencias_criado_por_idx
  on public.ocorrencias (criado_por);
create index if not exists ocorrencias_atualizado_por_idx
  on public.ocorrencias (atualizado_por);
create index if not exists perfis_usuarios_criado_por_idx
  on public.perfis_usuarios (criado_por);
create index if not exists tcos_criado_por_idx
  on public.tcos (criado_por);
create index if not exists tcos_atualizado_por_idx
  on public.tcos (atualizado_por);

alter policy auth_perfil_proprio_select
on public.perfis_usuarios
using (
  user_id = (select auth.uid())
  and (select private.usuario_ativo())
);

alter policy auth_acoes_preventivas_update
on public.acoes_preventivas
using (
  (select private.pode_administrar_dados())
  or (
    (select private.perfil_atual()) = 'OPERADOR'
    and criado_por = (select auth.uid())
  )
)
with check (
  (select private.pode_administrar_dados())
  or (
    (select private.perfil_atual()) = 'OPERADOR'
    and criado_por = (select auth.uid())
  )
);

comment on column public.tcos.unidade_id is
  'Unidade responsável, derivada obrigatoriamente da ocorrência vinculada.';

do $$
begin
  if (select count(*) from public.unidades) <> 13
     or (select count(*) from public.unidades where ativo) <> 13 then
    raise exception 'Validação final falhou: catálogo de unidades inconsistente.';
  end if;

  if exists (
    select 1
    from public.tcos t
    join public.ocorrencias o on o.id = t.ocorrencia_id
    where t.unidade_id is distinct from o.unidade_id
  ) then
    raise exception 'Validação final falhou: TCO e ocorrência com unidades divergentes.';
  end if;

  if has_function_privilege(
    'anon',
    'public.cadastrar_subtipo_ocorrencia_publico(bigint,text,text)',
    'execute'
  ) then
    raise exception 'Validação final falhou: RPC de subtipo ainda executável por anon.';
  end if;
end
$$;
