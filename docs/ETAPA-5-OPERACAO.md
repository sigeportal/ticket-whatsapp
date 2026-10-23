# Etapa 5 — Operação, Observabilidade e Implantação (OPS-01 a OPS-03, DOC-01)

**Aceite registrado em 22/10/2026:** o usuário aprovou expressamente a etapa 5 — Operação, observabilidade e implantação (OPS-01 a OPS-03, DOC-01). Implementação e comportamento apresentados aceitos (backup estruturado com manifesto de integridade SHA-256 e rotação automática; restauração segura com prevenção de colisão de sessões Baileys e validação das metas RPO <= 24h e RTO <= 4h; probes de saúde `/health/live` e `/health/ready` com zero exposição de segredos e timeouts; observabilidade isolada de status de WhatsApp `/health/whatsapp`; endpoint de métricas operacionais `/health/metrics`; alertas operacionais desduplicados; sanitização de logs confidenciais; execução em container como usuário `node`; script de entrada com falha estrita em migrações e sem seeds no restart; graceful shutdown de filas Bull, banco e sockets; e documentação operacional completa com alinhamento do `README.md`). Pendências de homologação final continuam abertas; este aceite não comprova essas verificações nem autoriza publicação ou envio de mensagens reais. Etapa 6 não iniciada e depende de nova orientação.

Data: 22/10/2026. Estado: etapa aprovada pelo usuário. Não autoriza uso em produção, publicação ou envio de mensagens reais.

Esta etapa atende integralmente aos requisitos **OPS-01** (backup, restauração com validação de integridade, metas RPO/RTO e trava de segurança anti-colisão Baileys), **OPS-02** (endpoints de liveness e readiness com timeout e zero segredos, observabilidade isolada de WhatsApp, métricas operacionais e regras de alerta com desduplicação), **OPS-03** (runtime Node 22 LTS, execução com usuário não-privilegiado `node`, entrypoint estrito que aborta se migrações falharem sem rodar seeds no restart, e graceful shutdown para filas Bull, banco e sockets) e **DOC-01** (documentação operacional completa e correção das divergências do README).

---

## 1. Escopo e Decisões de Arquitetura

| Requisito | Solução Implementada |
|---|---|
| **OPS-01: Backup Estruturado** | Exportação consistente de tabelas essenciais (`Companies`, `Users`, `Contacts`, `Tickets`, `Messages`, `Settings`, `Schedules`, `Whatsapps`, `Queues`, `AuditLogs`, `QueueWaitAlerts`) e mídias confinados (`/app/public`), com metadados e checksum SHA-256 no arquivo `manifest.json`. Rotação configurável preservando as N cópias mais recentes |
| **OPS-01: Restauração Segura** | Validação de integridade SHA-256 antes de qualquer inserção; se houver adulteração, aborta com `ERR_BACKUP_INTEGRITY_COMPROMISED`. Medição e validação documental de conformidade com **RPO <= 24h** e **RTO <= 4h** |
| **OPS-01: Trava Anti-Colisão Baileys** | Ao restaurar uma base (`preventSessionCollision = true`), todas as conexões WhatsApp têm seu status redefinido para `DISCONNECTED` e QR code limpo, impedindo que o ambiente restaurado (ex: staging/homologação) dispute as credenciais da sessão em produção e cause banimento por loops de reconexão |
| **OPS-02: Liveness e Readiness** | `GET /health/live`: status do processo Express em tempo real. `GET /health/ready`: checagem com timeout de 3s para PostgreSQL (`SELECT 1`) e Redis (`ping`). Retorna 200 quando saudável ou 503 quando degradado, **sem jamais expor senhas, credenciais ou URIs de conexão** |
| **OPS-02: Observabilidade de WhatsApp** | `GET /health/whatsapp`: métricas e status das conexões Baileys por empresa (`total`, `connected`, `disconnected`, `qrcode`), observáveis separadamente da saúde central da aplicação |
| **OPS-02: Métricas Operacionais** | `GET /health/metrics`: consumo de memória RSS/Heap, filas Bull, contadores de mensagens `failed` e `uncertain`, alertas de fila pendentes e consumo orçamentário mensal de IA |
| **OPS-02: Alertas Operacionais** | Avaliação periódica com desduplicação para: WhatsApp desconectado > 5 minutos, falhas de entrega de mensagens e uso de disco > 80% |
| **OPS-02: Higienização de Logs** | Mascaramento de dados confidenciais (`password`, `token`, `secret`, `authorization`, `jwt`, `apiKey`, `db_pass`) com `[REDACTED]` tanto no Pino Logger quanto via helper `sanitizeLogData` |
| **OPS-03: Runtime e Segurança de Imagem** | Imagem `node:22-bookworm`, build TypeScript verificado, execução como usuário não-root `USER node` com diretórios `/app/public` e `/app/sessions` devidamente isolados |
| **OPS-03: Entrypoint com Falha Estrita** | `docker-entrypoint.sh` executa `npx sequelize db:migrate` com `set -e`. Caso a migração falhe, o container aborta imediatamente com erro, prevenindo execução com schema inconsistente. Seeds desabilitados no restart |
| **OPS-03: Graceful Shutdown** | Interceptação de `SIGINT` e `SIGTERM` fecha filas Bull (`stopQueueProcess`), pool de conexões do Sequelize e websockets de forma ordenada, com timeout de 30s |
| **DOC-01: Alinhamento da Documentação** | `README.md` corrigido para refletir a stack real: Node 22 LTS, React 17.0.2 + Vite, isolamento de portas internas de banco/Redis no Docker Compose |

