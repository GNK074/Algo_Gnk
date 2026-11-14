param([Parameter(Mandatory)][string]$KeyPath)
$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
    if ((git branch --show-current) -ne 'main' -or (git status --porcelain)) {
        throw 'Commit changes on a clean main branch before syncing.'
    }
    $revision = git rev-parse HEAD
    if ($LASTEXITCODE -ne 0 -or $revision -notmatch '^[a-f0-9]{40}$') { throw 'Cannot determine revision.' }
    git push origin main
    if ($LASTEXITCODE -ne 0) { throw 'GitHub push failed.' }
    $remote = @'
set -eu
cd /opt/Algo_Gnk
test -z "$(git status --porcelain)"
git pull --ff-only origin main
test "$(git rev-parse HEAD)" = RELEASE_SHA
grep -qx GNK_ENVIRONMENT=production .env.production
grep -q '^GNK_RELEASE=' .env.production
release=$(git rev-parse --short HEAD)
GNK_RELEASE="$release" bash deploy/gnk-service.sh production build
GNK_RELEASE="$release" bash deploy/gnk-service.sh production start
test "$(docker inspect -f '{{.Config.Image}}' gnk-production-api-1)" = "gnk-api:$release"
test "$(docker inspect -f '{{.Config.Image}}' gnk-production-web-1)" = "gnk-web:$release"
curl -fsS --retry 5 --max-time 10 https://gnkalgo.com/api/health
sed -i "s/^GNK_RELEASE=.*/GNK_RELEASE=$release/" .env.production
echo
bash deploy/gnk-service.sh production status
'@
    $remote.Replace('RELEASE_SHA', $revision) | plink -batch -i $KeyPath ubuntu@130.210.34.12 "tr -d '\r' | bash"
    if ($LASTEXITCODE -ne 0) { throw 'OCI rollout failed.' }
} finally {
    Pop-Location
}
