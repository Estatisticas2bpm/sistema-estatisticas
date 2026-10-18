# Google Sheets multiunidade — arquitetura da Fase 3D-D


## Estado final — 18/10/2026: integração inteiramente ENCERRADA

> **Decisão do CPC:** Nenhuma unidade do SIE-CPC utiliza mais Google Sheets
> como destino de dados. Isso inclui o **1º BPM e o 2º BPM**.
> O banco de dados PostgreSQL do Supabase passou a ser a única fonte operacional.

A migração `20261019000000_encerrar_sheets_arquivar_historico_e_liberar_espaco.sql`:

- desativa as duas integrações ainda ativas, sem excluir as planilhas existentes
  na conta Google do proprietário;
- remove os gatilhos que criavam tarefas de saída durante cadastro, edição ou
  exclusão de BOs; as funções históricas ficam inativas, sem afetar outras RPCs;
- registra `sync_status='NAO_APLICAVEL'` para **todas** as ocorrências;
  não houve exclusão de BOs, nem alterações de estatísticas/documentos;
- antes de liberar espaço, **arquiva no schema privado** todos os 11.330 eventos
  em forma compacta (identificador, versão, data, resultado e hash do payload),
  e o payload integral da **última versão de cada um dos 3.316 identificadores**,
  incluindo 34 que não têm BO atual;
- valida os totais do arquivo e esvazia a outbox com `TRUNCATE`, que devolve
  imediatamente suas páginas e índices ao PostgreSQL;
- retira do portal os atalhos de Google Sheets e evita a consulta RPC de planilhas
  durante o login.

**Nota de auditoria:** O arquivo compacto não armazena integralmente os
payloads de cada versão intermediária; preserva seus metadados e hashes,
além do último payload integral por identificador. Antes de reverter esta
decisão, seria preciso redesenhar o fluxo e obter autorização institucional.

**Os trechos abaixo são documentação histórica descontinuada**, e não instruções
para reativar o Google Sheets.

---



> **DECISÃO DEFINITIVA DE 18/10/2026 — CANCELAMENTO DA EXPANSÃO:**
> O SIE-CPC sincroniza dados com Google Sheets **somente do 1º BPM e do 2º BPM**.
> Todas as demais unidades (CIPTUR, GIRO, BOPE e subunidades, CIPA, CIPG,
> Cavalaria e outras) **não utilizam planilha**. Seus dados permanecem
> integralmente no banco Supabase e são acessados pelo próprio site.
> As etapas abaixo sobre adicionar planilhas a outras unidades representam
> planejamento histórico **descontinuado** e não devem ser executadas.

## Política atual, aplicada no banco

- A permissão para envio é restrita aos UUIDs oficiais do **1BPM** e do **2BPM**.
- Os gatilhos de criação, atualização e exclusão de BO **não criam eventos de
  Google Sheets** para nenhuma outra unidade, mesmo se alguém inserir uma
  integração nova acidentalmente.
- Os registros das demais unidades usam `sync_status='NAO_APLICAVEL'`.
  Esse status **não significa erro**: o BO está registrado no Supabase.
- As **202 tarefas históricas pendentes** das unidades sem planilha foram
  reclassificadas para `CANCELADO`, com motivo e data de cancelamento.
  Seus respectivos payloads foram **preservados para auditoria**.
- O sincronizador só recebe eventos dos batalhões com integração ativa,
  mantendo o 1º BPM e o 2º BPM operando normalmente.
- Não limpar manualmente a outbox nem reenviar eventos cancelados.
  Eventual política futura de retenção deve ser precedida por backup e
  homologação independente.

---

## Objetivo

Manter um único banco central e uma única fila de sincronização, mas garantir que cada ocorrência seja enviada somente para a planilha configurada para sua unidade responsável.

## Componentes

- `public.unidades_integracoes`: associa uma unidade à sua planilha de ocorrências.
- `public.google_sheets_sync_outbox.unidade_id`: registra a unidade responsável no momento em que o evento entra na fila.
- `public.claim_google_sheets_sync_batch_v2`: entrega eventos já acompanhados da rota de planilha.
- `google-sheets-sync`: Edge Function que resolve o roteamento antes de liberar eventos.
- `public.obter_planilha_usuario()`: retorna somente a planilha da unidade principal do usuário autenticado.
- O atalho "Planilha de ocorrências" do site deixa de possuir ID fixo no HTML.

## Estado inicial

Somente o 2º BPM possui integração ativa. Sua planilha oficial foi preservada sem alteração estrutural.

Nenhuma segunda unidade foi ativada e nenhuma segunda planilha foi criada nesta fase.

## Compatibilidade com o sincronizador legado

Enquanto existir apenas uma integração Google Sheets ativa, chamadas antigas de `pull` sem rota explícita continuam funcionando para preservar o 2º BPM.

Quando houver duas ou mais integrações ativas, chamadas sem roteamento passam a receber HTTP 409. Isso é proposital: um sincronizador antigo não poderá misturar ocorrências de unidades diferentes.

## Modo multiunidade futuro

O sincronizador central atualizado deverá chamar:

`{ action: "pull", routing_mode: "multi" }`

Cada evento recebido contém:

- `unidade_id`
- `unidade_sigla`
- `google_sheet_id`
- `aba_principal`
- `payload`

O consumidor deverá abrir a planilha indicada por `google_sheet_id` e somente depois confirmar o evento com `ack`.

## Procedimento para adicionar uma nova unidade

1. Criar a planilha da unidade usando o mesmo padrão estrutural aprovado.
2. Cadastrar a nova integração inicialmente como inativa.
3. Atualizar o sincronizador central para o modo multiunidade.
4. Validar que o sincronizador abre a planilha pelo `google_sheet_id` de cada evento.
5. Ativar a integração da nova unidade.
6. Somente depois remover as travas temporárias do 2º BPM e ativar a unidade piloto.
7. Confirmar que eventos de uma unidade nunca aparecem na planilha de outra.

## Critérios de aceite antes do primeiro piloto

- 2º BPM continua sincronizando normalmente.
- Eventos da outbox possuem `unidade_id` obrigatório.
- Cada integração ativa possui uma única unidade e uma única planilha.
- O sincronizador antigo é bloqueado automaticamente quando houver mais de uma integração ativa.
- O sincronizador multiunidade roteia pelo `google_sheet_id` entregue pelo backend.
- `ack` é enviado somente após gravação bem-sucedida no destino correto.
- O atalho da planilha no site aponta para a planilha da unidade principal do usuário.
- Nenhuma unidade sem integração ativa recebe eventos da fila.
- Nenhuma segunda unidade é ativada antes desses testes.
