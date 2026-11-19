-- Expor o catálogo documental no campo Tipo de Ocorrência já existente.
-- Não renomeia, exclui ou reclassifica os registros históricos.
alter table public.tipos_ocorrencia add column ppe_criado boolean not null default false;
create table public.ppe_tipos_integracao(
 natureza_id uuid primary key references public.naturezas_ppe(id) on delete restrict,
 tipo_id bigint not null unique references public.tipos_ocorrencia(id) on delete restrict,
 nome_catalogo text not null,
 integrado_em timestamptz not null default now()
);
alter table public.ppe_tipos_integracao enable row level security;
revoke all on public.ppe_tipos_integracao from public,anon,authenticated;

create function private.ppe_integrar_tipo(p_id uuid) returns void
language plpgsql security definer set search_path='' as $fn$
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
             and (t.nome=v_nome or t.nome=v_nome||' [PPE '||n.codigo_ppe||']')) then return;end if;
 v_rotulo:=v_nome;
 -- Mesmo texto de códigos distintos: não presumir equivalência jurídica.
 if exists(select 1 from public.tipos_ocorrencia t join public.ppe_tipos_integracao m on m.tipo_id=t.id
           where t.nome=v_rotulo and m.natureza_id<>p_id) then
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
 on conflict(natureza_id) do update set tipo_id=excluded.tipo_id,nome_catalogo=excluded.nome_catalogo,integrado_em=now();
end $fn$;
revoke all on function private.ppe_integrar_tipo(uuid) from public,anon,authenticated;

create function private.ppe_integrar_tipo_trigger() returns trigger
language plpgsql security definer set search_path='' as $fn$
begin
 perform private.ppe_integrar_tipo(new.id);return new;
end $fn$;
revoke all on function private.ppe_integrar_tipo_trigger() from public,anon,authenticated;
create trigger trg_ppe_integrar_tipo after insert or update of descricao_padronizada,status_validacao,ativo on public.naturezas_ppe
for each row execute function private.ppe_integrar_tipo_trigger();
do $backfill$
declare v_id uuid;
begin
 for v_id in select id from public.naturezas_ppe where ativo and status_validacao<>'DIVERGENTE' order by codigo_ppe loop
  perform private.ppe_integrar_tipo(v_id);
 end loop;
