// Telas do Maxx.
const { html, raw } = require('./html');
const config = require('./config');
const { CONTAS: CONTAS_BANCA } = require('./banca');
const { PONTOS, CONQUISTAS } = require('./regras');

// ---------- Ícones ----------
const svg = (corpo) =>
  raw(`<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corpo}</svg>`);

const icone = {
  inicio: svg('<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>'),
  mural: svg('<path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16 9a3 3 0 0 1 0 6"/><path d="M19 6a7 7 0 0 1 0 12"/>'),
  novo: svg('<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/>'),
  ranking: svg('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3a3 3 0 0 1-3 4M7 5H4a3 3 0 0 0 3 4"/>'),
  perfil: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  coracao: svg('<path d="M12 20.5s-7.5-4.6-9.6-9.3A5.4 5.4 0 0 1 12 5.7a5.4 5.4 0 0 1 9.6 5.5C19.5 15.9 12 20.5 12 20.5z"/>'),
  comentario: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.5-5A8 8 0 1 1 21 12z"/>'),
};

// ---------- Utilidades ----------
function tempoRelativo(dataSql) {
  const data = new Date(String(dataSql).replace(' ', 'T') + 'Z');
  const seg = Math.floor((Date.now() - data.getTime()) / 1000);
  if (seg < 60) return 'agora';
  if (seg < 3600) return `há ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `há ${Math.floor(seg / 3600)} h`;
  if (seg < 7 * 86400) return `há ${Math.floor(seg / 86400)} d`;
  return data.toLocaleDateString('pt-BR');
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const fmt = (n) => Number(n).toLocaleString('pt-BR');

function avatar(u, tamanho = 'p') {
  if (u.avatar) return html`<img class="avatar avatar-${tamanho}" src="/uploads/${u.avatar}" alt="">`;
  const matiz = (Number(u.usuario_id ?? u.id) * 67) % 360;
  const inicial = (u.nome || '?').trim().charAt(0).toUpperCase();
  return html`<span class="avatar avatar-${tamanho} avatar-letra" style="--matiz:${matiz}" aria-hidden="true">${inicial}</span>`;
}

function selo(papel) {
  if (papel === 'professor') return html`<span class="selo selo-prof">Professor(a)</span>`;
  if (papel === 'admin') return html`<span class="selo selo-oficial">Oficial</span>`;
  return '';
}

function linkUsuario(u) {
  return html`<a class="usuario-link" href="/u/${u.usuario_id ?? u.id}">${avatar(u)}<span><strong>${u.nome}</strong> ${selo(u.papel)}${u.curso ? html`<small>${u.curso}</small>` : ''}</span></a>`;
}

const erroBox = (erro) => (erro ? html`<p class="alerta">${erro}</p>` : '');

const opcoesCurso = (selecionado) =>
  config.CURSOS.map((c) => html`<option value="${c}" ${c === selecionado ? 'selected' : ''}>${c}</option>`);

// ---------- Layout ----------
function layout({ usuario, titulo, ativo, conteudo }) {
  const item = (chave, href, rotulo) =>
    html`<a href="${href}" class="${ativo === chave ? 'ativo' : ''}" aria-label="${rotulo}">${icone[chave]}<span>${rotulo}</span></a>`;
  return html`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo ? `${titulo} · ` : ''}${config.NOME_APP}</title>
<meta name="theme-color" content="#5b21b6">
<link rel="icon" href="/icone.svg" type="image/svg+xml">
<link rel="stylesheet" href="/estilo.css">
</head>
<body>
<header class="topo">
  <a href="/" class="marca">${config.NOME_APP}</a>
  <span class="topo-sub">${config.FACULDADE}</span>
  ${usuario?.papel === 'admin' ? html`<a class="topo-link" href="/admin">Administração</a>` : ''}
