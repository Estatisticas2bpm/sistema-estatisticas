# Fase 3H — ativação isolada da integração Google Sheets do 1º BPM

Projeto Supabase: `jppmhhukujigxupgskdk`

## Pré-condições validadas

- 1º BPM ativo.
- 2º BPM ativo.
- Total de ocorrências: 2.753.
- Ocorrências sem unidade: 0.
- Ocorrências do 1º BPM: 0.
- Usuários do 1º BPM: 0.
- Integração Google Sheets do 2º BPM ativa.
- Integração Google Sheets do 1º BPM inativa.
- `claim_google_sheets_sync_batch_v2(integer,text)` existente.
- Edge Function `google-sheets-sync` ativa e com suporte a `routing_mode=multi`.

## Execução

Foi alterado exclusivamente o registro de `public.unidades_integracoes` do 1º BPM para `ativo = true`.

Nenhuma alteração foi feita em:

- `public.ocorrencias`;
- `public.perfis_usuarios`;
- cadastro das unidades;
- módulos;
- dados históricos.

## Pós-validações

- Unidades ativas: 2.
- Integrações ativas: 2.
- Integração Google Sheets do 1º BPM: ativa.
- Integração Google Sheets do 2º BPM: ativa.
- Total de ocorrências: 2.753.
- Ocorrências sem unidade: 0.
- Ocorrências do 1º BPM: 0.
- Usuários do 1º BPM: 0.

## Estado de parada

A Fase 3H termina antes da criação do primeiro usuário e antes do primeiro BO de teste do 1º BPM.
