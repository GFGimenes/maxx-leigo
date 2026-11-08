const crypto = require('node:crypto');

function hashSenha(senha) {
  const sal = crypto.randomBytes(16);
  const hash = crypto.scryptSync(senha, sal, 64);
  return `${sal.toString('hex')}:${hash.toString('hex')}`;
}

function confereSenha(senha, armazenado) {
  const [sal, hash] = String(armazenado).split(':');
  if (!sal || !hash) return false;
  const calculado = crypto.scryptSync(senha, Buffer.from(sal, 'hex'), 64);
  const esperado = Buffer.from(hash, 'hex');
  return esperado.length === calculado.length && crypto.timingSafeEqual(calculado, esperado);
}

module.exports = { hashSenha, confereSenha };
