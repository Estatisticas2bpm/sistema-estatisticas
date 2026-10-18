# Modo TV do CPC — suspensão temporária (18/10/2026)

**Situação:** desabilitado para todos os perfis, inclusive ADMIN, por decisão de produto.

## Motivo

O Comando de Policiamento da Capital reúne unidades com atividades distintas. A apresentação
institucional definitiva deve ser definida **após cada unidade possuir pelo menos três meses
de registros operacionais ou de produtividade especializada**, permitindo escolher indicadores
e gráficos representativos a partir de dados reais.

A referência inicial para revisão é **janeiro de 2027**, aproximadamente três meses depois
da suspensão. **Não existe reativação automática por data**: o sistema continuará com Modo TV
desabilitado até uma nova decisão e homologação.

## Escopo técnico da suspensão

- O botão *Modo TV — CPC* foi removido dos atalhos em `index.html`.
- `auth-config.js` não atribui a permissão `tv` a nenhum perfil.
- `auth-guard.js` nega a permissão `tv` incondicionalmente, inclusive a ADMIN.
- O mapeamento de páginas continua presente para bloquear acesso direto a
  `modo-tv.html`, `painel-tv.html` e `mapa-tv.html`.
- Os arquivos de apresentação, mapa, gráficos, consultas e identidade visual foram
  **preservados**, sem alterações no banco ou nos módulos operacionais.
- Não substituir a logo durante o período de suspensão; revisar a identidade visual
  junto ao layout definitivo.

## Critérios antes de reativar

1. Confirmar ao menos **três meses de registros por unidade ativa**, respeitando a
   natureza de cada serviço (BOs, abordagens, autos, fiscalização, guarda, patrulhamento
   montado, operações especializadas etc.).
2. Validar completude, consistência, autoria, datas e identificação das unidades
   e subunidades; verificar duplicidades e períodos sem registros.
3. Conferir os indicadores consolidados com os dashboards homologados do SIE-CPC.
4. Definir o layout trimestral e os gráficos com base nos dados disponíveis, priorizando
   clareza para televisão e divulgação institucional sem exposição de dados pessoais.
5. Homologar controles de acesso, atualização automática, desempenho e exibição contínua.
6. Apenas após autorização, reintroduzir o atalho na página inicial, habilitar
   `tv` aos perfis apropriados em `auth-config.js` e substituir a negação
   temporária em `auth-guard.js` pela política de acesso definida.

A suspensão não afeta o **Dashboard Completo**, o **Mapa Criminal**, o **painel geral**
nem a operação diária das unidades.