</header>
<main class="conteudo">${conteudo}</main>
${
  usuario
    ? html`<nav class="nav-inferior">
  ${item('inicio', '/', 'Início')}
  ${item('mural', '/mural', 'Mural')}
  ${item('novo', '/novo', 'Postar')}
  ${item('ranking', '/ranking', 'Ranking')}
  ${item('perfil', `/u/${usuario.id}`, 'Perfil')}
</nav>`
    : ''
}
</body>
</html>`;
}

// ---------- Entrar / Cadastrar ----------
function caixaBanca(erro) {
  return html`<section class="cartao auth banca" id="banca">
  <h2>Banca do TCC</h2>
  <p class="muted">Entre sem cadastro com o código de acesso da apresentação.</p>
  ${erroBox(erro)}
  <form method="post" action="/banca" class="form">
    <label>Código de acesso<input name="codigo" required autocomplete="off" autocapitalize="none" spellcheck="false"></label>
    <span class="banca-rotulo">Entrar como</span>
    <div class="banca-perfis">
      ${Object.entries(CONTAS_BANCA).map(([perfil, c]) => html`<button class="btn btn-sec" name="perfil" value="${perfil}">${c.rotulo}</button>`)}
    </div>
  </form>
</section>`;
}

function telaEntrar({ erro, email = '', banca = false, erroBanca }) {
  return html`<section class="cartao auth">
  <h1 class="marca-grande">${config.NOME_APP}</h1>
  <p class="muted">A rede social da ${config.FACULDADE}</p>
  ${erroBox(erro)}
  <form method="post" action="/entrar" class="form">
    <label>E-mail da faculdade<input type="email" name="email" value="${email}" required autocomplete="email"></label>
    <label>Senha<input type="password" name="senha" required autocomplete="current-password"></label>
    <button class="btn">Entrar</button>
  </form>
  <p class="muted">Ainda não tem conta? <a href="/cadastrar">Cadastre-se</a></p>
</section>
${banca ? caixaBanca(erroBanca) : ''}`;
}

function telaCadastrar({ erro, dados = {} }) {
  const dominio = config.DOMINIOS_PERMITIDOS[0];
  return html`<section class="cartao auth">
  <h1 class="marca-grande">${config.NOME_APP}</h1>
  <p class="muted">Crie sua conta com o e-mail @${dominio}</p>
  ${erroBox(erro)}
  <form method="post" action="/cadastrar" class="form">
    <label>Nome completo<input name="nome" value="${dados.nome || ''}" required maxlength="60" autocomplete="name"></label>
    <label>E-mail da faculdade<input type="email" name="email" value="${dados.email || ''}" required placeholder="voce@${dominio}" autocomplete="email"></label>
    <label>Curso<select name="curso" required><option value="">Selecione…</option>${opcoesCurso(dados.curso)}</select></label>
    <label>Senha (mínimo 8 caracteres)<input type="password" name="senha" required minlength="8" autocomplete="new-password"></label>
    <button class="btn">Criar conta</button>
  </form>
  <p class="muted">Professores: criem a conta normalmente e peçam à faculdade para liberar o perfil de professor.</p>
  <p class="muted">Já tem conta? <a href="/entrar">Entrar</a></p>
</section>`;
}

// ---------- Feed ----------
// noFeed = true: mostra os últimos comentários e uma caixa para comentar ali mesmo.
function cartaoPost(p, voltar, noFeed = false) {
  return html`<article class="post" id="post-${p.id}">
  <header class="post-topo">${linkUsuario(p)}<span class="tempo">${tempoRelativo(p.criado_em)}</span></header>
  ${
    p.imagem
      ? html`<a href="/posts/${p.id}"><img class="post-img" src="/uploads/${p.imagem}" alt="Foto publicada por ${p.nome}" loading="lazy"></a>`
      : html`<a href="/posts/${p.id}" class="post-texto">${p.legenda}</a>`
  }
  <div class="post-acoes">
    <form method="post" action="/posts/${p.id}/curtir">
      <input type="hidden" name="voltar" value="${voltar}">
      <button class="btn-icone ${p.curti ? 'curtido' : ''}" aria-label="${p.curti ? 'Descurtir' : 'Curtir'}">${icone.coracao}</button>
    </form>
    <a class="btn-icone" href="/posts/${p.id}#comentar" aria-label="Comentar">${icone.comentario}</a>
  </div>
  <div class="post-info">
    <strong>${plural(p.n_curtidas, 'curtida', 'curtidas')}</strong>
    ${p.imagem && p.legenda ? html`<p class="legenda"><a href="/u/${p.usuario_id}"><strong>${p.nome}</strong></a> ${p.legenda}</p>` : ''}
    ${
      noFeed
        ? comentariosNoFeed(p, voltar)
        : p.n_comentarios > 0
          ? html`<a class="muted" href="/posts/${p.id}">Ver ${plural(p.n_comentarios, 'comentário', 'comentários')}</a>`
          : ''
    }
  </div>
