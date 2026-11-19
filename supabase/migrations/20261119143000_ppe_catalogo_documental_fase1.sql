-- Fase aditiva: catálogo PPe e evidência documental. Não reclassifica históricos.
create table public.naturezas_ppe (
 id uuid primary key default gen_random_uuid(),
 codigo_ppe text not null unique check(codigo_ppe ~ '^[0-9]{1,9}$'),
 descricao_original text not null check(length(btrim(descricao_original)) between 3 and 320),
 descricao_padronizada text not null check(length(btrim(descricao_padronizada)) between 3 and 320),
 fundamentacao_legal text check(length(fundamentacao_legal)<=300),
 categoria text check(length(categoria)<=120),
 primeiro_registro timestamptz not null default now(),
 ultimo_registro timestamptz not null default now(),
 quantidade_registros integer not null default 0 check(quantidade_registros>=0),
 status_validacao text not null default 'PENDENTE' check(status_validacao in ('PENDENTE','VALIDADA','DIVERGENTE')),
 ativo boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.naturezas_ppe_divergencias (
 id uuid primary key default gen_random_uuid(),
 natureza_id uuid not null references public.naturezas_ppe(id) on delete restrict,
 descricao text not null check(length(descricao) between 3 and 320),
 fundamentacao_legal text not null default '' check(length(fundamentacao_legal)<=300),
 identificado_em timestamptz not null default now(),
 resolvido_em timestamptz,
 resolvido_por uuid references auth.users(id),
 unique(natureza_id,descricao,fundamentacao_legal)
);
create table public.naturezas_ppe_sinonimos (
 natureza_id uuid not null references public.naturezas_ppe(id) on delete restrict,
 termo text not null check(length(btrim(termo)) between 2 and 160),
 primary key(natureza_id,termo)
);
create table public.naturezas_ppe_solicitacoes (
 id uuid primary key default gen_random_uuid(),
 descricao text not null check(length(btrim(descricao)) between 3 and 320),
 solicitante uuid not null references auth.users(id),
 unidade_id uuid not null references public.unidades(id),
 criado_em timestamptz not null default now(),
 status text not null default 'PENDENTE' check(status in ('PENDENTE','ATENDIDA','RECUSADA')),
 resposta text,
 resolvido_por uuid references auth.users(id),
 resolvido_em timestamptz
);
create table public.ocorrencias_naturezas_ppe (
 ocorrencia_id uuid not null references public.ocorrencias(id) on delete cascade,
 natureza_id uuid not null references public.naturezas_ppe(id) on delete restrict,
 origem text not null check(origem in ('ORIGINAL','VALIDADA')),
 descricao_documento text,
 fundamentacao_documento text,
 associado_em timestamptz not null default now(),
 associado_por uuid references auth.users(id),
 primary key(ocorrencia_id,natureza_id,origem)
);
create index on public.ocorrencias_naturezas_ppe(natureza_id,origem,ocorrencia_id);
create table public.naturezas_ppe_auditoria (
 id bigint generated always as identity primary key,
 natureza_id uuid references public.naturezas_ppe(id) on delete restrict,
 ocorrencia_id uuid,
 usuario_id uuid references auth.users(id),
 acao text not null,
 anterior jsonb,
 novo jsonb,
 justificativa text,
 criado_em timestamptz not null default now()
);
alter table public.ocorrencias add column ppe_naturezas_originais jsonb;
alter table public.ocorrencias add constraint ocorrencias_ppe_originais_array check(ppe_naturezas_originais is null or (jsonb_typeof(ppe_naturezas_originais)='array' and jsonb_array_length(ppe_naturezas_originais)<=30));

alter table public.naturezas_ppe enable row level security;
alter table public.naturezas_ppe_divergencias enable row level security;
alter table public.naturezas_ppe_sinonimos enable row level security;
alter table public.naturezas_ppe_solicitacoes enable row level security;
alter table public.ocorrencias_naturezas_ppe enable row level security;
alter table public.naturezas_ppe_auditoria enable row level security;
revoke all on public.naturezas_ppe,public.naturezas_ppe_divergencias,public.naturezas_ppe_sinonimos,public.naturezas_ppe_solicitacoes,public.ocorrencias_naturezas_ppe,public.naturezas_ppe_auditoria from public,anon,authenticated;
grant select on public.naturezas_ppe,public.naturezas_ppe_divergencias,public.naturezas_ppe_sinonimos,public.naturezas_ppe_solicitacoes,public.ocorrencias_naturezas_ppe,public.naturezas_ppe_auditoria to authenticated;
create policy ppe_catalogo_leitura on public.naturezas_ppe for select to authenticated using((select private.usuario_ativo()));
create policy ppe_sinonimos_leitura on public.naturezas_ppe_sinonimos for select to authenticated using((select private.usuario_ativo()));
create policy ppe_divergencias_admin on public.naturezas_ppe_divergencias for select to authenticated using((select private.usuario_ativo()) and (select private.perfil_atual())='ADMIN');
create policy ppe_auditoria_admin on public.naturezas_ppe_auditoria for select to authenticated using((select private.usuario_ativo()) and (select private.perfil_atual())='ADMIN');
create policy ppe_solicitacoes_leitura on public.naturezas_ppe_solicitacoes for select to authenticated using((select private.usuario_ativo()) and ((select private.perfil_atual())='ADMIN' or solicitante=(select auth.uid())));
create policy ppe_vinculos_leitura on public.ocorrencias_naturezas_ppe for select to authenticated using(exists(select 1 from public.ocorrencias o where o.id=ocorrencia_id));

-- Somente a entrada estruturada de extração (sem texto integral do PDF).
create function public.ppe_catalogar_extracao(p_itens jsonb) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare x jsonb; cod text; descr text; lei text; n public.naturezas_ppe%rowtype; res jsonb:='[]';
begin
 if not private.usuario_ativo() or not private.pode_escrever_operacional() then raise insufficient_privilege; end if;
 if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens)>30 then raise exception 'Extração PPe inválida'; end if;
 for x in select value from jsonb_array_elements(p_itens) loop
  cod:=btrim(x->>'codigo_ppe'); descr:=upper(regexp_replace(btrim(x->>'descricao_original'),'\s+',' ','g')); lei:=nullif(btrim(x->>'fundamentacao_legal'),'');
  if cod is null or cod !~ '^[0-9]{1,9}$' or descr is null or length(descr) not between 3 and 320 or coalesce(length(lei),0)>300 then raise exception 'Natureza PPe inválida';end if;
  insert into public.naturezas_ppe(codigo_ppe,descricao_original,descricao_padronizada,fundamentacao_legal)
   values(cod,descr,descr,lei) on conflict(codigo_ppe) do nothing;
  select * into strict n from public.naturezas_ppe where codigo_ppe=cod for update;
  if n.descricao_original is distinct from descr or (lei is not null and n.fundamentacao_legal is distinct from lei) then
   insert into public.naturezas_ppe_divergencias(natureza_id,descricao,fundamentacao_legal) values(n.id,descr,coalesce(lei,'')) on conflict do nothing;
   update public.naturezas_ppe set status_validacao=case when status_validacao='VALIDADA' then 'VALIDADA' else 'DIVERGENTE' end,ativo=case when status_validacao='VALIDADA' then ativo else false end,ultimo_registro=now(),updated_at=now() where id=n.id;
  else
   update public.naturezas_ppe set ultimo_registro=now(),updated_at=now() where id=n.id;
  end if;
  res:=res||jsonb_build_array(jsonb_build_object('id',n.id,'codigo_ppe',cod));
 end loop;
 return res;
