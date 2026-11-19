alter table public.naturezas_ppe add column fundamentacao_original text check(length(fundamentacao_original)<=300);
update public.naturezas_ppe set fundamentacao_original=fundamentacao_legal;
CREATE OR REPLACE FUNCTION public.ppe_catalogar_extracao(p_itens jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare x jsonb; cod text; descr text; lei text; n public.naturezas_ppe%rowtype; res jsonb:='[]';
begin
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

create function public.ppe_admin_criar(p_codigo text,p_descricao text,p_lei text,p_categoria text,p_justificativa text) returns uuid
language plpgsql security definer set search_path='' as $fn$
declare n public.naturezas_ppe%rowtype;
begin
 if not private.usuario_ativo() or private.perfil_atual() is distinct from 'ADMIN' then raise insufficient_privilege;end if;
 if length(btrim(coalesce(p_justificativa,''))) not between 5 and 500 then raise exception 'Informe a fonte documental e justificativa';end if;
 insert into public.naturezas_ppe(codigo_ppe,descricao_original,descricao_padronizada,fundamentacao_original,fundamentacao_legal,categoria,status_validacao)
 values(btrim(p_codigo),upper(btrim(p_descricao)),upper(btrim(p_descricao)),nullif(btrim(p_lei),''),nullif(btrim(p_lei),''),nullif(btrim(p_categoria),''),'VALIDADA') returning * into n;
 insert into public.naturezas_ppe_auditoria(natureza_id,usuario_id,acao,novo,justificativa) values(n.id,auth.uid(),'INCLUSAO_ADMIN',to_jsonb(n),p_justificativa);
 return n.id;
end $fn$;
revoke all on function public.ppe_admin_criar(text,text,text,text,text) from public,anon;
grant execute on function public.ppe_admin_criar(text,text,text,text,text) to authenticated;
