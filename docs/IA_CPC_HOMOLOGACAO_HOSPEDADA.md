# Roteiro de homologação hospedada — IA CPC
**Proposta, 18/11/2026.** Não executar na produção, não adquirir créditos nem configurar chave real nesta etapa. A criação de projeto/branch hospedado exige aprovação específica e conferência de custos. Este documento não cria recursos.

## 1. Pré-verificação
Leitura de metadados do ambiente operacional em 18/11/2026: esquema privado, funções private.usuario_ativo() e public.admin_validar_sessao(uuid,uuid) existentes; 15/15 colunas operacionais estruturadas exigidas pela IA presentes. Tabelas privadas de acesso e recarga, RPC de saldo e Edge ia-cpc ausentes. Nenhuma branch de desenvolvimento hospedada localizada. Não foram consultados BOs ou identidades nem alterados dados.
Última validação geral aprovada antes da trava adicional: execução GitHub Actions 44405818974, commit 0111364bdb31d9e3eb086650441a5ed81ad4c533. Reexecutar testes para a versão nova.

## 2. Ambiente segregado (mediante autorização)
- Usar projeto de homologação exclusivo, sem copiar a base operacional. Confirmar plano, custo, armazenamento, região e referência do projeto antes de criar recursos.
- Validar referência e URL tanto no painel Supabase quanto no destino do CLI ou ferramenta de administração. Não usar chave ou URL de produção; não executar script destinado a ambiente local contra uma URL remota.
- Usar somente os fixtures sintéticos de tests/ia-cpc-supabase-local-fixture.sql e contas de teste com senhas próprias, geradas e guardadas em local protegido. O fixture implementa interfaces mínimas de Auth e de contexto: não é reprodução completa do esquema operacional.
- Introduzir a proposta de SQL docs/sql/ia_cpc_cota_pendente_aprovacao.sql no ambiente segregado após revisar dependências, privilégios e RLS. Não aplicar como migração automática de produção.
- Publicar a Edge ia-cpc exclusivamente nesse projeto, com verificação JWT conforme configuração/gateway efetivamente suportados pelo Auth de homologação; confirmar teste de token inválido no gateway E verificação Auth interna. Não alterar verificação JWT de outras Edge Functions.
- Servir cópia temporária da interface da branch por HTTPS em origem de teste, com URL e chave pública da homologação. Não publicar a cópia na URL oficial. Não entregar service_role ao navegador. Configurar URLs de redirecionamento do Auth apenas para origem de teste.
- Não usar fixture como substituto de auditoria das funções de sessão/MFA do ambiente real.

## 3. Flags para a homologação sem provedor
Configurar exclusivamente no projeto segregado:
- IA_CPC_ENABLED=true (permite testar o módulo).
- IA_CPC_API_PAGA_ENABLED=false (trava independente; valor ausente ou diferente de true também nega chamada paga).
- IA_CPC_RELATOS_ENABLED=false.
- IA_CPC_ALLOWED_ORIGINS=origem HTTPS exata do frontend temporário, sem wildcard.
- OPENAI_API_KEY, OPENAI_MODEL e IA_CPC_BRL_USD_RESERVA: não configurar nesta fase. A checagem de configuração financeira só é obrigatória caso a API paga seja ligada, o que está fora do escopo.
- Não ligar nenhum dos flags em produção. O código mantém a verificação de sessão, usuário e autorização individual antes de consultar saldo ou dados, e impede processamento de relatos quando a API paga está desligada.
- Consultas sem registros retornam aviso sem cobrança; consultas com registros são rejeitadas antes de montar payload, reservar centavos ou chamar o provedor. Isto não testa qualidade da resposta gerada por IA.

## 4. Casos de aceite no ambiente hospedado
1. Sem sessão, JWT inválido, sessão expirada/revogada: negar acesso. Confirmar que JWT válido não basta se sessão revogada ou perfil inativo.
2. Criar cinco contas fictícias: ADMIN designado, COMANDANTE CPC designado, ADMIN não designado, outro comandante e operador. Exigir exatamente as duas autorizadas no navegador e na Edge. Testar acesso direto e mudança de unidade.
3. Validar CORS pela origem de teste e bloquear origem externa. Testar logout/login de verdade, refresh, expiração e MFA caso adotada; não reutilizar credenciais de usuários reais.
4. Conferir saldo inicial zero com API paga desligada e sem credencial OpenAI. Conta desautorizada não pode consultar saldo nem RPC financeira diretamente.
5. Em ambiente fictício APENAS, inserir recarga de R$100 fictícios e BO sintético em período distinto. Consulta com dados: 503 informando liberação da API paga pendente; saldo continua R$100, tabela de consumo sem reservas. Período vazio continua respondendo sem custo. Testar remoção da flag, não apenas false.
6. Testar autorização negada em RPCs de reserva, finalização, registro de recarga e tabelas privadas. Revisar Security Advisor e RLS do projeto segregado.
7. Verificar UI, logs e uso do provedor: nenhuma chave OpenAI, dados policiais verdadeiros, consulta paga ou cobrança. Logs não devem conter tokens ou narrativas.
8. Ao final desativar IA_CPC_ENABLED, confirmar rejeição 503, revogar sessões de teste e registrar resultado. Encerrar recursos de teste conforme autorização e custo. Não reaproveitar usuários de teste na produção.

## 5. Antes da implantação oficial
- Homologação hospedada aprovada e identificada por commit. Verificar atualização da main sem perder alterações posteriores.
- Avaliar mecanismo auditado de conciliação corretiva, preço/modelo vigente, parâmetros de reserva e disponibilidade na conta da OpenAI. Nenhuma tentativa de cobrança sem aprovação.
- Aprovação institucional de processamento externo restrito aos agregados; revisar política de dados e risco de inferência por pequenas contagens. Relatos continuam bloqueados até revisão amostral independente.
- Designar nominalmente as duas contas pelo gestor autorizado, fora do repositório. Não compartilhar login.
- Obter autorização expressa para schema, deploy, acesso real, chave e eventual compra. Configurar flags desligadas inicialmente no ambiente operacional. Testar sem afetar os demais módulos e com carteira zerada.
- Separar autorização de uso geral de autorização de cobrança; ativar IA_CPC_API_PAGA_ENABLED somente após aceite financeiro e aquisição manual confirmada. Consultar procedimento financeiro em docs/IA_CPC_PROCEDIMENTO_RECARGA_CONCILIACAO.md.
- Plano de reversão: negar IA_CPC_ENABLED e IA_CPC_API_PAGA_ENABLED, desativar acessos individuais autorizados se necessário, preservar registros financeiros e verificar site convencional. Não apagar consumo e não reverter migrações operacionais não relacionadas. Operações em curso podem terminar; conciliar seu consumo.

**Status:** roteiro preparado. Projeto hospedado, testes hospedados, configuração de chave, compra e publicação ainda NÃO realizados.