</article>`;
}

function comentariosNoFeed(p, voltar) {
  const ultimos = p.ultimos_comentarios || [];
  return html`${
    p.n_comentarios > ultimos.length
      ? html`<a class="muted" href="/posts/${p.id}">Ver todos os ${p.n_comentarios} comentários</a>`
      : ''
  }
  ${ultimos.map(
    (c) => html`<p class="comentario-curto"><a href="/u/${c.usuario_id}"><strong>${c.nome}</strong></a> ${selo(c.papel)} ${c.texto}</p>`,
  )}
  <form method="post" action="/posts/${p.id}/comentar" class="comentar-feed">
    <input type="hidden" name="voltar" value="${voltar}">
    <input name="texto" placeholder="Adicione um comentário…" required maxlength="500" aria-label="Comentar no post de ${p.nome}">
    <button class="btn-link">Publicar</button>
  </form>`;
}

// Cartão de "fulano ganhou uma medalha" no feed.
function cartaoMedalha(m) {
  const primeiroNome = m.nome.split(' ')[0];
  return html`<article class="post evento evento-medalha" id="medalha-${m.id}">
  <header class="post-topo">${linkUsuario(m)}<span class="tempo">${tempoRelativo(m.criado_em)}</span></header>
  <div class="evento-corpo">
    <span class="evento-emoji" aria-hidden="true">${m.emoji}</span>
    <p class="evento-rotulo">🏅 Medalha de professor</p>
    <h2>${primeiroNome} ganhou <span class="evento-destaque">${m.medalha}</span></h2>
    <p class="muted">entregue por ${
      m.professor_id ? html`<a href="/u/${m.professor_id}">${m.professor_nome}</a>` : 'um(a) professor(a)'
    } · <span class="pts">+${m.pontos} pts</span></p>
    ${m.mensagem ? html`<blockquote>“${m.mensagem}”</blockquote>` : ''}
    <a class="btn btn-sec" href="/u/${m.usuario_id}">Ver perfil de ${primeiroNome}</a>
  </div>
</article>`;
}

// Cartão de "fulano desbloqueou uma conquista" no feed.
function cartaoConquista(c) {
  const primeiroNome = c.nome.split(' ')[0];
  return html`<article class="post evento evento-conquista" id="conquista-${c.id}">
  <header class="post-topo">${linkUsuario(c)}<span class="tempo">${tempoRelativo(c.criado_em)}</span></header>
  <div class="evento-corpo">
    <span class="evento-emoji" aria-hidden="true">${c.info.emoji}</span>
    <p class="evento-rotulo">✨ Nova conquista</p>
    <h2>${primeiroNome} desbloqueou <span class="evento-destaque">${c.info.nome}</span></h2>
    <p class="muted">${c.info.descricao} · <span class="pts">+${c.info.bonus} pts</span></p>
    <a class="btn btn-sec" href="/u/${c.usuario_id}">Ver conquistas de ${primeiroNome}</a>
  </div>
