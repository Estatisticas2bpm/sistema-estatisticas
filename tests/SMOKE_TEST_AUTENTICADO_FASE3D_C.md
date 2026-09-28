# Smoke test autenticado — Fase 3D-C

Executar somente com uma sessão autenticada já existente do usuário atual do 2º BPM.

## Checklist

- [ ] Página inicial abre sem erro.
- [ ] Cadastro abre sem erro.
- [ ] Consulta abre e respeita o perfil.
- [ ] Dashboard abre e carrega os dados.
- [ ] Mapa criminal abre.
- [ ] TCO abre.
- [ ] Gerenciamento de usuários abre para ADMIN.
- [ ] Edição de usuário usa seletor de unidade, sem UUID manual.
- [ ] Apenas unidades ativas aparecem como novos destinos.
- [ ] ACOES_SOCIAIS permanece oculta para o 2º BPM.
- [ ] Acesso direto a `acoes.html` é bloqueado para o 2º BPM.
- [ ] Sessão de perfil ativo sem unidade ativa é encerrada e redirecionada para `login.html?erro=unidade-indisponivel`.
- [ ] Console do navegador não apresenta erro relevante.

## Restrições

Não criar usuário apenas para teste.
Não alterar senha.
Não copiar ou registrar token de sessão.
Não ativar outra unidade.
Não remover o CHECK ou o DEFAULT temporários do 2º BPM.
