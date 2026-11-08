const app = require('./app');
const config = require('./config');

app.listen(config.PORTA, () => {
  console.log(`${config.NOME_APP} rodando em http://localhost:${config.PORTA}`);
});
