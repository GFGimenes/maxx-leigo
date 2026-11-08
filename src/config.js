// Configurações do Maxx. Edite aqui para adaptar à faculdade.
const path = require('node:path');

module.exports = {
  NOME_APP: 'Maxx',
  FACULDADE: 'UniMax',

  // Só e-mails destes domínios podem criar conta.
  DOMINIOS_PERMITIDOS: ['unimax.edu.br'],

  // Cursos disponíveis no cadastro e no ranking por curso.
  CURSOS: [
    'Administração',
    'Arquitetura e Urbanismo',
    'Ciência da Computação',
    'Direito',
    'Enfermagem',
    'Engenharia Civil',
    'Medicina',
    'Psicologia',
  ],

  // Conta da faculdade criada automaticamente na primeira vez que o app roda.
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@unimax.edu.br',
  ADMIN_SENHA: process.env.ADMIN_SENHA || 'unimax-admin',

  PORTA: Number(process.env.PORT) || 3000,
  PASTA_DADOS: process.env.MAXX_DADOS || path.join(__dirname, '..', 'dados'),
  TAMANHO_MAX_IMAGEM_MB: 5,
};
