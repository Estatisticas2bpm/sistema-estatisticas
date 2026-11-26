# Catálogo PPE por descrição e fundamento

O código operacional continua único quando existe. A descrição integral normalizada e a fundamentação compatível identificam a natureza; tentativa, consumação, qualificadores e artigos distintos não são removidos para encontrar equivalências. Um código documental repetido pode aparecer em fontes de naturezas distintas. O primeiro titular operacional mantém seu código.

- `naturezas_ppe_fontes` registra código de origem (inclusive ausência), descrição, fundamento, vínculo e datas de primeira e última leitura. A chave documental deduplica reenvios. Fontes sem correspondência segura ficam sem vínculo e visíveis para revisão administrativa.
- O BO mantém a evidência em `ppe_naturezas_originais`; o gatilho de inserção usa o UUID confirmado pela RPC, nunca o código isolado. O contador continua somando BOs distintos efetivamente vinculados.
- O formulário só preenche a opção retornada pelo catálogo atual ou um subtipo institucional comprovado por contexto explícito, descrição, fundamento e código. O formulário e os botões (+) continuam editáveis. Quando não for possível atribuir meios diferentes a dois subtipos do mesmo pai, usa a opção direta separada se disponível; caso contrário, sinaliza conferência sem misturar os meios.
- A migração não atualiza BOs, vínculos anteriores ou status antigos. Promove pontualmente a descrição consumada de importunação sexual somente se a divergência exata já estiver documentada no catálogo. Não reativa o registro em quarentena do titular do código 20210.

## Validação

- `node --test tests/ppe-identidade-documental.test.cjs tests/ppe-catalogo-naturezas.test.js`.
- `node scripts/test-ppe-identidade-postgres.cjs`, usando `@electric-sql/pglite` **0.3.14** ou apontando `PPE_PGLITE_PATH` para o `dist/index.cjs` dessa versão. O teste executa a migração num PostgreSQL embarcado, usando trechos das migrações anteriores e perfis isolados; nunca conecta à produção.
- Na implantação, comparar a quantidade e os resumos criptográficos dos BOs e vínculos preexistentes antes/depois, verificar RLS e concessões, e confirmar a disponibilidade do tipo 20210 consumado sem código operacional duplicado.
- Os testes de extração usam trechos das seções descritas no chamado, não os PDFs oficiais. A homologação deve importar esses PDFs em sessão autorizada e conferir o rascunho, sem criar BOs fictícios.

## Reversão

Aplicar a migração em uma única transação; erros de validação ou de bloqueio abortam a alteração. Se o problema for apenas visual após a publicação, reverter os arquivos do frontend e manter a estrutura aditiva do banco para não perder fontes e vínculos novos. Não restaurar a RPC antiga por código depois de aceitar variantes: isso reintroduziria associações incorretas e deixaria de aceitar BOs sem código. Eventuais correções no banco devem ser feitas por migração de avanço preservando IDs, evidências e auditoria.