---

## 2. Detalhamento dos Componentes

### 2.1 Backup e Restauração ([`BackupService.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/OperationServices/BackupService.ts) e [`RestoreService.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/OperationServices/RestoreService.ts))

- **Manifesto de Integridade (`manifest.json`):**
  Registra o UUID do backup, data UTC, alvos de RPO/RTO, checksums SHA-256 de cada tabela e o hash unificado das mídias.
- **Proteção contra Colisão de Sessão:**
  Em uma restauração de emergência ou teste em staging, o script impede colisão de chaves com o servidor ativo:
  ```typescript
  if (item.name === "Whatsapps" && options.preventSessionCollision !== false) {
    row.status = "DISCONNECTED";
    row.qrcode = null;
  }
  ```
- **Conformidade com RPO e RTO:**
  O serviço avalia a idade do backup em relação ao momento da restauração (`backupAgeHours <= 24`) e o tempo gasto na restauração (`durationMs <= 4h`), gerando o flag de conformidade no retorno.

### 2.2 Probes de Saúde e Métricas ([`HealthController.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/controllers/HealthController.ts))

- **`GET /health/live`:**
  Retorno 200 imediato:
  ```json
  { "status": "ok", "uptimeSeconds": 1420, "timestamp": "2026-10-22T21:00:00.000Z" }
  ```
- **`GET /health/ready`:**
  Verifica dependências com timeouts rigorosos:
  ```json
  {
    "status": "ok",
    "checks": { "database": "healthy", "redis": "healthy" },
    "timestamp": "2026-10-22T21:00:00.000Z"
  }
  ```
  *Em falha de banco ou Redis, retorna HTTP 503 com status `"degraded"` sem vazar credenciais.*
- **`GET /health/whatsapp`:**
  Permite que os operadores saibam se algum canal caiu sem que o Kubernetes ou balancer retire o pod do ar:
  ```json
  {
    "status": "ok",
    "summary": { "total": 2, "connected": 1, "disconnected": 1, "qrcode": 0, "other": 0 },
    "connections": [ ... ]
  }
  ```
- **`GET /health/metrics`:**
  Consolida métricas em tempo real:
  - Memória: `rssMb`, `heapTotalMb`, `heapUsedMb`;
  - Contagem de mensagens com falha ou incertas (`status = 'failed' | 'uncertain'`);
  - Fila de espera e alertas ativos da supervisão;
  - Gastos mensais de IA por empresa.

### 2.3 Alertas Operacionais e Higienização ([`OperationalAlertService.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/OperationServices/OperationalAlertService.ts) e [`logger.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/utils/logger.ts))

- **Regras de Alerta Avaliadas:**
  1. *WhatsApp desconectado há mais de 5 minutos* -> Severidade HIGH com instrução de leitura de QR code.
  2. *Mensagens em estado de falha ou incertas pendentes* -> Severidade MEDIUM/HIGH orientando retry controlado.
  3. *Tickets em espera acima do limite na fila* -> Severidade HIGH orientando intervenção da supervisão.
  4. *Uso de disco acima de 80%* -> Severidade HIGH/CRITICAL orientando rotação de logs/mídias.
- **Desduplicação:**
  Alertas idênticos ativos possuem janela de supressão de 10 minutos para prevenir flood e esgotamento de logs.
- **Higienização de Logs:**
  Função `sanitizeLogData` e paths de redação do Pino Logger limpam automaticamente senhas, chaves de API (`GEMINI_API_KEY`, `OPENAI_API_KEY`), tokens de autenticação e cookies de requisições.

### 2.4 Resiliência de Deploy e Dockerfile ([`Dockerfile`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/Dockerfile) e [`docker-entrypoint.sh`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/docker-entrypoint.sh))

- **Execução como usuário `node`:**
  Elimina o risco de container breakout por processos rodando como `root`.
- **Entrypoint seguro:**
  ```sh
  #!/bin/sh
  set -e
  echo "==> [Entrypoint] Verificando e executando migrações pendentes do banco de dados..."
  if ! npx sequelize db:migrate; then
    echo "==> [ERRO CRÍTICO] Falha ao executar migrações do banco de dados. Abortando inicialização..." >&2
    exit 1
  fi
  exec "$@"
  ```
