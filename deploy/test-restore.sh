#!/usr/bin/env bash
set -euo pipefail

backup=${1:?Provide the encrypted backup path}
identity=${2:?Provide the age identity file path}
container=$(docker run --rm -d -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17)
trap 'docker stop "$container" >/dev/null' EXIT
for attempt in {1..30}; do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null; then break; fi
  sleep 1
done
docker exec "$container" createdb -h 127.0.0.1 -U postgres gnk_restore
age --decrypt -i "$identity" "$backup" |
  docker exec -i "$container" pg_restore -h 127.0.0.1 -U postgres -d gnk_restore --exit-on-error --no-owner --no-privileges
docker exec "$container" psql -h 127.0.0.1 -U postgres -d gnk_restore -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM "_prisma_migrations"; SELECT count(*) FROM "User";'