end $backfill$;
CREATE OR REPLACE FUNCTION public.obter_catalogos_cadastro()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select jsonb_build_object('tipos',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'nome',t.nome,'categoria',t.categoria,'codigo_ppe',n.codigo_ppe,'ppe_descricao_original',n.descricao_original,'ppe_descricao_padronizada',n.descricao_padronizada,'ppe_fundamentacao_original',n.fundamentacao_original) order by case when n.id is not null then 0 else 1 end,t.ordem,t.nome),'[]'::jsonb) from public.tipos_ocorrencia t left join public.ppe_tipos_integracao m on m.tipo_id=t.id left join public.naturezas_ppe n on n.id=m.natureza_id and n.ativo and n.status_validacao<>'DIVERGENTE' where t.ativo and (not t.ppe_criado or n.id is not null)),'subtipos',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'tipo_id',s.tipo_id,'nome',s.nome,'fundamento_legal',s.fundamento_legal) order by s.nome),'[]'::jsonb) from public.subtipos_ocorrencia s where s.ativo),'bairros',(select coalesce(jsonb_agg(nome order by nome),'[]'::jsonb) from public.bairros where ativo),'locais',(select coalesce(jsonb_agg(nome order by nome),'[]'::jsonb) from public.locais_apresentacao where ativo),'enderecos',(select coalesce(jsonb_agg(jsonb_build_object('logradouro',logradouro,'bairro',bairro,'latitude',latitude,'longitude',longitude) order by logradouro),'[]'::jsonb) from public.enderecos_padronizados where ativo)); $function$;
CREATE OR REPLACE FUNCTION public.gerenciar_catalogo_ocorrencias_admin(p_entidade text, p_acao text, p_id bigint, p_nome text DEFAULT NULL::text, p_fundamento_legal text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_entidade text := upper(btrim(coalesce(p_entidade, '')));
  v_acao text := upper(btrim(coalesce(p_acao, '')));
  v_nome text := upper(btrim(regexp_replace(coalesce(p_nome, ''), '[[:space:]]+', ' ', 'g')));
  v_fundamento text := nullif(btrim(regexp_replace(coalesce(p_fundamento_legal, ''), '[[:space:]]+', ' ', 'g')), '');
  v_tipo public.tipos_ocorrencia%rowtype;
  v_subtipo public.subtipos_ocorrencia%rowtype;
  v_antes jsonb;
  v_depois jsonb;
begin
  if auth.uid() is null or private.perfil_atual() is distinct from 'ADMIN' then
    raise exception 'Somente administradores podem editar ou desativar tipos e subtipos.'
      using errcode = '42501';
  end if;

  if v_entidade not in ('TIPO', 'SUBTIPO')
     or v_acao not in ('EDITAR', 'DESATIVAR')
     or p_id is null or p_id <= 0 then
    raise exception 'Parâmetros inválidos para gerenciar catálogo.'
      using errcode = '22023';
  end if;

  if v_acao = 'EDITAR' and
     (length(v_nome) < 3 or length(v_nome) >
       case when v_entidade = 'TIPO' then 120 else 160 end
      or length(coalesce(v_fundamento, '')) > 200) then
    raise exception 'Nome ou fundamento legal fora dos limites permitidos.'
      using errcode = '22023';
  end if;

  if v_entidade = 'TIPO' then
    if exists(select 1 from public.ppe_tipos_integracao m where m.tipo_id=p_id) or exists(select 1 from public.tipos_ocorrencia t where t.id=p_id and t.ppe_criado) then
      raise exception 'Tipo proveniente do catálogo PPe. Revise ou inative pelo Catálogo de Naturezas PPe.' using errcode='42501';
    end if;
    select * into v_tipo
      from public.tipos_ocorrencia
     where id = p_id and ativo = true
       for update;
    if not found then
      raise exception 'Tipo inexistente ou já desativado.'
        using errcode = '22023';
    end if;
    v_antes := jsonb_build_object('id',v_tipo.id,'nome',v_tipo.nome,'ativo',v_tipo.ativo);

    if v_acao = 'EDITAR' then
      if exists (select 1 from public.tipos_ocorrencia t
                 where t.id <> p_id and upper(btrim(t.nome)) = v_nome) then
        raise exception 'Já existe um tipo de ocorrência com este nome.'
          using errcode = '23505';
      end if;
      update public.tipos_ocorrencia set nome = v_nome
       where id = p_id returning * into v_tipo;
    else
      update public.tipos_ocorrencia set ativo = false
       where id = p_id returning * into v_tipo;
    end if;
    v_depois := jsonb_build_object('id',v_tipo.id,'nome',v_tipo.nome,'ativo',v_tipo.ativo);
  else
    select * into v_subtipo
      from public.subtipos_ocorrencia
     where id = p_id and ativo = true
       for update;
    if not found then
      raise exception 'Subtipo inexistente ou já desativado.'
        using errcode = '22023';
    end if;
    v_antes := jsonb_build_object('id',v_subtipo.id,'tipo_id',v_subtipo.tipo_id,
       'nome',v_subtipo.nome,'fundamento_legal',v_subtipo.fundamento_legal,'ativo',v_subtipo.ativo);

    if v_acao = 'EDITAR' then
      if exists (select 1 from public.subtipos_ocorrencia s
                 where s.tipo_id = v_subtipo.tipo_id and s.id <> p_id
                   and upper(btrim(s.nome)) = v_nome) then
        raise exception 'Já existe um subtipo com este nome para o tipo selecionado.'
          using errcode = '23505';
      end if;
      update public.subtipos_ocorrencia
         set nome = v_nome, fundamento_legal = v_fundamento
       where id = p_id returning * into v_subtipo;
    else
      update public.subtipos_ocorrencia set ativo = false
       where id = p_id returning * into v_subtipo;
    end if;
    v_depois := jsonb_build_object('id',v_subtipo.id,'tipo_id',v_subtipo.tipo_id,
       'nome',v_subtipo.nome,'fundamento_legal',v_subtipo.fundamento_legal,'ativo',v_subtipo.ativo);
  end if;

  insert into public.logs_sistema(usuario_id,acao,entidade,entidade_id,detalhes)
  values (auth.uid(), 'CATALOGO_' || v_entidade || '_' || v_acao,
          case when v_entidade = 'TIPO' then 'tipos_ocorrencia' else 'subtipos_ocorrencia' end,
          p_id::text, jsonb_build_object('antes',v_antes,'depois',v_depois));

  return v_depois;
end
$function$;
