# Etapa 2 — Dados e auditoria (GOV-01 e GOV-02)

**Aceite registrado em 22/10/2026:** o usuário aprovou expressamente a etapa 2 — Dados e auditoria (GOV-01 e GOV-02). Implementação e comportamento apresentados aceitos (trilha de auditoria, higienização, isolamento, ciclo de vida de tickets, retenção de 2 anos para conversas e 1 ano para anexos a partir de `closedAt`, Legal Hold, direitos dos titulares LGPD e opt-out de campanhas). Pendências externas de implantação já documentadas continuam abertas; este aceite não comprova essas verificações nem autoriza publicação, uso de produção ou envio real. Etapa 3 não iniciada e depende de nova orientação.

Data: 22/10/2026. Estado: etapa aprovada pelo usuário. Não autoriza uso em produção, publicação ou envio de mensagens reais.

Esta etapa cumpre os requisitos **GOV-01** (trilha de auditoria segura e estruturada) e **GOV-02** (ciclo de vida, retenção temporal, legal hold e direitos dos titulares / LGPD), preservando rigorosamente as decisões de negócio e o isolamento multi-tenant da arquitetura.

---

## 1. Escopo e decisões preservadas

| Tema | Definição aplicada |
|---|---|
| Empresa | Uma empresa inicial na operação; isolamento estrito por `companyId` nos modelos, consultas e auditoria |
| WhatsApp | Baileys mantido; sem chamadas de API externa ou envio real |
| Trilha de auditoria | Tabela `AuditLogs` imutável, indexada, com expurgo de dados sensíveis e acesso restrito a administradores |
| Conversas | Retenção máxima de **dois anos** (730 dias) a partir do encerramento do respectivo ticket (`closedAt`) |
| Anexos | Retenção máxima de **um ano** (365 dias) a partir do encerramento do respectivo ticket (`closedAt`), inclusive áudios |
| Novo atendimento | **Não renova** a retenção de tickets encerrados anteriores. Reabertura restrita à janela de tolerância; novos contatos geram novo ticket |
| Legal Hold | Bloqueio cautelar de expurgo por ticket com justificativa obrigatória; preserva conversas, anexos e impede anonimização de titular |
| Titular LGPD | Exportação completa de dossiê cadastral e anonimização/esquecimento seguro com exclusão física de mídias |
| Campanhas | Opt-out de contato implementado e respeitado nos workers de disparo de campanha |

A LGPD não define um prazo numérico rígido para guarda de mensagens de suporte/atendimento. Os prazos de 2 anos e 1 ano são escolhas operacionais da organização, justificadas pela necessidade de suporte, histórico operacional e prazo prescricional aplicável, e não constituem certificação jurídica automática.

---

## 2. Trilha de auditoria (GOV-01)

### 2.1 Modelo e armazenamento
- Tabela `AuditLogs` com campos:
  - `id`: identificador sequencial único;
  - `companyId`: identificador da empresa (tenant);
  - `userId`, `userEmail`, `userRole`: dados do operador ou sistema executor;
  - `resource`: recurso auditado (`auth`, `user`, `ticket`, `contact`, `retention`, `audit_log`, `campaign`);
  - `action`: verbo da ação (`create`, `update`, `delete`, `reset_password`, `close`, `reopen`, `transfer`, `export`, `purge`, `legal_hold`, `anonymize`, `opt_out`, etc.);
  - `result`: resultado (`success`, `failure`, `denied`);
  - `targetId`: identificador do objeto afetado (opcional);
  - `details`: JSON estruturado com metadados relevantes;
  - `ip`: endereço IP de origem;
  - `createdAt`: carimbo temporal UTC imutável.
- Índices para performance e consultas de conformidade: `[companyId, createdAt]`, `[companyId, resource]`, `[companyId, action]`.

