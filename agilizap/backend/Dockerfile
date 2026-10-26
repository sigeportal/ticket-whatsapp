FROM node:22-bookworm

WORKDIR /app

# Instala dependências de sistema essenciais (certificados TLS e processamento de áudio/vídeo via FFmpeg)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Instala todas as dependências (incluindo devDependencies necessárias para compilar TypeScript)
RUN npm install --legacy-peer-deps --include=dev

COPY . .
RUN npm run build

# Define ambiente de produção em runtime
ENV NODE_ENV=production

# Diretórios para armazenamento persistente de mídias e sessões do Baileys
RUN mkdir -p public sessions \
  && cp docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh \
  && chmod +x /usr/local/bin/docker-entrypoint.sh \
  && chown -R node:node /app

USER node

EXPOSE 8080

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
