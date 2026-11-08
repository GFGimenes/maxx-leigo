const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');

const config = require('./config');
const db = require('./db');
const { hashSenha, confereSenha } = require('./senha');
const pontos = require('./pontos');
const banca = require('./banca');
const v = require('./views');

const PASTA_UPLOADS = path.join(config.PASTA_DADOS, 'uploads');
fs.mkdirSync(PASTA_UPLOADS, { recursive: true });

const COOKIE = 'maxx_sessao';
const DURACAO_SESSAO_MS = 30 * 24 * 60 * 60 * 1000;
const POSTS_POR_PAGINA = 20;

// Erro com mensagem que pode ser mostrada ao usuário.
class ErroUsuario extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

// ---------- Upload de imagens ----------
const TIPOS_IMAGEM = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const upload = multer({
  storage: multer.diskStorage({
    destination: PASTA_UPLOADS,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + TIPOS_IMAGEM[file.mimetype]),
  }),
  limits: { fileSize: config.TAMANHO_MAX_IMAGEM_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (TIPOS_IMAGEM[file.mimetype]) cb(null, true);
    else cb(new ErroUsuario('Formato de imagem não suportado. Use JPG, PNG, WEBP ou GIF.'));
  },
});

function apagarArquivo(nome) {
  if (nome) fs.rm(path.join(PASTA_UPLOADS, path.basename(nome)), { force: true }, () => {});
}

// ---------- Sessão ----------
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

function lerCookie(req, nome) {
  for (const parte of (req.headers.cookie || '').split(';')) {
    const [k, ...resto] = parte.trim().split('=');
    if (k === nome) return decodeURIComponent(resto.join('='));
  }
  return null;
}

function iniciarSessao(res, usuarioId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES (?, ?, ?)').run(
    hashToken(token),
    usuarioId,
    Date.now() + DURACAO_SESSAO_MS,
  );
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: DURACAO_SESSAO_MS,
  });
}

// ---------- Helpers ----------
function enviar(req, res, { titulo, ativo, conteudo, status = 200 }) {
  res.status(status).type('html').send(String(v.layout({ usuario: req.usuario, titulo, ativo, conteudo })));
}

function exigeLogin(req, res, next) {
  if (!req.usuario) return res.redirect('/entrar');
  next();
}

const exigePapel = (...papeis) => (req, res, next) => {
  if (!papeis.includes(req.usuario?.papel)) throw new ErroUsuario('Você não tem permissão para fazer isso.', 403);
  next();
};

// Só aceita caminhos internos para evitar redirecionar para outro site.
const caminhoSeguro = (p, padrao = '/') => (typeof p === 'string' && /^\/(?!\/)/.test(p) && !p.includes('\\') ? p : padrao);

const texto = (valor, max) => String(valor ?? '').trim().slice(0, max);
const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ErroUsuario('Página não encontrada.', 404);
  return id;
};

const SQL_POST = `
SELECT p.*, u.nome, u.avatar, u.papel, u.curso,
  (SELECT COUNT(*) FROM curtidas c WHERE c.post_id = p.id) AS n_curtidas,
  (SELECT COUNT(*) FROM comentarios c WHERE c.post_id = p.id) AS n_comentarios,
  EXISTS (SELECT 1 FROM curtidas c WHERE c.post_id = p.id AND c.usuario_id = ?) AS curti
FROM posts p JOIN usuarios u ON u.id = p.usuario_id`;

// ---------- App ----------
const app = express();
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'same-origin');
  const token = lerCookie(req, COOKIE);
  if (token) {
    req.usuario = db
      .prepare('SELECT u.* FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token_hash = ? AND s.expira_em > ?')
      .get(hashToken(token), Date.now());
    // Contas da banca só valem enquanto o acesso da banca estiver ligado.
    if (req.usuario && !banca.ligada() && banca.ehContaBanca(req.usuario.email)) req.usuario = undefined;
  }
  next();
});

// ----- Entrar / cadastrar / sair -----
app.get('/entrar', (req, res) => {
  if (req.usuario) return res.redirect('/');
  enviar(req, res, { titulo: 'Entrar', conteudo: v.telaEntrar({ banca: banca.ligada() }) });
});

app.post('/entrar', (req, res) => {
  const email = texto(req.body.email, 200).toLowerCase();
  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  if (!usuario || !confereSenha(String(req.body.senha || ''), usuario.senha_hash)) {
    return enviar(req, res, { titulo: 'Entrar', status: 401, conteudo: v.telaEntrar({ erro: 'E-mail ou senha incorretos.', email, banca: banca.ligada() }) });
  }
  iniciarSessao(res, usuario.id);
  res.redirect('/');
});

app.get('/cadastrar', (req, res) => {
  if (req.usuario) return res.redirect('/');
  enviar(req, res, { titulo: 'Cadastrar', conteudo: v.telaCadastrar({}) });
});

