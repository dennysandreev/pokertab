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

RUN corepack pnpm --filter @pokertable/api prisma:generate \
  && corepack pnpm --filter @pokertable/config build \
  && corepack pnpm --filter @pokertable/shared build \
  && corepack pnpm --filter @pokertable/api build

EXPOSE 3000

CMD ["sh", "-c", "corepack pnpm --filter @pokertable/api prisma:migrate:deploy && node apps/api/dist/main.js"]
