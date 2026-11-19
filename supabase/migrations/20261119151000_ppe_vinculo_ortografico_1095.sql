-- Vínculo explícito de variante ortográfica comprovada no documento PPe.
alter table public.ppe_tipos_integracao add column nome_tipo_vinculado text;
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
CREATE OR REPLACE FUNCTION public.obter_catalogos_cadastro()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select jsonb_build_object('tipos',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'nome',t.nome,'categoria',t.categoria,'codigo_ppe',n.codigo_ppe,'ppe_descricao_original',n.descricao_original,'ppe_descricao_padronizada',n.descricao_padronizada,'ppe_fundamentacao_original',n.fundamentacao_original) order by case when n.id is not null then 0 else 1 end,t.ordem,t.nome),'[]'::jsonb) from public.tipos_ocorrencia t left join public.ppe_tipos_integracao m on m.tipo_id=t.id left join public.naturezas_ppe n on n.id=m.natureza_id and n.ativo and n.status_validacao<>'DIVERGENTE' and m.nome_catalogo=upper(btrim(regexp_replace(n.descricao_padronizada,'[[:space:]]+',' ','g'))) and (t.nome=m.nome_tipo_vinculado or t.nome=m.nome_catalogo or t.nome=m.nome_catalogo||' [PPE '||n.codigo_ppe||']') where t.ativo and (not t.ppe_criado or n.id is not null)),'subtipos',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'tipo_id',s.tipo_id,'nome',s.nome,'fundamento_legal',s.fundamento_legal) order by s.nome),'[]'::jsonb) from public.subtipos_ocorrencia s where s.ativo),'bairros',(select coalesce(jsonb_agg(nome order by nome),'[]'::jsonb) from public.bairros where ativo),'locais',(select coalesce(jsonb_agg(nome order by nome),'[]'::jsonb) from public.locais_apresentacao where ativo),'enderecos',(select coalesce(jsonb_agg(jsonb_build_object('logradouro',logradouro,'bairro',bairro,'latitude',latitude,'longitude',longitude) order by logradouro),'[]'::jsonb) from public.enderecos_padronizados where ativo)); $function$;
do $vinculo$
declare n public.naturezas_ppe%rowtype; t public.tipos_ocorrencia%rowtype;
begin
 select * into strict n from public.naturezas_ppe where codigo_ppe='1095' and ativo and status_validacao<>'DIVERGENTE' and descricao_original='ACIDENTE DE TRÂNSITO -AUTO LESÃO' and descricao_padronizada='ACIDENTE DE TRÂNSITO -AUTO LESÃO';
 select * into strict t from public.tipos_ocorrencia where nome='ACIDENTE DE TRÂNSITO - AUTOLESÃO' and ativo;
 if exists(select 1 from public.ppe_tipos_integracao where tipo_id=t.id and natureza_id<>n.id) then raise exception 'Tipo já associado a outro código';end if;
 insert into public.ppe_tipos_integracao(natureza_id,tipo_id,nome_catalogo,nome_tipo_vinculado)
 values(n.id,t.id,n.descricao_padronizada,t.nome)
 on conflict(natureza_id) do update set tipo_id=excluded.tipo_id,nome_catalogo=excluded.nome_catalogo,nome_tipo_vinculado=excluded.nome_tipo_vinculado,integrado_em=now();
 insert into public.naturezas_ppe_auditoria(natureza_id,acao,novo,justificativa)
 values(n.id,'INTEGRACAO_VARIANTE_ORTOGRAFICA',jsonb_build_object('codigo_ppe',n.codigo_ppe,'tipo_id',t.id,'nome_tipo',t.nome),'Conferência da seção Natureza do PDF fornecido. Variante difere apenas em espaços e hífen; nenhum BO reclassificado.');
end $vinculo$;