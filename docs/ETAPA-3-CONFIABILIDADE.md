# Etapa 3 — Confiabilidade do atendimento (REL-01 a REL-04)

**Aceite registrado em 22/10/2026:** o usuário aprovou expressamente a etapa 3 — Confiabilidade do atendimento (REL-01 a REL-04). Implementação e comportamento apresentados aceitos (reconciliação de agendamentos vencidos durante paradas com transição para `EM_REVISAO` e revisão humana auditada; idempotência por `operationId`; máquina de estados de mensagem com detecção de falha incerta sem reenvio cego e retentativa manual controlada; concorrência atômica no claim de tickets com 409 Conflict; resolução de corrida na criação simultânea; e observabilidade detalhada de desconexões Baileys com interrupção de loops infinitos). Pendências externas de implantação já documentadas continuam abertas; este aceite não comprova essas verificações nem autoriza publicação, uso de produção ou envio real. Etapa 4 não iniciada e depende de nova orientação.

Data: 22/10/2026. Estado: etapa aprovada pelo usuário. Não autoriza uso em produção, publicação ou envio de mensagens reais.

Esta etapa cumpre os requisitos **REL-01** (agendamentos e paradas sem disparos acidentais em massa), **REL-02** (entrega, desduplicação e máquina de estados de mensagens), **REL-03** (concorrência atômica e consistência de tickets) e **REL-04** (observabilidade de conexão WhatsApp e continuidade operacional), preservando rigorosamente as decisões de negócio aprovadas (D-01: manter Baileys; sem API oficial; login simples email/senha; isolamento estrito multi-tenant).

---

## 1. Escopo e decisões preservadas

| Tema | Definição aplicada |
|---|---|
| WhatsApp | Biblioteca Baileys mantida; sem migração para API oficial ou provedores pagos |
| Agendamentos vencidos | Durante parada/queda de serviço, agendamentos vencidos **jamais são disparados automaticamente em massa**. São transferidos para o estado `EM_REVISAO` com justificativa e exigem revisão humana |
| Revisão de agendamentos | Somente administradores ou supervisores da mesma empresa podem aprovar ou cancelar agendamentos em revisão, gerando trilha de auditoria |
| Idempotência de envio | Chave de operação `operationId` persistida no modelo `Message` impede criação e processamento duplicado de mensagens em retentativas HTTP |
| Estados de mensagem | Máquina canônica de estados: `pending` → `processing` → `sended` (ack 1) → `delivered` (ack 2) → `read` (ack 3), além de `failed` e `uncertain` |
| Falha incerta | Quedas de socket e timeouts de rede sem ack de confirmação são classificados como `uncertain` com justificativa registrada, **bloqueando reenvio automático cego** |
| Retentativa controlada | Endpoint dedicado `POST /messages/:messageId/retry` restrito a mensagens `failed` ou `uncertain`, com incremento de tentativas e auditoria |
| Concorrência de tickets | Atualização condicional atômica (`UPDATE ... WHERE id = :id AND (userId IS NULL OR userId = :userId)`): quando dois operadores assumem ao mesmo tempo, exatamente um vence (HTTP 200) e o concorrente recebe **HTTP 409 Conflict** (`ERR_TICKET_ALREADY_CLAIMED`) |
| Conexão WhatsApp | Classificação canônica de desconexões: `LOGGED_OUT` (401), `BANNED_OR_FORBIDDEN` (403), `CONNECTION_REPLACED` (440), `BAD_SESSION` (500), `PERSISTENT_NETWORK_FAILURE`, com mensagem clara de ação requerida (`actionRequired`) no painel |

---

## 2. Implementação por Requisito

### 2.1 REL-01 — Agendamentos e paradas de serviço
- **Causa raiz prevenida:** Em sistemas legados com Bull/cron, se o backend ficasse offline por horas, ao reiniciar todos os jobs de agendamentos passados executavam simultaneamente ("rajada de mensagens"), disparando cobranças, lembretes ou avisos em horários inadequados (ex: madrugada) para centenas de clientes.
- **Serviço de Reconciliação:** Criado [`ScheduleReconciliationService.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/ScheduleServices/ScheduleReconciliationService.ts):
  - `reconcileOverdueSchedules`: Localiza agendamentos `PENDENTE` ou `AGENDADA` com `sendAt` no passado (com janela de tolerância de 60 segundos). Atualiza o status atomicamente para `EM_REVISAO` e preenche `interruptionReason` com carimbo temporal da indisponibilidade. Registra evento de auditoria `flag_overdue_review`.
  - Executado automaticamente no startup do serviço e em cada ciclo de verificação em [`queues.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/queues.ts).
  - `reviewSchedule`: Permite que administradores ou supervisores aprovem (`action: "approve"`, retornando ao estado `PENDENTE` para envio) ou cancelem (`action: "cancel"`, mudando para `CANCELADA`). Registra quem revisou (`reviewedBy`), o horário (`reviewedAt`) e gera log de auditoria com detalhes.
- **Endpoints:**
  - `POST /schedules/:scheduleId/review`: aprovação ou cancelamento humano (RBAC: `admin` ou `supervisor`).
  - `POST /schedules/reconcile`: disparo manual de varredura de agendamentos vencidos.
