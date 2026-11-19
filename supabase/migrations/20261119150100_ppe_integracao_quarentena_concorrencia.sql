-- Evitar reaproveitamento de tipos PPe em quarentena e serializar a materialização concorrente.
CREATE OR REPLACE FUNCTION public.obter_catalogos_cadastro()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select jsonb_build_object('tipos',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'nome',t.nome,'categoria',t.categoria,'codigo_ppe',n.codigo_ppe,'ppe_descricao_original',n.descricao_original,'ppe_descricao_padronizada',n.descricao_padronizada,'ppe_fundamentacao_original',n.fundamentacao_original) order by case when n.id is not null then 0 else 1 end,t.ordem,t.nome),'[]'::jsonb) from public.tipos_ocorrencia t left join public.ppe_tipos_integracao m on m.tipo_id=t.id left join public.naturezas_ppe n on n.id=m.natureza_id and n.ativo and n.status_validacao<>'DIVERGENTE' and m.nome_catalogo=upper(btrim(regexp_replace(n.descricao_padronizada,'[[:space:]]+',' ','g'))) and (t.nome=m.nome_catalogo or t.nome=m.nome_catalogo||' [PPE '||n.codigo_ppe||']') where t.ativo and (not t.ppe_criado or n.id is not null)),'subtipos',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'tipo_id',s.tipo_id,'nome',s.nome,'fundamento_legal',s.fundamento_legal) order by s.nome),'[]'::jsonb) from public.subtipos_ocorrencia s where s.ativo),'bairros',(select coalesce(jsonb_agg(nome order by nome),'[]'::jsonb) from public.bairros where ativo),'locais',(select coalesce(jsonb_agg(nome order by nome),'[]'::jsonb) from public.locais_apresentacao where ativo),'enderecos',(select coalesce(jsonb_agg(jsonb_build_object('logradouro',logradouro,'bairro',bairro,'latitude',latitude,'longitude',longitude) order by logradouro),'[]'::jsonb) from public.enderecos_padronizados where ativo)); $function$;

