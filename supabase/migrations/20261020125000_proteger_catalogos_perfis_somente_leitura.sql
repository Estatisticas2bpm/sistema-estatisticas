-- Verificação de perfil nas funções SECURITY DEFINER que mantêm catálogos.
-- Bloqueia COMANDANTE e CONSULTA até por RPC direta, sem afetar demais funções.

-- Protege cadastrar_bairro_publico
CREATE OR REPLACE FUNCTION public.cadastrar_bairro_publico(p_nome text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_nome text := upper(trim(regexp_replace(coalesce(p_nome,''), '\s+', ' ', 'g')));
begin
  IF NOT private.pode_escrever_operacional() THEN
    RAISE EXCEPTION 'Acesso somente de leitura: cadastro de referência não autorizado.'
      USING ERRCODE='42501';
  END IF;
  if length(v_nome)<2 then raise exception 'Nome de bairro inválido.'; end if;
  insert into public.bairros(nome,ativo) values(v_nome,true) on conflict(nome) do update set ativo=true;
  return v_nome;
end; $function$;


-- Protege cadastrar_comandante_publico
CREATE OR REPLACE FUNCTION public.cadastrar_comandante_publico(p_nome text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_nome text;
  v_chave text;
  v_existente text;
begin
  IF NOT private.pode_escrever_operacional() THEN
    RAISE EXCEPTION 'Acesso somente de leitura: cadastro de referência não autorizado.'
      USING ERRCODE='42501';
  END IF;
  v_nome := upper(trim(regexp_replace(coalesce(p_nome,''), '[[:space:]]+', ' ', 'g')));
  if v_nome !~ '^(CEL|TEN CEL|MAJ|CAP|TEN|ASP|ST|SGT|CB|SD|AL SGT) [^ ]' then
    raise exception 'Use o padrão Graduação + Nome de Guerra.';
  end if;

  v_chave := public.chave_comandante_estatistica(v_nome);
  select nome into v_existente
  from public.comandantes
  where public.chave_comandante_estatistica(nome)=v_chave
  order by criado_em desc, id desc
  limit 1;

  if v_existente is not null then
    raise exception 'Este policial já está cadastrado como %. Edite o cadastro existente em vez de criar outro.', v_existente;
  end if;

  insert into public.comandantes(nome) values (v_nome);
  return v_nome;
end;
$function$;


-- Protege cadastrar_endereco_publico
CREATE OR REPLACE FUNCTION public.cadastrar_endereco_publico(p_logradouro text, p_bairro text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_logradouro text := upper(trim(regexp_replace(coalesce(p_logradouro,''), '\s+', ' ', 'g')));
  v_bairro text := upper(trim(regexp_replace(coalesce(p_bairro,''), '\s+', ' ', 'g')));
begin
  IF NOT private.pode_escrever_operacional() THEN
    RAISE EXCEPTION 'Acesso somente de leitura: cadastro de referência não autorizado.'
      USING ERRCODE='42501';
  END IF;
  if v_logradouro !~ '^(RUA|AVENIDA|TRAVESSA|ALAMEDA|RODOVIA|ESTRADA|VICINAL|PRAÇA) [^ ]' then raise exception 'Logradouro inválido.'; end if;
  if not exists(select 1 from public.bairros where nome=v_bairro and ativo) then raise exception 'Bairro inválido.'; end if;
  insert into public.enderecos_padronizados(logradouro,bairro,ativo) values(v_logradouro,v_bairro,true)
  on conflict(logradouro) do update set bairro=excluded.bairro,ativo=true;
  return jsonb_build_object('logradouro',v_logradouro,'bairro',v_bairro);
end; $function$;


-- Protege cadastrar_subtipo_ocorrencia_publico
CREATE OR REPLACE FUNCTION public.cadastrar_subtipo_ocorrencia_publico(p_tipo_id bigint, p_nome text, p_fundamento_legal text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_nome text := upper(trim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g')));
  v_fundamento text := nullif(trim(regexp_replace(coalesce(p_fundamento_legal, ''), '\s+', ' ', 'g')), '');
  v_tipo public.tipos_ocorrencia%rowtype;
  v_subtipo public.subtipos_ocorrencia%rowtype;
begin
  IF NOT private.pode_escrever_operacional() THEN
    RAISE EXCEPTION 'Acesso somente de leitura: cadastro de referência não autorizado.'
      USING ERRCODE='42501';
  END IF;
  if p_tipo_id is null then
    raise exception 'Selecione primeiro o Tipo de Ocorrência.';
  end if;

  if length(v_nome) < 3 then
    raise exception 'Informe um subtipo com pelo menos 3 caracteres.';
  end if;

  select * into v_tipo
  from public.tipos_ocorrencia
  where id = p_tipo_id and ativo = true
  limit 1;

  if not found then
    raise exception 'Tipo de Ocorrência inválido ou inativo.';
  end if;

  select * into v_subtipo
  from public.subtipos_ocorrencia
  where tipo_id = p_tipo_id
    and upper(trim(nome)) = v_nome
  limit 1;

  if found then
    update public.subtipos_ocorrencia
       set ativo = true,
           fundamento_legal = coalesce(v_fundamento, fundamento_legal)
     where id = v_subtipo.id
     returning * into v_subtipo;
  else
    insert into public.subtipos_ocorrencia (tipo_id, nome, fundamento_legal, ativo)
    values (p_tipo_id, v_nome, v_fundamento, true)
    returning * into v_subtipo;
  end if;

  return jsonb_build_object(
    'id', v_subtipo.id,
    'tipo_id', v_subtipo.tipo_id,
    'nome', v_subtipo.nome,
    'fundamento_legal', v_subtipo.fundamento_legal
  );
end;
$function$;


-- Protege cadastrar_tipo_ocorrencia_publico
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
    if not v_tipo.ativo then
      update public.tipos_ocorrencia set ativo = true where id = v_tipo.id returning * into v_tipo;
    end if;
  else
    insert into public.tipos_ocorrencia (nome, categoria, ativo, ordem)
    values (v_nome, 'OUTROS', true, 0)
    returning * into v_tipo;
  end if;

  return jsonb_build_object('id', v_tipo.id, 'nome', v_tipo.nome, 'categoria', v_tipo.categoria);
end;
$function$;