end $fn$;
revoke all on function public.ppe_catalogar_extracao(jsonb) from public,anon;
grant execute on function public.ppe_catalogar_extracao(jsonb) to authenticated;

-- A evidência original é imutável depois de persistida. Vinculação atômica ao BO.
create function private.ppe_vincular_original() returns trigger
language plpgsql security definer set search_path='' as $fn$
declare x jsonb; nid uuid;
begin
 if tg_op='UPDATE' and old.ppe_naturezas_originais is not null then
  if new.ppe_naturezas_originais is distinct from old.ppe_naturezas_originais then raise exception 'A natureza original do PPe deve ser preservada';end if;
  return new;
 end if;
 if new.ppe_naturezas_originais is null or new.ppe_naturezas_originais='[]'::jsonb then return new;end if;
 perform public.ppe_catalogar_extracao(new.ppe_naturezas_originais);
 for x in select value from jsonb_array_elements(new.ppe_naturezas_originais) loop
  select id into strict nid from public.naturezas_ppe where codigo_ppe=x->>'codigo_ppe';
  insert into public.ocorrencias_naturezas_ppe(ocorrencia_id,natureza_id,origem,descricao_documento,fundamentacao_documento,associado_por)
   values(new.id,nid,'ORIGINAL',x->>'descricao_original',x->>'fundamentacao_legal',auth.uid()) on conflict do nothing;
 end loop;
 return new;
end $fn$;
revoke all on function private.ppe_vincular_original() from public,anon,authenticated;
create trigger trg_ppe_vincular_original after insert or update of ppe_naturezas_originais on public.ocorrencias for each row execute function private.ppe_vincular_original();

create function private.ppe_recontar_vinculos() returns trigger
language plpgsql security definer set search_path='' as $fn$
declare nid uuid;
begin
 nid:=case when tg_op='DELETE' then old.natureza_id else new.natureza_id end;
 -- Serializa alterações por natureza; conta BOs distintos, não reenvios.
 perform 1 from public.naturezas_ppe where id=nid for update;
 update public.naturezas_ppe set quantidade_registros=(select count(distinct ocorrencia_id) from public.ocorrencias_naturezas_ppe where natureza_id=nid),updated_at=now() where id=nid;
 return null;
