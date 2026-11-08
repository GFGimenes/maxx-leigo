// Testa os fluxos principais do Maxx num banco temporário.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'maxx-teste-'));
process.env.MAXX_DADOS = pasta;
process.env.ADMIN_SENHA = 'senha-admin-teste';
process.env.CODIGO_BANCA = 'banca-teste';

const app = require('../src/app');
let servidor;
let base;

before(async () => {
  await new Promise((ok) => {
    servidor = app.listen(0, ok);
  });
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => {
  servidor.close();
  require('../src/db').close();
  fs.rmSync(pasta, { recursive: true, force: true });
});

// Cliente simples que guarda o cookie de sessão.
function cliente() {
  let cookie = '';
  async function req(metodo, caminho, corpo) {
    const opcoes = { method: metodo, redirect: 'manual', headers: { cookie } };
    if (corpo instanceof FormData) opcoes.body = corpo;
    else if (corpo) {
      opcoes.body = new URLSearchParams(corpo);
      opcoes.headers['content-type'] = 'application/x-www-form-urlencoded';
    }
    const r = await fetch(base + caminho, opcoes);
    const setCookie = r.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: r.status, local: r.headers.get('location'), html: await r.text() };
  }
  return { get: (c) => req('GET', c), post: (c, corpo) => req('POST', c, corpo) };
}

async function cadastrar(nome, email, curso) {
  const c = cliente();
  const r = await c.post('/cadastrar', { nome, email, curso, senha: 'senha12345' });
  assert.equal(r.status, 302, `cadastro de ${email} falhou`);
  return c;
}

test('fluxo completo', async () => {
  // Sem login, vai para a tela de entrar.
  const anon = cliente();
  assert.equal((await anon.get('/')).local, '/entrar');
  assert.equal((await anon.get('/ranking')).local, '/entrar');

  // E-mail de fora da faculdade é recusado.
  const fora = await anon.post('/cadastrar', { nome: 'Fulano', email: 'fulano@gmail.com', curso: 'Direito', senha: 'senha12345' });
  assert.equal(fora.status, 400);
  assert.match(fora.html, /e-mail da faculdade/);

  const ana = await cadastrar('Ana Souza', 'ana@unimax.edu.br', 'Direito');
  const bruno = await cadastrar('Bruno Lima', 'bruno@unimax.edu.br', 'Psicologia');
  const prof = await cadastrar('Prof. Carla', 'carla@unimax.edu.br', 'Direito');

  // E-mail repetido é recusado.
  const repetido = await anon.post('/cadastrar', { nome: 'Ana', email: 'ANA@unimax.edu.br', curso: 'Direito', senha: 'senha12345' });
  assert.match(repetido.html, /Já existe uma conta/);

  // Ana publica um post de texto e um com imagem.
  assert.equal((await ana.post('/posts', { legenda: 'Primeiro dia de aula! <script>alert(1)</script>' })).status, 302);
  const form = new FormData();
  form.append('legenda', 'Foto do campus');
  form.append('imagem', new Blob([Buffer.from('89504e470d0a1a0a', 'hex')], { type: 'image/png' }), 'foto.png');
  assert.equal((await ana.post('/posts', form)).status, 302);

  // Arquivo que não é imagem é recusado.
  const ruim = new FormData();
  ruim.append('imagem', new Blob(['oi'], { type: 'text/html' }), 'x.html');
  assert.equal((await ana.post('/posts', ruim)).status, 400);

  // O feed mostra o post e o conteúdo está escapado (sem XSS).
  const feed = await bruno.get('/');
  assert.match(feed.html, /Primeiro dia de aula!/);
  assert.ok(!feed.html.includes('<script>alert(1)</script>'));
  assert.match(feed.html, /&lt;script&gt;/);

  // Bruno curte e comenta os posts da Ana.
  await bruno.post('/posts/1/curtir', { voltar: '/' });
  await bruno.post('/posts/2/curtir', { voltar: 'https://site-malicioso.com' }).then((r) => assert.equal(r.local, '/#post-2'));
  await bruno.post('/posts/1/comentar', { texto: 'Bem-vinda!' });
  await bruno.post('/posts/1/comentar', { texto: 'Comentário repetido não soma pontos de novo' });
  // Curtir o próprio post não dá pontos.
  await ana.post('/posts/1/curtir', { voltar: '/' });

  // Aluno não pode dar medalha nem postar no mural.
  assert.equal((await bruno.post('/u/2/medalha', { tipo_id: '1' })).status, 403);
  assert.equal((await bruno.post('/mural', { titulo: 'x', texto: 'y' })).status, 403);
  assert.equal((await bruno.get('/admin')).status, 403);

  // A faculdade entra, promove a Carla a professora e publica um aviso fixado.
  const admin = cliente();
  assert.equal((await admin.post('/entrar', { email: 'admin@unimax.edu.br', senha: 'senha-admin-teste' })).status, 302);
  assert.equal((await admin.post('/admin/usuarios/4/papel', { papel: 'professor' })).status, 302);
  await admin.post('/mural', { titulo: 'Semana de provas', texto: 'Provas de 10 a 14/11.', fixado: '1' });
  assert.match((await ana.get('/')).html, /Semana de provas/);
  assert.match((await ana.get('/mural')).html, /Provas de 10 a 14\/11/);

  // Professora dá medalha para a Ana (id 2) e não pode dar para outra professora.
  assert.equal((await prof.post('/u/2/medalha', { tipo_id: '1', mensagem: 'Excelente seminário' })).local, '/u/2?ok=medalha');
  assert.equal((await prof.post('/u/4/medalha', { tipo_id: '1' })).status, 400);

  // Pontos da Ana: 2 posts (20) + 2 curtidas de outros (4) + medalha Excelência (50)
  //              + conquistas Primeiro clique (20) e Medalhista (20) = 114
  // Pontos do Bruno: 1 post comentado (3).
  const ranking = await ana.get('/ranking');
  assert.match(ranking.html, /Ana Souza[\s\S]*114[\s\S]*Bruno Lima[\s\S]*3 <small>pts/);
  const perfil = await ana.get('/u/2');
  assert.match(perfil.html, /114<\/strong><span>pontos/);
  assert.match(perfil.html, /Excelente seminário/);

  // Ranking por curso: Psicologia só tem o Bruno; professores não aparecem.
  const psico = await ana.get('/ranking?curso=Psicologia');
  assert.match(psico.html, /Bruno Lima/);
  assert.ok(!psico.html.includes('Ana Souza'));
  assert.ok(!ranking.html.includes('Prof. Carla</strong>'));

  // Bruno não pode apagar post da Ana; a Ana pode.
  assert.equal((await bruno.post('/posts/1/apagar')).status, 403);
  assert.equal((await ana.post('/posts/1/apagar')).status, 302);
  assert.equal((await ana.get('/posts/1')).status, 404);

  // Sair encerra a sessão.
  await ana.post('/sair');
  assert.equal((await ana.get('/')).local, '/entrar');
});

