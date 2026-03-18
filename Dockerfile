FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY shared/package.json shared/package.json
RUN npm ci

FROM deps AS build
COPY tsconfig.base.json ./
COPY backend backend
COPY frontend frontend
COPY shared shared
RUN npm run build

FROM base AS production-deps
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY shared/package.json shared/package.json
RUN npm ci --omit=dev

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=8080
ENV LOG_FORMAT=json

COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=production-deps /app/package.json ./package.json
COPY --from=production-deps /app/backend/package.json ./backend/package.json
COPY --from=production-deps /app/shared/package.json ./shared/package.json
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/frontend/dist ./frontend/dist
COPY --from=build /app/shared/dist ./shared/dist

EXPOSE 8080

CMD ["node", "backend/dist/backend/src/index.js"]
