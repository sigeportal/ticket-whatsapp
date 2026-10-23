# Etapa 4 — IA e Supervisão Operacional (AI-01 e OPS-04)

**Aceite registrado em 22/10/2026:** o usuário aprovou expressamente a etapa 4 — IA e supervisão (AI-01 e OPS-04). Implementação e comportamento apresentados aceitos (falha segura de IA com transferência determinística para fila humana; sanitização estrita de `[RESUMO_IA]`, comandos de transferência e instruções de prompt; anti-colisão entre operador humano e robô; validação de áudio no servidor em até 10 minutos e 20 MB; teto orçamentário mensal de IA de R$ 50,00 por empresa com virada automática de mês; cálculo de expediente semanal no fuso `America/Campo_Grande` seg-sex 08h-17h e sáb 08h-12h com dispensa de feriados municipais para Fátima do Sul/MS; alertas de espera em fila acima de 10 minutos úteis com desduplicação por episódio e roteamento estrito para supervisores da fila ou administradores substitutos; e resolução exclusiva por resposta humana ou fechamento de ticket). Pendências externas de infraestrutura e implantação já documentadas continuam abertas; este aceite não comprova essas verificações nem autoriza publicação, uso de produção ou envio real. Etapa 5 não iniciada e depende de nova orientação.

Data: 22/10/2026. Estado: etapa aprovada pelo usuário. Não autoriza uso em produção, publicação ou envio de mensagens reais.

Esta etapa cumpre os requisitos **AI-01** (falha segura de IA, higienização estrita contra vazamentos de prompts/resumos internos, validação de áudio e teto orçamentário mensal) e **OPS-04** (cálculo de expediente comercial em `America/Campo_Grande`, alertas de espera em fila acima de 10 minutos úteis, desduplicação por episódio e roteamento estrito para supervisores da fila), preservando rigorosamente as decisões de negócio aprovadas (D-01: manter Baileys; sem API oficial; login simples email/senha; isolamento estrito multi-tenant; D-07: áudios de até 10 min e 20 MB validados no servidor; D-08: fuso America/Campo_Grande, seg-sex 08h-17h, sáb 08h-12h).

---

## 1. Escopo e Decisões de Arquitetura

| Tema | Definição aplicada |
|---|---|
| Falha Segura de IA | Em caso de timeout do provedor, exaustão de cota (`ResourceExhausted` / 429), erro 503, chave de API ausente ou resposta inválida, o sistema **não trava** e realiza **transferência determinística para a fila humana** com resumo interno do contexto |
| Sanitização de Conteúdo | Blocos de resumo interno (`[RESUMO_IA]...[/RESUMO_IA]`), diretivas operacionais (`Ação: Transferir para a fila [...]`) e instruções internas do prompt são **removidos do texto enviado ao cliente**, mesmo em cenários de resposta truncada pelo provedor |
| Anti-Colisão Atendente/Robô | Se um atendente humano assumir o ticket (`ticket.userId != null`) ou o ticket for fechado enquanto a IA processa, o envio da mensagem gerada pela IA é abortado imediatamente |
| Validação de Áudio no Servidor | Validação rígida no servidor de arquivos de áudio: duração máxima de **10 minutos (600s)** e tamanho máximo de **20 MB**. Áudios que excederem o limite não são enviados à IA e são encaminhados diretamente para atendimento humano com aviso claro |
| Teto Orçamentário de IA | Controle de gastos mensais por empresa (`aiMonthlyBudgetLimit`, `aiMonthlySpent`, `aiBudgetPeriod`). Atingido o teto, chamadas à IA são bloqueadas e novos atendimentos são direcionados para atendentes humanos |
| Expediente Comercial (`America/Campo_Grande`) | Horário útil em Mato Grosso do Sul (UTC-4): Segunda a Sexta das 08:00 às 17:00, Sábado das 08:00 às 12:00, Domingo e feriados fechados. Fora do expediente a contagem pausa e é retomada na abertura |
| Caso de Teste Canônico | Sábado às 11:55 + 10 minutos úteis = **Segunda-feira às 08:05** (ou Terça-feira às 08:05 em caso de feriado na segunda-feira) |
| Alertas de Espera em Fila | Tickets em espera acima de **10 minutos úteis** disparam alerta de supervisão. Mensagens adicionais do cliente ou respostas automáticas de bot **não reiniciam o relógio de espera**. Assumir o ticket sem enviar resposta **não encerra a espera**. A espera só é encerrada por **resposta humana** ou **encerramento do ticket** |
| Desduplicação de Alerta | Exatamente **1 alerta** gerado por episódio de espera (`currentWaitEpisodeId`), impedindo spam para a supervisão |
| Roteamento Estrito de Alertas | Alertas são direcionados estritamente aos **supervisores da fila específica** do ticket. Caso a fila não possua supervisores vinculados, o alerta escala para os administradores da empresa como substitutos |

