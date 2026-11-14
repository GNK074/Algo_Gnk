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

Use dedicated Ubuntu instances for staging and production. On each instance, place the TLS full chain and private key in a dedicated directory. Store each environment's Compose settings in a separate, access-restricted environment file. Set GNK_ENVIRONMENT, GNK_RELEASE, GNK_TLS_DIRECTORY, POSTGRES_PASSWORD, DATABASE_URL, GNK_PUBLIC_ORIGIN, GNK_SMTP_USERNAME, GNK_SMTP_PASSWORD and GNK_EMAIL_FROM. Use a unique release tag and set the database hostname to db. URL-encode the database password in DATABASE_URL.

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

Gmail SMTP uses smtp.gmail.com on port 587 with required STARTTLS.
Set GNK_SMTP_USERNAME to the full Gmail address and GNK_SMTP_PASSWORD to a
Google app password. Set GNK_EMAIL_FROM to the Gmail address or a verified
Gmail Send mail as address. Keep the app password in the server environment file.

See [Project layout](docs/project-layout.md) for source and deployment paths.

Set GNK_MFA_KEY to a persistent 32-byte hex key generated with openssl rand -hex 32. Use distinct keys per environment and retain each key with its encrypted backups.
