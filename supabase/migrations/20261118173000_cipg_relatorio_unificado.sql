
alter table public.cipg_servicos_guarda alter column instituicao drop not null;
alter table public.cipg_servicos_guarda add column if not exists codigo_relatorio text,
 add column if not exists comandante_id uuid references auth.users(id) on delete restrict,
 add column if not exists recebeu_de_id uuid references auth.users(id) on delete restrict,
 add column if not exists passou_para_id uuid references auth.users(id) on delete restrict,
 add column if not exists descricao_alteracao_pessoal text,
 add column if not exists descricao_alteracao_instalacoes text,
 add column if not exists descricao_alteracao_material text;
alter table public.cipg_eventos_guarda add column if not exists descricao_evento text,
 add column if not exists acionou_viatura boolean, add column if not exists unidade_acionada text,
 add column if not exists numero_ppe text;
alter table public.cipg_eventos_guarda drop constraint cipg_eventos_guarda_tipo_evento_check;
alter table public.cipg_eventos_guarda add constraint cipg_eventos_guarda_tipo_evento_check check(tipo_evento in ('ENTRADA DE PM NO HOSPITAL','ALTA / SAÍDA DE PM DO HOSPITAL','ÓBITO DE PM','ALTERAÇÃO NO POSTO','FUGA / EVASÃO','TUMULTO','APOIO PRESTADO','DESACATO','AMEAÇA','OUTROS'));
create sequence if not exists public.cipg_numero_relatorio_seq;
alter table public.cipg_servicos_guarda alter column codigo_relatorio set default ('CIPG-'||to_char(now() at time zone 'America/Boa_Vista','YYYY')||'-'||lpad(nextval('public.cipg_numero_relatorio_seq')::text,8,'0'));
grant usage on sequence public.cipg_numero_relatorio_seq to authenticated;
update public.cipg_servicos_guarda set codigo_relatorio=default where codigo_relatorio is null;
alter table public.cipg_servicos_guarda alter column codigo_relatorio set not null;
create unique index if not exists cipg_codigo_relatorio_unico on public.cipg_servicos_guarda(codigo_relatorio);

