-- O código operacional continua único; documentos com o mesmo código podem
-- apontar para naturezas distintas. Nenhum BO ou vínculo existente é alterado.
set local lock_timeout='5s';
select pg_catalog.pg_advisory_xact_lock(73191823);

create function private.ppe_chave_texto(p_texto text) returns text
language sql immutable set search_path='' as $fn$
 select btrim(regexp_replace(regexp_replace(
  translate(upper(coalesce(p_texto,'')),
   'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ–—º°','AAAAAEEEEIIIIOOOOOUUUUC--OO'),
   '[[:space:]]+',' ','g'), ' *- *','-','g'));
$fn$;
revoke all on function private.ppe_chave_texto(text) from public,anon,authenticated;

alter table public.naturezas_ppe alter column codigo_ppe drop not null;
create index naturezas_ppe_descricao_original_chave_idx
 on public.naturezas_ppe (private.ppe_chave_texto(descricao_original));
create index naturezas_ppe_descricao_padronizada_chave_idx
 on public.naturezas_ppe (private.ppe_chave_texto(descricao_padronizada));

create table public.naturezas_ppe_fontes (
 id uuid primary key default gen_random_uuid(),
 natureza_id uuid references public.naturezas_ppe(id) on delete restrict,
 codigo_documento text check(codigo_documento ~ '^[0-9]{1,9}$'),
 descricao_documento text not null check(length(descricao_documento) between 3 and 320),
 fundamento_documento text check(length(fundamento_documento)<=300),
 descricao_chave text generated always as (private.ppe_chave_texto(descricao_documento)) stored,
 fundamento_chave text generated always as (private.ppe_chave_texto(fundamento_documento)) stored,
 primeiro_registro timestamptz not null default now(),
 ultimo_registro timestamptz not null default now(),
 unique nulls not distinct(codigo_documento,descricao_chave,fundamento_chave)
);
create index naturezas_ppe_fontes_natureza_idx on public.naturezas_ppe_fontes(natureza_id);
alter table public.naturezas_ppe_fontes enable row level security;
revoke all on public.naturezas_ppe_fontes from public,anon,authenticated;
grant select on public.naturezas_ppe_fontes to authenticated;
create policy ppe_fontes_leitura_admin on public.naturezas_ppe_fontes for select to authenticated
 using ((select private.usuario_ativo()) and (select private.perfil_atual())='ADMIN');

