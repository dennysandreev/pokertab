FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json eslint.config.mjs ./
COPY apps/api/package.json apps/api/package.json
COPY apps/bot/package.json apps/bot/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN corepack pnpm install --frozen-lockfile

COPY . .

RUN corepack pnpm --filter @pokertable/shared build \
  && corepack pnpm --filter @pokertable/bot build

EXPOSE 3100

CMD ["node", "apps/bot/dist/index.js"]
