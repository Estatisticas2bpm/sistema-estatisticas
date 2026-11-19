CREATE OR REPLACE FUNCTION private.ppe_validar_selecao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ids uuid[]; codigos_original text[]; codigos_validado text[]; anteriores uuid[];
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
 if cardinality(new.ppe_naturezas_selecionadas) not between 1 and 30 or array_position(new.ppe_naturezas_selecionadas,null) is not null then raise exception 'Selecione de 1 a 30 naturezas válidas.'; end if;
 select array_agg(distinct x order by x) into ids from unnest(new.ppe_naturezas_selecionadas) x;
 if cardinality(ids)<>cardinality(new.ppe_naturezas_selecionadas) then raise exception 'Naturezas repetidas não são permitidas.';end if;
 -- As naturezas antigas podem ter sido inativadas; só aceitar nova inclusão ativa.
 if exists(select 1 from unnest(ids) x left join public.naturezas_ppe n on n.id=x
   where n.id is null or ((not n.ativo or n.status_validacao='DIVERGENTE') and not (x=any(coalesce(anteriores,array[]::uuid[]))))) then raise exception 'Existe natureza indisponível ou divergente na seleção.';end if;
 select array_agg(distinct x->>'codigo_ppe' order by x->>'codigo_ppe') into codigos_original from jsonb_array_elements(coalesce(new.ppe_naturezas_originais,'[]'::jsonb)) x;
 select array_agg(n.codigo_ppe order by n.codigo_ppe) into codigos_validado from public.naturezas_ppe n where n.id=any(ids);
 if (tg_op='UPDATE' or (codigos_original is not null and codigos_original is distinct from codigos_validado))
   and length(btrim(coalesce(new.ppe_justificativa_classificacao,''))) not between 5 and 500
 then raise exception 'Informe a justificativa da classificação/correção (5 a 500 caracteres).';end if;
 new.ppe_naturezas_selecionadas:=ids;
 new.ppe_justificativa_classificacao:=nullif(btrim(new.ppe_justificativa_classificacao),'');
 return new;
end $function$;
CREATE OR REPLACE FUNCTION public.ppe_admin_associar_historico(p_ocorrencia uuid, p_ids uuid[], p_justificativa text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not private.usuario_ativo() or private.perfil_atual() is distinct from 'ADMIN' then raise insufficient_privilege;end if;
 if length(btrim(coalesce(p_justificativa,''))) not between 5 and 500 or cardinality(p_ids) not between 1 and 30 then raise exception 'Selecione a natureza e informe a justificativa.';end if;
 if exists(select 1 from unnest(p_ids) x left join public.naturezas_ppe n on n.id=x where n.id is null or not n.ativo or n.status_validacao<>'VALIDADA') then raise exception 'A revisão histórica exige naturezas administrativamente validadas e ativas.';end if;
 update public.ocorrencias set ppe_naturezas_selecionadas=p_ids,ppe_justificativa_classificacao=p_justificativa
 where id=p_ocorrencia and unidade_id=any(coalesce(private.unidades_acessiveis_atual(),array[]::uuid[]));
 if not found then raise exception 'Registro não encontrado ou fora do escopo.';end if;
end $function$;
-- Evita disponibilizar descrições coletadas com marcador de provável coluna de meios.
with suspeitas as (
 update public.naturezas_ppe set status_validacao='DIVERGENTE',ativo=false,updated_at=now()
 where status_validacao='PENDENTE' and descricao_original ~* 'OUTRO\(S\)'
 returning id
)
insert into public.naturezas_ppe_auditoria(natureza_id,acao,justificativa)
select id,'EXTRACAO_AMBIGUA','Marcador de meio empregado encontrado; requer conferência documental. Original preservado.' from suspeitas;
