// Monta o feed da tela inicial: posts, medalhas dadas por professores e
// conquistas desbloqueadas pelos alunos, tudo misturado do mais novo para o mais antigo.
const db = require('./db');
const { CONQUISTAS } = require('./regras');

const COMENTARIOS_NO_FEED = 2; // últimos comentários mostrados embaixo de cada post

const SQL_POST = `
SELECT p.*, u.nome, u.avatar, u.papel, u.curso,
  (SELECT COUNT(*) FROM curtidas c WHERE c.post_id = p.id) AS n_curtidas,
  (SELECT COUNT(*) FROM comentarios c WHERE c.post_id = p.id) AS n_comentarios,
  EXISTS (SELECT 1 FROM curtidas c WHERE c.post_id = p.id AND c.usuario_id = ?) AS curti
FROM posts p JOIN usuarios u ON u.id = p.usuario_id`;

// Em caso de empate no horário, a conquista aparece acima do post que a gerou.
const SQL_ITENS = `
SELECT tipo, id FROM (
  SELECT 'post' AS tipo, id, criado_em, 2 AS ordem FROM posts
  UNION ALL
  SELECT 'medalha', id, criado_em, 1 FROM medalhas
  UNION ALL
  SELECT 'conquista', ca.id, ca.criado_em, 0 FROM conquistas_alunos ca
    JOIN usuarios u ON u.id = ca.aluno_id
    WHERE ca.anunciar = 1 AND u.papel = 'aluno'
)
ORDER BY criado_em DESC, ordem, id DESC
LIMIT ? OFFSET ?`;

const porId = (linhas) => new Map(linhas.map((l) => [l.id, l]));
const lista = (ids) => JSON.stringify(ids);

function carregarPosts(ids, usuarioId) {
  if (ids.length === 0) return new Map();
  const posts = db.prepare(`${SQL_POST} WHERE p.id IN (SELECT value FROM json_each(?))`).all(usuarioId, lista(ids));
  // Últimos comentários de cada post, numa consulta só.
  const comentarios = db
    .prepare(
      `SELECT * FROM (
         SELECT c.*, u.nome, u.papel, ROW_NUMBER() OVER (PARTITION BY c.post_id ORDER BY c.id DESC) AS n
         FROM comentarios c JOIN usuarios u ON u.id = c.usuario_id
         WHERE c.post_id IN (SELECT value FROM json_each(?))
       ) WHERE n <= ? ORDER BY id`,
    )
    .all(lista(ids), COMENTARIOS_NO_FEED);
  for (const p of posts) p.ultimos_comentarios = comentarios.filter((c) => c.post_id === p.id);
  return porId(posts);
}

function carregarMedalhas(ids) {
  if (ids.length === 0) return new Map();
  return porId(
    db
      .prepare(
        `SELECT m.id, m.mensagem, m.criado_em, m.aluno_id AS usuario_id, a.nome, a.avatar, a.papel, a.curso,
           t.nome AS medalha, t.emoji, t.pontos, m.professor_id, pr.nome AS professor_nome
         FROM medalhas m JOIN usuarios a ON a.id = m.aluno_id JOIN tipos_medalha t ON t.id = m.tipo_id
         LEFT JOIN usuarios pr ON pr.id = m.professor_id
         WHERE m.id IN (SELECT value FROM json_each(?))`,
      )
      .all(lista(ids)),
  );
}

function carregarConquistas(ids) {
  if (ids.length === 0) return new Map();
  const linhas = db
    .prepare(
      `SELECT ca.id, ca.conquista, ca.criado_em, ca.aluno_id AS usuario_id, u.nome, u.avatar, u.papel, u.curso
       FROM conquistas_alunos ca JOIN usuarios u ON u.id = ca.aluno_id
       WHERE ca.id IN (SELECT value FROM json_each(?))`,
    )
    .all(lista(ids));
  // Junta com os dados da conquista (emoji, nome, bônus). Conquistas que saíram das regras somem.
  return porId(linhas.map((l) => ({ ...l, info: CONQUISTAS.find((c) => c.id === l.conquista) })).filter((l) => l.info));
}

// Retorna { itens, temMais }. Cada item é { tipo: 'post' | 'medalha' | 'conquista', dados }.
function pagina({ usuarioId, pagina, porPagina }) {
  const linhas = db.prepare(SQL_ITENS).all(porPagina + 1, (pagina - 1) * porPagina);
  const temMais = linhas.length > porPagina;
  const itens = linhas.slice(0, porPagina);
  const ids = (tipo) => itens.filter((i) => i.tipo === tipo).map((i) => i.id);
  const dados = {
    post: carregarPosts(ids('post'), usuarioId),
    medalha: carregarMedalhas(ids('medalha')),
    conquista: carregarConquistas(ids('conquista')),
  };
  return {
    itens: itens.map((i) => ({ tipo: i.tipo, dados: dados[i.tipo].get(i.id) })).filter((i) => i.dados),
    temMais,
  };
}

module.exports = { SQL_POST, pagina };