</article>`;
}

function feed({ itens, avisoFixado, pagina, temMais }) {
  const voltar = pagina > 1 ? `/?pagina=${pagina}` : '/';
  const cartao = {
    post: (p) => cartaoPost(p, voltar, true),
    medalha: cartaoMedalha,
    conquista: cartaoConquista,
  };
  return html`
  ${
    avisoFixado
      ? html`<a class="aviso-faixa" href="/mural">📢 <strong>${avisoFixado.titulo}</strong><span>Ver no mural ›</span></a>`
      : ''
  }
  ${
    itens.length === 0
      ? html`<section class="cartao vazio"><p>Nenhum post ainda.</p><a class="btn" href="/novo">Faça o primeiro post</a></section>`
      : itens.map((i) => cartao[i.tipo](i.dados))
  }
  <div class="paginacao">
    ${pagina > 1 ? html`<a class="btn btn-sec" href="/?pagina=${pagina - 1}">‹ Mais recentes</a>` : ''}
    ${temMais ? html`<a class="btn btn-sec" href="/?pagina=${pagina + 1}">Mais antigos ›</a>` : ''}
  </div>`;
}

function postDetalhe({ post, comentarios, usuario }) {
  const podeApagar = (dono) => usuario.id === dono || usuario.papel === 'admin';
  return html`${cartaoPost(post, `/posts/${post.id}`)}
  ${
    podeApagar(post.usuario_id)
      ? html`<form method="post" action="/posts/${post.id}/apagar" class="direita" onsubmit="return confirm('Apagar este post?')">
          <button class="btn-link perigo">Apagar post</button></form>`
      : ''
  }
  <section class="cartao">
    <h2>Comentários</h2>
    ${comentarios.length === 0 ? html`<p class="muted">Seja o primeiro a comentar.</p>` : ''}
    <ul class="comentarios">
      ${comentarios.map(
        (c) => html`<li>${avatar(c)}<div><a href="/u/${c.usuario_id}"><strong>${c.nome}</strong></a> ${selo(c.papel)} ${c.texto}
          <small class="muted"> · ${tempoRelativo(c.criado_em)}</small>
          ${
            podeApagar(c.usuario_id)
              ? html`<form method="post" action="/comentarios/${c.id}/apagar" class="inline"><button class="btn-link perigo">apagar</button></form>`
              : ''
          }</div></li>`,
      )}
    </ul>
    <form method="post" action="/posts/${post.id}/comentar" class="form-linha" id="comentar">
      <input name="texto" placeholder="Escreva um comentário…" required maxlength="500">
      <button class="btn">Enviar</button>
    </form>
  </section>`;
}

function novoPost({ erro, legenda = '' }) {
  return html`<section class="cartao">
  <h1>Novo post</h1>
  ${erroBox(erro)}
  <form method="post" action="/posts" enctype="multipart/form-data" class="form">
    <label>Foto (JPG, PNG, WEBP ou GIF, até ${config.TAMANHO_MAX_IMAGEM_MB} MB)
      <input type="file" name="imagem" accept="image/jpeg,image/png,image/webp,image/gif"></label>
    <label>Legenda<textarea name="legenda" rows="4" maxlength="2200" placeholder="O que está rolando na ${config.FACULDADE}?">${legenda}</textarea></label>
    <button class="btn">Publicar</button>
  </form>
  <p class="muted">Cada post vale <strong>${PONTOS.post} pontos</strong> para o ranking.</p>
</section>`;
}

// ---------- Perfil ----------
function perfil({ perfil: p, stats, medalhas, tiposMedalha, posts, usuario, medalhasDadas, msg }) {
  const proprio = usuario.id === p.id;
  return html`<section class="cartao perfil">
  <div class="perfil-topo">
    ${avatar(p, 'g')}
    <div>
      <h1>${p.nome} ${selo(p.papel)}</h1>
      ${p.curso && p.papel !== 'admin' ? html`<p class="muted">${p.curso}</p>` : ''}
      ${p.bio ? html`<p class="bio">${p.bio}</p>` : ''}
    </div>
  </div>
  ${msg ? html`<p class="sucesso">${msg}</p>` : ''}
  ${
    stats
      ? html`<div class="numeros">
      <div><strong>${fmt(stats.total)}</strong><span>pontos</span></div>
      <div><strong>${stats.posicao_geral ?? '–'}º</strong><span>no geral</span></div>
      <div><strong>${stats.posicao_curso ?? '–'}º</strong><span>no curso</span></div>
      <div><strong>${stats.medalhas}</strong><span>medalhas</span></div>
    </div>`
      : ''
  }
  ${p.papel === 'professor' ? html`<p class="muted">Já entregou ${plural(medalhasDadas, 'medalha', 'medalhas')} para alunos.</p>` : ''}
  ${
    proprio
      ? html`<div class="acoes-perfil">
      <a class="btn btn-sec" href="/perfil/editar">Editar perfil</a>
      <form method="post" action="/sair"><button class="btn btn-sec">Sair</button></form>
    </div>`
      : ''
  }
</section>

