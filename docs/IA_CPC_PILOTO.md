# SIE-CPC — Piloto do Assistente de Inteligência Operacional

**Situação:** implementação em branch, DESATIVADA por padrão. Não habilitar em produção sem revisão institucional, testes autenticados e autorização de tratamento de dados.

## Escopo da Fase 1

- **ADMIN:** acesso ao assistente, independentemente da unidade administrativa de origem.
- **COMANDANTE:** acesso somente se sua unidade principal vinculada no perfil for a unidade ativa com sigla CPC.
- Outros perfis, incluindo COMANDANTE de outra unidade: sem acesso.
- Frontend esconde atalho; guard bloqueia acesso direto à página; Edge Function revalida token, perfil ativo e unidade principal no banco.
- Nenhum privilégio de leitura/escrita foi ampliado nas tabelas do sistema. Chave de serviço usada exclusivamente no servidor, após autenticação e autorização, nunca exposta no GitHub ou navegador.

## Escopo e limitações

O assistente lê apenas colunas estatísticas em public.ocorrencias (data, unidade, natureza, bairro, quantidades) e catálogo de unidades. Não lê PDFs, históricos nem documentos individuais. Resume **registros ativos**, incluindo rascunhos e finalizados conforme o dashboard implantado; a resposta distingue as duas quantidades.

São enviados ao provedor de IA somente agregados e a pergunta digitada pelo comandante, não os registros brutos. Categorias com menos de cinco casos não aparecem nos rankings. Isso minimiza, mas não elimina, riscos de dados pessoais digitados na pergunta; foram previstos orientações e filtros básicos. Exige homologação institucional.

O piloto cobre períodos de até 366 dias, no máximo 10 mil registros por solicitação. Indicadores: total de ocorrências, conduzidos, prisões, armas, veículos recuperados, ranking de unidades, naturezas e bairros, série mensal. Não substitui regras especializadas de GIRO, CIPA, CIPG e Cavalaria. Conferir com dashboard antes de publicar.

## Variáveis e ativação — somente após homologação

1. Criar projeto de API institucional com faturamento e orçamento após autorização para processamento externo de dados.
2. Implantar a Edge Function **supabase/functions/ia-cpc/index.ts** no mesmo Supabase com JWT obrigatório (verify_jwt = true). Conferir CLI e documentação atual.
3. Configurar os segredos Supabase, sem valores no repositório:
   - **OPENAI_API_KEY**: chave secreta do projeto aprovado.
   - **OPENAI_MODEL**: opcional, padrão gpt-6-luna, ou outro modelo homologado.
   - **IA_CPC_ALLOWED_ORIGINS**: origens exatas HTTPS do site, separadas por vírgula, sem barra final; sem ela todas as chamadas são negadas.
   - **IA_CPC_ENABLED**: ausente ou false até o aceite; true somente após homologação.
   - **SUPABASE_URL** e **SUPABASE_SERVICE_ROLE_KEY**: segredos do projeto no ambiente de execução; nunca no frontend.
4. Confirmar que nenhuma chave secreta foi enviada ao GitHub, que a função exige autenticação e que há autorização institucional para tráfego externo.
5. Ativar apenas após testes com dados sintéticos e aprovação de segurança e da área responsável pelos dados.

## Controle de custos

O piloto é desativado até IA_CPC_ENABLED=true. Cada pergunta gera uma chamada paga quando habilitado. A agregação local reduz o consumo, mas **esta primeira versão ainda não possui teto financeiro rígido**. Antes da liberação, configurar alertas e orçamento no provedor e implementar cota persistente no backend, se o comando exigir bloqueio automático. Alertas de faturamento, por si sós, não impedem extrapolação.

## Homologação obrigatória

- [ ] ADMIN do 2º BPM e ADMIN da CIPTUR: interface e API autorizadas.
- [ ] COMANDANTE com unidade principal CPC: interface e API autorizadas.
- [ ] COMANDANTE do 1º BPM: sem atalho, página e API bloqueadas.
- [ ] ESTATISTICA, OPERADOR, CONSULTA e conta inativa: página e API bloqueadas.
- [ ] Requisição sem token, com token expirado, origem inválida e perfil revogado: recusadas.
- [ ] Período invertido, data futura, mais de 366 dias e limite de registros.
- [ ] Conferir totais com os dashboards, documentando rascunhos e finalizados.
- [ ] Conferir que nenhum dado nominal, relato ou BO completo é enviado à API.
- [ ] Revisar custo real, cotas e auditoria antes do uso regular.
- [ ] Registrar a autorização institucional de segurança e publicação.

**Arquivos:** auth-config.js, auth-guard.js, index.html, dashboard-cpc.html, ia-cpc.html, supabase/functions/ia-cpc/index.ts, testes e este documento. Sem migrações ou alterações no banco de dados de produção.