test('acesso da banca', async () => {
  const config = require('../src/config');
  const anon = cliente();

  // A tela de entrar mostra a caixa da banca.
  assert.match((await anon.get('/entrar')).html, /Banca do TCC/);

  // Código errado não entra.
  const errado = await anon.post('/banca', { codigo: 'chute', perfil: 'aluno' });
  assert.equal(errado.status, 401);
  assert.match(errado.html, /Código de acesso incorreto/);

  // Com o código certo, entra como aluno, professor ou faculdade (sem ligar para maiúsculas).
  const aluno = cliente();
  assert.equal((await aluno.post('/banca', { codigo: 'Banca-Teste', perfil: 'aluno' })).local, '/');
  assert.equal((await aluno.post('/posts', { legenda: 'Post da banca' })).status, 302);
  const prof = cliente();
  await prof.post('/banca', { codigo: 'banca-teste', perfil: 'professor' });
  const idAluno = require('../src/db').prepare("SELECT id FROM usuarios WHERE email = 'banca.aluno@unimax.edu.br'").get().id;
  assert.equal((await prof.post(`/u/${idAluno}/medalha`, { tipo_id: '1' })).status, 302);
  const fac = cliente();
  await fac.post('/banca', { codigo: 'banca-teste', perfil: 'admin' });
  assert.equal((await fac.get('/admin')).status, 200);

  // Ninguém consegue se cadastrar com o e-mail de uma conta da banca, nem entrar com senha.
  const cad = await anon.post('/cadastrar', { nome: 'Xavier', email: 'banca.aluno@unimax.edu.br', curso: 'Direito', senha: 'senha12345' });
  assert.match(cad.html, /Já existe uma conta/);
  assert.equal((await anon.post('/entrar', { email: 'banca.aluno@unimax.edu.br', senha: '!' })).status, 401);

  // Desligando o acesso da banca, a caixa some e as sessões da banca param de valer.
  config.CODIGO_BANCA = '';
  assert.ok(!(await anon.get('/entrar')).html.includes('Banca do TCC'));
  assert.equal((await aluno.get('/')).local, '/entrar');
  assert.equal((await anon.post('/banca', { codigo: 'banca-teste', perfil: 'aluno' })).local, '/entrar');
});