create or replace function public.cipg_listar_efetivo_caderno() returns table(id uuid,nome text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not (exists(select 1 from public.cipg_acessos_caderno a join public.unidades u on u.id=a.unidade_id where a.user_id=auth.uid() and a.ativo and not a.senha_temporaria and u.sigla='CIPG' and u.ativo)
 or (private.usuario_ativo() and exists(select 1 from public.perfis_usuarios p join public.unidades u on u.id=p.unidade_id where p.user_id=auth.uid() and (p.perfil='ADMIN' or (p.perfil in ('ESTATISTICA','OPERADOR') and u.sigla='CIPG'))))) then raise insufficient_privilege; end if;
 return query select a.user_id,concat_ws(' ',nullif(btrim(a.posto_graduacao),''),nullif(btrim(a.nome_guerra),''))::text from public.cipg_acessos_caderno a join public.unidades u on u.id=a.unidade_id where a.ativo and u.sigla='CIPG' and u.ativo and nullif(btrim(a.nome_guerra),'') is not null order by 2,1;
end $$;

create or replace function private.cipg_preparar_relatorio() returns trigger language plpgsql security definer set search_path='' as $$
declare v_nome text; v_tipo text;
begin
 if new.posto_codigo is null or new.turno_cipg is null then raise exception 'Selecione posto de serviço e turno.'; end if;
 select tipo_local into v_tipo from public.cipg_postos where codigo=new.posto_codigo and ativo;
 if not found then raise exception 'Posto de serviço inexistente ou desativado.'; end if;
 new.tipo_local:=v_tipo;
 new.instituicao:=nullif(btrim(new.instituicao),'');
 new.km_rodados:=case when new.km_inicial is not null and new.km_final is not null then new.km_final-new.km_inicial else null end;
 new.rondas_realizadas:=0;
 if new.comandante_id is not null then select nome into v_nome from public.cipg_listar_efetivo_caderno() where id=new.comandante_id; if not found then raise exception 'Comandante não cadastrado ou inativo.'; end if;new.comandante:=v_nome;end if;
 if new.recebeu_de_id is not null then select nome into v_nome from public.cipg_listar_efetivo_caderno() where id=new.recebeu_de_id; if not found then raise exception 'Militar que passou o serviço não cadastrado ou inativo.'; end if;new.recebeu_de:=v_nome;end if;
 if new.passou_para_id is not null then select nome into v_nome from public.cipg_listar_efetivo_caderno() where id=new.passou_para_id; if not found then raise exception 'Militar que recebeu o serviço não cadastrado ou inativo.'; end if;new.passou_para:=v_nome;end if;
 if not new.alteracao_pessoal then new.descricao_alteracao_pessoal:=null;end if;
 if not new.alteracao_instalacoes then new.descricao_alteracao_instalacoes:=null;end if;
 if not new.alteracao_material then new.descricao_alteracao_material:=null;end if;
 if new.alteracao_pessoal or new.alteracao_instalacoes or new.alteracao_material then new.situacao:='COM ALTERACAO';end if;
 return new;
end $$;
drop trigger if exists cipg_preparar_relatorio_insert on public.cipg_servicos_guarda;
create trigger cipg_preparar_relatorio_insert before insert on public.cipg_servicos_guarda for each row execute function private.cipg_preparar_relatorio();

create or replace function public.cipg_salvar_relatorio(p_id uuid,p_servico jsonb,p_eventos jsonb default '[]'::jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s public.cipg_servicos_guarda%rowtype; e public.cipg_eventos_guarda%rowtype; v_evento jsonb; v_codigo text; v_existente uuid;
begin
 if auth.uid() is null or p_id is null or jsonb_typeof(p_servico) is distinct from 'object' or jsonb_typeof(p_eventos) is distinct from 'array' or jsonb_array_length(p_eventos)>100 then raise exception 'Dados inválidos.';end if;
 select codigo_relatorio,criado_por into v_codigo,v_existente from public.cipg_servicos_guarda where id=p_id;
 if found then
  if v_existente is distinct from auth.uid() then raise insufficient_privilege;end if;
  return jsonb_build_object('id',p_id,'codigo_relatorio',v_codigo,'ja_salvo',true);
 end if;
 s:=jsonb_populate_record(null::public.cipg_servicos_guarda,p_servico);
 insert into public.cipg_servicos_guarda(id,unidade_id,data_servico,posto_codigo,instituicao,tipo_local,modalidade,regime,turno_cipg,comandante_id,recebeu_de_id,passou_para_id,efetivo_ordinario,efetivo_svi,viatura,km_inicial,km_final,litros_abastecidos,saidas_autorizadas,alteracao_pessoal,alteracao_instalacoes,alteracao_material,descricao_alteracao_pessoal,descricao_alteracao_instalacoes,descricao_alteracao_material,outros_solicitacoes,situacao,intercorrencias)
 values(p_id,s.unidade_id,s.data_servico,s.posto_codigo,s.instituicao,'OUTRO',coalesce(s.modalidade,'GUARDA_FIXA'),s.regime,s.turno_cipg,s.comandante_id,s.recebeu_de_id,s.passou_para_id,coalesce(s.efetivo_ordinario,0),coalesce(s.efetivo_svi,0),s.viatura,s.km_inicial,s.km_final,s.litros_abastecidos,s.saidas_autorizadas,coalesce(s.alteracao_pessoal,false),coalesce(s.alteracao_instalacoes,false),coalesce(s.alteracao_material,false),left(s.descricao_alteracao_pessoal,500),left(s.descricao_alteracao_instalacoes,500),left(s.descricao_alteracao_material,500),s.outros_solicitacoes,case when jsonb_array_length(p_eventos)>0 then 'COM ALTERACAO' else 'SEM ALTERACAO' end,jsonb_array_length(p_eventos)) returning codigo_relatorio into v_codigo;
 for v_evento in select value from jsonb_array_elements(p_eventos) loop
  e:=jsonb_populate_record(null::public.cipg_eventos_guarda,v_evento);
  insert into public.cipg_eventos_guarda(servico_id,tipo_evento,data_evento,hora_evento,graduacao,unidade_militar,em_servico,causa_motivo,conduzido_por,setor_atendimento,desfecho,apoio_acompanhamento,descricao_evento,acionou_viatura,unidade_acionada,numero_ppe)
  values(p_id,e.tipo_evento,e.data_evento,e.hora_evento,e.graduacao,e.unidade_militar,e.em_servico,e.causa_motivo,e.conduzido_por,e.setor_atendimento,e.desfecho,e.apoio_acompanhamento,left(e.descricao_evento,500),e.acionou_viatura,case when e.acionou_viatura then left(e.unidade_acionada,120) end,left(e.numero_ppe,120));
 end loop;
 return jsonb_build_object('id',p_id,'codigo_relatorio',v_codigo);
end $$;
create or replace function public.cipg_gerenciar_posto(p_codigo text,p_nome text,p_tipo text,p_ativo boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.usuario_ativo() or not exists(select 1 from public.perfis_usuarios p left join public.unidades u on u.id=p.unidade_id where p.user_id=auth.uid() and p.ativo and (p.perfil='ADMIN' or (p.perfil='ESTATISTICA' and u.sigla='CIPG'))) then raise insufficient_privilege; end if;
 insert into public.cipg_postos(codigo,nome,tipo_local,ativo,criado_por) values(upper(btrim(p_codigo)),btrim(p_nome),p_tipo,p_ativo,auth.uid())
 on conflict(codigo) do update set nome=excluded.nome,tipo_local=excluded.tipo_local,ativo=excluded.ativo;
end $$;
revoke all on function public.cipg_listar_efetivo_caderno(),public.cipg_salvar_relatorio(uuid,jsonb,jsonb),public.cipg_gerenciar_posto(text,text,text,boolean) from public,anon;
grant execute on function public.cipg_listar_efetivo_caderno(),public.cipg_salvar_relatorio(uuid,jsonb,jsonb),public.cipg_gerenciar_posto(text,text,text,boolean) to authenticated;
CREATE OR REPLACE FUNCTION private.verificar_acesso_api()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := coalesce(auth.role()::text, '');
  v_uid uuid := auth.uid();
  v_path text := coalesce(nullif(current_setting('request.path', true),''),'');
  v_method text := upper(coalesce(nullif(current_setting('request.method', true),''),''));
  v_session_text text := auth.jwt()->>'session_id';
begin
  -- Mantém a exceção já existente para serviços confiáveis com JWT service_role.
  if v_role = 'service_role' then
    return;
  end if;

  -- Mantém os critérios originais do SIE-CPC (perfil ativo + sessão válida + não revogada).
  if v_role = 'authenticated' and private.usuario_ativo() then
    return;
  end if;

  -- Contas EXCLUSIVAS do GIRO não têm perfil no SIE-CPC por desenho.
  -- Permite SOMENTE o GET da autorização própria e o POST da RPC de abordagens.
  -- Esta exceção NÃO permite consultas aos dashboards, BOs nem outros recursos.
  if v_role = 'authenticated'
     and v_uid is not null
     and (
       (v_method = 'GET' and v_path in
          ('/giro_acessos_abordagem','/rest/v1/giro_acessos_abordagem'))
       or
       (v_method = 'POST' and v_path in
          ('/rpc/registrar_abordagem_giro','/rest/v1/rpc/registrar_abordagem_giro'))
     )
     and v_session_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and exists (
       select 1
       from auth.sessions s
       join public.giro_acessos_abordagem a
         on a.user_id = s.user_id and a.ativo = true
       join public.unidades u
         on u.id = a.unidade_id
        and u.ativo = true
        and upper(u.sigla) = 'GIRO'
        and u.aceita_registro_operacional = true
       where s.id = v_session_text::uuid
         and s.user_id = v_uid
         and (s.not_after is null or s.not_after > now())
         and nullif(btrim(a.nome_completo),'') is not null
         and nullif(btrim(a.nome_guerra),'') is not null
         and nullif(btrim(a.matricula),'') is not null
         -- Não ressuscita perfis institucionais revogados/bloqueados.
         and not exists (
           select 1 from public.perfis_usuarios p where p.user_id = v_uid
         )
         and not exists (
           select 1 from public.sessoes_revogadas r
           where r.user_id = v_uid and r.session_id = s.id
         )
     )
  then
    return;
  end if;

  -- CIPG: excecao limitada ao Caderno Digital; RLS de autoria permanece.
  if v_role = 'authenticated'
     and v_uid is not null
     and (
       (v_method = 'GET' and v_path in (
         '/cipg_acessos_caderno','/rest/v1/cipg_acessos_caderno',
         '/cipg_postos','/rest/v1/cipg_postos',
         '/cipg_servicos_guarda','/rest/v1/cipg_servicos_guarda',
         '/cipg_eventos_guarda','/rest/v1/cipg_eventos_guarda'
       ))
       or (v_method = 'POST' and v_path in (
         '/cipg_servicos_guarda','/rest/v1/cipg_servicos_guarda',
         '/cipg_eventos_guarda','/rest/v1/cipg_eventos_guarda',
         '/rpc/cipg_listar_efetivo_caderno','/rest/v1/rpc/cipg_listar_efetivo_caderno',
         '/rpc/cipg_salvar_relatorio','/rest/v1/rpc/cipg_salvar_relatorio'
       ))
     )
     and v_session_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and exists (
       select 1 from auth.sessions s
       join auth.users au on au.id=s.user_id
       join public.cipg_acessos_caderno a on a.user_id=s.user_id and a.ativo=true
         and (not a.senha_temporaria or (v_method='GET' and v_path in
             ('/cipg_acessos_caderno','/rest/v1/cipg_acessos_caderno')))
       join public.unidades u on u.id=a.unidade_id
         and u.ativo=true and upper(u.sigla)='CIPG'
         and u.aceita_registro_operacional=true
       where s.id = v_session_text::uuid and s.user_id=v_uid
         and (s.not_after is null or s.not_after>now())
         and (au.banned_until is null or au.banned_until<=now())
         and not exists (select 1 from public.perfis_usuarios p where p.user_id=v_uid)
         and not exists (select 1 from public.sessoes_revogadas r where r.user_id=v_uid and r.session_id=s.id)
     )
  then
    return;
  end if;

  raise insufficient_privilege
    using message = 'Acesso ao sistema não autorizado.';
end;
$function$;