app.post('/cadastrar', (req, res) => {
  const dados = {
    nome: texto(req.body.nome, 60),
    email: texto(req.body.email, 200).toLowerCase(),
    curso: texto(req.body.curso, 100),
  };
  const senha = String(req.body.senha || '');
  const dominio = dados.email.split('@')[1];
  let erro = null;
  if (dados.nome.length < 2) erro = 'Informe seu nome.';
  else if (!/^[^\s@]+@[^\s@]+$/.test(dados.email) || !config.DOMINIOS_PERMITIDOS.includes(dominio))
    erro = `Use seu e-mail da faculdade (@${config.DOMINIOS_PERMITIDOS.join(', @')}).`;
  else if (!config.CURSOS.includes(dados.curso)) erro = 'Selecione seu curso.';
  else if (senha.length < 8) erro = 'A senha precisa ter pelo menos 8 caracteres.';
  else if (banca.ehContaBanca(dados.email) || db.prepare('SELECT 1 FROM usuarios WHERE email = ?').get(dados.email)) erro = 'Já existe uma conta com esse e-mail.';
  if (erro) return enviar(req, res, { titulo: 'Cadastrar', status: 400, conteudo: v.telaCadastrar({ erro, dados }) });

  const { lastInsertRowid } = db
    .prepare('INSERT INTO usuarios (nome, email, senha_hash, curso) VALUES (?, ?, ?, ?)')
    .run(dados.nome, dados.email, hashSenha(senha), dados.curso);
  iniciarSessao(res, Number(lastInsertRowid));
  res.redirect('/');
});

app.post('/banca', (req, res) => {
  if (!banca.ligada()) return res.redirect('/entrar');
  const r = banca.entrar({ codigo: texto(req.body.codigo, 200), perfil: String(req.body.perfil || ''), ip: req.ip });
  if (r.erro) {
    return enviar(req, res, { titulo: 'Entrar', status: 401, conteudo: v.telaEntrar({ banca: true, erroBanca: r.erro }) });
  }
  iniciarSessao(res, r.usuarioId);
  res.redirect('/');
});

app.post('/sair', (req, res) => {
  const token = lerCookie(req, COOKIE);
  if (token) db.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(hashToken(token));
  res.clearCookie(COOKIE);
  res.redirect('/entrar');
});

// Tudo daqui pra baixo exige login.
app.use(exigeLogin);
app.use('/uploads', express.static(PASTA_UPLOADS, { maxAge: '7d' }));

// ----- Feed -----
app.get('/', (req, res) => {
  const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
  const posts = db
    .prepare(`${SQL_POST} ORDER BY p.id DESC LIMIT ? OFFSET ?`)
    .all(req.usuario.id, POSTS_POR_PAGINA + 1, (pagina - 1) * POSTS_POR_PAGINA);
  const temMais = posts.length > POSTS_POR_PAGINA;
  const avisoFixado = db.prepare('SELECT * FROM avisos WHERE fixado = 1 ORDER BY id DESC LIMIT 1').get();
  enviar(req, res, {
    ativo: 'inicio',
    conteudo: v.feed({ posts: posts.slice(0, POSTS_POR_PAGINA), avisoFixado, pagina, temMais }),
  });
});

// ----- Posts -----
app.get('/novo', (req, res) => enviar(req, res, { titulo: 'Novo post', ativo: 'novo', conteudo: v.novoPost({}) }));

app.post('/posts', upload.single('imagem'), (req, res) => {
  const legenda = texto(req.body.legenda, 2200);
  const imagem = req.file?.filename || null;
  if (!imagem && !legenda) {
    return enviar(req, res, { titulo: 'Novo post', ativo: 'novo', status: 400, conteudo: v.novoPost({ erro: 'Adicione uma foto ou escreva algo.' }) });
  }
  db.prepare('INSERT INTO posts (usuario_id, imagem, legenda) VALUES (?, ?, ?)').run(req.usuario.id, imagem, legenda);
  res.redirect('/');
});

function buscarPost(req) {
  const post = db.prepare(`${SQL_POST} WHERE p.id = ?`).get(req.usuario.id, idParam(req));
  if (!post) throw new ErroUsuario('Esse post não existe mais.', 404);
  return post;
}

app.get('/posts/:id', (req, res) => {
  const post = buscarPost(req);
  const comentarios = db
    .prepare(
      `SELECT c.*, u.nome, u.avatar, u.papel FROM comentarios c JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.post_id = ? ORDER BY c.id`,
    )
    .all(post.id);
  enviar(req, res, { titulo: `Post de ${post.nome}`, conteudo: v.postDetalhe({ post, comentarios, usuario: req.usuario }) });
});

