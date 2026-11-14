# Project layout

- frontend/src/app contains Next.js routes and route layouts.
- frontend/src/components contains shared forms, the disclaimer and the theme control.
- backend/src/api contains the NestJS account controller.
- backend/src/security contains the TOTP and secret encryption utilities.
- backend/prisma contains the schema and migrations used by Prisma and CI.
- deploy/gnk-service.sh wraps the existing server Compose commands on Ubuntu.
- infrastructure/nginx contains the container reverse proxy configuration.

Use bash deploy/gnk-service.sh staging validate to check the staging configuration.
The script selects .env.staging or .env.production based on its first argument.
