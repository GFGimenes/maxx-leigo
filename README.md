# Maxx

A rede social da **UniMax**: um "Instagram" só para alunos e professores da faculdade, com pontos, medalhas, ranking e mural de avisos.

## O que tem

- **Feed** com posts de foto e/ou texto, curtidas e comentários (sem stories, vídeos ou mensagens).
- **Acesso restrito**: só e-mails `@unimax.edu.br` conseguem criar conta.
- **Pontos e conquistas**: quem posta, comenta e recebe curtidas ganha pontos, e desbloqueia conquistas com bônus.
- **Medalhas de professores**: professores entregam medalhas (com mensagem) que valem pontos.
- **Ranking geral e por curso** (só alunos participam).
- **Mural** de avisos oficiais da faculdade, com opção de fixar no topo.
- **Administração**: a conta da faculdade define quem é professor ou administrador.

## Como rodar no seu computador

1. Instale o [Node.js](https://nodejs.org) (versão 22.13 ou mais nova).
2. Abra o terminal nesta pasta e rode:
   ```
   npm install
   npm start
   ```
3. Abra **http://localhost:3000** no navegador.

Na primeira vez é criada a conta da faculdade:
**admin@unimax.edu.br** / senha **unimax-admin** (troque definindo a variável `ADMIN_SENHA` antes do primeiro uso).

### Quer ver com conteúdo de exemplo?

Rode `npm run demo` antes do `npm start`. Isso cria alunos, professores, posts, medalhas e avisos.
Todas as contas de exemplo usam a senha `senha1234`, por exemplo:
- aluna: `ana.costa@unimax.edu.br`
- professora: `prof.marina@unimax.edu.br`

### Acesso da banca (dia da apresentação)

Para a banca testar o app sem ter cadastro na faculdade, inicie o Maxx com um **código de acesso** (mínimo 6 caracteres):

```
# PowerShell
$env:CODIGO_BANCA="maxx2026"; npm start

# Mac/Linux
CODIGO_BANCA=maxx2026 npm start
```

A tela de entrar passa a mostrar a caixa **Banca do TCC**: é só digitar o código e escolher entrar como **Aluno(a)**, **Professor(a)** ou **Faculdade** (administração). As contas de teste são criadas sozinhas no primeiro acesso.

- Sem `CODIGO_BANCA`, a caixa não aparece e as contas de teste não funcionam (nem para quem já estava logado).
- As contas de teste não têm senha: só dá para entrar nelas pelo código.
- Depois de 10 códigos errados, o aparelho espera 15 minutos para tentar de novo.
- Dica: rode `npm run demo` antes, para a banca encontrar o app com conteúdo.

### Como liberar um professor

1. O professor cria a conta normalmente pelo site.
2. Entre com a conta da faculdade, clique em **Administração**, mude o papel dele para `professor` e salve.

## Como funcionam os pontos

| Ação | Pontos |
|---|---|
| Publicar um post | +10 |
| Receber uma curtida de outra pessoa | +2 |
| Comentar no post de um colega (conta 1 vez por post) | +3 |
| Medalhas de professores | +20 a +50 |
| Conquistas (primeiro post, 50 curtidas, 5 medalhas…) | +20 a +100 |

Curtir ou comentar o próprio post não dá pontos. Valores, conquistas e medalhas ficam em `src/regras.js`.
Cursos, domínio de e-mail e outras opções ficam em `src/config.js`.

## Estrutura

```
src/config.js   configurações (cursos, domínio, porta)
src/regras.js   pontos, conquistas e medalhas
src/app.js      rotas/páginas do site
src/views.js    telas (HTML)
src/db.js       banco de dados (SQLite, arquivo em dados/maxx.db)
public/         estilo e ícone
test/           teste automático (npm test)
```

Fotos enviadas e o banco de dados ficam na pasta `dados/`. Faça backup dela.