${
  usuario.papel === 'professor' && p.papel === 'aluno'
    ? html`<section class="cartao">
    <h2>🏅 Dar uma medalha para ${p.nome.split(' ')[0]}</h2>
    <form method="post" action="/u/${p.id}/medalha" class="form">
      <label>Medalha<select name="tipo_id" required>
        ${tiposMedalha.map((t) => html`<option value="${t.id}">${t.emoji} ${t.nome} (+${t.pontos} pts)</option>`)}
      </select></label>
      <label>Mensagem (opcional)<input name="mensagem" maxlength="200" placeholder="Ex.: Ótima apresentação do trabalho!"></label>
      <button class="btn">Entregar medalha</button>
    </form>
  </section>`
    : ''
}

${
  stats
    ? html`<section class="cartao">
    <h2>Conquistas</h2>
    <ul class="conquistas">
      ${CONQUISTAS.map((c) => {
        const tem = stats.conquistas.some((x) => x.id === c.id);
        return html`<li class="${tem ? 'ganhou' : 'bloqueada'}" title="${c.descricao}">
          <span class="emoji">${c.emoji}</span><strong>${c.nome}</strong><small>${c.descricao}</small></li>`;
      })}
    </ul>
  </section>
  <section class="cartao">
    <h2>Medalhas dos professores</h2>
    ${medalhas.length === 0 ? html`<p class="muted">Nenhuma medalha ainda.</p>` : ''}
    <ul class="medalhas">
      ${medalhas.map(
        (m) => html`<li><span class="emoji">${m.emoji}</span><div><strong>${m.nome}</strong> <span class="pts">+${m.pontos}</span>
          <small class="muted">por ${m.professor_nome || 'professor(a)'} · ${tempoRelativo(m.criado_em)}</small>
          ${m.mensagem ? html`<p>“${m.mensagem}”</p>` : ''}</div></li>`,
      )}
    </ul>
  </section>`
    : ''
}

<section class="grade">
  ${posts.map(
    (post) => html`<a href="/posts/${post.id}" class="grade-item">${
      post.imagem ? html`<img src="/uploads/${post.imagem}" alt="" loading="lazy">` : html`<span>${post.legenda.slice(0, 80)}</span>`
    }</a>`,
  )}
</section>`;
}

function editarPerfil({ usuario, erro }) {
  return html`<section class="cartao">
  <h1>Editar perfil</h1>
  ${erroBox(erro)}
  <form method="post" action="/perfil/editar" enctype="multipart/form-data" class="form">
    <div class="perfil-topo">${avatar(usuario, 'g')}
      <label>Foto de perfil<input type="file" name="avatar" accept="image/jpeg,image/png,image/webp,image/gif"></label></div>
    <label>Nome<input name="nome" value="${usuario.nome}" required maxlength="60"></label>
    ${usuario.papel !== 'admin' ? html`<label>Curso<select name="curso" required>${opcoesCurso(usuario.curso)}</select></label>` : ''}
    <label>Bio<textarea name="bio" rows="3" maxlength="300">${usuario.bio}</textarea></label>
    <button class="btn">Salvar</button>
  </form>
</section>`;
}

// ---------- Ranking ----------
function ranking({ lista, curso, usuario, tiposMedalha }) {
  const trofeu = (pos) => ({ 1: '🥇', 2: '🥈', 3: '🥉' })[pos] || `${pos}º`;
  return html`<section class="cartao">
  <h1>🏆 Ranking</h1>
  <form method="get" action="/ranking" class="filtro">
    <select name="curso" onchange="this.form.submit()" aria-label="Filtrar por curso">
      <option value="">Geral (todos os cursos)</option>${opcoesCurso(curso)}
    </select>
    <noscript><button class="btn">Ver</button></noscript>
  </form>
  ${lista.length === 0 ? html`<p class="muted">Ninguém pontuou ainda${curso ? ' neste curso' : ''}.</p>` : ''}
  <ol class="ranking">
    ${lista.map(
      (a) => html`<li class="${a.id === usuario.id ? 'eu' : ''}">
        <span class="pos">${trofeu(a.posicao)}</span>
        <a href="/u/${a.id}" class="usuario-link">${avatar(a)}<span><strong>${a.nome}</strong>${curso ? '' : html`<small>${a.curso}</small>`}</span></a>
        <span class="total">${fmt(a.total)} <small>pts</small></span>
      </li>`,
    )}
  </ol>
</section>

