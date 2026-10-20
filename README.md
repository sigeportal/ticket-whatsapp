# Ticket WhatsApp (Agilizap) — Plataforma de Atendimento Multicanal

Modernização e conteinerização completa da plataforma de atendimento multicanal via WhatsApp baseada no ecossistema Whaticket, dimensionada para operações ágeis de até 10 atendentes internos, com persistência resiliente e suporte nativo a automações e Inteligência Artificial.

---

## 🏛️ Arquitetura da Stack (Docker)

```
┌────────────────────────────────────────────────────────┐
│                   Docker Compose Stack                 │
├───────────────────┬────────────────────────────────────┤
│ ticket-frontend   │ Nginx Alpine (SPA React 18 / Vite) │
│                   │ Porta Externa: 3000 -> 80          │
├───────────────────┼────────────────────────────────────┤
│ ticket-backend    │ Node.js 20 LTS (Express, Baileys,  │
│                   │ Sequelize ORM, Socket.IO)          │
│                   │ Porta Externa: 8080                │
├───────────────────┼────────────────────────────────────┤
│ ticket-postgres   │ PostgreSQL 14 Alpine               │
│                   │ Porta Externa: 5432                │
│                   │ Volume: postgres_data              │
├───────────────────┼────────────────────────────────────┤
│ ticket-redis      │ Redis 7 Alpine                     │
│                   │ Porta Externa: 6379                │
│                   │ Volume: redis_data                 │
└───────────────────┴────────────────────────────────────┘
```

### Principais Destaques da Infraestrutura (Fase 1):
1. **Frontend Otimizado (Multi-Stage):**
   - Imagem de produção baseada em `nginx:alpine` (~30 MB vs >1.5 GB no legado).
   - Suporte nativo a roteamento SPA com `try_files` e compressão Gzip.
2. **Backend Node 20 LTS:**
   - Imagem oficial `node:20-bookworm` com suporte estável a Chromium headless, FFmpeg e Baileys.
3. **Persistência de Mídias e Sessões:**
   - Volume `backend_public` dedicado a uploads (`/app/public`), garantindo que áudios, imagens, documentos e avatares persistam entre reinicializações e deploys.
   - Sessões do WhatsApp armazenadas com segurança no PostgreSQL.
4. **Resiliência e Healthchecks:**
   - O backend só inicializa após PostgreSQL e Redis estarem com healthcheck `healthy`.

---

## 🚀 Como Executar

### Pré-requisitos
- Docker Engine e Docker Compose (ou Docker Desktop no Windows/Mac, ou Docker ativo via WSL2).

### 1. Clonar o repositório
```bash
git clone https://github.com/sigeportal/ticket-whatsapp.git
cd ticket-whatsapp
```

### 2. Configurar variáveis de ambiente
Copie o template `.env.example` para `.env`:
```bash
cp .env.example .env
```
*(No Windows PowerShell: `Copy-Item .env.example .env`)*

Revise as credenciais e configurações no arquivo `.env`.

### 3. Iniciar a stack completa

**No Linux / macOS / WSL:**
```bash
chmod +x docker-start.sh
./docker-start.sh
```
*Ou simplesmente:*
```bash
docker compose up -d --build
```

**No Windows PowerShell:**
```powershell
.\docker-start.ps1
```

### 4. Acessar a aplicação
- **Frontend (Painel de Atendimento):** [http://localhost:3000](http://localhost:3000)
- **Backend (API & Webhooks):** [http://localhost:8080](http://localhost:8080)

---

## 🛠️ Comandos Úteis do Docker Compose

```bash
# Ver status de todos os containers
docker compose ps

# Acompanhar logs de todos os serviços em tempo real
docker compose logs -f

# Acompanhar logs apenas do backend
docker compose logs -f backend

# Parar todos os serviços
docker compose down

# Reiniciar todos os serviços
docker compose restart

# Executar migrações manualmente (caso necessário)
docker compose exec backend npx sequelize db:migrate
```

---

## 🗺️ Roteiro de Modernização

- [x] **Fase 1: Infraestrutura & Dockerização Total**
  - Dockerfiles otimizados (Node 20 LTS + Nginx Alpine multi-stage).
  - Orquestração completa com `docker-compose.yml` e volumes persistentes.
  - `.env.example` unificado e scripts utilitários.
- [ ] **Fase 2: Backend & Baileys**
  - Atualização do `@whiskeysockets/baileys` para versão estável mais recente.
  - Persistência e reconexão resiliente de sessões WhatsApp.
- [ ] **Fase 3: Frontend (Vite + React 18 + Nova UI)**
  - Migração de Create React App para Vite + React 18.
  - Interface moderna, responsiva e acessível.
- [ ] **Fase 4: IA & Automações**
  - Conexão nativa com **Google Gemini 1.5 Flash** para triagem, FAQ e resumos.
  - Transcrição de áudios recebidos com Whisper.
- [ ] **Fase 5: Homologação e Testes Finais**
  - Validação de ponta a ponta em ambiente real com até 10 atendentes.
