#!/usr/bin/env bash
# Sobe backend + frontend locais para produção (servidor Oracle, https://ciadosuco.duckdns.org).
#
# Uso:   CHAVE=/caminho/da/chave-ssh ./deploy.sh
#        (sem CHAVE, usa a chave padrão do ssh / ssh-agent)
#
# Passos: 1) build do frontend apontando para a API de produção
#         2) backup do banco de produção (fica em ~/backups/loja-sucos no servidor, junto do backup diário)
#         3) copia o código do backend (NUNCA sobrescreve o app/.env do servidor)
#         4) roda as migrações (Flyway) e reconstrói a API
#         5) publica o frontend em /var/www/ciadosuco
#         6) confere se a API e o site respondem
set -euo pipefail

SERVIDOR="${SERVIDOR:-ubuntu@137.131.167.36}"
# Pasta do backend no servidor (projeto docker-compose "loja-sucos"). O servidor não tem rsync: copia via tar.
PASTA_SERVIDOR="loja-sucos/backend"
URL="https://ciadosuco.duckdns.org"
BACK="$(cd "$(dirname "$0")" && pwd)"
FRONT="$BACK/../loja-sucos-frontend"
COMPOSE="docker-compose --env-file app/.env -f docker_compose.prod.yml -p loja-sucos"

SSH_OPTS=(-o ConnectTimeout=15)
[ -n "${CHAVE:-}" ] && SSH_OPTS+=(-i "$CHAVE")
ssh_srv() { ssh "${SSH_OPTS[@]}" "$SERVIDOR" "$@"; }

echo "==> Testando acesso ao servidor"
ssh_srv "test -f ~/$PASTA_SERVIDOR/app/.env" || { echo "Sem acesso ou ~/$PASTA_SERVIDOR/app/.env não existe."; exit 1; }

echo "==> 1/6 Build do frontend (API: $URL/api)"
DIST="$(mktemp -d)"
trap 'rm -rf "$DIST"' EXIT
(cd "$FRONT" && VITE_API_URL="$URL/api" npx vite build --outDir "$DIST" --emptyOutDir)

echo "==> 2/6 Backup do banco de produção"
ssh_srv "set -e; mkdir -p ~/backups/loja-sucos; \
  ARQ=~/backups/loja-sucos/antes-deploy-\$(date +%Y%m%d-%H%M%S).dump; \
  docker exec loja-sucos-database sh -c 'pg_dump -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Fc' > \$ARQ; \
  test -s \$ARQ && ls -lh \$ARQ"

echo "==> 3/6 Copiando o backend (sem app/.env)"
tar -C "$BACK" -czf - \
  --exclude='./.git' --exclude='./app/.env' --exclude='*.log' --exclude='__pycache__' \
  --exclude='.pytest_cache' --exclude='./backups' . \
  | ssh_srv "tar -C ~/$PASTA_SERVIDOR -xzf - && echo 'código copiado'"

echo "==> 4/6 Migrações e nova API"
ssh_srv "cd ~/$PASTA_SERVIDOR && $COMPOSE run --rm flyway && $COMPOSE up -d --build app"

echo "==> 5/6 Publicando o frontend"
tar -C "$DIST" -czf - . | ssh_srv "rm -rf /tmp/ciadosuco-dist && mkdir -p /tmp/ciadosuco-dist && \
  tar -C /tmp/ciadosuco-dist -xzf - && sudo cp -r /tmp/ciadosuco-dist/. /var/www/ciadosuco/ && rm -rf /tmp/ciadosuco-dist"

echo "==> 6/6 Conferindo"
sleep 5
for tentativa in 1 2 3 4 5 6; do
  codigo_api=$(curl -s -o /dev/null -w '%{http_code}' "$URL/api/docs" || true)
  [ "$codigo_api" = "200" ] && break
  sleep 5
done
codigo_site=$(curl -s -o /dev/null -w '%{http_code}' "$URL/" || true)
echo "API: $codigo_api | Site: $codigo_site"
ssh_srv "docker logs --tail 5 loja-sucos-app"
[ "$codigo_api" = "200" ] && [ "$codigo_site" = "200" ] && echo "Deploy concluído." || { echo "Algo não respondeu 200. Veja os logs acima."; exit 1; }
