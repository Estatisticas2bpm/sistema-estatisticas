-- GIRO: acesso ADMIN com autoria individual preservada (19/10/2026).
-- Acesso de policiais GIRO segue individual e inalterado.
-- ADMIN pode registrar somente quando sua unidade de trabalho é GIRO.
-- Qualquer tentativa em contexto CPC/COMANDO ou outro batalhão é negada.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='90s';
CREATE OR REPLACE FUNCTION public.registrar_abordagem_giro(p_tipo_abordagem text, p_pessoas jsonb, p_latitude double precision, p_longitude double precision, p_precisao_metros real DEFAULT NULL::real, p_endereco text DEFAULT NULL::text, p_bairro text DEFAULT NULL::text, p_municipio text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_unidade uuid;
  v_tipo text := upper(trim(coalesce(p_tipo_abordagem,'')));
  v_qtd integer;
  v_id uuid := gen_random_uuid();
begin
  if v_user is null then
    raise exception 'Sessão inválida.' using errcode='42501';
  end if;

  if private.perfil_atual() = 'ADMIN' then
    -- ADMIN deve selecionar GIRO como unidade de trabalho. Não pode registrar
    -- abordagens GIRO em contexto CPC, 2BPM ou outra unidade.
    select u.id into v_unidade
    from public.unidades u
    where u.id = private.unidade_atual()
      and upper(u.sigla) = 'GIRO'
      and u.ativo = true
      and u.aceita_registro_operacional = true
    limit 1;
  else
    select a.unidade_id into v_unidade
    from public.giro_acessos_abordagem a
    join public.unidades u on u.id = a.unidade_id
    where a.user_id = v_user
      and a.ativo = true
      and u.ativo = true
      and upper(u.sigla) = 'GIRO'
    limit 1;
  
  end if;

  if v_unidade is null then
    raise exception 'Acesso de abordagem do GIRO não autorizado ou unidade ainda inativa.'
      using errcode='42501';
  end if;

  if v_tipo not in ('A_PE','MOTO','VEICULO') then
    raise exception 'Selecione o tipo da abordagem.' using errcode='23514';
  end if;

  if p_pessoas is null or jsonb_typeof(p_pessoas) <> 'array' then
    raise exception 'Informe as pessoas abordadas.' using errcode='23514';
  end if;

  v_qtd := jsonb_array_length(p_pessoas);
  if v_qtd < 1 or v_qtd > 20 then
    raise exception 'Informe entre 1 e 20 pessoas por abordagem.' using errcode='23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_pessoas) p
    where coalesce(p->>'nacionalidade','') not in ('BR','VE','OUTRA')
       or coalesce(p->>'sexo','') not in ('M','F','NI')
       or coalesce(p->>'idade','') !~ '^[0-9]{1,3}$'
       or (p->>'idade')::integer not between 0 and 130
  ) then
    raise exception 'Há pessoa com nacionalidade, sexo ou idade inválida.' using errcode='23514';
  end if;

  if p_latitude is null or p_longitude is null then
    raise exception 'Capture a localização antes de salvar.' using errcode='23514';
  end if;

  insert into public.giro_abordagens (
    id,unidade_id,tipo_abordagem,pessoas,quantidade_pessoas,
    latitude,longitude,precisao_metros,endereco,bairro,municipio,criado_por
  )
  values (
    v_id,v_unidade,v_tipo,p_pessoas,v_qtd,
    p_latitude,p_longitude,p_precisao_metros,
    nullif(trim(coalesce(p_endereco,'')),''),
    nullif(trim(coalesce(p_bairro,'')),''),
    nullif(trim(coalesce(p_municipio,'')),''),
    v_user
  );

  return v_id;
end
$function$
;

CREATE OR REPLACE FUNCTION private.validar_abordagem_giro_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_unidade uuid;
  v_qtd integer;
begin
  if v_user is null then
    raise exception 'Sessão inválida.' using errcode='42501';
  end if;

  if private.perfil_atual() = 'ADMIN' then
    -- ADMIN deve selecionar GIRO como unidade de trabalho. Não pode registrar
    -- abordagens GIRO em contexto CPC, 2BPM ou outra unidade.
    select u.id into v_unidade
    from public.unidades u
    where u.id = private.unidade_atual()
      and upper(u.sigla) = 'GIRO'
      and u.ativo = true
      and u.aceita_registro_operacional = true
    limit 1;
  else
    select a.unidade_id into v_unidade
    from public.giro_acessos_abordagem a
    join public.unidades u on u.id=a.unidade_id
    where a.user_id=v_user
      and a.ativo=true
      and u.ativo=true
      and upper(u.sigla)='GIRO'
    limit 1;
  
  end if;

  if v_unidade is null then
    raise exception 'Acesso de abordagem do GIRO não autorizado ou unidade ainda inativa.'
      using errcode='42501';
  end if;

  new.tipo_abordagem := upper(trim(coalesce(new.tipo_abordagem,'')));
  if new.tipo_abordagem not in ('A_PE','MOTO','VEICULO') then
    raise exception 'Selecione o tipo da abordagem.' using errcode='23514';
  end if;

  if new.pessoas is null or jsonb_typeof(new.pessoas)<>'array' then
    raise exception 'Informe as pessoas abordadas.' using errcode='23514';
  end if;

  v_qtd := jsonb_array_length(new.pessoas);
  if v_qtd<1 or v_qtd>20 then
    raise exception 'Informe entre 1 e 20 pessoas por abordagem.' using errcode='23514';
  end if;

  if exists (
    select 1 from jsonb_array_elements(new.pessoas) p
    where coalesce(p->>'nacionalidade','') not in ('BR','VE','OUTRA')
       or coalesce(p->>'sexo','') not in ('M','F','NI')
       or coalesce(p->>'idade','') !~ '^[0-9]{1,3}$'
       or (p->>'idade')::integer not between 0 and 130
  ) then
    raise exception 'Há pessoa com nacionalidade, sexo ou idade inválida.' using errcode='23514';
  end if;

  if new.latitude is null or new.longitude is null then
    raise exception 'Capture a localização antes de salvar.' using errcode='23514';
  end if;

  new.unidade_id := v_unidade;
  new.criado_por := v_user;
  new.quantidade_pessoas := v_qtd;
  new.registrado_em := now();
  new.criado_em := now();
  return new;
end
$function$
;
-- Política adicional limitada ao administrador ativo e ao contexto GIRO.
DROP POLICY IF EXISTS giro_abordagens_insert_admin_contexto_giro ON public.giro_abordagens;
CREATE POLICY giro_abordagens_insert_admin_contexto_giro
ON public.giro_abordagens FOR INSERT TO authenticated
WITH CHECK (
  criado_por = (SELECT auth.uid())
  AND private.perfil_atual() = 'ADMIN'
  AND unidade_id = private.unidade_atual()
  AND EXISTS (
    SELECT 1 FROM public.unidades u
    WHERE u.id = giro_abordagens.unidade_id
      AND upper(u.sigla) = 'GIRO'
      AND u.ativo = true
      AND u.aceita_registro_operacional = true
  )
);
-- Não amplia SELECT/UPDATE/DELETE de outros perfis e não mexe em BOs existentes.
COMMIT;
