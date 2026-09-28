-- fase3m_e_indices_territorio_cpc
-- Índices de apoio à navegação AISC/SISC/Setor/Bairro.


create index territorio_cpc_aisc_unidade_idx on public.territorio_cpc_aisc(unidade_id);
create index territorio_cpc_sisc_aisc_idx on public.territorio_cpc_sisc(aisc_id);
create index territorio_cpc_setores_sisc_idx on public.territorio_cpc_setores(sisc_id);
create index territorio_cpc_bairros_setor_idx on public.territorio_cpc_bairros(setor_id);
create index territorio_cpc_aliases_bairro_idx on public.territorio_cpc_bairro_aliases(bairro_id);
create index territorio_cpc_excecoes_unidade_idx on public.territorio_cpc_excecoes(unidade_id);
