# Google Sheets multiunidade — arquitetura da Fase 3D-D

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