<section class="cartao">
  <h2>Como ganhar pontos</h2>
  <ul class="regras">
    <li><span>📷 Publicar um post</span><strong>+${PONTOS.post}</strong></li>
    <li><span>❤️ Receber uma curtida de um colega</span><strong>+${PONTOS.curtida}</strong></li>
    <li><span>💬 Comentar no post de um colega (1 vez por post)</span><strong>+${PONTOS.comentario}</strong></li>
  </ul>
  <h3>Medalhas dos professores</h3>
  <ul class="regras">
    ${tiposMedalha.map((t) => html`<li><span>${t.emoji} ${t.nome}</span><strong>+${t.pontos}</strong></li>`)}
  </ul>
  <h3>Conquistas (bônus)</h3>
  <ul class="regras">
    ${CONQUISTAS.map((c) => html`<li><span>${c.emoji} ${c.nome} — ${c.descricao}</span><strong>+${c.bonus}</strong></li>`)}
  </ul>
</section>`;
}

// ---------- Mural ----------
function mural({ avisos, usuario, erro }) {
  const admin = usuario.papel === 'admin';
  return html`<section class="cartao">
  <h1>📢 Mural da ${config.FACULDADE}</h1>
  <p class="muted">Avisos oficiais da faculdade.</p>
  ${
    admin
      ? html`${erroBox(erro)}<form method="post" action="/mural" class="form">
      <label>Título<input name="titulo" required maxlength="120"></label>
      <label>Aviso<textarea name="texto" rows="4" required maxlength="5000"></textarea></label>
      <label class="check"><input type="checkbox" name="fixado" value="1"> Fixar no topo (também aparece no início)</label>
      <button class="btn">Publicar aviso</button>
    </form>`
      : ''
  }
</section>
${avisos.length === 0 ? html`<section class="cartao"><p class="muted">Nenhum aviso por enquanto.</p></section>` : ''}
${avisos.map(
  (a) => html`<article class="cartao aviso ${a.fixado ? 'fixado' : ''}">
    ${a.fixado ? html`<span class="selo selo-oficial">📌 Fixado</span>` : ''}
    <h2>${a.titulo}</h2>
    <p class="texto-aviso">${a.texto}</p>
    <small class="muted">${tempoRelativo(a.criado_em)}</small>
    ${
      admin
        ? html`<div class="acoes-perfil">
        <form method="post" action="/mural/${a.id}/fixar"><button class="btn-link">${a.fixado ? 'Desafixar' : 'Fixar'}</button></form>
        <form method="post" action="/mural/${a.id}/apagar" onsubmit="return confirm('Apagar este aviso?')"><button class="btn-link perigo">Apagar</button></form>
      </div>`
        : ''
    }
  </article>`,
)}`;
}

// ---------- Administração ----------
function admin({ usuarios, usuario, busca = '' }) {
  return html`<section class="cartao">
  <h1>Administração</h1>
  <p class="muted">Defina quem é professor. Professores podem dar medalhas aos alunos e não entram no ranking.</p>
  <form method="get" action="/admin" class="form-linha">
    <input name="q" value="${busca}" placeholder="Buscar por nome ou e-mail">
    <button class="btn">Buscar</button>
  </form>
  <ul class="lista-admin">
    ${usuarios.map(
      (u) => html`<li>
        <a href="/u/${u.id}" class="usuario-link">${avatar(u)}<span><strong>${u.nome}</strong><small>${u.email}${u.curso ? ` · ${u.curso}` : ''}</small></span></a>
        ${
          u.id === usuario.id
            ? html`<span class="selo selo-oficial">Você</span>`
            : html`<form method="post" action="/admin/usuarios/${u.id}/papel" class="form-linha">
            <select name="papel" aria-label="Papel de ${u.nome}">
              ${['aluno', 'professor', 'admin'].map((p) => html`<option value="${p}" ${u.papel === p ? 'selected' : ''}>${p}</option>`)}
            </select>
            <button class="btn btn-sec">Salvar</button>
          </form>`
        }
      </li>`,
    )}
  </ul>
</section>`;
}

function erro(mensagem) {
  return html`<section class="cartao vazio"><h1>Ops!</h1><p>${mensagem}</p><a class="btn" href="javascript:history.back()">Voltar</a></section>`;
}

module.exports = {
  layout,
  telaEntrar,
  telaCadastrar,
  feed,
  postDetalhe,
  novoPost,
  perfil,
  editarPerfil,
  ranking,
  mural,
  admin,
  erro,
};
