-- Fonte documental para as duas medidas solicitadas pelo comando CPC.
-- Uma linha representa UMA atividade documentada, nunca um BO ou pessoa.
-- Não migrar automaticamente BOs, local de entrega, conduções ou serviços.
-- Apenas registros validados alimentam o indicador executivo.
create table if not exists public.cpc_atividades_documentadas (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id),
  subunidade_id uuid references public.unidades(id),
  tipo text not null check (tipo in ('OPERACAO','APRESENTACAO')),
  referencia_atividade text not null check (length(btrim(referencia_atividade)) between 3 and 160),
  documento_referencia text not null check (length(btrim(documento_referencia)) between 3 and 200),
  data_atividade date not null,
  local_atividade text not null check (length(btrim(local_atividade)) between 3 and 240),
  descricao text not null check (length(btrim(descricao)) between 10 and 3000),
  situacao text not null default 'PENDENTE'
    check (situacao in ('PENDENTE','VALIDADO','CANCELADO')),
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  validado_por uuid references auth.users(id),
  validado_em timestamptz,
  constraint cpc_atividade_validacao_coerente check (
    (situacao='PENDENTE' and validado_por is null and validado_em is null)
    or (situacao in ('VALIDADO','CANCELADO'))
  )
);
-- O identificador individual da atividade impede lançar o mesmo evento duas
-- vezes na mesma unidade, ainda que existam vários BOs relativos a ele.
create unique index if not exists cpc_atividades_documentadas_evento_uniq
 on public.cpc_atividades_documentadas
 (unidade_id, tipo, upper(btrim(referencia_atividade)));
create index if not exists cpc_atividades_documentadas_periodo
 on public.cpc_atividades_documentadas(data_atividade,unidade_id,situacao);

-- Garante integridade da revisão mesmo que um cliente contorne a interface.
create or replace function public.cpc_validar_transicao_atividade()
returns trigger language plpgsql
set search_path to 'public','auth','private'
as $$
begin
  if tg_op='INSERT' then
    if new.situacao <> 'PENDENTE' or new.validado_por is not null or new.validado_em is not null then
      raise exception 'Novo lançamento deve permanecer pendente.';
    end if;
    if new.criado_por is distinct from auth.uid() then
      raise exception 'Identidade do autor inconsistente.';
    end if;
  else
    if new.id is distinct from old.id
       or new.unidade_id is distinct from old.unidade_id
       or new.subunidade_id is distinct from old.subunidade_id
       or new.tipo is distinct from old.tipo
       or new.referencia_atividade is distinct from old.referencia_atividade
       or new.documento_referencia is distinct from old.documento_referencia
       or new.data_atividade is distinct from old.data_atividade
       or new.local_atividade is distinct from old.local_atividade
       or new.descricao is distinct from old.descricao
       or new.criado_por is distinct from old.criado_por
       or new.criado_em is distinct from old.criado_em then
      raise exception 'Registro documental imutável. Cancele o lançamento incorreto.';
    end if;
    if old.situacao not in ('PENDENTE','VALIDADO') or new.situacao=old.situacao then
      raise exception 'Transição de revisão inválida.';
    end if;
    if old.situacao='VALIDADO' and new.situacao<>'CANCELADO' then
      raise exception 'Atividade validada só pode ser cancelada.';
    end if;
    if new.situacao not in ('VALIDADO','CANCELADO') then
      raise exception 'A revisão deve validar ou cancelar.';
    end if;
    if not private.pode_administrar_dados() or new.unidade_id <> private.unidade_atual() then
      raise exception 'Somente estatística/administração da unidade pode validar.';
    end if;
    if new.situacao='VALIDADO' then
      new.validado_por:=auth.uid();
      new.validado_em:=now();
    else
      -- Preserva quem validou anteriormente para a trilha de auditoria.
      new.validado_por:=old.validado_por;
      new.validado_em:=old.validado_em;
    end if;
  end if;
  if new.subunidade_id is not null and not exists (
    select 1 from public.unidades u where u.id=new.subunidade_id
      and u.parent_id=new.unidade_id and u.tipo='SUBUNIDADE' and u.ativo=true
  ) then
    raise exception 'Subunidade não pertence à unidade operacional.';
  end if;
  new.atualizado_em:=now();
  return new;
end $$;
drop trigger if exists cpc_atividades_documentadas_transicao on public.cpc_atividades_documentadas;
create trigger cpc_atividades_documentadas_transicao
 before insert or update on public.cpc_atividades_documentadas
 for each row execute function public.cpc_validar_transicao_atividade();

alter table public.cpc_atividades_documentadas enable row level security;
revoke all on public.cpc_atividades_documentadas from anon;
revoke all on public.cpc_atividades_documentadas from authenticated;
grant select,insert,update on public.cpc_atividades_documentadas to authenticated;
drop policy if exists cpc_atividades_leitura_unidades on public.cpc_atividades_documentadas;
create policy cpc_atividades_leitura_unidades
 on public.cpc_atividades_documentadas for select to authenticated
 using (private.usuario_ativo() and unidade_id=any(private.unidades_acessiveis_atual()));
drop policy if exists cpc_atividades_cadastro_propria_unidade on public.cpc_atividades_documentadas;
create policy cpc_atividades_cadastro_propria_unidade
 on public.cpc_atividades_documentadas for insert to authenticated
 with check (
   private.usuario_ativo() and private.pode_escrever_operacional()
   and unidade_id=private.unidade_atual() and criado_por=auth.uid()
   and situacao='PENDENTE' and validado_por is null and validado_em is null
   and exists(select 1 from public.unidades u where u.id=unidade_id
     and u.ativo=true and u.aceita_registro_operacional=true and u.tipo<>'COMANDO')
 );
drop policy if exists cpc_atividades_revisao_unidade on public.cpc_atividades_documentadas;
create policy cpc_atividades_revisao_unidade
 on public.cpc_atividades_documentadas for update to authenticated
 using (private.usuario_ativo() and private.pode_administrar_dados()
   and unidade_id=private.unidade_atual())
 with check (private.usuario_ativo() and private.pode_administrar_dados()
   and unidade_id=private.unidade_atual());
-- DELETE propositalmente indisponível: cancelamento preserva evidências.
