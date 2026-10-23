# Ticket WhatsApp (Agilizap) — Plataforma de Atendimento Multicanal

Modernização e conteinerização completa da plataforma de atendimento multicanal via WhatsApp baseada no ecossistema Whaticket, dimensionada para operações ágeis de até 10 atendentes internos, com persistência resiliente, isolamento multi-tenant estrito e suporte nativo a automações e Inteligência Artificial.

---

## 🏛️ Arquitetura da Stack (Docker)

```
┌────────────────────────────────────────────────────────┐
│                   Docker Compose Stack                 │
├───────────────────┬────────────────────────────────────┤
│ ticket-frontend   │ Nginx Alpine (SPA React 17 / Vite) │
│                   │ Porta Host: 127.0.0.1:3000 -> 80   │
├───────────────────┼────────────────────────────────────┤
│ ticket-backend    │ Node.js 22 LTS (Express, Baileys,  │
│                   │ Sequelize ORM, Socket.IO, Bull)    │
│                   │ Porta Host: 127.0.0.1:8080         │
│                   │ Usuário: node (não-privilegiado)   │
├───────────────────┼────────────────────────────────────┤
│ ticket-postgres   │ PostgreSQL 14 Alpine               │
│                   │ Rede Interna (sem portas expostas) │
│                   │ Volume: postgres_data              │
├───────────────────┼────────────────────────────────────┤
│ ticket-redis      │ Redis 7 Alpine                     │
│                   │ Rede Interna (sem portas expostas) │
│                   │ Volume: redis_data                 │
└───────────────────┴────────────────────────────────────┘
```

### Principais Destaques da Infraestrutura (Etapa 5 — Operação e Observabilidade):
1. **Frontend Otimizado (Multi-Stage):**
   - Imagem de produção baseada em `nginx:alpine` (~30 MB).
   - SPA React 17 compilada com Vite, suporte nativo a roteamento com `try_files` e compressão Gzip.
2. **Backend Node 22 LTS Seguro:**
   - Imagem baseada em `node:22-bookworm` com suporte estável a Chromium headless, FFmpeg e Baileys 6.7.24 (ESM).
   - Execução com usuário sem privilégios (`USER node`) para prevenir elevação de privilégios.
   - Script de entrada (`docker-entrypoint.sh`) com parada estrita em caso de falha de migração e proteção contra execução indevida de seeds em reinicializações.
3. **Persistência e Isolamento de Rede:**
   - Volume `backend_public` dedicado a uploads confinados (`/app/public`).
   - PostgreSQL e Redis restritos estritamente à rede interna de containers, sem portas publicadas na interface de rede pública do host.
4. **Resiliência e Observabilidade:**
   - Probes de saúde HTTP: `/health/live` (liveness) e `/health/ready` (readiness de DB e Redis com timeout e zero exposição de segredos).
   - Observabilidade dedicada de WhatsApp: `/health/whatsapp` separada da disponibilidade geral da aplicação.
   - Métricas operacionais em tempo real: `/health/metrics` (memória, filas Bull, mensagens falhas/incertas, alertas de supervisão).
   - Desligamento ordenado (Graceful Shutdown): interceptação de `SIGINT` e `SIGTERM` fechando filas Bull, conexões com banco e sockets sem perder tarefas em trânsito.

---

## 🚀 Como Executar

### Pré-requisitos
- Docker Engine e Docker Compose (ou Docker Desktop no Windows/Mac, ou Docker ativo via WSL2).
- Node.js 22.19+ (caso execute localmente fora de containers).

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

Revise as credenciais e configurações no arquivo `.env`. Configure senhas fortes e exclusivas para `DB_PASS`, `REDIS_PASSWORD`, `JWT_SECRET` e `JWT_REFRESH_SECRET`.

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
- **Backend (API & Healthchecks):** [http://localhost:8080](http://localhost:8080)
- **Liveness Probe:** [http://localhost:8080/health/live](http://localhost:8080/health/live)
- **Readiness Probe:** [http://localhost:8080/health/ready](http://localhost:8080/health/ready)

---

## 🩺 Monitoramento e Endpoints de Saúde

| Endpoint | Método | Finalidade | Status Esperado |
|---|---|---|---|
| `/health/live` | `GET` | Verificação de vida do processo Express | `200 OK` `{ status: "ok", uptimeSeconds: ... }` |
| `/health/ready` | `GET` | Prontidão de dependências (PostgreSQL e Redis com timeouts) | `200 OK` ou `503 Service Unavailable` em falha |
| `/health/whatsapp` | `GET` | Observabilidade de conexões WhatsApp por empresa | `200 OK` `{ summary: { total, connected, disconnected } }` |
| `/health/metrics` | `GET` | Métricas de memória, filas Bull, mensagens falhas e alertas | `200 OK` |

---

## 📦 Backup, Restauração e Manutenção

A stack utiliza **Named Volumes otimizados** para garantir que nenhuma sessão do WhatsApp, mídia ou dado relacional seja perdido quando os containers pararem, falharem ou forem reiniciados.

- **Guia Completo de Persistência e DR:** [`docs/PERSISTENCIA-E-BACKUP.md`](docs/PERSISTENCIA-E-BACKUP.md)
- **Script de Backup:** `scripts/backup.sh` (Linux) ou `scripts/backup.ps1` (Windows)
- **Script de Restauração:** `scripts/restore.sh` (Linux) ou `scripts/restore.ps1` (Windows)

Consulte também o manual operacional em [`docs/ETAPA-5-OPERACAO.md`](docs/ETAPA-5-OPERACAO.md).

### Suíte de Testes Automatizada (Backend)
```bash
cd agilizap/backend

# Testes de Operação e Observabilidade (Etapa 5)
npm run test:operation

# Testes de IA e Supervisão (Etapa 4)
npm run test:ai-supervision

# Testes de Confiabilidade (Etapa 3)
npm run test:reliability

# Testes de Governança e Dados (Etapa 2)
npm run test:governance

# Testes de Segurança e Controle de Acesso (Etapa 1)
npm run test:security
```
