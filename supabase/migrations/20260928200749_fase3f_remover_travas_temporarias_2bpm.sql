-- Reconciliação histórica.
-- Esta versão consta como aplicada no Supabase e removeu o CHECK/default
-- temporário que restringia ocorrências ao 2BPM. O estado final é preservado
-- pelas migrations autoritativas posteriores e por unidade_id sem default.
select 1;
