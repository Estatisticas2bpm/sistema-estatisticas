insert into supabase_migrations.schema_migrations (
  version,
  statements,
  name
)
values (
  '20260925045947',
  array[]::text[],
  'fase1_hierarquia_unidades_cpc'
)
on conflict (version) do nothing;
