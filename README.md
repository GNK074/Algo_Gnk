# GNK Algo

This checkout contains the initial account application scaffold. The Compose file starts loopback-only PostgreSQL and Redis for local validation.

1. Run npm install.
2. Set POSTGRES_PASSWORD in the shell or in a checkout-local .env file.
3. Run npm run services.
4. Run npm run dev:web and npm run dev:api in separate terminals.

The frontend listens on port 3000 and the API liveness endpoint is /api/health on port 4000. Run npm run build to compile both workspaces.

Staging and production deployment require dedicated OCI infrastructure and separate credentials. The official domain cutover requires explicit approval.

## Initial account migration

Set DATABASE_URL in the shell before running npm run migrate. For the local Compose database, use the form postgresql://gnk:PASSWORD@127.0.0.1:55432/gnk and URL-encode the password. Wait for PostgreSQL to become healthy before applying the migration.

## Isolated OCI server configuration

Use dedicated Ubuntu instances for staging and production. On each instance, place the TLS full chain and private key in a dedicated directory. Store each environment's Compose settings in a separate, access-restricted environment file. Set GNK_ENVIRONMENT, GNK_RELEASE, GNK_TLS_DIRECTORY, POSTGRES_PASSWORD, DATABASE_URL, GNK_PUBLIC_ORIGIN, GNK_SMTP_PASSWORD and GNK_EMAIL_FROM. Use a unique release tag and set the database hostname to db. URL-encode the database password in DATABASE_URL.

Build with docker compose --env-file PATH -f compose.server.yaml build. After the application passes its release checks, run docker compose --env-file PATH -f compose.server.yaml up -d --wait on the dedicated staging instance. The migration runs before the API starts. Nginx serves the web app and forwards API requests on the same origin.

Before an upgrade, back up PostgreSQL with pg_dump and test restoring the backup in an isolated database. Retain the preceding image tags and release configuration. Roll back the application by selecting the prior release tag if the schema is compatible. For an incompatible migration, restore the verified pre-upgrade backup during a maintenance window and account for writes made since the backup.

This configuration has not been deployed to OCI. Complete the authentication flows, legal review, staging tests, and rollback drill before production cutover.

### Production environment on a host with Nginx

Copy .env.production.example to .env.production with restrictive permissions.
Generate a unique database password and set DATABASE_URL to
postgresql://gnk:PASSWORD@db:5432/gnk using the same password. Set the
release tag, TLS directory and verified transactional sender credentials.
The template publishes the stack on loopback ports 18080 and 18443 so the
host Nginx can retain ports 80 and 443. The HTTP listener redirects to the
public HTTPS origin on port 443, so use the HTTPS listener as the upstream
with certificate verification enabled when configuring host Nginx at cutover.

Validate with docker compose --env-file .env.production -f compose.server.yaml config --quiet.
The production project name is gnk-production. Its network and database
volume are scoped separately from the staging Compose project.

Cloudflare Email Sending uses smtp.mx.cloudflare.net on port 465 with implicit TLS. Onboard the sender domain in Cloudflare, set GNK_EMAIL_FROM to an address on that domain, and set GNK_SMTP_PASSWORD to an Email Sending: Edit token in the server environment file.

See [Project layout](docs/project-layout.md) for source and deployment paths.

Set GNK_MFA_KEY to a persistent 32-byte hex key generated with openssl rand -hex 32. Use distinct keys per environment and retain each key with its encrypted backups.

## Live OCI routing

Public HTTPS uses host Nginx on port 443. The gnkalgo.com virtual host
proxies to https://127.0.0.1:18443, the loopback-only Compose HTTPS listener.
The upstream uses TLS SNI and certificate hostname verification for gnkalgo.com
with the Ubuntu system CA bundle. Keep the production HTTPS bind set to
127.0.0.1:18443 unless the host upstream is updated in the same change.

On OCI, verify the container and public route:

```bash
curl --noproxy '*' -fsS --connect-to gnkalgo.com:443:127.0.0.1:18443 https://gnkalgo.com/api/health
curl -fsS https://gnkalgo.com/api/health
```

Both should return {"status":"ok"}. The host Nginx virtual host is managed
on OCI. Keep certificate private keys and environment files on the server.

## Platform administration

Set GNK_PLATFORM_ADMIN_IDS to a comma-separated list of existing account UUIDs in the API environment to grant access to /admin. An empty value disables platform admin access. The agreement administrator setting is independent.

Before deploying this increment, apply the account activity migration on a staging copy. Check that anonymous admin requests receive 401, retail requests receive 403, and configured administrators can search users and read audit history. Exercise sign-in, sign-out, password reset and session revocation with two staging accounts and verify that each account activity feed only contains its own events. Roll back the application image first and retain the additive activity table so recorded events remain available. Rehearse database restoration separately using a staging backup.

## Read-only portfolio

The account workspace shows holdings value and position P&L through /user/portfolio. Set GNK_PORTFOLIO_ORIGIN to the trading API HTTPS origin and GNK_PORTFOLIO_SECRET to a dedicated 32-byte hex secret. The trading service needs the same secret and its companion portfolio bridge deployed.

On the trading service, set GNK_PORTFOLIO_ACCOUNT_LINKS to a JSON object keyed by account-app user UUID with verified trading user IDs as values. Verify ownership before provisioning each link and remove the link when access ends. The bridge accepts a short-lived signed request and uses Redis to reject repeated nonces.

Before enabling the link in production, exercise two linked test accounts and one unlinked account. Check session and disclosure enforcement, expired and repeated signed requests, and stale or missing broker snapshots.

## FastAPI analytics

Start the Python service locally with `docker compose -f compose.analytics.yaml up --build --wait`.
Liveness is available at http://127.0.0.1:58000/health. Readiness returns HTTP 503 until a market-data source is implemented and connected.
The analytics Compose file is independent of the production account stack.

For historical NIFTY 50 charts, provide GNK_CANDLES_FILE and GNK_CANDLES_SOURCE to analytics.
The source file must be an authorized daily CSV with date,open,high,low,close headers and up to 1000 rows ordered oldest first.
Mount the CSV read-only when running analytics in Docker. Set GNK_ANALYTICS_ORIGIN in the account API to the analytics service URL reachable from that container.
The dashboard labels prices as historical and shows availability states when the source is missing.