- **Graceful Shutdown em `server.ts`:**
  Na chegada de `SIGINT` ou `SIGTERM`, aciona `stopQueueProcess()` que fecha pausadamente as filas Bull, fecha o pool do Sequelize e fecha os websockets em até 30 segundos.

---

## 3. Roteiro Operacional e Runbooks

### 3.1 Procedimento de Backup Manual
1. Para gerar um backup completo do banco e mídias confinados:
   ```bash
   # Dentro do container backend ou ambiente Node
   node -e "require('./dist/services/OperationServices/BackupService').BackupService.createBackup().then(console.log)"
   ```
2. O arquivo de manifesto gerado em `backups/backup-<UUID>/manifest.json` atesta a integridade e data do snapshot.

### 3.2 Procedimento de Restauração em Ambiente Isolado
1. Copiar a pasta de backup desejada para o ambiente alvo.
2. Executar a restauração com a trava de segurança ativa:
   ```bash
   node -e "require('./dist/services/OperationServices/RestoreService').RestoreService.restoreBackup('./backups/backup-<UUID>', { preventSessionCollision: true }).then(console.log)"
   ```
3. A integridade SHA-256 de cada tabela é conferida antes de qualquer inserção.
4. As sessões do WhatsApp permanecem em `DISCONNECTED`, permitindo que os operadores as ativem manualmente apenas quando o novo ambiente for promovido a produção.

### 3.3 Procedimento de Atualização (Deploy)
1. Realizar backup preventivo da base e dos arquivos.
2. Atualizar o repositório (`git pull`).
3. Recompilar imagens: `docker compose build backend frontend`.
4. Reiniciar serviços: `docker compose up -d`.
   - O `docker-entrypoint.sh` aplicará automaticamente as novas migrações.
   - Caso alguma migração falhe, o container para e não assume tráfego.

### 3.4 Procedimento de Rollback
1. Reverter o código para o commit anterior: `git checkout <commit_anterior>`.
2. Caso a migração anterior possua rollback reversível:
   `npx sequelize db:migrate:undo`
3. Reiniciar a stack com `docker compose up -d --build`.

---

## 4. Matriz de Testes Executados e Resultados

| Teste | Requisito | Resultado |
|---|---|---|
| Criação de backup estruturado com manifesto SHA-256 | OPS-01 | **APROVADO** |
| Rotina de rotação de backups preservando N cópias | OPS-01 | **APROVADO** |
| Detecção estrita de adulteração e rejeição com erro de integridade | OPS-01 | **APROVADO** |
| Restauração com métricas RPO/RTO e trava de segurança Baileys | OPS-01 | **APROVADO** |
| Liveness probe (`GET /health/live`) retornando 200 | OPS-02 | **APROVADO** |
| Readiness probe (`GET /health/ready`) com DB e Redis saudáveis | OPS-02 | **APROVADO** |
| Readiness probe (`GET /health/ready`) retornando 503 em falha de DB | OPS-02 | **APROVADO** |
| Zero vazamento de segredos nos endpoints de saúde | OPS-02 | **APROVADO** |
| Observabilidade isolada de conexões WhatsApp (`GET /health/whatsapp`) | OPS-02 | **APROVADO** |
| Métricas operacionais em tempo real (`GET /health/metrics`) | OPS-02 | **APROVADO** |
| Sanitização de logs (redação de senhas, tokens, chaves) | OPS-02 | **APROVADO** |
| Avaliação de regras de alertas operacionais e desduplicação | OPS-02 | **APROVADO** |
| Graceful shutdown e encerramento limpo de filas Bull (`stopQueueProcess`) | OPS-03 | **APROVADO** |
| Entrypoint Docker abortando em falha de migração e sem seeds | OPS-03 | **APROVADO** |
| Dockerfile com usuário não-privilegiado `node` | OPS-03 | **APROVADO** |
| **Suíte de Operação (`npm run test:operation`)** | **OPS-01 a OPS-03** | **15/15 APROVADOS** |
| **Regressão de IA e Supervisão (`npm run test:ai-supervision`)** | **AI-01 e OPS-04** | **14/14 APROVADOS** |
| **Regressão de Confiabilidade (`npm run test:reliability`)** | **REL-01 a REL-04** | **13/13 APROVADOS** |
| **Regressão de Governança (`npm run test:governance`)** | **GOV-01 e GOV-02** | **12/12 APROVADOS** |
| **Regressão de Segurança (`npm run test:security`)** | **SEC-01 a SEC-05** | **23/23 APROVADOS** |
| **Compilação Backend TypeScript (`npm run build`)** | **Geral** | **0 ERROS** |
