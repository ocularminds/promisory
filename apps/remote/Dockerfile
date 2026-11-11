# Official Node 22.23.4 multi-platform manifest, resolved 11 November 2026.
FROM node:22.23.4-bookworm-slim@sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d AS manifests
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY apps/forge/package.json ./apps/forge/package.json
COPY apps/remote/package.json ./apps/remote/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/design-system/package.json ./packages/design-system/package.json
COPY packages/domain/package.json ./packages/domain/package.json
COPY packages/integrations-atlassian/package.json ./packages/integrations-atlassian/package.json
COPY packages/integrations-decionis/package.json ./packages/integrations-decionis/package.json
COPY packages/test-fixtures/package.json ./packages/test-fixtures/package.json

FROM manifests AS build
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY apps/remote ./apps/remote
COPY packages ./packages
RUN npm run remote:build

FROM manifests AS dependencies
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    --workspace=@promisory/remote --include-workspace-root

FROM node:22.23.4-bookworm-slim@sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d
WORKDIR /app
ENV NODE_ENV=production PROMISORY_LISTEN_HOST=0.0.0.0 PROMISORY_PORT=8787
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/remote/dist/server.js ./server.js
COPY --from=manifests --chown=node:node /app/package.json ./package.json
USER node
EXPOSE 8787
CMD ["node", "server.js"]
