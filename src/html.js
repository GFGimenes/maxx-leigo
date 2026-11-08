// Mini sistema de templates: tudo que é interpolado é escapado automaticamente,
// a não ser que venha de outro html`` ou de raw(). Isso protege contra XSS.
class Raw {
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}

const raw = (s) => new Raw(String(s));

function esc(v) {
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function renderizar(v) {
  if (v === null || v === undefined || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(renderizar).join('');
  return esc(v);
}

function html(partes, ...valores) {
  let saida = partes[0];
  valores.forEach((v, i) => {
    saida += renderizar(v) + partes[i + 1];
  });
  return new Raw(saida);
}

module.exports = { html, raw, esc };
