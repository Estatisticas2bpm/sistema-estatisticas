# Sincronizador central Google Apps Script — CPC/PMRR

Arquivo principal: `sincronizador-cpc.gs`.

## O que ele faz

O script consulta a Edge Function `google-sheets-sync` em modo multiunidade. Cada evento já chega com a unidade responsável e com o ID da planilha correta. O script abre exatamente essa planilha, faz upsert pelo `sync_id` e só envia `ack` depois da gravação bem-sucedida.

Eventos de exclusão removem a linha correspondente da planilha pelo mesmo `sync_id`.

## Segredo

O valor de `SYNC_SECRET` não deve ser colocado no código-fonte. Ele deve permanecer em **Configurações do projeto > Propriedades do script** no Apps Script.

## Implantação

1. Abrir o projeto Apps Script que hoje executa a sincronização do 2º BPM.
2. Fazer backup do código atual.
3. Substituir/adaptar o código pela versão `sincronizador-cpc.gs`.
4. Preservar o segredo existente em `SYNC_SECRET`.
5. Executar `instalarGatilhoSincronizacaoCpc()` uma vez.
6. Manter somente uma rotina central de sincronização.
7. Confirmar o 2º BPM antes de habilitar uma segunda integração.

## Regra de segurança do backend

Enquanto existir somente uma integração ativa, o sincronizador antigo continua aceito por compatibilidade.

Quando houver duas ou mais integrações ativas, chamadas antigas sem roteamento recebem HTTP 409. A versão central deve usar `routing_mode: "multi"`, o que impede mistura silenciosa de dados entre unidades.

## Antes de ativar o 1º BPM

- validar que a planilha do 2º BPM continua recebendo apenas eventos do 2º BPM;
- criar a planilha do 1º BPM;
- cadastrar sua integração inicialmente inativa;
- implantar este sincronizador central;
- ativar a integração do 1º BPM;
- só então liberar a unidade e remover as travas temporárias do banco.