### 2.2 Sanitização e segurança de credenciais
A função centralizadora [`logAuditEvent`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/security/audit.ts) aplica [`sanitizeAuditDetails`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/security/audit.ts#L10) recursivamente antes de qualquer inserção:
- Remove ou mascara chaves sensíveis: `password`, `token`, `secret`, `hash`, `authorization`, `creditCard`, `cpf`, `rg`.
- Garante que credenciais, códigos de redefinição e chaves de sessão jamais cheguem ao banco de auditoria.

### 2.3 Controle de acesso e rotas
- Endpoints implementados em [`AuditLogController.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/controllers/AuditLogController.ts) e [`auditLogRoutes.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/routes/auditLogRoutes.ts):
  - `GET /audit-logs`: listagem paginada com filtros por período (`startDate`, `endDate`), recurso (`resource`), ação (`action`), resultado (`result`) e operador (`actorUserId`).
  - `GET /audit-logs/export`: exportação estruturada em lote (limite de segurança de 5.000 registros por requisição).
- **RBAC Estrito:** ambos os endpoints exigem perfil `admin` ou `super`. Atendentes e supervisores recebem **HTTP 403 Forbidden**, e cada tentativa indevida gera automaticamente um registro de auditoria com `result: "denied"`.
- **Isolamento de tenant:** todo filtro e retorno é restrito ao `companyId` da sessão autenticada.

### 2.4 Eventos auditados
A auditoria foi integrada diretamente nos fluxos críticos:
1. **Contas e usuários:** criação, edição de perfil/filas e exclusão de operador ([`UserController.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/controllers/UserController.ts)).
2. **Autenticação:** conclusão de redefinição de senha com invalidação de sessões ([`ResetPassword.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/ResetPasswordService/ResetPassword.ts)).
3. **Tickets:** encerramento, reabertura e transferência de fila/usuário ([`UpdateTicketService.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/TicketServices/UpdateTicketService.ts) e [`TicketController.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/controllers/TicketController.ts)).
4. **Contatos:** exclusão definitiva e exportação em lote para CSV ([`ContactController.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/controllers/ContactController.ts) e [`ContactExportController.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/controllers/ContactExportController.ts)).
5. **Governança:** simulação/prévia de retenção, expurgo de conversas/mídias, alteração de legal hold, exportação de dossiê de titular, solicitação de anonimização e opt-out de marketing ([`DataRetentionController.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/controllers/DataRetentionController.ts)).

---

## 3. Retenção de dados, ciclo de vida e legal hold (GOV-02)

### 3.1 Ciclo de vida e solução da reabertura de tickets legados
No código original, [`FindOrCreateTicketService`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/TicketServices/FindOrCreateTicketService.ts) agrupava qualquer ticket fechado anterior do mesmo contato (`status IN ('open', 'pending', 'closed')`), unificando conversas de anos diferentes em uma mesma linha de ticket. Isso violava a retenção temporal, pois uma nova mensagem reiniciava o relógio de todas as mensagens antigas.

**Correção implementada:**
1. A busca inicial verifica tickets ativos (`status IN ('open', 'pending')`). Se houver, a interação ocorre nele.
2. Caso não haja ticket ativo, busca-se o último ticket encerrado. Se este tiver sido fechado dentro da janela de tolerância (`timeCreateNewTicket` configurado ou padrão de 2 horas), ele é reaberto: o status passa a `open` e o campo `closedAt` é limpo (`null`).
3. Se o último ticket tiver sido fechado há **mais tempo que a janela de tolerância**, o sistema cria um **NOVO ticket**. O ticket anterior permanece intacto, com seu `closedAt` inalterado, preservando sua contagem individual de retenção de 2 anos (conversas) e 1 ano (anexos).

### 3.2 Política de retenção e expurgo
O serviço [`DataRetentionService.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/services/DataRetentionService/DataRetentionService.ts) implementa:

1. **Prévia / Simulação (`previewRetention`):**
   - Endpoint: `GET /retention/preview?conversationRetentionDays=730&attachmentRetentionDays=365`.
   - Executa busca estritamente de leitura, calculando a quantidade de tickets e mensagens elegíveis a expurgo, quantidade de anexos elegíveis, arquivos encontrados em disco e quantidade de tickets protegidos por Legal Hold.
   - Retorna o relatório sem alterar nenhuma linha no banco nem desvincular arquivos.

2. **Expurgo seguro (`executeRetentionPurge`):**
   - Endpoint: `POST /retention/purge`.
   - Pode rodar em modo simulação (`dryRun: true`) ou execução definitiva (`dryRun: false`).
   - Expurgo de anexos (> 1 ano de ticket fechado): localiza mídias de mensagens vinculadas a tickets fechados sem legal hold, apaga fisicamente os arquivos em disco através de caminho confinado [`confinedPath`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/security/media.ts#L18) e limpa a coluna `mediaUrl` da mensagem, registrando `[anexo_expurgado_por_retencao]`.
   - Expurgo de conversas (> 2 anos de ticket fechado): remove mensagens e notas dos tickets elegíveis, e remove os registros de tickets concluídos que não estejam sob Legal Hold.
   - **Garantia de Legal Hold:** tickets com `legalHold: true` são estritamente excluídos de qualquer expurgo.

### 3.3 Legal Hold (Bloqueio Cautelar)
- Colunas adicionadas ao modelo [`Ticket.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/models/Ticket.ts): `legalHold` (boolean), `legalHoldReason` (string), `legalHoldAt` (Date).
- Endpoint: `PUT /retention/tickets/:ticketId/legal-hold`, corpo `{ "legalHold": true, "reason": "Notificação judicial / Processo nº ..." }`.
- Validações:
  - Justificativa textual não vazia é obrigatória ao ativar;
  - Restrito a administradores da mesma empresa;
  - Toda ativação/desativação gera evento de auditoria com o motivo registrado;
  - Bloqueia expurgo de conversas e de anexos durante todo o período ativo;
  - Bloqueia tentativas de anonimização/exclusão de dados do titular correspondente.

---

## 4. Direitos dos titulares e campanhas (LGPD)

### 4.1 Exportação de dossiê do titular
- Endpoint: `GET /retention/data-subject/:contactId`.
- Restrito a administradores da empresa do contato.
- Gera JSON estruturado com todos os dados pessoais mantidos: cadastro do contato, campos customizados, tags, histórico de tickets associados, mensagens enviadas/recebidas e anotações internas.
- Toda exportação é registrada na auditoria.

### 4.2 Anonimização / Direito ao esquecimento
- Endpoint: `POST /retention/data-subject/:contactId/anonymize`, corpo `{ "forceAnonymizeNonHeld": false }`.
- Validações:
  - Se houver qualquer ticket do contato sob `legalHold: true`, a exclusão é **recusada com HTTP 409 Conflict**, impedindo violação de dever legal de guarda.
  - Se aprovado: o nome do contato passa a `[Titular Excluído]`, o número de telefone é mascarado (`anon_...`), e-mail é limpo, campos customizados e listas de campanha são excluídos; mensagens têm o conteúdo substituído por `[Mensagem apagada a pedido do titular]` e mídias associadas são apagadas fisicamente do disco com `unlinkSync`.
  - Toda operação é auditada com metadados do operador e do contato afetado.

### 4.3 Opt-Out de campanhas
- Campo `optOutCampaign` (boolean) adicionado a `Contact` e `ContactListItem`.
- Endpoint: `POST /retention/contacts/:contactId/opt-out`, corpo `{ "optOut": true }`.
- Sincronização automática: ao alterar a flag no contato, todos os itens de listas de disparo vinculados têm a flag atualizada.
- Bloqueio operacional: os despachantes de campanha em [`queues.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/queues.ts#L45) verificam `contact.optOutCampaign`. Contatos com opt-out têm o envio de campanhas sumariamente cancelado/ignorado.

---

## 5. Migração de banco de dados e reversibilidade

- Arquivo: [`20261022000000-data-governance.ts`](file:///F:/Projetos/ticket-whatsapp/agilizap/backend/src/database/migrations/20261022000000-data-governance.ts).
- Operações de `up`:
  1. Cria tabela `AuditLogs` com índices por data, recurso e ação.
  2. Adiciona colunas `closedAt`, `legalHold`, `legalHoldReason`, `legalHoldAt` na tabela `Tickets`.
  3. Adiciona índice composto `[companyId, status, closedAt]` para otimização de consultas de retenção e atendimento.
  4. Adiciona colunas `optOutCampaign` nas tabelas `Contacts` e `ContactListItems`.
  5. Cria índice único parcial para garantir no máximo um ticket ativo por contato/empresa/canal.
- Operações de `down`:
  - Totalmente reversível. Remove as colunas criadas, descarta os índices e remove a tabela `AuditLogs`.
  - Reversibilidade integral comprovada em teste automatizado (`up` -> `down` -> `up`).

---

## 6. Verificações e evidências

A execução foi realizada em ambiente estritamente isolado (PostgreSQL/WASM PGlite em memória), sem contato com banco real, sem envio de mensagens reais e sem conexões de rede externas.

| Suíte de verificação | Comando | Resultado | Evidência |
|---|---|---|---|
| Governança e auditoria (GOV-01 e GOV-02) | `npm run test:governance` | **12/12 grupos passaram** | [governance-tests.txt](evidencias/etapa-2/governance-tests.txt) |
| Regressão de segurança e acesso (Etapa 1) | `npm run test:security` | **23/23 grupos passaram** | [security-regression-tests.txt](evidencias/etapa-2/security-regression-tests.txt) |
| Compilação TypeScript do backend | `npm run build` | **Aprovado (0 erros)** | [backend-build.txt](evidencias/etapa-2/backend-build.txt) |

### Grupos de teste validados na suíte de governança:
1. Execução de migration `up` em banco isolado.
2. Reversibilidade de migration `down` e re-aplicação `up`.
3. Sanitização de credenciais, imutabilidade e gravação de logs de auditoria.
4. Isolamento estrito de listagem de auditoria entre empresas distintas (Company 1 vs Company 2).
5. Bloqueio RBAC para atendentes (HTTP 403) e geração de log de auditoria com `result: "denied"`.
6. Exportação estruturada de logs com filtros por período e recurso.
7. Ciclo de vida de tickets: preenchimento de `closedAt`, limpeza na reabertura e auditoria das ações.
8. Reabertura vs novo ticket: interação dentro de 2h reabre; após a tolerância gera novo ticket e preserva `closedAt` antigo.
9. Legal Hold: proteção contra expurgo com justificativa obrigatória e RBAC.
10. Simulação de retenção (dry-run): contagem exata das fronteiras de 1 ano e 2 anos sem tocar dados ou arquivos.
11. Expurgo real de retenção: exclusão física de anexos confinados, limpeza de mensagens e proteção de tickets sob hold.
12. Direitos LGPD do titular: exportação de dossiê, anonimização bloqueada por legal hold, anonimização bem-sucedida sem hold e bloqueio de campanha por opt-out.

---

## 7. Pendências para implantação em produção

1. **Homologação e aceite humano:** o usuário deve conferir e aprovar o comportamento e as decisões desta etapa.
2. **Automação agendada de expurgo:** os endpoints `/retention/preview` e `/retention/purge` estão prontos e protegidos; antes de ativar execução automática periódica em produção (via cron ou Bull), a organização deve validar os relatórios de simulação com dados reais.
3. **Não autorização de produção:** nenhum dado de produção foi alterado e nenhuma etapa subsequente (Etapas 3 a 6) foi iniciada.