-- O gatilho atual atende também a natureza sem código. Uma eventual edição
-- administrativa não pode fabricar um sufixo nem substituir outro vínculo.
CREATE OR REPLACE FUNCTION private.ppe_integrar_tipo(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n public.naturezas_ppe%rowtype; v_nome text; v_rotulo text; v_tipo bigint; v_ativo boolean; v_anterior bigint;
begin
 select * into n from public.naturezas_ppe where id=p_id;
 if not found or not n.ativo or n.status_validacao='DIVERGENTE' then return;end if;
 v_nome:=upper(btrim(regexp_replace(n.descricao_padronizada,'[[:space:]]+',' ','g')));
 if length(v_nome) not between 3 and 320 then return;end if;
 -- Serializar apenas a materialização de nomes, inclusive códigos distintos com o mesmo texto.
 perform pg_catalog.pg_advisory_xact_lock(73191823);
 select m.tipo_id into v_anterior from public.ppe_tipos_integracao m where m.natureza_id=p_id;
 if exists(select 1 from public.ppe_tipos_integracao m join public.tipos_ocorrencia t on t.id=m.tipo_id
             where m.natureza_id=p_id and m.nome_catalogo=v_nome
             and (t.nome=m.nome_tipo_vinculado or t.nome=v_nome or t.nome=v_nome||' [PPE '||n.codigo_ppe||']')) then return;end if;
 v_rotulo:=v_nome;
 -- Mesmo texto de códigos distintos: não presumir equivalência jurídica.
 if exists(select 1 from public.tipos_ocorrencia t join public.ppe_tipos_integracao m on m.tipo_id=t.id
           where t.nome=v_rotulo and m.natureza_id<>p_id) then
  if n.codigo_ppe is null then
    raise exception 'O nome já pertence a outra natureza PPE. Preserve descrições distintas.' using errcode='23505';
  end if;
  v_rotulo:=v_nome||' [PPE '||n.codigo_ppe||']';
 end if;
 select t.id,t.ativo into v_tipo,v_ativo from public.tipos_ocorrencia t
 where upper(btrim(regexp_replace(t.nome,'[[:space:]]+',' ','g')))=v_rotulo
 order by t.ativo desc,(t.nome=v_rotulo) desc,t.id limit 1;
 if v_tipo is not null and not v_ativo then
  -- Respeitar desativação explícita do catálogo antigo.
  return;
 end if;
 if v_tipo is not null and exists(select 1 from public.ppe_tipos_integracao m where m.tipo_id=v_tipo and m.natureza_id<>p_id) then return;end if;
 if v_tipo is null then
  insert into public.tipos_ocorrencia(nome,categoria,ativo,ordem,ppe_criado)
  values(v_rotulo,coalesce(nullif(n.categoria,''),'OUTROS'),true,0,true)
  on conflict(nome) do nothing;
  select t.id,t.ativo into v_tipo,v_ativo from public.tipos_ocorrencia t where t.nome=v_rotulo;
  if not coalesce(v_ativo,false) then return;end if;
 end if;
 insert into public.ppe_tipos_integracao(natureza_id,tipo_id,nome_catalogo)
 values(p_id,v_tipo,v_nome)
 on conflict(natureza_id) do update set tipo_id=excluded.tipo_id,nome_catalogo=excluded.nome_catalogo,nome_tipo_vinculado=null,integrado_em=now();
end $function$;

-- Somente a RPC autorizada e a promoção documental pontual abaixo chamam
-- este núcleo. O status administrativo da natureza nunca é alterado aqui.
create function private.ppe_catalogar_fonte(p_item jsonb) returns jsonb
language plpgsql set search_path='' as $fn$
declare
 cod text:=nullif(btrim(p_item->>'codigo_ppe'),'');
 descr text:=btrim(regexp_replace(p_item->>'descricao_original','[[:space:]]+',' ','g'));
 lei text:=nullif(btrim(p_item->>'fundamentacao_legal'),'');
 chave text:=private.ppe_chave_texto(descr);
 chave_lei text:=private.ppe_chave_texto(lei);
 fonte public.naturezas_ppe_fontes%rowtype;
 n public.naturezas_ppe%rowtype;
 dono uuid; nid uuid; total integer; compativeis integer; tipo bigint;
 conflito boolean; nova_fonte boolean;
begin
 if jsonb_typeof(p_item) is distinct from 'object'
    or (cod is not null and cod !~ '^[0-9]{1,9}$')
    or descr is null or length(descr) not between 3 and 320 or coalesce(length(lei),0)>300
    or descr ~* '(CPF|RG|MATR[IÍ]CULA|DATA DE NASCIMENTO|NOME COMPLETO|ENDERE[ÇC]O|TELEFONE) *[:\-]'
    or descr ~ '[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}'
 then raise exception 'Natureza PPe inválida'; end if;

 select * into fonte from public.naturezas_ppe_fontes f
 where f.codigo_documento is not distinct from cod
   and f.descricao_chave=chave and f.fundamento_chave=chave_lei;
 nova_fonte:=not found;
 nid:=fonte.natureza_id;
 if cod is not null then
   select id into dono from public.naturezas_ppe where codigo_ppe=cod;
 end if;

 if nid is null then
   -- Correspondência integral: nunca descartar qualificadores. O fundamento
   -- ausente no cadastro legado só é compatível se já constar na descrição.
   with nomes as (
     select cand.id, private.ppe_chave_texto(coalesce(cand.fundamentacao_original,cand.fundamentacao_legal)) as fundamento
     from public.naturezas_ppe cand
     left join public.ppe_tipos_integracao m on m.natureza_id=cand.id
     where private.ppe_chave_texto(cand.descricao_original)=chave
        or private.ppe_chave_texto(cand.descricao_padronizada)=chave
        or (m.nome_tipo_vinculado is not null and private.ppe_chave_texto(m.nome_tipo_vinculado)=chave
            and m.nome_catalogo=upper(btrim(regexp_replace(cand.descricao_padronizada,'[[:space:]]+',' ','g'))))
   ), candidatos as (
     select id, fundamento=chave_lei
        or (fundamento='' and strpos(chave,'('||chave_lei||')')>0)
        or (chave_lei='' and strpos(chave,'('||fundamento||')')>0) as compativel
     from nomes
   )
   select count(*),count(*) filter (where compativel),
          min(id::text) filter (where compativel)
     into total,compativeis,nid from candidatos;
   conflito:=total>0 and compativeis<>1;
   if conflito then
     nid:=null;
   elsif total=0 then
     insert into public.naturezas_ppe
       (codigo_ppe,descricao_original,descricao_padronizada,fundamentacao_legal,fundamentacao_original)
     values (case when dono is null then cod end,descr,upper(descr),lei,lei)
     returning id into nid;
   end if;
 end if;

 insert into public.naturezas_ppe_fontes(natureza_id,codigo_documento,descricao_documento,fundamento_documento)
 values(nid,cod,descr,lei)
 on conflict(codigo_documento,descricao_chave,fundamento_chave)
 do update set ultimo_registro=now(), natureza_id=excluded.natureza_id
 returning * into fonte;

 if dono is not null and dono is distinct from nid then
   insert into public.naturezas_ppe_divergencias(natureza_id,descricao,fundamentacao_legal)
   select dono,upper(descr),coalesce(lei,'')
   where not exists (
     select 1 from public.naturezas_ppe_divergencias d
     where d.natureza_id=dono and private.ppe_chave_texto(d.descricao)=chave
       and private.ppe_chave_texto(d.fundamentacao_legal)=chave_lei
   )
   on conflict do nothing;
 end if;
 if nova_fonte then
   insert into public.naturezas_ppe_auditoria(natureza_id,usuario_id,acao,novo)
   values(nid,auth.uid(),case when nid is null then 'FONTE_PPE_REVISAO'
      when dono is not null and dono<>nid then 'FONTE_PPE_CODIGO_COMPARTILHADO'
      else 'FONTE_PPE_CATALOGADA' end,
      jsonb_build_object('fonte_id',fonte.id,'codigo_documento',cod,
        'descricao_documento',descr,'fundamento_documento',lei,'titular_codigo_id',dono));
 end if;
 if nid is not null then
   update public.naturezas_ppe set ultimo_registro=now(),updated_at=now()
    where id=nid returning * into n;
   -- Mesmos critérios de visibilidade de obter_catalogos_cadastro().
   select t.id into tipo from public.ppe_tipos_integracao m
   join public.tipos_ocorrencia t on t.id=m.tipo_id
   where m.natureza_id=nid and t.ativo and n.ativo and n.status_validacao<>'DIVERGENTE'
     and m.nome_catalogo=upper(btrim(regexp_replace(n.descricao_padronizada,'[[:space:]]+',' ','g')))
     and (t.nome=m.nome_tipo_vinculado or t.nome=m.nome_catalogo or t.nome=m.nome_catalogo||' [PPE '||n.codigo_ppe||']');
 end if;
 return jsonb_build_object('id',nid,'fonte_id',fonte.id,'codigo_ppe',cod,'tipo_id',tipo,
   'situacao',case when nid is null then 'REVISAO'
     when not n.ativo and n.status_validacao<>'DIVERGENTE' then 'BLOQUEADA'
     when tipo is null then 'INDISPONIVEL' else 'DISPONIVEL' end);
end $fn$;
revoke all on function private.ppe_catalogar_fonte(jsonb) from public,anon,authenticated;

create or replace function public.ppe_catalogar_extracao(p_itens jsonb) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare x jsonb; res jsonb:='[]'::jsonb;
begin
 if not private.usuario_ativo() or not private.pode_escrever_operacional() then raise insufficient_privilege; end if;
 if jsonb_typeof(p_itens) is distinct from 'array' then raise exception 'Extração PPe inválida'; end if;
 if jsonb_array_length(p_itens)>30 then raise exception 'Extração PPe inválida'; end if;
 perform pg_catalog.pg_advisory_xact_lock(73191823);
 for x in select value from jsonb_array_elements(p_itens) loop
   res:=res||jsonb_build_array(private.ppe_catalogar_fonte(x));
 end loop;
 return res;
end $fn$;
revoke all on function public.ppe_catalogar_extracao(jsonb) from public,anon;
grant execute on function public.ppe_catalogar_extracao(jsonb) to authenticated;

create or replace function private.ppe_vincular_original() returns trigger
language plpgsql security definer set search_path='' as $fn$
declare x record;
begin
 if tg_op='UPDATE' and old.ppe_naturezas_originais is not null then
   if new.ppe_naturezas_originais is distinct from old.ppe_naturezas_originais then
     raise exception 'A natureza original do PPe deve ser preservada';
   end if;
   return new;
 end if;
 if new.ppe_naturezas_originais is null or new.ppe_naturezas_originais='[]'::jsonb then return new; end if;
 for x in
   select a.item original, b.item resultado
   from jsonb_array_elements(new.ppe_naturezas_originais) with ordinality a(item,pos)
   join jsonb_array_elements(public.ppe_catalogar_extracao(new.ppe_naturezas_originais))
     with ordinality b(item,pos) using(pos)
 loop
   -- Fonte ambígua fica integralmente no JSON original, sem vínculo incorreto.
   if x.resultado->>'id' is null then continue; end if;
   insert into public.ocorrencias_naturezas_ppe
     (ocorrencia_id,natureza_id,origem,descricao_documento,fundamentacao_documento,associado_por)
   values(new.id,(x.resultado->>'id')::uuid,'ORIGINAL',x.original->>'descricao_original',
     x.original->>'fundamentacao_legal',auth.uid()) on conflict do nothing;
 end loop;
 return new;
end $fn$;

-- A confirmação explícita também deve distinguir identidades que usam o
-- mesmo código e aceitar códigos documentais diferentes da mesma identidade.
create or replace function private.ppe_validar_selecao() returns trigger
language plpgsql security definer set search_path='' as $fn$
declare ids uuid[]; ids_documento uuid[]; documento_inconclusivo boolean; anteriores uuid[];
begin
 if tg_op='UPDATE' then
  anteriores:=old.ppe_naturezas_selecionadas;
  if new.ppe_naturezas_selecionadas is not distinct from anteriores then
   new.ppe_justificativa_classificacao:=old.ppe_justificativa_classificacao;
   return new;
  end if;
  if anteriores is not null and new.ppe_naturezas_selecionadas is null then raise exception 'Não é permitido apagar a classificação PPe; selecione outra natureza.';end if;
  if anteriores is null and new.ppe_naturezas_selecionadas is not null and private.perfil_atual() is distinct from 'ADMIN' then raise exception 'A associação inicial de registro existente exige validação administrativa.' using errcode='42501';end if;
 end if;
 if new.ppe_naturezas_selecionadas is null then new.ppe_justificativa_classificacao:=null;return new;end if;
 if not private.usuario_ativo() or not (private.pode_escrever_operacional() or (tg_op='UPDATE' and private.perfil_atual()='ADMIN' and new.unidade_id=any(coalesce(private.unidades_acessiveis_atual(),array[]::uuid[])))) then raise insufficient_privilege;end if;
 if cardinality(new.ppe_naturezas_selecionadas) not between 1 and 30 or array_position(new.ppe_naturezas_selecionadas,null) is not null then raise exception 'Selecione de 1 a 30 naturezas válidas.';end if;
 select array_agg(distinct x order by x) into ids from unnest(new.ppe_naturezas_selecionadas) x;
 if cardinality(ids)<>cardinality(new.ppe_naturezas_selecionadas) then raise exception 'Naturezas repetidas não são permitidas.';end if;
 if tg_op='INSERT' and coalesce(jsonb_array_length(new.ppe_naturezas_originais),0)>0 then
  select array_agg(distinct (x->>'id')::uuid order by (x->>'id')::uuid)
     filter (where x->>'id' is not null), bool_or(x->>'id' is null)
    into ids_documento, documento_inconclusivo
  from jsonb_array_elements(public.ppe_catalogar_extracao(new.ppe_naturezas_originais)) x;
 end if;
 if exists(select 1 from unnest(ids) x left join public.naturezas_ppe n on n.id=x
   where n.id is null or ((not n.ativo or n.status_validacao='DIVERGENTE') and not (x=any(coalesce(anteriores,array[]::uuid[]))))) then raise exception 'Existe natureza indisponível ou divergente na seleção.';end if;
 if (tg_op='UPDATE' or documento_inconclusivo or (ids_documento is not null and ids_documento is distinct from ids))
    and length(btrim(coalesce(new.ppe_justificativa_classificacao,''))) not between 5 and 500
 then raise exception 'Informe a justificativa da classificação/correção (5 a 500 caracteres).';end if;
 new.ppe_naturezas_selecionadas:=ids;
 new.ppe_justificativa_classificacao:=nullif(btrim(new.ppe_justificativa_classificacao),'');
 return new;
end $fn$;

-- Promoção pontual da descrição consumada: só quando a evidência exata já
-- consta na fila. A tentativa mantém seu código, seu status e seus vínculos.
do $fn$
declare evidencia record;
begin
 select d.descricao,d.fundamentacao_legal into evidencia
 from public.naturezas_ppe_divergencias d join public.naturezas_ppe n on n.id=d.natureza_id
 where n.codigo_ppe='20210' and d.resolvido_em is null
   and private.ppe_chave_texto(d.descricao)='IMPORTUNACAO SEXUAL (ART. 215-A DO CPB)'
   and private.ppe_chave_texto(d.fundamentacao_legal)='ART. 215-A DO CPB'
 order by d.identificado_em,d.id limit 1;
 if found then
   perform private.ppe_catalogar_fonte(jsonb_build_object('codigo_ppe','20210',
     'descricao_original',evidencia.descricao,'fundamentacao_legal',evidencia.fundamentacao_legal));
 end if;
end $fn$;