app.post('/posts/:id/curtir', (req, res) => {
  const post = buscarPost(req);
  if (post.curti) db.prepare('DELETE FROM curtidas WHERE post_id = ? AND usuario_id = ?').run(post.id, req.usuario.id);
  else db.prepare('INSERT OR IGNORE INTO curtidas (post_id, usuario_id) VALUES (?, ?)').run(post.id, req.usuario.id);
  res.redirect(`${caminhoSeguro(req.body.voltar)}#post-${post.id}`);
});

app.post('/posts/:id/comentar', (req, res) => {
  const post = buscarPost(req);
  const t = texto(req.body.texto, 500);
  if (t) db.prepare('INSERT INTO comentarios (post_id, usuario_id, texto) VALUES (?, ?, ?)').run(post.id, req.usuario.id, t);
  res.redirect(`/posts/${post.id}#comentar`);
});

app.post('/posts/:id/apagar', (req, res) => {
  const post = buscarPost(req);
  if (post.usuario_id !== req.usuario.id && req.usuario.papel !== 'admin') throw new ErroUsuario('Você não pode apagar este post.', 403);
  db.prepare('DELETE FROM posts WHERE id = ?').run(post.id);
  apagarArquivo(post.imagem);
  res.redirect(`/u/${post.usuario_id}`);
});

app.post('/comentarios/:id/apagar', (req, res) => {
  const c = db.prepare('SELECT * FROM comentarios WHERE id = ?').get(idParam(req));
  if (!c) throw new ErroUsuario('Comentário não encontrado.', 404);
  if (c.usuario_id !== req.usuario.id && req.usuario.papel !== 'admin') throw new ErroUsuario('Você não pode apagar este comentário.', 403);
  db.prepare('DELETE FROM comentarios WHERE id = ?').run(c.id);
  res.redirect(`/posts/${c.post_id}`);
});

// ----- Perfil -----
app.get('/u/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(idParam(req));
  if (!p) throw new ErroUsuario('Usuário não encontrado.', 404);
  const ehAluno = p.papel === 'aluno';
  enviar(req, res, {
    titulo: p.nome,
    ativo: p.id === req.usuario.id ? 'perfil' : '',
    conteudo: v.perfil({
      perfil: p,
      usuario: req.usuario,
      msg: req.query.ok === 'medalha' ? 'Medalha entregue! 🎉' : null,
      stats: ehAluno ? pontos.statsDoAluno(p.id) : null,
      medalhas: ehAluno
        ? db
            .prepare(
              `SELECT m.*, t.nome, t.emoji, t.pontos, pr.nome AS professor_nome FROM medalhas m
               JOIN tipos_medalha t ON t.id = m.tipo_id LEFT JOIN usuarios pr ON pr.id = m.professor_id
               WHERE m.aluno_id = ? ORDER BY m.id DESC`,
            )
            .all(p.id)
        : [],
      medalhasDadas: p.papel === 'professor' ? db.prepare('SELECT COUNT(*) AS n FROM medalhas WHERE professor_id = ?').get(p.id).n : 0,
      tiposMedalha: db.prepare('SELECT * FROM tipos_medalha ORDER BY pontos DESC').all(),
      posts: db.prepare('SELECT id, imagem, legenda FROM posts WHERE usuario_id = ? ORDER BY id DESC').all(p.id),
    }),
  });
});

app.post('/u/:id/medalha', exigePapel('professor'), (req, res) => {
  const aluno = db.prepare("SELECT * FROM usuarios WHERE id = ? AND papel = 'aluno'").get(idParam(req));
  if (!aluno) throw new ErroUsuario('Medalhas só podem ser dadas para alunos.');
  const tipo = db.prepare('SELECT * FROM tipos_medalha WHERE id = ?').get(Number(req.body.tipo_id));
  if (!tipo) throw new ErroUsuario('Escolha uma medalha válida.');
  db.prepare('INSERT INTO medalhas (aluno_id, professor_id, tipo_id, mensagem) VALUES (?, ?, ?, ?)').run(
    aluno.id,
    req.usuario.id,
    tipo.id,
    texto(req.body.mensagem, 200),
  );
  res.redirect(`/u/${aluno.id}?ok=medalha`);
});

app.get('/perfil/editar', (req, res) =>
  enviar(req, res, { titulo: 'Editar perfil', ativo: 'perfil', conteudo: v.editarPerfil({ usuario: req.usuario }) }),
);

