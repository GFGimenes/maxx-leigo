// Acesso da banca do TCC: permite entrar sem cadastro, com um código de acesso,
// em contas de teste (aluno, professor e faculdade).
//
// Fica DESLIGADO por padrão. Para ligar no dia da apresentação, inicie o app com
// a variável CODIGO_BANCA definida (mínimo 6 caracteres). Ao desligar, as contas
// de teste param de funcionar na hora, mesmo para quem já estava logado.
const crypto = require('node:crypto');
const config = require('./config');
const db = require('./db');

const TAMANHO_MIN_CODIGO = 6;
const MAX_TENTATIVAS = 10; // tentativas erradas por IP...
const JANELA_MS = 15 * 60 * 1000; // ...a cada 15 minutos

const dominio = config.DOMINIOS_PERMITIDOS[0];
const CONTAS = {
  aluno: { nome: 'Banca · Aluno(a)', email: `banca.aluno@${dominio}`, papel: 'aluno', curso: config.CURSOS[0], rotulo: 'Aluno(a)' },
  professor: { nome: 'Banca · Professor(a)', email: `banca.professor@${dominio}`, papel: 'professor', curso: null, rotulo: 'Professor(a)' },
  admin: { nome: 'Banca · Faculdade', email: `banca.faculdade@${dominio}`, papel: 'admin', curso: null, rotulo: 'Faculdade' },
};
const EMAILS = new Set(Object.values(CONTAS).map((c) => c.email));

const ligada = () => String(config.CODIGO_BANCA || '').length >= TAMANHO_MIN_CODIGO;
const ehContaBanca = (email) => EMAILS.has(String(email).toLowerCase());

if (config.CODIGO_BANCA && !ligada()) {
  console.warn(`CODIGO_BANCA ignorado: precisa ter pelo menos ${TAMANHO_MIN_CODIGO} caracteres.`);
}

function codigoConfere(codigo) {
  const h = (s) => crypto.createHash('sha256').update(String(s).trim().toLowerCase()).digest();
  return crypto.timingSafeEqual(h(codigo), h(config.CODIGO_BANCA));
}

// Limite simples de tentativas erradas por IP, para ninguém ficar chutando códigos.
const tentativas = new Map();
function bloqueado(ip) {
  const t = tentativas.get(ip);
  if (!t || Date.now() - t.inicio > JANELA_MS) return false;
  return t.n >= MAX_TENTATIVAS;
}
function registrarErro(ip) {
  const t = tentativas.get(ip);
  if (!t || Date.now() - t.inicio > JANELA_MS) tentativas.set(ip, { n: 1, inicio: Date.now() });
  else t.n++;
}

// Cria a conta de teste se ainda não existir e garante que o papel está certo.
// A senha é inválida de propósito: só dá para entrar por aqui.
function obterConta(perfil) {
  const c = CONTAS[perfil];
  const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(c.email);
  if (existente) {
    db.prepare('UPDATE usuarios SET papel = ? WHERE id = ?').run(c.papel, existente.id);
    return existente.id;
  }
  const r = db
    .prepare('INSERT INTO usuarios (nome, email, senha_hash, papel, curso, bio) VALUES (?, ?, ?, ?, ?, ?)')
    .run(c.nome, c.email, '!', c.papel, c.curso, 'Conta de teste da banca do TCC');
  return Number(r.lastInsertRowid);
}

// Retorna { usuarioId } se deu certo, ou { erro } com a mensagem para mostrar.
function entrar({ codigo, perfil, ip }) {
  if (!Object.hasOwn(CONTAS, perfil)) return { erro: 'Escolha um perfil para entrar.' };
  if (bloqueado(ip)) return { erro: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' };
  if (!codigoConfere(codigo)) {
    registrarErro(ip);
    return { erro: 'Código de acesso incorreto.' };
  }
  return { usuarioId: obterConta(perfil) };
}

module.exports = { CONTAS, ligada, ehContaBanca, entrar };