---

## 2. Implementação por Requisito

### 2.1 AI-01 — Falha Segura e Governança de IA

- **Sanitização contra Vazamentos ([`AISanitizer.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/AIServices/AISanitizer.ts)):**
  - Isola blocos `[RESUMO_IA]...[/RESUMO_IA]` para notas internas, mesmo se a resposta do modelo tiver sido truncada sem a tag de fechamento (`[/RESUMO_IA]`).
  - Extrai comandos operacionais dinâmicos como `Ação: Transferir para a fila [Nome da Fila]` e resolve o ID da fila de destino sem vazar o comando textual para o cliente.
  - Higieniza diretivas residuais de prompt para que instruções internas da empresa nunca cheguem ao WhatsApp do cliente.
- **Validação de Áudio no Servidor ([`AIAudioValidator.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/AIServices/AIAudioValidator.ts)):**
  - Inspeciona o arquivo de mídia diretamente no disco/servidor antes de invocar transcrição ou modelos multimodais.
  - Verifica o tamanho do arquivo em bytes (limite de 20 MiB) e a duração em segundos (limite de 600 segundos) via inspeção de cabeçalho multimídia/ffmpeg.
  - Emite justificativas estruturadas (`FILE_SIZE_EXCEEDS_LIMIT`, `DURATION_EXCEEDS_LIMIT`) que acionam fallback gracioso.
- **Teto Orçamentário Mensal ([`AIBudgetService.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/AIServices/AIBudgetService.ts)):**
  - Verifica e debita custos de IA por empresa na tabela `Companies`.
  - Controle automático de virada de mês (`aiBudgetPeriod: 'YYYY-MM'`), reiniciando o acumulador mensal automaticamente.
  - Bloqueio imediato quando o gasto atinge ou ultrapassa `aiMonthlyBudgetLimit`, acionando fallback humano com motivo auditado `MONTHLY_BUDGET_EXCEEDED`.
- **Serviço Unificado de IA ([`AIService.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/AIServices/AIService.ts)):**
  - Envolve chamadas a provedores (Gemini, OpenAI) com timeout estrito configurável (padrão 25s).
  - Preserva o modelo e configurações salvas na base (sem substituição silenciosa de parâmetros).
  - Mapeia erros de cota (429 / ResourceExhausted), indisponibilidade (503) e timeout para transferência determinística para atendente humano com nota interna explicativa.
- **Anti-Colisão Atendente/Robô ([`wbotMessageListener.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/WbotServices/wbotMessageListener.ts)):**
  - Antes de gravar e enviar qualquer resposta originada pela IA no WhatsApp, o listener recarrega o estado atual do ticket no banco de dados.
  - Se um operador humano já tiver assumido o ticket (`ticket.userId !== null`) ou o ticket tiver sido finalizado/transferido durante o processamento da IA, o despacho é cancelado com registro em log.

---

### 2.2 OPS-04 — Expediente Comercial e Supervisão de Filas

- **Cálculo de Expediente Comercial ([`BusinessHoursService.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/ScheduleServices/BusinessHoursService.ts)):**
  - Fuso horário canônico: `America/Campo_Grande` (Mato Grosso do Sul, UTC-4).
  - Grade comercial:
    - Segunda a Sexta: 08:00 às 17:00 (540 minutos úteis/dia).
    - Sábado: 08:00 às 12:00 (240 minutos úteis/dia).
    - Domingo: fechado (0 minutos úteis).
  - Pausa fora do expediente e retomada automática no início do próximo expediente útil.
  - Suporte a calendário de feriados (municipais, estaduais e nacionais) via lista de strings `'YYYY-MM-DD'`.
  - Funções de alta precisão: `isBusinessTime`, `getNextBusinessOpening`, `addBusinessMinutes`, `calculateBusinessMinutesBetween`.
