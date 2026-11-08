// Configurações do Maxx. Edite aqui para adaptar à faculdade.
const path = require('node:path');

module.exports = {
  NOME_APP: 'Maxx',
  FACULDADE: 'UniMax',

  // Só e-mails destes domínios podem criar conta.
  DOMINIOS_PERMITIDOS: ['unimax.edu.br', 'al.unieduk.com.br', 'prof.unieduk.com.br'],
  // Quem se cadastra com e-mail destes domínios já entra como professor(a).
  DOMINIOS_PROFESSORES: ['prof.unieduk.com.br'],

  // Cursos disponíveis no cadastro e no ranking por curso.
  CURSOS: [
    'Administração',
    'Ciência da Computação',
    'Inteligência Artificial',
    'Medicina',
  ],

  // Conta da faculdade criada automaticamente na primeira vez que o app roda.
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@unimax.edu.br',
  ADMIN_SENHA: process.env.ADMIN_SENHA || 'unimax-admin',

  // Acesso da banca do TCC (entrar sem cadastro, com código). Desligado se vazio.
  // Ex.: CODIGO_BANCA=maxx2026 npm start
  CODIGO_BANCA: process.env.CODIGO_BANCA || '',

  PORTA: Number(process.env.PORT) || 3000,
  PASTA_DADOS: process.env.MAXX_DADOS || path.join(__dirname, '..', 'dados'),
  TAMANHO_MAX_IMAGEM_MB: 5,
};
