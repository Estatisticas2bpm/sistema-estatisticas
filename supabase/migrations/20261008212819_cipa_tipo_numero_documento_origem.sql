-- Extensão da CIPA: mantém a origem BIOMA/CICC/PATRULHAMENTO independente
-- do documento formal (Ordem de Missão, Ordem de Serviço, número).
alter table public.cipa_ocorrencias_ambientais
  add column if not exists tipo_documento_origem text,
  add column if not exists numero_documento_origem text;

comment on column public.cipa_ocorrencias_ambientais.tipo_documento_origem is 'ORDEM DE MISSÃO, ORDEM DE SERVIÇO ou outro documento que determinou a missão; independente da origem BIOMA/CICC.';
comment on column public.cipa_ocorrencias_ambientais.numero_documento_origem is 'Identificador literal da ordem de missão/serviço registrado no PPE (ex: 34/2026).';
