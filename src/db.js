const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');
const { MEDALHAS_PADRAO } = require('./regras');
const { hashSenha } = require('./senha');

fs.mkdirSync(config.PASTA_DADOS, { recursive: true });
const db = new DatabaseSync(path.join(config.PASTA_DADOS, 'maxx.db'));

db.exec(`
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'aluno' CHECK (papel IN ('aluno', 'professor', 'admin')),
  curso TEXT,
  bio TEXT NOT NULL DEFAULT '',
  avatar TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessoes (
  token_hash TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_em INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  imagem TEXT,
  legenda TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_posts_usuario ON posts(usuario_id);

CREATE TABLE IF NOT EXISTS curtidas (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS comentarios (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comentarios_post ON comentarios(post_id);

CREATE TABLE IF NOT EXISTS tipos_medalha (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  emoji TEXT NOT NULL,
  pontos INTEGER NOT NULL,
  descricao TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS medalhas (
  id INTEGER PRIMARY KEY,
  aluno_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  professor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo_id INTEGER NOT NULL REFERENCES tipos_medalha(id),
  mensagem TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_medalhas_aluno ON medalhas(aluno_id);

-- Quando cada aluno desbloqueou cada conquista (para mostrar no feed).
-- anunciar = 0: conquista antiga, registrada sem aparecer no feed.
CREATE TABLE IF NOT EXISTS conquistas_alunos (
  id INTEGER PRIMARY KEY,
  aluno_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  conquista TEXT NOT NULL,
  anunciar INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (aluno_id, conquista)
);

CREATE INDEX IF NOT EXISTS idx_posts_data ON posts(criado_em);
CREATE INDEX IF NOT EXISTS idx_medalhas_data ON medalhas(criado_em);

CREATE TABLE IF NOT EXISTS avisos (
  id INTEGER PRIMARY KEY,
  autor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL,
  fixado INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Dados iniciais: tipos de medalha e conta da faculdade.
if (db.prepare('SELECT COUNT(*) AS n FROM tipos_medalha').get().n === 0) {
  const inserir = db.prepare('INSERT INTO tipos_medalha (nome, emoji, pontos, descricao) VALUES (?, ?, ?, ?)');
  for (const m of MEDALHAS_PADRAO) inserir.run(m.nome, m.emoji, m.pontos, m.descricao);
}

if (!db.prepare("SELECT 1 FROM usuarios WHERE papel = 'admin'").get()) {
  db.prepare("INSERT INTO usuarios (nome, email, senha_hash, papel, bio) VALUES (?, ?, ?, 'admin', ?)").run(
    config.FACULDADE,
    config.ADMIN_EMAIL,
    hashSenha(config.ADMIN_SENHA),
    'Conta oficial da faculdade',
  );
  console.log(`Conta da faculdade criada: ${config.ADMIN_EMAIL} / senha: ${config.ADMIN_SENHA} (troque depois!)`);
}

module.exports = db;
