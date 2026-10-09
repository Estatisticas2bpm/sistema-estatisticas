-- CIPG: ajustar o SIE-CPC ao levantamento presencial SIEPOM (24/09/2026).
-- Eventos da CIPG sao relatos do livro de servico, NAO ocorrencias policiais.
-- Nao armazenar nome de guerra, lesao/quadro ou descricao clinica no modulo estatistico.
begin;
create table if not exists public.cipg_postos (
  codigo text primary key check (codigo ~ '^[A-Z0-9_-]{2,16}$'),
  nome text not null check(length(btrim(nome)) between 3 and 180),
  tipo_local text not null default 'OUTRO'
    check(tipo_local in('EDIFICIO_PUBLICO','ESTABELECIMENTO_PENAL','OUTRO')),
  area text check(area is null or area in('LESTE','OESTE')),
  area_pendente_validacao boolean not null default false,
  municipio text,
  bairro text,
  logradouro text,
  ativo boolean not null default true,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
insert into public.cipg_postos(codigo,nome,tipo_local,area,area_pendente_validacao,municipio,bairro,logradouro)
values
 ('PSE','PRONTO SOCORRO DO ESTADO — HOSPITAL GERAL DE RORAIMA (HGR)',
  'EDIFICIO_PUBLICO','LESTE',false,'BOA VISTA','AEROPORTO','AV EDUARDO GOMES N° 1364'),
 ('CSE','CENTRO SÓCIO EDUCATIVO',
  'EDIFICIO_PUBLICO',null,true,'BOA VISTA','PEDRA PINTADA','R. SB-02, 321')
on conflict(codigo) do nothing;
comment on column public.cipg_postos.area_pendente_validacao is
'A planilha sinaliza divergencia da area LESTE/OESTE do CSE. Nao preencher area sem verificacao.';

alter table public.cipg_servicos_guarda
  add column if not exists posto_codigo text references public.cipg_postos(codigo) on delete restrict,
  add column if not exists numero_sei text,
  add column if not exists regime text,
  add column if not exists efetivo_ordinario integer not null default 0
    check(efetivo_ordinario between 0 and 10000),
  add column if not exists efetivo_svi integer not null default 0
    check(efetivo_svi between 0 and 10000),
  add column if not exists viatura text,
  add column if not exists km_rodados numeric(12,2)
    check(km_rodados is null or km_rodados>=0),
  add column if not exists litros_abastecidos numeric(12,2)
    check(litros_abastecidos is null or litros_abastecidos>=0),
  add column if not exists situacao text not null default 'SEM ALTERACAO'
    check(situacao in('SEM ALTERACAO','COM ALTERACAO')),
  add column if not exists alteracao_pessoal boolean not null default false,
  add column if not exists alteracao_instalacoes boolean not null default false,
  add column if not exists alteracao_material boolean not null default false,
  add column if not exists saidas_autorizadas integer
    check(saidas_autorizadas is null or saidas_autorizadas>=0);
create unique index if not exists cipg_servicos_numero_sei_unico
  on public.cipg_servicos_guarda(unidade_id,lower(btrim(numero_sei)))
  where numero_sei is not null and btrim(numero_sei)<>'';
create index if not exists cipg_servicos_posto_periodo
  on public.cipg_servicos_guarda(posto_codigo,data_servico desc);
comment on column public.cipg_servicos_guarda.efetivo_ordinario is
'Efetivo empregado no servico, nao numero de policiais distintos no periodo.';
comment on column public.cipg_servicos_guarda.situacao is
'SEM ALTERACAO quando o relatorio for S/A; COM ALTERACAO se relatar alteracoes ou eventos.';

create table if not exists public.cipg_eventos_guarda (
 id uuid primary key default gen_random_uuid(),
 servico_id uuid not null references public.cipg_servicos_guarda(id) on delete restrict,
 tipo_evento text not null check(tipo_evento in(
  'ENTRADA DE PM NO HOSPITAL','ÓBITO DE PM','ALTERAÇÃO NO POSTO',
  'FUGA / EVASÃO','TUMULTO','APOIO PRESTADO','OUTROS')),
 graduacao text check(graduacao is null or graduacao in(
  'CEL','TEN CEL','MAJ','CAP','1º TEN','2º TEN','ASP OF','ST',
  '1º SGT','2º SGT','3º SGT','CB','SD','CIVIL','OUTRO')),
 unidade_militar text check(unidade_militar is null or length(unidade_militar)<=120),
 em_servico text check(em_servico is null or em_servico in('SIM','NÃO','NÃO INFORMADO')),
 causa_motivo text check(causa_motivo is null or causa_motivo in(
  'ACIDENTE DE TRÂNSITO','ATROPELAMENTO','PAF — ARMA DE FOGO',
  'ARMA BRANCA','AGRESSÃO FÍSICA','INFARTO / PROBLEMA CARDÍACO',
  'AVC','MAL SÚBITO','SURTO / CRISE PSIQUIÁTRICA','QUEDA',
  'OUTRA DOENÇA','OUTROS')),
 conduzido_por text check(conduzido_por is null or conduzido_por in(
  'SAMU','VIATURA PM','CORPO DE BOMBEIROS','MEIOS PRÓPRIOS','OUTROS','NÃO INFORMADO')),
 setor_atendimento text check(setor_atendimento is null or length(setor_atendimento)<=120),
 desfecho text check(desfecho is null or desfecho in(
  'EM ATENDIMENTO','EM OBSERVAÇÃO','INTERNADO','LIBERADO','TRANSFERIDO','ÓBITO')),
 criado_por uuid not null default auth.uid() references auth.users(id) on delete restrict,
 atualizado_por uuid references auth.users(id) on delete set null,
 criado_em timestamptz not null default now(),
 atualizado_em timestamptz not null default now()
);
create index if not exists cipg_eventos_guarda_servico_idx
 on public.cipg_eventos_guarda(servico_id);
create index if not exists cipg_eventos_guarda_criador_idx
 on public.cipg_eventos_guarda(criado_por);

drop trigger if exists cipg_eventos_guarda_atualizado_em on public.cipg_eventos_guarda;
create trigger cipg_eventos_guarda_atualizado_em
before update on public.cipg_eventos_guarda
for each row execute function public.atualizar_data_modificacao();

alter table public.cipg_postos enable row level security;
revoke all on public.cipg_postos from anon,authenticated;
grant select,insert on public.cipg_postos to authenticated;
drop policy if exists cipg_postos_select on public.cipg_postos;
create policy cipg_postos_select on public.cipg_postos
for select to authenticated using (
 (select private.usuario_ativo()) and
 exists(select 1 from public.unidades u where u.sigla='CIPG' and u.ativo
 and private.pode_acessar_unidade(u.id))
);
drop policy if exists cipg_postos_insert on public.cipg_postos;
create policy cipg_postos_insert on public.cipg_postos
for insert to authenticated with check (
 (select private.pode_administrar_dados())
 and (select private.usuario_ativo())
 and exists(select 1 from public.unidades u where u.sigla='CIPG' and u.id=(select private.unidade_atual()) and u.ativo)
 and criado_por=(select auth.uid())
);

alter table public.cipg_eventos_guarda enable row level security;
revoke all on public.cipg_eventos_guarda from anon,authenticated;
grant select,insert,update,delete on public.cipg_eventos_guarda to authenticated;
drop policy if exists cipg_eventos_select on public.cipg_eventos_guarda;
create policy cipg_eventos_select on public.cipg_eventos_guarda
for select to authenticated using (
 (select private.usuario_ativo()) and exists(
  select 1 from public.cipg_servicos_guarda s join public.unidades u on u.id=s.unidade_id
  where s.id=servico_id and u.sigla='CIPG' and u.ativo
    and private.pode_acessar_unidade(s.unidade_id))
);
drop policy if exists cipg_eventos_insert on public.cipg_eventos_guarda;
create policy cipg_eventos_insert on public.cipg_eventos_guarda
for insert to authenticated with check (
 criado_por=(select auth.uid())
 and (select private.pode_escrever_operacional()) and exists(
  select 1 from public.cipg_servicos_guarda s join public.unidades u on u.id=s.unidade_id
  where s.id=servico_id and u.sigla='CIPG' and u.ativo
    and s.unidade_id=(select private.unidade_atual()))
);
drop policy if exists cipg_eventos_update on public.cipg_eventos_guarda;
create policy cipg_eventos_update on public.cipg_eventos_guarda
for update to authenticated
using(
 (select private.pode_administrar_dados()) or
 ((select private.perfil_atual())='OPERADOR' and criado_por=(select auth.uid()))
)
with check (
 atualizado_por=(select auth.uid()) and
 ((select private.pode_administrar_dados()) or
 ((select private.perfil_atual())='OPERADOR' and criado_por=(select auth.uid())))
 and exists(select 1 from public.cipg_servicos_guarda s
  where s.id=servico_id and s.unidade_id=(select private.unidade_atual()))
);
drop policy if exists cipg_eventos_delete on public.cipg_eventos_guarda;
create policy cipg_eventos_delete on public.cipg_eventos_guarda
for delete to authenticated using (
 (select private.pode_administrar_dados())
 and exists(select 1 from public.cipg_servicos_guarda s
  where s.id=servico_id and s.unidade_id=(select private.unidade_atual()))
);
comment on table public.cipg_eventos_guarda is
'Uma linha por militar envolvido no acontecimento. Sem nome de guerra, lesao/quadro ou prontuario. Exibir apenas estatisticas agregadas.';
commit;