# Maxx

A rede social da **UniMax**: um "Instagram" só para alunos e professores da faculdade, com pontos, medalhas, ranking e mural de avisos.

## O que tem

- **Feed** com posts de foto e/ou texto, curtidas e comentários (dá para comentar direto no feed), e cartões comemorando as **medalhas** e **conquistas** dos alunos (sem stories, vídeos ou mensagens).
- **Acesso restrito**: só e-mails `@unimax.edu.br` conseguem criar conta.
- **Pontos e conquistas**: quem posta, comenta e recebe curtidas ganha pontos, e desbloqueia conquistas com bônus.
- **Troféus**: cada aluno tem uma tela de troféus, estilo conquistas de jogo, com as conquistas e medalhas que já ganhou, as que faltam e quanto falta para cada uma (abre pelo botão "Ver troféus" do perfil).
- **Medalhas de professores**: professores entregam medalhas (com mensagem) que valem pontos.
- **Ranking geral e por curso** (só alunos participam): abas para o geral e cada curso, pódio dos 3 primeiros, a sua posição no geral e no curso com quanto falta para passar o colega da frente, e os líderes de cada curso.
- **Mural de avisos**: a faculdade e os professores publicam avisos, e todos leem. Cada aviso mostra quem publicou, e o ícone do Mural mostra quantos avisos novos a pessoa ainda não viu. Só a faculdade fixa avisos no topo. Cada professor apaga só os próprios avisos, e a faculdade pode apagar qualquer um.
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

Quem se cadastra com e-mail `@prof.unieduk.com.br` já entra como professor (domínios em `DOMINIOS_PROFESSORES`, no `src/config.js`). Para os outros:

1. O professor cria a conta normalmente pelo site.
2. Entre com a conta da faculdade, clique em **Administração**, mude o papel dele para `professor` e salve.

## Colocar no ar

### Azure App Service (como está hoje: https://maxx-guilherme.azurewebsites.net)

O Maxx roda no plano grátis (F1) do Azure for Students, sem cartão. Para mandar uma versão nova do código, rode no PowerShell, dentro desta pasta:

```
powershell -ExecutionPolicy Bypass -File scripts\publicar-azure.ps1
```

- As contas, posts e fotos ficam no Azure em `/home/maxx-dados` e não são apagados ao publicar.
- O plano grátis "cochila" depois de uns 20 minutos sem uso: o primeiro acesso depois disso leva uns 20–30 segundos.
- Cabe por volta de 1 GB de dados (algumas centenas de fotos).
- Configurações (senha do admin, código da banca etc.) ficam no portal do Azure, em **maxx-guilherme → Variáveis de ambiente**.

### Servidor Ubuntu próprio (alternativa)

Com um servidor Ubuntu na nuvem (com HTTP e HTTPS liberados), rode no PowerShell, dentro desta pasta:

```
powershell -ExecutionPolicy Bypass -File scripts\publicar.ps1 -IP <ip-do-servidor> -Chave "<caminho-da-chave-ssh>" -Usuario <usuario-do-servidor>
```

Na primeira vez ele pede a senha da conta da faculdade e o código da banca (opcional). No final mostra o link, no formato `https://maxx.<ip-com-tracos>.sslip.io`.
Para atualizar depois de mudar o código, rode o mesmo comando: as contas, posts e fotos ficam guardados no servidor em `/var/lib/maxx`.

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
src/feed.js     monta o feed (posts, medalhas e conquistas)
src/views.js    telas (HTML)
src/db.js       banco de dados (SQLite, arquivo em dados/maxx.db)
public/         estilo e ícone
test/           teste automático (npm test)
```

Fotos enviadas e o banco de dados ficam na pasta `dados/`. Faça backup dela.
