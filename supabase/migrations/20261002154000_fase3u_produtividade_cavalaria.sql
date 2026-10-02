begin;

insert into public.modulos_sistema (codigo,nome,descricao,ativo,ordem)
values (
  'PRODUTIVIDADE_CAVALARIA',
  'Produtividade da Cavalaria',
  'Registro de serviços, policiamentos e indicadores operacionais da Cavalaria.',
  true,
  40
)
on conflict (codigo) do update
set nome=excluded.nome,
    descricao=excluded.descricao,
    ativo=true,
    ordem=excluded.ordem;

insert into public.unidades_modulos (unidade_id,modulo_id,ativo)
select u.id,m.id,true
from public.unidades u
join public.modulos_sistema m on m.codigo='PRODUTIVIDADE_CAVALARIA'
where upper(u.sigla)='CAVALARIA'
on conflict (unidade_id,modulo_id) do update set ativo=true;

create table if not exists public.cavalaria_servicos_produtividade (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete restrict,
  data_servico date not null,
  hora_inicio time,
  hora_fim time,
  tipo_policiamento text not null check (
    tipo_policiamento in (
      'POLICIAMENTO_MOTORIZADO',
      'POLICIAMENTO_MONTADO',
      'POLICIAMENTO_OPERACOES',
      'POLICIAMENTO_COMUNITARIO'
    )
  ),
  contexto_atividade text not null default 'ROTINA' check (
    contexto_atividade in (
      'ROTINA',
      'EVENTO',
      'VISITA_TECNICA',
      'ACAO_SOCIAL',
      'REPRESENTACAO_INSTITUCIONAL',
      'OUTRO'
    )
  ),
  localidade text not null,
  bairro text,
  endereco text,
  numero_documento text,
  comandante text,
  guarnicao jsonb not null default '[]'::jsonb check (jsonb_typeof(guarnicao)='array'),
  solipedes text[] not null default '{}'::text[],
  viaturas text[] not null default '{}'::text[],
  abordagens_pessoas integer not null default 0 check (abordagens_pessoas >= 0),
  abordagens_motos integer not null default 0 check (abordagens_motos >= 0),
  abordagens_carros integer not null default 0 check (abordagens_carros >= 0),
  rops_produzidos integer not null default 0 check (rops_produzidos >= 0),
  veiculos_removidos integer not null default 0 check (veiculos_removidos >= 0),
  foragidos_presos integer not null default 0 check (foragidos_presos >= 0),
  armas_apreendidas integer not null default 0 check (armas_apreendidas >= 0),
  observacoes text,
  criado_por uuid not null default auth.uid() references auth.users(id) on delete restrict,
  atualizado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists cavalaria_servicos_unidade_data_idx
  on public.cavalaria_servicos_produtividade (unidade_id,data_servico desc);
create index if not exists cavalaria_servicos_tipo_idx
  on public.cavalaria_servicos_produtividade (unidade_id,tipo_policiamento,data_servico desc);
create index if not exists cavalaria_servicos_contexto_idx
  on public.cavalaria_servicos_produtividade (unidade_id,contexto_atividade,data_servico desc);
create index if not exists cavalaria_servicos_criado_por_idx
  on public.cavalaria_servicos_produtividade (criado_por);
create index if not exists cavalaria_servicos_atualizado_por_idx
  on public.cavalaria_servicos_produtividade (atualizado_por)
  where atualizado_por is not null;

drop trigger if exists cavalaria_servicos_atualizado_em on public.cavalaria_servicos_produtividade;
create trigger cavalaria_servicos_atualizado_em
before update on public.cavalaria_servicos_produtividade
for each row execute function public.atualizar_data_modificacao();

alter table public.cavalaria_servicos_produtividade enable row level security;

revoke all on public.cavalaria_servicos_produtividade from anon;
revoke all on public.cavalaria_servicos_produtividade from authenticated;
grant select,insert,update,delete on public.cavalaria_servicos_produtividade to authenticated;

drop policy if exists cavalaria_servicos_select_escopo on public.cavalaria_servicos_produtividade;
create policy cavalaria_servicos_select_escopo
on public.cavalaria_servicos_produtividade
for select to authenticated
using (
  unidade_id = private.unidade_atual()
  or unidade_id = any(private.unidades_acessiveis_atual())
);

drop policy if exists cavalaria_servicos_insert_unidade on public.cavalaria_servicos_produtividade;
create policy cavalaria_servicos_insert_unidade
on public.cavalaria_servicos_produtividade
for insert to authenticated
with check (
  unidade_id = private.unidade_atual()
  and criado_por = (select auth.uid())
  and private.pode_escrever_operacional()
  and exists (
    select 1
    from public.unidades u
    where u.id = cavalaria_servicos_produtividade.unidade_id
      and u.ativo = true
      and upper(u.sigla) = 'CAVALARIA'
  )
);

drop policy if exists cavalaria_servicos_update_unidade on public.cavalaria_servicos_produtividade;
create policy cavalaria_servicos_update_unidade
on public.cavalaria_servicos_produtividade
for update to authenticated
using (
  unidade_id = private.unidade_atual()
  and (
    private.pode_administrar_dados()
    or (
      private.perfil_atual() = 'OPERADOR'
      and criado_por = (select auth.uid())
    )
  )
)
with check (
  unidade_id = private.unidade_atual()
  and atualizado_por = (select auth.uid())
  and (
    private.pode_administrar_dados()
    or (
      private.perfil_atual() = 'OPERADOR'
      and criado_por = (select auth.uid())
    )
  )
);

drop policy if exists cavalaria_servicos_delete_unidade on public.cavalaria_servicos_produtividade;
create policy cavalaria_servicos_delete_unidade
on public.cavalaria_servicos_produtividade
for delete to authenticated
using (
  unidade_id = private.unidade_atual()
  and private.pode_administrar_dados()
);

commit;
