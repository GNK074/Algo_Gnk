#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
environment=${1:-}
action=${2:-}
case "$environment" in
  staging|production) ;;
  *) echo "Usage: bash deploy/gnk-service.sh {staging|production} {validate|build|start|stop|status}" >&2; exit 2 ;;
esac
compose=(docker compose --env-file ".env.$environment" -f compose.server.yaml)
case "$action" in
  validate) "${compose[@]}" config --quiet ;;
  build) "${compose[@]}" build ;;
  start)
    "${compose[@]}" run --rm --no-deps --entrypoint sh nginx -ec '
      for file in fullchain.pem privkey.pem; do
        test -s "/etc/nginx/tls/$file" || {
          echo "Missing $file in GNK_TLS_DIRECTORY" >&2
          exit 1
        }
      done
      nginx -t
    '
    "${compose[@]}" up -d --wait
    ;;
  stop) "${compose[@]}" stop ;;
  status) "${compose[@]}" ps -a ;;
  *) echo "Unknown action: $action" >&2; exit 2 ;;
esac
