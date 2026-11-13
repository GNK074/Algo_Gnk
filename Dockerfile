FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN npm ci
COPY frontend frontend
COPY backend backend
ARG GNK_API_ORIGIN
ENV GNK_API_ORIGIN=
RUN npm exec -w backend -- prisma generate && npm run build

FROM build AS web
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "frontend"]

FROM build AS api
USER node
EXPOSE 4000
CMD ["npm", "run", "start", "-w", "backend"]
