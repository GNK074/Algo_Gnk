#!/usr/bin/env bash
set -euo pipefail
umask 077

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
case "${1:-}" in
  staging|production) ;;
  *) echo 'Usage: bash deploy/backup.sh {staging|production} OUTPUT.age AGE_RECIPIENT' >&2; exit 2 ;;
esac
output=${2:?Provide an output path}
recipient=${3:?Provide the age public recipient}
[[ ! -e "$output" ]] || { echo 'Backup already exists' >&2; exit 1; }
temporary=$(mktemp -- "${output}.XXXXXX")
trap 'rm -f -- "$temporary"' EXIT
docker compose --env-file ".env.$1" -f compose.server.yaml exec -T db \
  pg_dump -U gnk -Fc gnk | age -r "$recipient" -o "$temporary"
ln -- "$temporary" "$output"
echo "Encrypted backup saved to $output"
