-- GIRO: identificação funcional obrigatória em novas contas.
-- Preserva conta compartilhada histórica desativada para integridade dos registros antigos.
alter table public.giro_acessos_abordagem add column if not exists posto_graduacao text;
alter table public.giro_acessos_abordagem
 add constraint giro_identificacao_individual_completa check (
   (email is null and ativo=false)
   or (
     length(btrim(coalesce(nome_completo,''))) between 3 and 120
     and length(btrim(coalesce(nome_guerra,''))) between 2 and 100
     and length(btrim(coalesce(matricula,''))) between 3 and 30
     and length(btrim(coalesce(posto_graduacao,''))) between 2 and 70
     and length(btrim(coalesce(email,''))) between 5 and 254
   )
 ) not valid;
comment on column public.giro_acessos_abordagem.posto_graduacao is 'Posto ou graduação funcional; autoria das abordagens permanece vinculada a user_id.';
