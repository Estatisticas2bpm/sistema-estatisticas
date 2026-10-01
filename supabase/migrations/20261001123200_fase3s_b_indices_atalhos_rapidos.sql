create index unidades_atalhos_locais_local_id_idx
  on public.unidades_atalhos_locais (local_id);

create index unidades_atalhos_locais_criado_por_idx
  on public.unidades_atalhos_locais (criado_por)
  where criado_por is not null;
