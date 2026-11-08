// Cálculo de pontos, conquistas e rankings.
// Tudo é calculado a partir dos dados reais: se um post ou curtida
// for apagado, a pontuação se ajusta sozinha.
const db = require('./db');
const { PONTOS, CONQUISTAS } = require('./regras');

const SQL_STATS = `
SELECT u.id, u.nome, u.curso, u.avatar,
  (SELECT COUNT(*) FROM posts p WHERE p.usuario_id = u.id) AS posts,
  (SELECT COUNT(DISTINCT c.post_id) FROM comentarios c JOIN posts p ON p.id = c.post_id
     WHERE c.usuario_id = u.id AND p.usuario_id <> u.id) AS comentarios,
  (SELECT COUNT(*) FROM curtidas l JOIN posts p ON p.id = l.post_id
     WHERE p.usuario_id = u.id AND l.usuario_id <> u.id) AS curtidas,
  (SELECT COUNT(*) FROM medalhas m WHERE m.aluno_id = u.id) AS medalhas,
  (SELECT COALESCE(SUM(t.pontos), 0) FROM medalhas m JOIN tipos_medalha t ON t.id = m.tipo_id
     WHERE m.aluno_id = u.id) AS pontos_medalhas
FROM usuarios u
WHERE u.papel = 'aluno'`;

function calcular(s) {
  const conquistas = CONQUISTAS.filter((c) => c.atingiu(s));
  const pontosConquistas = conquistas.reduce((soma, c) => soma + c.bonus, 0);
  const total =
    s.posts * PONTOS.post +
    s.comentarios * PONTOS.comentario +
    s.curtidas * PONTOS.curtida +
    s.pontos_medalhas +
    pontosConquistas;
  return { ...s, conquistas, pontos_conquistas: pontosConquistas, total };
}

function ranking(curso) {
  let lista = db.prepare(SQL_STATS).all().map(calcular);
  if (curso) lista = lista.filter((a) => a.curso === curso);
  lista.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
  // Empatados ficam na mesma posição.
  lista.forEach((a, i) => {
    a.posicao = i > 0 && lista[i - 1].total === a.total ? lista[i - 1].posicao : i + 1;
  });
  return lista;
}

function statsDoAluno(id) {
  const row = db.prepare(SQL_STATS + ' AND u.id = ?').get(id);
  if (!row) return null;
  const s = calcular(row);
  s.posicao_geral = ranking().find((a) => a.id === id)?.posicao;
  s.posicao_curso = s.curso ? ranking(s.curso).find((a) => a.id === id)?.posicao : null;
  return s;
}

// Registra as conquistas que o aluno acabou de desbloquear (para aparecerem no feed).
// Conquistas já registradas são ignoradas; se o aluno perder uma depois
// (ex.: apagou posts), o registro fica como histórico.
function registrarConquistas(alunoId, anunciar = true) {
  const row = db.prepare(SQL_STATS + ' AND u.id = ?').get(alunoId);
  if (!row) return;
  const inserir = db.prepare('INSERT OR IGNORE INTO conquistas_alunos (aluno_id, conquista, anunciar) VALUES (?, ?, ?)');
  for (const c of calcular(row).conquistas) inserir.run(alunoId, c.id, anunciar ? 1 : 0);
}

// Na primeira vez com esta versão, registra as conquistas que os alunos já tinham,
// sem anunciar no feed (senão o feed seria inundado de conquistas antigas).
if (db.prepare('PRAGMA user_version').get().user_version < 1) {
  for (const { id } of db.prepare("SELECT id FROM usuarios WHERE papel = 'aluno'").all()) registrarConquistas(id, false);
  db.exec('PRAGMA user_version = 1');
}

module.exports = { ranking, statsDoAluno, registrarConquistas };
