alter table public.perfis_usuarios
  add column if not exists posto_graduacao text;

comment on column public.perfis_usuarios.posto_graduacao is
  'Posto ou graduação abreviada para identificação funcional do usuário, ex.: SD PM, 3º SGT PM, CAP PM.';