CREATE OR REPLACE FUNCTION public.cadastrar_tipo_ocorrencia_publico(p_nome text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_nome text := upper(trim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g')));
  v_tipo public.tipos_ocorrencia%rowtype;
begin
  IF NOT private.pode_escrever_operacional() THEN
    RAISE EXCEPTION 'Acesso somente de leitura: cadastro de referência não autorizado.'
      USING ERRCODE='42501';
  END IF;
  if length(v_nome) < 3 then
    raise exception 'Informe um nome com pelo menos 3 caracteres.';
  end if;

  select * into v_tipo
  from public.tipos_ocorrencia
  where upper(trim(nome)) = v_nome
  limit 1;

  if found then
    if v_tipo.ppe_criado and not exists(
      select 1 from public.ppe_tipos_integracao m join public.naturezas_ppe n on n.id=m.natureza_id
      where m.tipo_id=v_tipo.id and n.ativo and n.status_validacao<>'DIVERGENTE'
      and m.nome_catalogo=upper(btrim(regexp_replace(n.descricao_padronizada,'[[:space:]]+',' ','g')))
    ) then raise exception 'Natureza PPe em revisão. Consulte o administrador.' using errcode='42501';end if;
    if not v_tipo.ativo then
      raise exception 'Tipo desativado. Solicite ao administrador a correção do catálogo.' using errcode='42501';
    end if;
  else
    insert into public.tipos_ocorrencia (nome, categoria, ativo, ordem)
    values (v_nome, 'OUTROS', true, 0)
    returning * into v_tipo;
  end if;

  return jsonb_build_object('id', v_tipo.id, 'nome', v_tipo.nome, 'categoria', v_tipo.categoria);
end;
$function$;

CREATE OR REPLACE FUNCTION public.ppe_catalogar_extracao(p_itens jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare x jsonb; cod text; descr text; lei text; n public.naturezas_ppe%rowtype; res jsonb:='[]';
begin
 perform pg_catalog.pg_advisory_xact_lock(73191823);
 if not private.usuario_ativo() or not private.pode_escrever_operacional() then raise insufficient_privilege; end if;
 if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens)>30 then raise exception 'Extração PPe inválida'; end if;
 for x in select value from jsonb_array_elements(p_itens) loop
  cod:=btrim(x->>'codigo_ppe'); descr:=upper(regexp_replace(btrim(x->>'descricao_original'),'\s+',' ','g')); lei:=nullif(btrim(x->>'fundamentacao_legal'),'');
  if cod is null or cod !~ '^[0-9]{1,9}$' or descr is null or length(descr) not between 3 and 320 or coalesce(length(lei),0)>300 then raise exception 'Natureza PPe inválida';end if;
  insert into public.naturezas_ppe(codigo_ppe,descricao_original,descricao_padronizada,fundamentacao_legal,fundamentacao_original)
   values(cod,descr,descr,lei,lei) on conflict(codigo_ppe) do nothing;
  select * into strict n from public.naturezas_ppe where codigo_ppe=cod for update;
  if n.descricao_original is distinct from descr or (lei is not null and n.fundamentacao_original is distinct from lei) then
   insert into public.naturezas_ppe_divergencias(natureza_id,descricao,fundamentacao_legal) values(n.id,descr,coalesce(lei,'')) on conflict do nothing;
   update public.naturezas_ppe set status_validacao=case when status_validacao='VALIDADA' then 'VALIDADA' else 'DIVERGENTE' end,ativo=case when status_validacao='VALIDADA' then ativo else false end,ultimo_registro=now(),updated_at=now() where id=n.id;
  else
   update public.naturezas_ppe set ultimo_registro=now(),updated_at=now() where id=n.id;
  end if;
  res:=res||jsonb_build_array(jsonb_build_object('id',n.id,'codigo_ppe',cod));
 end loop;
 return res;
end $function$;

CREATE OR REPLACE FUNCTION public.ppe_admin_criar(p_codigo text, p_descricao text, p_lei text, p_categoria text, p_justificativa text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n public.naturezas_ppe%rowtype;
begin
 perform pg_catalog.pg_advisory_xact_lock(73191823);
 if not private.usuario_ativo() or private.perfil_atual() is distinct from 'ADMIN' then raise insufficient_privilege;end if;
 if length(btrim(coalesce(p_justificativa,''))) not between 5 and 500 then raise exception 'Informe a fonte documental e justificativa';end if;
 insert into public.naturezas_ppe(codigo_ppe,descricao_original,descricao_padronizada,fundamentacao_original,fundamentacao_legal,categoria,status_validacao)
 values(btrim(p_codigo),upper(btrim(p_descricao)),upper(btrim(p_descricao)),nullif(btrim(p_lei),''),nullif(btrim(p_lei),''),nullif(btrim(p_categoria),''),'VALIDADA') returning * into n;
 insert into public.naturezas_ppe_auditoria(natureza_id,usuario_id,acao,novo,justificativa) values(n.id,auth.uid(),'INCLUSAO_ADMIN',to_jsonb(n),p_justificativa);
 return n.id;
end $function$;

CREATE OR REPLACE FUNCTION public.ppe_admin_validar(p_id uuid, p_descricao text, p_lei text, p_categoria text, p_ativo boolean, p_justificativa text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare anterior public.naturezas_ppe%rowtype; novo public.naturezas_ppe%rowtype;
begin
 perform pg_catalog.pg_advisory_xact_lock(73191823);
 if not private.usuario_ativo() or private.perfil_atual() is distinct from 'ADMIN' then raise insufficient_privilege;end if;
 if length(btrim(coalesce(p_justificativa,''))) not between 5 and 500 then raise exception 'Informe a justificativa (5 a 500 caracteres)';end if;
 select * into strict anterior from public.naturezas_ppe where id=p_id for update;
 update public.naturezas_ppe set descricao_padronizada=upper(btrim(p_descricao)),fundamentacao_legal=nullif(btrim(p_lei),''),categoria=nullif(btrim(p_categoria),''),ativo=p_ativo,status_validacao='VALIDADA',updated_at=now() where id=p_id returning * into novo;
 insert into public.naturezas_ppe_auditoria(natureza_id,usuario_id,acao,anterior,novo,justificativa) values(p_id,auth.uid(),'VALIDACAO',to_jsonb(anterior),to_jsonb(novo),p_justificativa);
end $function$;