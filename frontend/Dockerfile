# --------- Stage 1: Сборка ---------
FROM node:22-alpine AS builder
WORKDIR /app

# Сначала только зависимости (для кэширования слоя)
COPY package.json package-lock.json* ./
RUN npm ci

# Потом весь код
COPY . .

# Production билд (Next.js standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --------- Stage 2: Runtime ---------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Создаём непривилегированного пользователя
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nextjs

# Копируем только то что нужно для запуска
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