app.post('/perfil/editar', upload.single('avatar'), (req, res) => {
  const nome = texto(req.body.nome, 60);
  const bio = texto(req.body.bio, 300);
  let curso = req.usuario.curso;
  if (req.usuario.papel !== 'admin') curso = texto(req.body.curso, 100);
  let erro = null;
  if (nome.length < 2) erro = 'Informe seu nome.';
  else if (req.usuario.papel !== 'admin' && !config.CURSOS.includes(curso)) erro = 'Selecione um curso válido.';
  if (erro) {
    apagarArquivo(req.file?.filename);
    return enviar(req, res, { titulo: 'Editar perfil', ativo: 'perfil', status: 400, conteudo: v.editarPerfil({ usuario: req.usuario, erro }) });
  }
  const avatar = req.file ? req.file.filename : req.usuario.avatar;
  db.prepare('UPDATE usuarios SET nome = ?, bio = ?, curso = ?, avatar = ? WHERE id = ?').run(nome, bio, curso, avatar, req.usuario.id);
  if (req.file) apagarArquivo(req.usuario.avatar);
  res.redirect(`/u/${req.usuario.id}`);
});

// ----- Ranking -----
app.get('/ranking', (req, res) => {
  const curso = config.CURSOS.includes(req.query.curso) ? req.query.curso : '';
  enviar(req, res, {
    titulo: 'Ranking',
    ativo: 'ranking',
    conteudo: v.ranking({
      lista: pontos.ranking(curso),
      curso,
      usuario: req.usuario,
      tiposMedalha: db.prepare('SELECT * FROM tipos_medalha ORDER BY pontos DESC').all(),
    }),
  });
});

// ----- Mural -----
const listarAvisos = () => db.prepare('SELECT * FROM avisos ORDER BY fixado DESC, id DESC').all();

app.get('/mural', (req, res) =>
  enviar(req, res, { titulo: 'Mural', ativo: 'mural', conteudo: v.mural({ avisos: listarAvisos(), usuario: req.usuario }) }),
);

app.post('/mural', exigePapel('admin'), (req, res) => {
  const titulo = texto(req.body.titulo, 120);
  const t = texto(req.body.texto, 5000);
  if (!titulo || !t) {
    return enviar(req, res, {
      titulo: 'Mural',
      ativo: 'mural',
      status: 400,
      conteudo: v.mural({ avisos: listarAvisos(), usuario: req.usuario, erro: 'Preencha o título e o aviso.' }),
    });
  }
  db.prepare('INSERT INTO avisos (autor_id, titulo, texto, fixado) VALUES (?, ?, ?, ?)').run(req.usuario.id, titulo, t, req.body.fixado ? 1 : 0);
  res.redirect('/mural');
});

app.post('/mural/:id/fixar', exigePapel('admin'), (req, res) => {
  db.prepare('UPDATE avisos SET fixado = 1 - fixado WHERE id = ?').run(idParam(req));
  res.redirect('/mural');
});

app.post('/mural/:id/apagar', exigePapel('admin'), (req, res) => {
  db.prepare('DELETE FROM avisos WHERE id = ?').run(idParam(req));
  res.redirect('/mural');
});

// ----- Administração -----
app.get('/admin', exigePapel('admin'), (req, res) => {
  const busca = texto(req.query.q, 100);
  const like = `%${busca}%`;
  const usuarios = db
    .prepare(
      `SELECT * FROM usuarios WHERE nome LIKE ? OR email LIKE ?
       ORDER BY CASE papel WHEN 'admin' THEN 0 WHEN 'professor' THEN 1 ELSE 2 END, nome LIMIT 200`,
    )
    .all(like, like);
  enviar(req, res, { titulo: 'Administração', conteudo: v.admin({ usuarios, usuario: req.usuario, busca }) });
});

app.post('/admin/usuarios/:id/papel', exigePapel('admin'), (req, res) => {
  const id = idParam(req);
  const papel = req.body.papel;
  if (!['aluno', 'professor', 'admin'].includes(papel)) throw new ErroUsuario('Papel inválido.');
  if (id === req.usuario.id) throw new ErroUsuario('Você não pode mudar o seu próprio papel.');
  db.prepare('UPDATE usuarios SET papel = ? WHERE id = ?').run(papel, id);
  res.redirect('/admin');
});

// ----- Erros -----
app.use((req, res) => enviar(req, res, { titulo: 'Não encontrado', status: 404, conteudo: v.erro('Página não encontrada.') }));

app.use((err, req, res, next) => {
  if (req.file) apagarArquivo(req.file.filename);
  let mensagem = 'Algo deu errado. Tente de novo.';
  let status = 500;
  if (err instanceof ErroUsuario) {
    mensagem = err.message;
    status = err.status;
  } else if (err instanceof multer.MulterError) {
    status = 400;
    mensagem = err.code === 'LIMIT_FILE_SIZE' ? `A imagem é grande demais (máximo ${config.TAMANHO_MAX_IMAGEM_MB} MB).` : 'Não foi possível enviar a imagem.';
  } else {
    console.error(err);
  }
  enviar(req, res, { titulo: 'Ops', status, conteudo: v.erro(mensagem) });
});

module.exports = app;
