FROM node:24-bookworm-slim AS build

WORKDIR /workspace
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
ENV PORT=3000
ENV BASE_PATH=/
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY}
ENV VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN}
ENV VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID}
ENV VITE_FIREBASE_STORAGE_BUCKET=${VITE_FIREBASE_STORAGE_BUCKET}
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=${VITE_FIREBASE_MESSAGING_SENDER_ID}
ENV VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID}
RUN pnpm --filter @workspace/personal-gemini-journal run build
RUN pnpm --filter @workspace/api-server run build

FROM node:24-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PUBLIC_DIR=/app/web
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/artifacts/api-server/dist ./dist
COPY --from=build /workspace/artifacts/api-server/package.json ./package.json
COPY --from=build /workspace/artifacts/personal-gemini-journal/dist/public ./web

CMD ["node", "--enable-source-maps", "dist/index.mjs"]