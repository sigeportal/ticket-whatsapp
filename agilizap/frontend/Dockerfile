# ==========================================
# Estágio 1: Build da aplicação com Vite
# ==========================================
FROM node:20-bookworm AS builder

WORKDIR /app

# Argumentos de build para injeção de variáveis no bundle Vite
ARG REACT_APP_BACKEND_URL=http://localhost:8080
ARG REACT_APP_HOURS_CLOSE_TICKETS_AUTO=24
ARG REACT_APP_NAME_SYSTEM=Agilizap

ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL \
    REACT_APP_HOURS_CLOSE_TICKETS_AUTO=$REACT_APP_HOURS_CLOSE_TICKETS_AUTO \
    REACT_APP_NAME_SYSTEM=$REACT_APP_NAME_SYSTEM

# Instalação das dependências
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Compilação da aplicação com Vite
COPY . .
RUN npm run build

# ==========================================
# Estágio 2: Servidor Nginx de Produção
# ==========================================
FROM nginx:alpine

# Remove configuração padrão
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copia configuração customizada do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia os artefatos compilados do estágio de build
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