- **Fila e Worker (`queues.ts`):**
  - O agendamento calcula dinamicamente o atraso (`delay = sendAt - now`) evitando os 40 segundos arbitrários do legado.
  - Antes de despachar, o worker verifica se o registro foi cancelado (`CANCELADA`), enviado (`ENVIADA`) ou colocado em revisão (`EM_REVISAO`), abortando o envio com segurança se não estiver apto.
  - Atualizações via [`UpdateService.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/ScheduleServices/UpdateService.ts) para data futura revertem automaticamente o status de `EM_REVISAO` para `PENDENTE` e limpam `interruptionReason`.

### 2.2 REL-02 — Entrega, desduplicação e máquina de estados de mensagens
- **Idempotência (`operationId`):**
  - Adicionado campo `operationId` na tabela `Messages` com índice composto `[companyId, operationId]`.
  - [`CreateMessageService.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/MessageServices/CreateMessageService.ts): Se uma requisição chegar com um `operationId` já existente na empresa, retorna imediatamente a mensagem já persistida sem criar registro duplicado nem reenviar ao Baileys.
- **Máquina de Estados de Mensagem:**
  - Coluna `status` canônica (`pending`, `processing`, `sended`, `delivered`, `read`, `failed`, `uncertain`).
  - Em [`wbotMessageListener.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/WbotServices/wbotMessageListener.ts) (`handleMsgAck`), os acks recebidos do WhatsApp mapeiam os estados:
    - Ack 1 / 2: `sended` (servidor WhatsApp aceitou).
    - Ack 3: `delivered` (entregue ao aparelho de destino).
    - Ack 4: `read` (lido pelo destinatário).
    - Ack negativo: `failed`.
- **Tratamento de Falha Incerta:**
  - [`SendWhatsAppMessage.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/WbotServices/SendWhatsAppMessage.ts) categoriza erros via helper `isUncertainError(err)`: timeouts de socket (`ETIMEDOUT`, `ECONNRESET`), quedas durante espera de ack ou desconexão do socket Baileys.
  - Em caso de falha incerta, a mensagem é gravada como `status: "uncertain"` e `uncertainReason` é preenchido. **O sistema não tenta reenviar cegamente**, evitando duplicar a mensagem no WhatsApp do cliente caso ela já tenha trafegado na rede.
- **Endpoint de Retentativa Controlada:**
  - `POST /messages/:messageId/retry` em [`MessageController.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/controllers/MessageController.ts):
  - Permite retentativa manual apenas para mensagens em estado `failed` ou `uncertain`. Mensagens já entregues (`sended`, `delivered`, `read`) são rejeitadas com **HTTP 400 Bad Request** (`ERR_MESSAGE_NOT_RETRYABLE`).
  - Incrementa contador `retries`, reenvia via Baileys e registra auditoria.

### 2.3 REL-03 — Concorrência e consistência de tickets
- **Claim Atômico com Prevenção de Conflito:**
  - Em [`UpdateTicketService.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/TicketServices/UpdateTicketService.ts), quando um atendente assume um ticket (`userId` preenchido e status `open`):
  - É executado um `Ticket.update` condicional atômico no banco:
    ```sql
    UPDATE "Tickets"
    SET "userId" = :userId, "status" = 'open'
    WHERE "id" = :ticketId
      AND "companyId" = :companyId
      AND ("userId" IS NULL OR "userId" = :userId);
    ```
  - Se outro atendente assumiu frações de milissegundo antes, `affectedRows` será 0, e o serviço lança imediatamente **HTTP 409 Conflict** (`ERR_TICKET_ALREADY_CLAIMED`), impedindo sobrescrita silenciosa.
