begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table public.unidades in share row exclusive mode;

do $$
declare
  v_total bigint;
begin
  select count(*) into v_total from public.unidades;

  if v_total <> 1 then
    raise exception 'Migration cancelada: esperada exatamente 1 unidade, mas foram encontradas %.', v_total;
  end if;

  if not exists (
    select 1
    from public.unidades
    where id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
      and sigla = '2BPM'
      and nome = '2º Batalhão de Polícia Militar'
      and ativo = true
  ) then
    raise exception 'Migration cancelada: o registro original do 2º BPM não corresponde ao inventário aprovado.';
  end if;
end
$$;

alter table public.unidades
  add column parent_id uuid,
  add column tipo text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'unidades_parent_id_fkey'
      and conrelid = 'public.unidades'::regclass
  ) then
    alter table public.unidades
      add constraint unidades_parent_id_fkey
      foreign key (parent_id)
      references public.unidades(id)
      on update no action
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'unidades_parent_diferente_do_id_chk'
      and conrelid = 'public.unidades'::regclass
  ) then
    alter table public.unidades
      add constraint unidades_parent_diferente_do_id_chk
      check (parent_id is null or parent_id <> id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'unidades_tipo_nao_vazio_chk'
      and conrelid = 'public.unidades'::regclass
  ) then
    alter table public.unidades
      add constraint unidades_tipo_nao_vazio_chk
      check (btrim(tipo) <> '');
  end if;
end
$$;

insert into public.unidades (sigla, nome, tipo, parent_id, ativo)
values ('CPC', 'Comando de Policiamento da Capital', 'COMANDO', null, false);

do $$
declare
  v_linhas integer;
begin
  update public.unidades
  set parent_id = (select id from public.unidades where sigla = 'CPC'),
      tipo = 'BATALHAO'
  where id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
    and sigla = '2BPM';

  get diagnostics v_linhas = row_count;

  if v_linhas <> 1 then
    raise exception 'Migration cancelada: não foi possível atualizar exatamente o registro original do 2º BPM.';
  end if;
end
$$;

with unidades_cpc (sigla, nome, tipo) as (
  values
    ('1BPM', '1º Batalhão de Polícia Militar', 'BATALHAO'),
    ('GIRO', 'GIRO', 'UNIDADE'),
    ('CIPTUR', 'CIPTUR', 'UNIDADE'),
    ('CIPA', 'CIPA', 'UNIDADE'),
    ('CIPG', 'CIPG', 'UNIDADE'),
    ('CAVALARIA', 'Cavalaria', 'UNIDADE'),
    ('BOPE', 'BOPE', 'BATALHAO')
)
insert into public.unidades (sigla, nome, tipo, parent_id, ativo)
select u.sigla, u.nome, u.tipo, cpc.id, false
from unidades_cpc u
cross join public.unidades cpc
where cpc.sigla = 'CPC';

with subunidades_bope (sigla, nome, tipo) as (
  values
    ('CANIL', 'Canil', 'SUBUNIDADE'),
    ('FORCA_TATICA', 'Força Tática', 'SUBUNIDADE'),
    ('CHOQUE', 'Choque', 'SUBUNIDADE'),
    ('GATE', 'GATE', 'SUBUNIDADE')
)
insert into public.unidades (sigla, nome, tipo, parent_id, ativo)
select s.sigla, s.nome, s.tipo, bope.id, false
from subunidades_bope s
cross join public.unidades bope
where bope.sigla = 'BOPE';

alter table public.unidades
  alter column tipo set not null;

create index unidades_parent_id_idx
  on public.unidades(parent_id);

do $$
declare
  v_total bigint;
  v_ativos bigint;
  v_subunidades_bope bigint;
begin
  select count(*) into v_total from public.unidades;

  if v_total <> 13 then
    raise exception 'Migration cancelada: esperadas 13 unidades após a carga, mas foram encontradas %.', v_total;
  end if;

  select count(*) into v_ativos from public.unidades where ativo = true;

  if v_ativos <> 1 then
    raise exception 'Migration cancelada: esperada exatamente 1 unidade ativa, mas foram encontradas %.', v_ativos;
  end if;

  if not exists (
    select 1
    from public.unidades u
    join public.unidades p on p.id = u.parent_id
    where u.id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
      and u.sigla = '2BPM'
      and u.nome = '2º Batalhão de Polícia Militar'
      and u.tipo = 'BATALHAO'
      and u.ativo = true
      and p.sigla = 'CPC'
  ) then
    raise exception 'Migration cancelada: a preservação ou vinculação do 2º BPM falhou.';
  end if;

  if not exists (
    select 1
    from public.unidades u
    join public.unidades p on p.id = u.parent_id
    where u.sigla = 'BOPE'
      and u.tipo = 'BATALHAO'
      and p.sigla = 'CPC'
  ) then
    raise exception 'Migration cancelada: o BOPE não foi vinculado corretamente ao CPC.';
  end if;

  select count(*) into v_subunidades_bope
  from public.unidades u
  join public.unidades p on p.id = u.parent_id
  where p.sigla = 'BOPE'
    and u.tipo = 'SUBUNIDADE'
    and u.sigla in ('CANIL', 'FORCA_TATICA', 'CHOQUE', 'GATE');

  if v_subunidades_bope <> 4 then
    raise exception 'Migration cancelada: esperadas 4 subunidades do BOPE, mas foram encontradas %.', v_subunidades_bope;
  end if;

  if exists (
    select 1 from public.unidades
    where sigla = 'GAT' or upper(nome) = 'GAT'
  ) then
    raise exception 'Migration cancelada: foi encontrada a nomenclatura incorreta GAT.';
  end if;

  if not exists (
    select 1
    from public.unidades u
    join public.unidades p on p.id = u.parent_id
    where u.sigla = 'GATE'
      and u.nome = 'GATE'
      and u.tipo = 'SUBUNIDADE'
      and p.sigla = 'BOPE'
  ) then
    raise exception 'Migration cancelada: o GATE não foi vinculado corretamente ao BOPE.';
  end if;

  if exists (select 1 from public.unidades where id = parent_id) then
    raise exception 'Migration cancelada: foi detectada autorreferência na hierarquia.';
  end if;
end
$$;

commit;
