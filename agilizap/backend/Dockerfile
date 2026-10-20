FROM node:20-bookworm

WORKDIR /app

# Instala dependências de sistema necessárias para o Chromium headless e processamento de áudio/vídeo
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    ffmpeg \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY package*.json ./

# Instala todas as dependências (incluindo devDependencies necessárias para compilar TypeScript)
RUN npm install --legacy-peer-deps --include=dev

COPY . .
RUN npm run build

# Define ambiente de produção em runtime
ENV NODE_ENV=production

# Diretórios para armazenamento persistente de mídias e sessões do Baileys
RUN mkdir -p public sessions

EXPOSE 8080

CMD ["sh", "-c", "npx sequelize db:migrate && (npx sequelize db:seed:all || true) && node dist/server.js"]