end $fn$;
revoke all on function private.ppe_recontar_vinculos() from public,anon,authenticated;
create trigger trg_ppe_recontar_vinculos after insert or delete on public.ocorrencias_naturezas_ppe for each row execute function private.ppe_recontar_vinculos();

create function public.ppe_admin_validar(p_id uuid,p_descricao text,p_lei text,p_categoria text,p_ativo boolean,p_justificativa text) returns void
language plpgsql security definer set search_path='' as $fn$
declare anterior public.naturezas_ppe%rowtype; novo public.naturezas_ppe%rowtype;
begin
 if not private.usuario_ativo() or private.perfil_atual() is distinct from 'ADMIN' then raise insufficient_privilege;end if;
 if length(btrim(coalesce(p_justificativa,''))) not between 5 and 500 then raise exception 'Informe a justificativa (5 a 500 caracteres)';end if;
 select * into strict anterior from public.naturezas_ppe where id=p_id for update;
 update public.naturezas_ppe set descricao_padronizada=upper(btrim(p_descricao)),fundamentacao_legal=nullif(btrim(p_lei),''),categoria=nullif(btrim(p_categoria),''),ativo=p_ativo,status_validacao='VALIDADA',updated_at=now() where id=p_id returning * into novo;
 insert into public.naturezas_ppe_auditoria(natureza_id,usuario_id,acao,anterior,novo,justificativa) values(p_id,auth.uid(),'VALIDACAO',to_jsonb(anterior),to_jsonb(novo),p_justificativa);
end $fn$;
create function public.ppe_admin_sinonimo(p_id uuid,p_termo text,p_remover boolean) returns void
language plpgsql security definer set search_path='' as $fn$
declare termo_norm text:=upper(btrim(p_termo));
begin
 if not private.usuario_ativo() or private.perfil_atual() is distinct from 'ADMIN' then raise insufficient_privilege;end if;
 if p_remover then delete from public.naturezas_ppe_sinonimos where natureza_id=p_id and termo=termo_norm;
 else insert into public.naturezas_ppe_sinonimos values(p_id,termo_norm) on conflict do nothing;end if;
 insert into public.naturezas_ppe_auditoria(natureza_id,usuario_id,acao,novo) values(p_id,auth.uid(),case when p_remover then 'REMOVER_SINONIMO' else 'ADICIONAR_SINONIMO' end,jsonb_build_object('termo',termo_norm));
end $fn$;
create function public.ppe_solicitar_inclusao(p_descricao text) returns uuid
language plpgsql security definer set search_path='' as $fn$
declare nid uuid;
begin
 if not private.usuario_ativo() or not private.pode_escrever_operacional() then raise insufficient_privilege;end if;
 insert into public.naturezas_ppe_solicitacoes(descricao,solicitante,unidade_id) values(btrim(p_descricao),auth.uid(),private.unidade_atual()) returning id into nid;
 return nid;
end $fn$;
create function public.ppe_admin_resolver(p_id uuid,p_tipo text,p_resposta text,p_aceitar boolean) returns void
language plpgsql security definer set search_path='' as $fn$
begin
 if not private.usuario_ativo() or private.perfil_atual() is distinct from 'ADMIN' then raise insufficient_privilege;end if;
 if length(btrim(coalesce(p_resposta,''))) not between 5 and 500 then raise exception 'Informe a justificativa';end if;
 if p_tipo='DIVERGENCIA' then
 update public.naturezas_ppe_divergencias set resolvido_em=now(),resolvido_por=auth.uid() where id=p_id and resolvido_em is null;
 elsif p_tipo='SOLICITACAO' then
 update public.naturezas_ppe_solicitacoes set status=case when p_aceitar then 'ATENDIDA' else 'RECUSADA' end,resposta=p_resposta,resolvido_em=now(),resolvido_por=auth.uid() where id=p_id and status='PENDENTE';
 else raise exception 'Tipo inválido';end if;
 if not found then raise exception 'Registro inexistente ou já resolvido';end if;
 insert into public.naturezas_ppe_auditoria(usuario_id,acao,novo,justificativa) values(auth.uid(),'RESOLVER_'||p_tipo,jsonb_build_object('id',p_id,'aceitar',p_aceitar),p_resposta);
end $fn$;
revoke all on function public.ppe_admin_validar(uuid,text,text,text,boolean,text),public.ppe_admin_sinonimo(uuid,text,boolean),public.ppe_solicitar_inclusao(text),public.ppe_admin_resolver(uuid,text,text,boolean) from public,anon;
grant execute on function public.ppe_admin_validar(uuid,text,text,text,boolean,text),public.ppe_admin_sinonimo(uuid,text,boolean),public.ppe_solicitar_inclusao(text),public.ppe_admin_resolver(uuid,text,text,boolean) to authenticated;
