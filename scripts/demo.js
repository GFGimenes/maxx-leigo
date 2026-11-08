// Preenche o Maxx com dados de exemplo para demonstração.
// Uso: npm run demo   (todas as contas de exemplo usam a senha "senha1234")
const db = require('../src/db');
const { hashSenha } = require('../src/senha');

if (db.prepare("SELECT 1 FROM usuarios WHERE email = 'prof.marina@unimax.edu.br'").get()) {
  console.log('Os dados de exemplo já foram criados.');
  process.exit(0);
}

const senha = hashSenha('senha1234');
const criar = (nome, email, curso, papel = 'aluno', bio = '') =>
  Number(
    db.prepare('INSERT INTO usuarios (nome, email, senha_hash, curso, papel, bio) VALUES (?, ?, ?, ?, ?, ?)').run(nome, email, senha, curso, papel, bio)
      .lastInsertRowid,
  );

const marina = criar('Marina Albuquerque', 'prof.marina@unimax.edu.br', 'Ciência da Computação', 'professor', 'Professora de Algoritmos');
const roberto = criar('Roberto Nunes', 'prof.roberto@unimax.edu.br', 'Direito', 'professor', 'Professor de Direito Civil');
const alunos = [
  criar('Ana Beatriz Costa', 'ana.costa@unimax.edu.br', 'Ciência da Computação', 'aluno', 'Dev em formação 💻'),
  criar('Lucas Ferreira', 'lucas.ferreira@unimax.edu.br', 'Ciência da Computação'),
  criar('Júlia Ramos', 'julia.ramos@unimax.edu.br', 'Direito', 'aluno', 'Futura advogada ⚖️'),
  criar('Pedro Henrique', 'pedro.h@unimax.edu.br', 'Direito'),
  criar('Camila Oliveira', 'camila.o@unimax.edu.br', 'Psicologia', 'aluno', 'Psico | café | livros'),
  criar('Rafael Torres', 'rafael.t@unimax.edu.br', 'Engenharia Civil'),
];

const textos = [
  'Primeiro hackathon da UniMax foi incrível! Nosso time ficou em 2º lugar 🚀',
  'Alguém tem o resumo da aula de Direito Constitucional de ontem?',
  'Biblioteca lotada em semana de provas… boa sorte a todos! 📚',
  'Grupo de estudos de Cálculo toda quinta, 18h, sala 204. Chega mais!',
  'Visita técnica na obra do novo prédio hoje 🏗️',
  'Palestra sobre saúde mental no auditório foi sensacional 💜',
  'Quem mais vai na festa junina da faculdade?',
  'Terminei meu primeiro app em React!',
];
const posts = textos.map((t, i) =>
  Number(db.prepare('INSERT INTO posts (usuario_id, legenda) VALUES (?, ?)').run(alunos[i % alunos.length], t).lastInsertRowid),
);

// Curtidas e comentários variados.
posts.forEach((post, i) => {
  alunos.forEach((a, j) => {
    if ((i + j) % 3 !== 0) db.prepare('INSERT OR IGNORE INTO curtidas (post_id, usuario_id) VALUES (?, ?)').run(post, a);
  });
});
const comentar = (post, autor, texto) => db.prepare('INSERT INTO comentarios (post_id, usuario_id, texto) VALUES (?, ?, ?)').run(post, autor, texto);
comentar(posts[0], alunos[1], 'Mandaram muito bem!');
comentar(posts[0], marina, 'Parabéns, time! Orgulho 👏');
comentar(posts[1], alunos[3], 'Te mando no grupo!');
comentar(posts[3], alunos[0], 'Vou sim!');
comentar(posts[5], alunos[2], 'Precisamos de mais eventos assim.');

// Medalhas dos professores.
const medalha = (aluno, prof, tipoNome, msg) => {
  const tipo = db.prepare('SELECT id FROM tipos_medalha WHERE nome = ?').get(tipoNome);
  db.prepare('INSERT INTO medalhas (aluno_id, professor_id, tipo_id, mensagem) VALUES (?, ?, ?, ?)').run(aluno, prof, tipo.id, msg);
};
medalha(alunos[0], marina, 'Projeto destaque', 'Projeto do hackathon impecável!');
medalha(alunos[1], marina, 'Ajudou os colegas', 'Obrigada por ajudar a turma no laboratório.');
medalha(alunos[2], roberto, 'Excelência acadêmica', 'Melhor nota da turma no júri simulado.');
medalha(alunos[3], roberto, 'Participação em aula', '');

// Avisos no mural.
const admin = db.prepare("SELECT id FROM usuarios WHERE papel = 'admin'").get().id;
db.prepare('INSERT INTO avisos (autor_id, titulo, texto, fixado) VALUES (?, ?, ?, ?)').run(
  admin,
  'Semana de provas: 17 a 21 de novembro',
  'Confira no portal do aluno o calendário completo de provas de cada curso.\nA biblioteca funcionará até as 23h nesse período.',
  1,
);
db.prepare('INSERT INTO avisos (autor_id, titulo, texto) VALUES (?, ?, ?)').run(
  admin,
  'Inscrições abertas para a Semana Acadêmica',
  'Palestras, oficinas e minicursos de 1 a 5 de dezembro. Inscrições pela secretaria.',
);

console.log('Dados de exemplo criados! Entre com, por exemplo:');
console.log('  aluna:     ana.costa@unimax.edu.br / senha1234');
console.log('  professora: prof.marina@unimax.edu.br / senha1234');
