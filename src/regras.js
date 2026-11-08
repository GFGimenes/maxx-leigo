// Regras de pontuação e conquistas do Maxx.

// Pontos por ação.
const PONTOS = {
  post: 10, // cada post publicado
  comentario: 3, // por post de colega comentado (só conta 1 vez por post)
  curtida: 2, // cada curtida recebida de outra pessoa
};

// Conquistas automáticas: quando o aluno chega na meta, ganha o bônus.
// conta = o que é contado (posts, comentarios, curtidas ou medalhas); meta = quanto precisa.
const CONQUISTAS = [
  { id: 'primeiro_post', emoji: '📸', nome: 'Primeiro clique', descricao: 'Publicou o primeiro post', bonus: 20, conta: 'posts', meta: 1 },
  { id: 'fotografo', emoji: '🎞️', nome: 'Fotógrafo do campus', descricao: 'Publicou 10 posts', bonus: 50, conta: 'posts', meta: 10 },
  { id: 'bom_de_papo', emoji: '💬', nome: 'Bom de papo', descricao: 'Comentou em 10 posts de colegas', bonus: 30, conta: 'comentarios', meta: 10 },
  { id: 'popular', emoji: '❤️', nome: 'Popular', descricao: 'Recebeu 50 curtidas', bonus: 50, conta: 'curtidas', meta: 50 },
  { id: 'estrela', emoji: '🌟', nome: 'Estrela da UniMax', descricao: 'Recebeu 200 curtidas', bonus: 100, conta: 'curtidas', meta: 200 },
  { id: 'medalhista', emoji: '🏅', nome: 'Medalhista', descricao: 'Ganhou a primeira medalha de um professor', bonus: 20, conta: 'medalhas', meta: 1 },
  { id: 'colecionador', emoji: '🏆', nome: 'Colecionador', descricao: 'Ganhou 5 medalhas de professores', bonus: 60, conta: 'medalhas', meta: 5 },
];

// Medalhas que os professores podem dar (criadas no banco na primeira execução).
const MEDALHAS_PADRAO = [
  { nome: 'Excelência acadêmica', emoji: '🥇', pontos: 50, descricao: 'Desempenho excepcional na disciplina' },
  { nome: 'Projeto destaque', emoji: '🚀', pontos: 40, descricao: 'Entregou um projeto que se destacou' },
  { nome: 'Ideia brilhante', emoji: '💡', pontos: 30, descricao: 'Trouxe uma ideia ou solução criativa' },
  { nome: 'Ajudou os colegas', emoji: '🤝', pontos: 30, descricao: 'Ajudou a turma a aprender' },
  { nome: 'Participação em aula', emoji: '🙋', pontos: 20, descricao: 'Participou ativamente das aulas' },
];

module.exports = { PONTOS, CONQUISTAS, MEDALHAS_PADRAO };
