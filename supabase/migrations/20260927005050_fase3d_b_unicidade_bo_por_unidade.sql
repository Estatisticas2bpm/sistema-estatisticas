begin;

set local lock_timeout = '10s';
set local statement_timeout = '2min';

-- Impede que cadastros ou ativações concorrentes alterem as premissas entre
-- as validações e a substituição dos índices.
lock table public.ocorrencias in share row exclusive mode;
lock table public.unidades in share mode;

-- =========================================================
-- 1. PRÉ-CONDIÇÕES
-- =========================================================

do $$
declare
  v_total bigint;
  v_ativas bigint;
  v_unidades bigint;
  v_indexdef text;
  v_default text;
begin
  if to_regclass('public.ocorrencias') is null
     or to_regclass('public.unidades') is null then
    raise exception
      'Fase 3D-B cancelada: tabelas organizacionais obrigatórias não foram encontradas.';
  end if;

  select count(*) into v_total
  from public.ocorrencias;

  if v_total <> 2731 then
    raise exception
      'Fase 3D-B cancelada: esperado total de 2731 ocorrências, encontrado %.',
      v_total;
  end if;

  if exists (
    select 1
    from public.ocorrencias
    where unidade_id is null
  ) then
    raise exception
      'Fase 3D-B cancelada: existe ocorrência sem unidade responsável.';
  end if;

  if exists (
    select 1
    from public.ocorrencias
    where unidade_id is distinct from
      'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
  ) then
    raise exception
      'Fase 3D-B cancelada: existe ocorrência fora do 2º BPM.';
  end if;

  if exists (
    select 1
    from public.ocorrencias
    where data_ocorrencia is null
       or tipo_registro is null
       or btrim(tipo_registro) = ''
       or numero_bo is null
       or btrim(numero_bo) = ''
  ) then
    raise exception
      'Fase 3D-B cancelada: existem campos obrigatórios nulos ou vazios na chave de unicidade.';
  end if;

  if exists (
    select 1
    from public.ocorrencias o
    left join public.unidades u on u.id = o.unidade_id
    where u.id is null
  ) then
    raise exception
      'Fase 3D-B cancelada: existe ocorrência vinculada a unidade inexistente.';
  end if;

  select count(*) into v_unidades
  from public.unidades;

  if v_unidades <> 13 then
    raise exception
      'Fase 3D-B cancelada: esperado catálogo de 13 unidades, encontrado %.',
      v_unidades;
  end if;

  select count(*) into v_ativas
  from public.unidades
  where ativo;

  if v_ativas <> 1
     or not exists (
       select 1
       from public.unidades
       where id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
         and sigla = '2BPM'
         and ativo
     ) then
    raise exception
      'Fase 3D-B cancelada: somente o 2º BPM deve estar ativo.';
  end if;

  if not exists (
    select 1
    from pg_attribute
    where attrelid = 'public.ocorrencias'::regclass
      and attname = 'unidade_id'
      and atttypid = 'uuid'::regtype
      and attnotnull
      and not attisdropped
  ) then
    raise exception
      'Fase 3D-B cancelada: ocorrencias.unidade_id não é UUID NOT NULL.';
  end if;

  select pg_get_expr(d.adbin, d.adrelid)
    into v_default
  from pg_attribute a
  join pg_attrdef d
    on d.adrelid = a.attrelid
   and d.adnum = a.attnum
  where a.attrelid = 'public.ocorrencias'::regclass
    and a.attname = 'unidade_id';

  if v_default is distinct from
     '''f09a10df-cd1d-48d1-a093-bf731906e175''::uuid' then
    raise exception
      'Fase 3D-B cancelada: DEFAULT temporário de unidade_id foi alterado (%).',
      coalesce(v_default, 'NULL');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ocorrencias'::regclass
      and conname = 'ocorrencias_unidade_fase2_2bpm_chk'
      and contype = 'c'
      and convalidated
      and pg_get_constraintdef(oid, true) =
        'CHECK (unidade_id = ''f09a10df-cd1d-48d1-a093-bf731906e175''::uuid)'
  ) then
    raise exception
      'Fase 3D-B cancelada: CHECK temporário do 2º BPM não corresponde ao estado aprovado.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ocorrencias'::regclass
      and conname = 'ocorrencias_unidade_id_fkey'
      and contype = 'f'
      and convalidated
      and pg_get_constraintdef(oid, true) =
        'FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON UPDATE RESTRICT ON DELETE RESTRICT'
  ) then
    raise exception
      'Fase 3D-B cancelada: FK de unidade não corresponde ao estado aprovado.';
  end if;

  if to_regclass('public.ocorrencia_numero_ano_unico') is null then
    raise exception
      'Fase 3D-B cancelada: índice ocorrencia_numero_ano_unico não encontrado.';
  end if;

  select pg_get_indexdef(to_regclass('public.ocorrencia_numero_ano_unico'))
    into v_indexdef;

  if v_indexdef is distinct from
     'CREATE UNIQUE INDEX ocorrencia_numero_ano_unico ON public.ocorrencias USING btree (tipo_registro, numero_bo, EXTRACT(year FROM data_ocorrencia))' then
    raise exception
      'Fase 3D-B cancelada: definição inesperada de ocorrencia_numero_ano_unico: %.',
      coalesce(v_indexdef, 'NULL');
  end if;

  if to_regclass('public.ocorrencias_chave_importacao_uq') is null then
    raise exception
      'Fase 3D-B cancelada: índice ocorrencias_chave_importacao_uq não encontrado.';
  end if;

  select pg_get_indexdef(to_regclass('public.ocorrencias_chave_importacao_uq'))
    into v_indexdef;

  if v_indexdef is distinct from
     'CREATE UNIQUE INDEX ocorrencias_chave_importacao_uq ON public.ocorrencias USING btree (data_ocorrencia, tipo_registro, numero_bo)' then
    raise exception
      'Fase 3D-B cancelada: definição inesperada de ocorrencias_chave_importacao_uq: %.',
      coalesce(v_indexdef, 'NULL');
  end if;

  if exists (
    select 1
    from pg_constraint
    where conindid in (
      to_regclass('public.ocorrencia_numero_ano_unico'),
      to_regclass('public.ocorrencias_chave_importacao_uq')
    )
  ) then
    raise exception
      'Fase 3D-B cancelada: um índice-alvo passou a sustentar uma constraint.';
  end if;

  if exists (
    select 1
    from public.ocorrencias
    group by
      unidade_id,
      tipo_registro,
      numero_bo,
      extract(year from data_ocorrencia)
    having count(*) > 1
  ) then
    raise exception
      'Fase 3D-B cancelada: existem duplicidades na nova chave por unidade e ano.';
  end if;

  if exists (
    select 1
    from public.ocorrencias
    group by
      unidade_id,
      data_ocorrencia,
      tipo_registro,
      numero_bo
    having count(*) > 1
  ) then
    raise exception
      'Fase 3D-B cancelada: existem duplicidades na nova chave de importação por unidade.';
  end if;
end
$$;

-- =========================================================
-- 2. UNICIDADE POR UNIDADE RESPONSÁVEL
-- =========================================================

drop index public.ocorrencia_numero_ano_unico;

create unique index ocorrencia_numero_ano_unico
  on public.ocorrencias (
    unidade_id,
    tipo_registro,
    numero_bo,
    (extract(year from data_ocorrencia))
  );

drop index public.ocorrencias_chave_importacao_uq;

create unique index ocorrencias_chave_importacao_uq
  on public.ocorrencias (
    unidade_id,
    data_ocorrencia,
    tipo_registro,
    numero_bo
  );

comment on index public.ocorrencia_numero_ano_unico is
  'Impede repetição do mesmo tipo e número de documento no mesmo ano e na mesma unidade responsável.';

comment on index public.ocorrencias_chave_importacao_uq is
  'Impede repetição da mesma chave de importação na mesma unidade responsável.';

-- =========================================================
-- 3. PÓS-CONDIÇÕES
-- =========================================================

do $$
declare
  v_total bigint;
  v_ativas bigint;
  v_indexdef text;
  v_default text;
begin
  select count(*) into v_total
  from public.ocorrencias;

  if v_total <> 2731 then
    raise exception
      'Fase 3D-B cancelada: total pós-migration divergiu de 2731 (%).',
      v_total;
  end if;

  if exists (
    select 1
    from public.ocorrencias
    where unidade_id is null
       or unidade_id is distinct from
          'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
  ) then
    raise exception
      'Fase 3D-B cancelada: propriedade organizacional das ocorrências foi alterada.';
  end if;

  select count(*) into v_ativas
  from public.unidades
  where ativo;

  if v_ativas <> 1
     or not exists (
       select 1
       from public.unidades
       where id = 'f09a10df-cd1d-48d1-a093-bf731906e175'::uuid
         and sigla = '2BPM'
         and ativo
     ) then
    raise exception
      'Fase 3D-B cancelada: estado de ativação das unidades foi alterado.';
  end if;

  select pg_get_indexdef(to_regclass('public.ocorrencia_numero_ano_unico'))
    into v_indexdef;

  if v_indexdef is distinct from
     'CREATE UNIQUE INDEX ocorrencia_numero_ano_unico ON public.ocorrencias USING btree (unidade_id, tipo_registro, numero_bo, EXTRACT(year FROM data_ocorrencia))' then
    raise exception
      'Fase 3D-B cancelada: índice anual por unidade não foi criado como esperado: %.',
      coalesce(v_indexdef, 'NULL');
  end if;

  select pg_get_indexdef(to_regclass('public.ocorrencias_chave_importacao_uq'))
    into v_indexdef;

  if v_indexdef is distinct from
     'CREATE UNIQUE INDEX ocorrencias_chave_importacao_uq ON public.ocorrencias USING btree (unidade_id, data_ocorrencia, tipo_registro, numero_bo)' then
    raise exception
      'Fase 3D-B cancelada: índice de importação por unidade não foi criado como esperado: %.',
      coalesce(v_indexdef, 'NULL');
  end if;

  select pg_get_expr(d.adbin, d.adrelid)
    into v_default
  from pg_attribute a
  join pg_attrdef d
    on d.adrelid = a.attrelid
   and d.adnum = a.attnum
  where a.attrelid = 'public.ocorrencias'::regclass
    and a.attname = 'unidade_id';

  if v_default is distinct from
     '''f09a10df-cd1d-48d1-a093-bf731906e175''::uuid' then
    raise exception
      'Fase 3D-B cancelada: DEFAULT temporário do 2º BPM foi alterado.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ocorrencias'::regclass
      and conname = 'ocorrencias_unidade_fase2_2bpm_chk'
      and contype = 'c'
      and convalidated
  ) then
    raise exception
      'Fase 3D-B cancelada: CHECK temporário do 2º BPM foi removido ou invalidado.';
  end if;

  if exists (
    select 1
    from public.ocorrencias
    group by
      unidade_id,
      tipo_registro,
      numero_bo,
      extract(year from data_ocorrencia)
    having count(*) > 1
  ) or exists (
    select 1
    from public.ocorrencias
    group by
      unidade_id,
      data_ocorrencia,
      tipo_registro,
      numero_bo
    having count(*) > 1
  ) then
    raise exception
      'Fase 3D-B cancelada: a troca de índices não preservou a unicidade esperada.';
  end if;
end
$$;

commit;
