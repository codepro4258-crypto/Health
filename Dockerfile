FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY public ./public
COPY docs ./docs
COPY tests ./tests

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1

CMD ["node", "server.js"]