- **Validação de Transições e Pertencimento:**
  - Fechar ticket já fechado é rejeitado com **HTTP 400 Bad Request** (`ERR_TICKET_ALREADY_CLOSED`).
  - Transferência para filas, usuários ou conexões WhatsApp de outra empresa é rejeitada na camada de segurança ([`authorizeRequest.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/security/authorizeRequest.ts)) com **HTTP 403 Forbidden** e na camada de serviço com **HTTP 400 Bad Request** (`ERR_INVALID_QUEUE`, `ERR_INVALID_USER`, `ERR_INVALID_WHATSAPP`).
- **Resolução de Corrida na Criação de Tickets:**
  - Em [`FindOrCreateTicketService.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/TicketServices/FindOrCreateTicketService.ts), duas mensagens quase simultâneas de um contato novo poderiam disparar dois `Ticket.create` concorrentes.
  - Graças ao índice parcial único `tickets_active_contact_company_whatsapp_unique`, o segundo insert dispara `UniqueConstraintError`.
  - O serviço captura especificamente essa colisão concorrente e recarrega o ticket ativo criado pela primeira thread, retornando a mesma instância sem falhar o atendimento.

### 2.4 REL-04 — Conexão WhatsApp e observabilidade operacional
- **Diagnóstico Preciso de Desconexão:**
  - Atualizado [`wbot.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/libs/wbot.ts) em `connection.update`:
  - `DisconnectReason.loggedOut` (401): status `DISCONNECTED`, `disconnectReason: "LOGGED_OUT"`, `actionRequired: "Sessão encerrada no aparelho. Escaneie o QR Code novamente para conectar."`.
  - `DisconnectReason.connectionReplaced` (440): `disconnectReason: "CONNECTION_REPLACED"`, `actionRequired: "Sessão conectada em outro navegador ou dispositivo. Reconecte para assumir o controle."`.
  - 403 Forbidden: `disconnectReason: "BANNED_OR_FORBIDDEN"`, `actionRequired: "Acesso proibido ou número suspenso pelo WhatsApp (403). Verifique a linha junto ao WhatsApp."`.
  - `DisconnectReason.badSession` (500): `disconnectReason: "BAD_SESSION"`, `actionRequired: "Dados de sessão corrompidos. Reinicie a conexão e gere um novo QR Code."`.
- **Interrupção de Loops Infinitos de Falha:**
  - Erros transitórios de rede aplicam backoff exponencial (`min(1000 * 2^retries, 30000)` ms).
  - Ao atingir o teto de retentativas (`MAX_RECONNECT_RETRIES = 5`), o loop é interrompido, gravando `disconnectReason: "PERSISTENT_NETWORK_FAILURE"` e alertando o operador via `actionRequired`.
- **Limpeza no Sucesso:**
  - Conexão bem-sucedida (`connection === "open"`) zera o contador de retentativas e limpa `disconnectReason` e `actionRequired`.

---

## 3. Migração de Banco de Dados

Arquivo: [`20261022010000-service-reliability.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/database/migrations/20261022010000-service-reliability.ts).
Totalmente reversível (`up` e `down`).

### Alterações aplicadas:
1. **Tabela `Schedules`:**
   - Adicionadas colunas: `interruptionReason` (STRING), `reviewedBy` (INTEGER, FK Users), `reviewedAt` (DATE), `retries` (INTEGER default 0).
   - Índice composto: `schedules_company_status_send_at_idx` em `(companyId, status, sendAt)` para otimizar a varredura do worker de conciliação.
2. **Tabela `Messages`:**
   - Adicionadas colunas: `status` (STRING default 'pending'), `operationId` (STRING), `uncertainReason` (STRING), `retries` (INTEGER default 0).
   - Índices compostos: `messages_company_status_idx` em `(companyId, status)` e `messages_company_operation_id_idx` em `(companyId, operationId)`.
3. **Tabela `Whatsapps`:**
   - Adicionadas colunas: `disconnectReason` (STRING), `actionRequired` (TEXT), `lastDisconnectedAt` (DATE).

---

## 4. Evidências de Teste e Validação

### 4.1 Suíte de Confiabilidade (`npm run test:reliability`)
- **Arquivo:** [`agilizap/backend/tests/reliability/run.cjs`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/tests/reliability/run.cjs)
- **Ambiente:** PostgreSQL/WASM (PGlite) isolado em memória; zero dependências externas ou rede.
- **Resultado:** **13/13 aprovados (100%)**
  1. `PASS migration up executed inside isolated PostgreSQL/WASM`
  2. `PASS migration down/up reversibility verified`
  3. `PASS REL-01: Agendamentos vencidos durante parada sao reconciliados para EM_REVISAO sem disparo automatico`
  4. `PASS REL-01: Revisao humana - aprovacao e cancelamento auditados por admin e supervisor`
  5. `PASS REL-01: Cancelamento previo impede envio mesmo se o job estiver registrado`
  6. `PASS REL-01: Reagendamento para o futuro atualiza horario e reverte status para PENDENTE`
  7. `PASS REL-02: Idempotencia de mensagens - operationId evita criacao duplicada`
  8. `PASS REL-02: Maquina de estados de mensagem (pending -> sended -> delivered -> read)`
  9. `PASS REL-02: Falha incerta (timeout/rede) marca status uncertain sem reenvio cego`
  10. `PASS REL-02: Endpoint de retry manual controlado (POST /messages/:id/retry)`
  11. `PASS REL-03: Concorrencia ao assumir ticket - 1 vencedor e 1 conflito 409`
  12. `PASS REL-03: Validacao de transicoes de status e isolamento de fila/usuario`
  13. `PASS REL-03: Criacao simultanea de tickets para o mesmo contato recupera ticket ativo sem duplicar`
  14. `PASS REL-04: Observabilidade de desconexao WhatsApp - motivos e acoes requeridas`
  15. `PASS REL-04: Falha de rede persistente alerta operador e interrompe loops infinitos`

### 4.2 Verificação de Regressão
- **Segurança da Etapa 1:** `npm run test:security` → **23/23 aprovados**.
- **Governança da Etapa 2:** `npm run test:governance` → **12/12 aprovados**.
- **Compilação Backend:** `npm run build` → **tsc aprovado (0 erros)**.

---

## 5. Próxima Ação

Aguardar orientação e aprovação do usuário sobre a **Etapa 3** antes de iniciar a **Etapa 4 — IA e supervisão** (AI-01 e OPS-04: encaminhamento humano de falhas de IA e alerta de tempo de espera).
