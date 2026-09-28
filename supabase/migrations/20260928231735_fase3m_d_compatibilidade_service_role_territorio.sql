-- fase3m_d_compatibilidade_service_role_territorio
-- Mantém compatibilidade da classificação territorial com integrações service_role.


grant select on table
  public.territorio_cpc_aisc,
  public.territorio_cpc_sisc,
  public.territorio_cpc_setores,
  public.territorio_cpc_bairros,
  public.territorio_cpc_bairro_aliases,
  public.territorio_cpc_excecoes
to service_role;

grant execute on function
  public.territorio_por_bairro(text),
  public.sisc_por_bairro(text),
  public.aisc_por_bairro(text),
  public.setor_por_bairro(text),
  public.obter_catalogo_territorial_cpc()
to service_role;
