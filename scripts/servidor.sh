#!/usr/bin/env bash
# Instala ou atualiza o Maxx num servidor Ubuntu (ex.: Oracle Cloud Always Free).
# Não rode à mão: o scripts/publicar.ps1 envia o código e chama este script.
#
# O que ele faz:
#   - instala Node.js 22 e o Caddy (que cuida do HTTPS sozinho);
#   - coloca o código em /opt/maxx e os dados (banco + fotos) em /var/lib/maxx;
#   - deixa o Maxx como serviço: liga sozinho quando o servidor reinicia;
#   - libera as portas 80 e 443 no firewall do Ubuntu.
# Pode rodar quantas vezes quiser: os dados nunca são apagados.
set -euo pipefail

PACOTE=/tmp/maxx.tgz
PASTA_APP=/opt/maxx
PASTA_DADOS=/var/lib/maxx
ARQ_CONFIG=/etc/maxx.env

if [ "$(id -u)" -ne 0 ]; then echo "Rode com sudo."; exit 1; fi
if [ ! -f "$PACOTE" ]; then echo "Não achei $PACOTE (use o scripts/publicar.ps1)."; exit 1; fi
export DEBIAN_FRONTEND=noninteractive

passo() { echo; echo "==> $*"; }

# ---------- Node.js 22 ----------
versao_node() { node -e 'const [a,b]=process.versions.node.split(".").map(Number);console.log(a*1000+b)' 2>/dev/null || echo 0; }
if [ "$(versao_node)" -lt 22013 ]; then
  passo "Instalando Node.js 22 (demora alguns minutos)"
  apt-get update -q
  apt-get install -y -q ca-certificates curl gnupg
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi

# ---------- Caddy (HTTPS automático) ----------
if ! command -v caddy >/dev/null; then
  passo "Instalando o Caddy"
  apt-get install -y -q debian-keyring debian-archive-keyring apt-transport-https curl gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y -q caddy
fi

# ---------- Usuário, código e dados ----------
passo "Copiando o código do Maxx"
id maxx >/dev/null 2>&1 || useradd --system --home "$PASTA_APP" --shell /usr/sbin/nologin maxx
mkdir -p "$PASTA_DADOS"
rm -rf "$PASTA_APP.novo"
mkdir -p "$PASTA_APP.novo"
tar -xzf "$PACOTE" -C "$PASTA_APP.novo"
(cd "$PASTA_APP.novo" && npm ci --omit=dev --no-audit --no-fund)
rm -rf "$PASTA_APP.antigo"
[ -d "$PASTA_APP" ] && mv "$PASTA_APP" "$PASTA_APP.antigo"
mv "$PASTA_APP.novo" "$PASTA_APP"
chown -R maxx:maxx "$PASTA_APP" "$PASTA_DADOS"
chmod 700 "$PASTA_DADOS"
rm -f "$PACOTE"

# ---------- Configuração (só na primeira vez) ----------
if [ ! -f "$ARQ_CONFIG" ]; then
  passo "Configuração inicial"
  echo "Escolha a senha da conta da faculdade (admin@unimax.edu.br)."
  echo "Mínimo 8 caracteres. Ela não aparece enquanto você digita."
  while true; do
    read -rsp "Senha: " SENHA; echo
    read -rsp "Repita a senha: " SENHA2; echo
    if [ "${#SENHA}" -lt 8 ]; then echo "Muito curta, tente de novo."; continue; fi
    if [ "$SENHA" != "$SENHA2" ]; then echo "As senhas não batem, tente de novo."; continue; fi
    case "$SENHA" in *[\'\"\\]*) echo "Não use aspas nem barra invertida (\\) na senha."; continue;; esac
    break
  done
  echo
  echo "Código de acesso da banca do TCC (mínimo 6 caracteres, só letras e números)."
  read -rp "Deixe vazio e aperte Enter para desligar: " CODIGO
  if [ -n "$CODIGO" ] && ! [[ "$CODIGO" =~ ^[A-Za-z0-9]{6,}$ ]]; then echo "Código inválido; banca desligada."; CODIGO=""; fi
  umask 077
  {
    echo "NODE_ENV=production"
    echo "PORT=3000"
    echo "MAXX_DADOS=$PASTA_DADOS"
    echo "ADMIN_SENHA='$SENHA'"
    echo "CODIGO_BANCA=$CODIGO"
  } > "$ARQ_CONFIG"
  umask 022
fi

# ---------- Serviço ----------
passo "Ligando o Maxx"
cat > /etc/systemd/system/maxx.service <<UNIT
[Unit]
Description=Maxx - rede social
After=network.target

[Service]
User=maxx
WorkingDirectory=$PASTA_APP
EnvironmentFile=$ARQ_CONFIG
ExecStart=/usr/bin/node --disable-warning=ExperimentalWarning src/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable maxx >/dev/null 2>&1
systemctl restart maxx

# ---------- Endereço público e HTTPS ----------
IP=$(curl -fsS -4 https://ifconfig.me || curl -fsS -4 https://api.ipify.org)
ENDERECO="maxx.${IP//./-}.sslip.io"
cat > /etc/caddy/Caddyfile <<CADDY
$ENDERECO {
	reverse_proxy localhost:3000
}
CADDY
systemctl enable caddy >/dev/null 2>&1
systemctl restart caddy

# ---------- Firewall do Ubuntu (as imagens da Oracle bloqueiam tudo por padrão) ----------
for PORTA in 80 443; do
  iptables -C INPUT -p tcp --dport "$PORTA" -m state --state NEW -j ACCEPT 2>/dev/null \
    || iptables -I INPUT 1 -p tcp --dport "$PORTA" -m state --state NEW -j ACCEPT
done
command -v netfilter-persistent >/dev/null && netfilter-persistent save >/dev/null 2>&1 || true

# ---------- Conferência ----------
sleep 3
if systemctl is-active --quiet maxx && curl -fsS -o /dev/null http://localhost:3000/; then
  echo
  echo "============================================================"
  echo " Maxx no ar!"
  echo " Link para mandar aos amigos:  https://$ENDERECO"
  echo " (na primeira vez o HTTPS pode levar 1 ou 2 minutos)"
  echo "============================================================"
else
  echo
  echo "O Maxx não subiu. Últimas mensagens:"
  journalctl -u maxx -n 30 --no-pager
  exit 1
fi
