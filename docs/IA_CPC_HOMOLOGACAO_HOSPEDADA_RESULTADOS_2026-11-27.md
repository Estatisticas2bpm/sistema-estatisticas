# IA CPC — resultado da homologação hospedada em 27/11/2026

**Estado: homologação parcial. NÃO liberar produção.**

## Ambiente e escopo
- Projeto hospedado separado: `sie-cpc-ia-homologacao`, confirmado `ACTIVE_HEALTHY`.
- Banco operacional SIE-CPC: **não alterado**, nenhuma cópia de BOs ou dados de contas reais.
- Verificado no projeto hospedado: zero contas persistidas, zero BOs, zero contas da allowlist, zero compras/recargas, zero reservas e saldo local zero.
- Edge `ia-cpc` publicada **somente** nesse ambiente, `verify_jwt=true`, código inclui as travas `IA_CPC_ENABLED` e `IA_CPC_API_PAGA_ENABLED`.
- Os valores *hospedados* dessas variáveis secretas **não puderam ser inspecionados ou configurados** pelo conector; a execução real da Edge com login ainda não foi homologada. Chave OpenAI não utilizada nesta validação.

## Resultados aprovados diretamente no PostgreSQL hospedado
1. Simulação transacional de cinco identidades sintéticas usando perfil, unidade e lista privada: administrador designado e comandante CPC designado autorizados, outro administrador e outro comandante não designados e operador comum bloqueados.
2. Verificação de unicidade: segunda conta ativa com categoria `ADMIN` recusada; perfil desativado e mudança do comandante para fora do CPC negam permissão.
3. Com carteira zerada: reserva do designado recusada por falta de créditos; reserva do não designado recusada por falta de autorização.
4. Simulações transacionais de sessões do Auth: combinação usuário/sessão válida reconhecida; sessão de outro usuário, inexistente, expirada ou revogada negada.
5. Privilegios: `anon` e `authenticated` sem acesso às tabelas privadas; reserva/finalização e conciliação não expostas a usuários comuns; RLS habilitada em todas as tabelas financeiras.
6. **Todas as transações de identidades e sessões foram revertidas integralmente (`ROLLBACK`)**. Nova consulta confirmou zero contas, sessões, perfis, recargas, reservas e registros de revogação persistidos.

Os itens acima validam **funções SQL e simulações de contexto JWT**, não substituem sessões reais geradas pelo Supabase Auth e não provam que a Edge hospedada foi chamada com credenciais válidas.

## Auditoria de segurança
Supabase Security Advisor: avisos informativos para tabelas com RLS ativada e sem policies (negação por padrão), e alerta para três funções `SECURITY DEFINER` executáveis por `authenticated`, incluindo `public.ia_cpc_permitido()`. Estas funções têm uso previsto com checagem de identidade, mas devem passar por validação com tokens reais antes de qualquer liberação. Orientações:
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Pendências que impedem aceite da etapa 6
- [ ] Criar cinco **contas reais de teste** por Supabase Auth Admin API/painel no **projeto de homologação**; nunca inserir contas duradouras diretamente em `auth.users` por SQL. Usar emails de teste institucional e gerenciar senhas fora do repositório.
- [ ] Configurar no painel de **homologação**, com aprovação, `IA_CPC_ENABLED=true`, `IA_CPC_API_PAGA_ENABLED=false`, `IA_CPC_RELATOS_ENABLED=false` e `IA_CPC_ALLOWED_ORIGINS` igual à URL HTTPS real do frontend de testes. Não configurar `OPENAI_API_KEY`.
- [ ] Designar duas dessas contas fictícias na lista privada, verificar UI/Edge sem sessão, com JWT inválido, login e logout, refresh, revogação, mudança de unidade, outra conta ADMIN/COMANDANTE e CORS externo.
- [ ] Inserir BOs inteiramente sintéticos no projeto de teste e simular recarga **fictícia** via DBA. Com API paga desabilitada, verificar resposta 503, ausência de chamadas externas e zero registros de reserva. Depois limpar os dados de teste, conservando apenas artefatos aprovados.
- [ ] Registrar evidência de zero cobrança no provedor e revisar logs sem tokens/relatos. Não considerar ausência de logs uma prova de zero cobrança.
- [ ] Sincronizar a branch `feature/ia-cpc-admin-comandante-20261111` com `main` antes de merge. Em 27/11/2026, PR #152 estava como Draft e `mergeable=false`, pois a principal avançou; não resolver conflitos modificando funcionalidades operacionais sem revisão.

## Critério de liberação
Aprovação institucional e de segurança, testes completos da Edge/Auth hospedados com dados sintéticos, conciliação contábil conferida, tratamento documentado de incidentes e aprovação específica para API paga antes da produção. O módulo de análise de relatos históricos fica bloqueado até validação independente. Os únicos usuários definitivos serão uma conta ADMIN e uma COMANDANTE CPC expressamente designadas.

**Não houve merge, migração ou deploy no banco operacional nem compra de créditos da OpenAI nesta sessão.**