- **Gestão e Disparo de Alertas de Fila ([`QueueWaitAlertService.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/TicketServices/QueueWaitAlertService.ts)):**
  - `checkAndTriggerQueueWaitAlerts`: varre tickets em espera (`status: "pending"` ou `userId IS NULL`, com `lastClientMessageAt` definido).
  - Calcula os minutos úteis decorridos desde a última mensagem do cliente.
  - Se decorridos `>= 10` minutos úteis:
    - Verifica se já existe alerta registrado para o episódio atual (`currentWaitEpisodeId`).
    - Se já existir, **ignora** (desduplicação estrita de 1 alerta por episódio).
    - Se for inédito, localiza os supervisores vinculados à fila específica via `UserQueue`. Caso a fila não possua supervisores, busca administradores da empresa como substitutos.
    - Persiste o registro na tabela `QueueWaitAlerts` com `status: "pending_response"`.
    - Dispara notificação via Socket.IO para as salas dos supervisores (`user-${supervisorId}`) e registra log de auditoria `queue_wait_alert`.
- **Semântica de Encerramento de Espera ([`SendWhatsAppMessage.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/WbotServices/SendWhatsAppMessage.ts) e [`UpdateTicketService.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/TicketServices/UpdateTicketService.ts)):**
  - Mensagens adicionais enviadas pelo cliente atualizam `lastClientMessageAt`, mas **não alteram** o `currentWaitEpisodeId`, preservando a contagem de espera original.
  - Respostas automáticas de chatbots ou IA não encerram o episódio de espera da fila humana.
  - Apenas uma **resposta humana enviada por atendente** ou o **encerramento do ticket** (`status: "closed"`) resolve o alerta pendente (`status: "resolved"`), limpa `currentWaitEpisodeId` e carimba `resolvedAt` e `resolvedByUserId`.
- **API REST e Controle de Acesso (RBAC) ([`QueueWaitAlertController.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/controllers/QueueWaitAlertController.ts) e [`queueWaitAlertRoutes.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/routes/queueWaitAlertRoutes.ts)):**
  - `GET /queue-wait-alerts`:
    - Atendente comum (`user`): acesso negado com **HTTP 403 Forbidden** (`ERR_NO_PERMISSION`).
    - Supervisor (`supervisor`): visualiza estritamente os alertas pertencentes às filas sob sua gestão (`UserQueue`). Tentativas de consultar filas de terceiros retornam 403.
    - Administrador (`admin`): visualização ampla de todas as filas da sua empresa.

---

## 3. Modelo de Dados e Migração

Arquivo de migração: [`20261022020000-ai-supervision.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/database/migrations/20261022020000-ai-supervision.ts).
Totalmente reversível (`up` e `down`), verificado em PostgreSQL/WASM.

### 3.1 Tabela `QueueWaitAlerts`
- `id`: Chave primária inteira autoincrementável.
- `ticketId`: Chave estrangeira referenciando `Tickets(id)`.
- `queueId`: Chave estrangeira referenciando `Queues(id)`.
- `companyId`: Chave estrangeira referenciando `Companies(id)`.
- `episodeId`: Identificador único do episódio de espera (`VARCHAR(100)`).
- `businessMinutesWaiting`: Minutos úteis de espera apurados no momento do disparo.
- `recipientUserIds`: Lista JSON de IDs de usuários que receberam o alerta.
- `status`: Estado do alerta (`pending_response`, `resolved`, `cancelled`).
- `resolvedAt`: Carimbo temporal da resposta humana resolutora.
- `resolvedByUserId`: ID do usuário que respondeu ou encerrou o ticket.
- Índices criados:
  - `queue_wait_alerts_ticket_episode_unique` (composto único: `ticketId`, `episodeId`).
  - `queue_wait_alerts_company_status_idx` (composto: `companyId`, `status`).
  - `queue_wait_alerts_queue_idx` (`queueId`).

### 3.2 Extensões na Tabela `Tickets`
- `lastClientMessageAt`: Timestamp da mensagem mais recente recebida do cliente.
- `lastHumanResponseAt`: Timestamp da resposta mais recente enviada por atendente humano.
- `currentWaitEpisodeId`: Identificador único do ciclo de espera corrente (gerado na entrada na fila e nulo após resposta humana).

### 3.3 Extensões na Tabela `Companies`
- `aiMonthlyBudgetLimit`: Limite orçamentário mensal de IA em moeda local (definido como **R$ 50,00** por decisão aprovada em 22/10/2026).
- `aiMonthlySpent`: Total acumulado consumido no mês corrente.
- `aiBudgetPeriod`: Mês de competência (`YYYY-MM`).
- `aiRequestsCount`: Contador de requisições de IA no período.

---

## 4. Evidências de Teste e Regressão

A suíte de testes de IA e Supervisão (`tests/ai-supervision/run.cjs`) foi executada em ambiente isolado PostgreSQL/WASM (PGlite), sem conexões externas de rede ou instâncias reais do WhatsApp.

### 4.1 Resultados da Suíte `test:ai-supervision` (14/14 Aprovados)
1. `PASS migration up executed inside isolated PostgreSQL/WASM`
2. `PASS migration down/up reversibility verified`
3. `PASS AI-01: Sanitizacao - [RESUMO_IA] e Acao: Transferir sao extraidos e removidos do texto do cliente`
4. `PASS AI-01: Sanitizacao - Resposta truncada com [RESUMO_IA] sem fechamento nao vaza para o cliente`
5. `PASS AI-01: Fallback seguro - Timeout no provedor transfere para humano com resumo interno`
6. `PASS AI-01: Fallback seguro - Chave de API ausente transfere deterministica para humano`
7. `PASS AI-01: Audio validation - Audio superior a 10 min (600s) e rejeitado para IA e vai para humano`
8. `PASS AI-01: Orcamento - Teto mensal atingido bloqueia chamada a IA e encaminha para humano`
9. `PASS OPS-04: Horario util - Sabado 11h55 -> Segunda 08h05 sem feriado = exatamente 10 minutos uteis`
10. `PASS OPS-04: Horario util - Pausa fora do expediente e retomada na abertura`
11. `PASS OPS-04: Horario util - Feriado suspende contagem`
12. `PASS OPS-04: Alerta de espera - Disparo apos 10 minutos uteis e desduplicacao por episodio`
13. `PASS OPS-04: Alerta de espera - Fila sem supervisor escala para administradores (destinatario substituto)`
14. `PASS OPS-04: Semantica - Assumir ticket sem responder NAO encerra a espera`
15. `PASS OPS-04: Semantica - Resposta humana encerra espera e resolve alerta pendente`
16. `PASS OPS-04: API REST - Supervisor ve apenas alertas de suas filas e Atendente recebe 403`

### 4.2 Matriz de Regressão Geral (100% Verde)
- **Segurança (Etapa 1):** 23/23 testes aprovados (`npm run test:security`).
- **Governança de Dados (Etapa 2):** 12/12 testes aprovados (`npm run test:governance`).
- **Confiabilidade de Atendimento (Etapa 3):** 13/13 testes aprovados (`npm run test:reliability`).
- **IA e Supervisão (Etapa 4):** 14/14 testes aprovados (`npm run test:ai-supervision`).
- **Compilação TypeScript:** 0 erros (`npm run build`).

---

## 5. Decisões de Negócio Consolidadas em 22/10/2026

1. **Teto Orçamentário de IA (R$ 50,00/mês):** Aprovado expressamente pelo usuário o teto máximo de R$ 50,00 por mês em consumo de IA. Configurado como padrão no modelo `Company` e na migração.
2. **Localidade e Feriados:** Empresa situada em Fátima do Sul/MS (fuso `America/Campo_Grande`). O usuário dispensou o cadastro de feriados municipais locais ("os clientes já sabem os dias que não trabalhamos"). O cálculo de horas úteis opera sobre a grade semanal (seg-sex 08h-17h, sáb 08h-12h).
3. **Termos Legais dos Provedores:** Manter as chaves de API sob responsabilidade de faturamento da empresa com as provedoras (Google/OpenAI).
