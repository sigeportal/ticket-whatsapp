# Inventário de rotas — etapa 1

Data: 21/10/2026. Inventário do código local após as alterações. A política detalhada e as limitações estão em [ETAPA-1-SEGURANCA.md](ETAPA-1-SEGURANCA.md).

O middleware `isAuth` recarrega usuário, empresa e filas do banco e executa `security/authorizeRequest.ts` usando o padrão canônico da rota. Rotas públicas de login/recuperação têm controles próprios. Um nome de evento contendo a empresa não é autorização: as salas precisam ser autorizadas.

| Método | Rota | Controle de entrada | Arquivo em `src/routes` |
|---|---|---|---|
| GET | `/announcements/list` | JWT + política de recurso | `announcementRoutes.ts` |
| GET | `/announcements` | JWT + política de recurso | `announcementRoutes.ts` |
| GET | `/announcements/:id` | JWT + política de recurso | `announcementRoutes.ts` |
| POST | `/announcements` | JWT + política de recurso + manutenção explícita | `announcementRoutes.ts` |
| PUT | `/announcements/:id` | JWT + política de recurso + manutenção explícita | `announcementRoutes.ts` |
| DELETE | `/announcements/:id` | JWT + política de recurso + manutenção explícita | `announcementRoutes.ts` |
| POST | `/announcements/:id/media-upload` | JWT + política de recurso + manutenção explícita | `announcementRoutes.ts` |
| DELETE | `/announcements/:id/media-upload` | JWT + política de recurso + manutenção explícita | `announcementRoutes.ts` |
| POST | `/auth/signup` | JWT + política de recurso | `authRoutes.ts` |
| POST | `/auth/login` | Pública + limite de abuso | `authRoutes.ts` |
| POST | `/auth/refresh_token` | Pública | `authRoutes.ts` |
| DELETE | `/auth/logout` | JWT + política de recurso | `authRoutes.ts` |
| GET | `/auth/me` | JWT + política de recurso | `authRoutes.ts` |
| GET | `/campaigns/list` | JWT + política de recurso | `campaignRoutes.ts` |
| GET | `/campaigns` | JWT + política de recurso | `campaignRoutes.ts` |
| GET | `/campaigns/:id` | JWT + política de recurso | `campaignRoutes.ts` |
| POST | `/campaigns` | JWT + política de recurso | `campaignRoutes.ts` |
| PUT | `/campaigns/:id` | JWT + política de recurso | `campaignRoutes.ts` |
| DELETE | `/campaigns/:id` | JWT + política de recurso | `campaignRoutes.ts` |
| POST | `/campaigns/:id/cancel` | JWT + política de recurso | `campaignRoutes.ts` |
| POST | `/campaigns/:id/restart` | JWT + política de recurso | `campaignRoutes.ts` |
| POST | `/campaigns/:id/media-upload` | JWT + política de recurso | `campaignRoutes.ts` |
| DELETE | `/campaigns/:id/media-upload` | JWT + política de recurso | `campaignRoutes.ts` |
| GET | `/campaign-settings` | JWT + política de recurso | `campaignSettingRoutes.ts` |
| POST | `/campaign-settings` | JWT + política de recurso | `campaignSettingRoutes.ts` |
| GET | `/chats` | JWT + política de recurso | `chatRoutes.ts` |
| GET | `/chats/:id` | JWT + política de recurso | `chatRoutes.ts` |
| GET | `/chats/:id/messages` | JWT + política de recurso | `chatRoutes.ts` |
| POST | `/chats/:id/messages` | JWT + política de recurso | `chatRoutes.ts` |
| POST | `/chats/:id/read` | JWT + política de recurso | `chatRoutes.ts` |
| POST | `/chats` | JWT + política de recurso | `chatRoutes.ts` |
| PUT | `/chats/:id` | JWT + política de recurso | `chatRoutes.ts` |
| DELETE | `/chats/:id` | JWT + política de recurso | `chatRoutes.ts` |
| GET | `/companies/list` | JWT + política de recurso + manutenção explícita | `companyRoutes.ts` |
| GET | `/companies` | JWT + política de recurso + manutenção explícita | `companyRoutes.ts` |
| GET | `/companies/:id` | JWT + política de recurso | `companyRoutes.ts` |
| POST | `/companies` | JWT + política de recurso + manutenção explícita | `companyRoutes.ts` |
| PUT | `/companies/:id` | JWT + política de recurso + manutenção explícita | `companyRoutes.ts` |
| PUT | `/companies/:id/schedules` | JWT + política de recurso | `companyRoutes.ts` |
| DELETE | `/companies/:id` | JWT + política de recurso + manutenção explícita | `companyRoutes.ts` |
| POST | `/companies/cadastro` | JWT + política de recurso + manutenção explícita | `companyRoutes.ts` |
| GET | `/companies/listPlan/:id` | JWT + política de recurso | `companyRoutes.ts` |
| GET | `/companiesPlan` | JWT + política de recurso + manutenção explícita | `companyRoutes.ts` |
| GET | `/contact-list-items/list` | JWT + política de recurso | `contactListItemRoutes.ts` |
| GET | `/contact-list-items` | JWT + política de recurso | `contactListItemRoutes.ts` |
| GET | `/contact-list-items/:id` | JWT + política de recurso | `contactListItemRoutes.ts` |
| POST | `/contact-list-items` | JWT + política de recurso | `contactListItemRoutes.ts` |
| PUT | `/contact-list-items/:id` | JWT + política de recurso | `contactListItemRoutes.ts` |
| DELETE | `/contact-list-items/:id` | JWT + política de recurso | `contactListItemRoutes.ts` |
| GET | `/contact-lists/list` | JWT + política de recurso | `contactListRoutes.ts` |
| GET | `/contact-lists` | JWT + política de recurso | `contactListRoutes.ts` |
| GET | `/contact-lists/:id` | JWT + política de recurso | `contactListRoutes.ts` |
| POST | `/contact-lists` | JWT + política de recurso | `contactListRoutes.ts` |
| POST | `/contact-lists/:id/upload` | JWT + política de recurso | `contactListRoutes.ts` |
| PUT | `/contact-lists/:id` | JWT + política de recurso | `contactListRoutes.ts` |
| DELETE | `/contact-lists/:id` | JWT + política de recurso | `contactListRoutes.ts` |
| POST | `/contacts/import` | JWT + política de recurso | `contactRoutes.ts` |
| POST | `/contacts/upload` | JWT + política de recurso | `contactRoutes.ts` |
| GET | `/contacts` | JWT + política de recurso | `contactRoutes.ts` |
| GET | `/contacts/list` | JWT + política de recurso | `contactRoutes.ts` |
| GET | `/contacts/export` | JWT + política de recurso | `contactRoutes.ts` |
| GET | `/contacts/:contactId` | JWT + política de recurso | `contactRoutes.ts` |
| POST | `/contacts` | JWT + política de recurso | `contactRoutes.ts` |
| PUT | `/contacts/:contactId` | JWT + política de recurso | `contactRoutes.ts` |
| DELETE | `/contacts/:contactId` | JWT + política de recurso | `contactRoutes.ts` |
| GET | `/contact` | JWT + política de recurso | `contactRoutes.ts` |
| GET | `/dashboard` | JWT + política de recurso | `dashboardRoutes.ts` |
| GET | `/dashboard/ticketsUsers` | JWT + política de recurso | `dashboardRoutes.ts` |
| GET | `/dashboard/ticketsDay` | JWT + política de recurso | `dashboardRoutes.ts` |
| GET | `/files/list` | JWT + política de recurso | `filesRoutes.ts` |
| GET | `/files` | JWT + política de recurso | `filesRoutes.ts` |
| POST | `/files` | JWT + política de recurso | `filesRoutes.ts` |
| PUT | `/files/:fileId` | JWT + política de recurso | `filesRoutes.ts` |
| GET | `/files/:fileId` | JWT + política de recurso | `filesRoutes.ts` |
| DELETE | `/files/:fileId` | JWT + política de recurso | `filesRoutes.ts` |
| DELETE | `/files` | JWT + política de recurso | `filesRoutes.ts` |
| POST | `/files/uploadList/:fileListId` | JWT + política de recurso | `filesRoutes.ts` |
| POST | `/forgetpassword` | Pública + limite de abuso | `forgotPasswordRoutes.ts` |
| POST | `/resetpasswords` | Pública + limite de abuso | `forgotPasswordRoutes.ts` |
| GET | `/helps/list` | JWT + política de recurso | `helpRoutes.ts` |
| GET | `/helps` | JWT + política de recurso | `helpRoutes.ts` |
| GET | `/helps/:id` | JWT + política de recurso | `helpRoutes.ts` |
| POST | `/helps` | JWT + política de recurso + manutenção explícita | `helpRoutes.ts` |
| PUT | `/helps/:id` | JWT + política de recurso + manutenção explícita | `helpRoutes.ts` |
| DELETE | `/helps/:id` | JWT + política de recurso + manutenção explícita | `helpRoutes.ts` |
| GET | `/invoices` | JWT + política de recurso | `invoicesRoutes.ts` |
| GET | `/invoices/list` | JWT + política de recurso | `invoicesRoutes.ts` |
| GET | `/invoices/all` | JWT + política de recurso | `invoicesRoutes.ts` |
| GET | `/invoices/:Invoiceid` | JWT + política de recurso | `invoicesRoutes.ts` |
| PUT | `/invoices/:id` | JWT + política de recurso + manutenção explícita | `invoicesRoutes.ts` |
| GET | `/messages/:ticketId` | JWT + política de recurso | `messageRoutes.ts` |
| POST | `/messages/:ticketId` | JWT + política de recurso + limite de abuso | `messageRoutes.ts` |
| DELETE | `/messages/:messageId` | JWT + política de recurso | `messageRoutes.ts` |
| POST | `/api/messages/send` | Token da conexão + limite de abuso | `messageRoutes.ts` |
| POST | `/messages/edit/:messageId` | JWT + política de recurso | `messageRoutes.ts` |
| POST | `/message/forward` | JWT + política de recurso | `messageRoutes.ts` |
| GET | `/plans` | JWT + política de recurso | `planRoutes.ts` |
| GET | `/plans/list` | JWT + política de recurso | `planRoutes.ts` |
| GET | `/plans/all` | JWT + política de recurso | `planRoutes.ts` |
| GET | `/plans/register` | JWT + política de recurso | `planRoutes.ts` |
| GET | `/plans/:id` | JWT + política de recurso | `planRoutes.ts` |
| POST | `/plans` | JWT + política de recurso + manutenção explícita | `planRoutes.ts` |
| PUT | `/plans/:id` | JWT + política de recurso + manutenção explícita | `planRoutes.ts` |
| DELETE | `/plans/:id` | JWT + política de recurso + manutenção explícita | `planRoutes.ts` |
| GET | `/prompt` | JWT + política de recurso | `promptRouter.ts` |
| POST | `/prompt` | JWT + política de recurso | `promptRouter.ts` |
| GET | `/prompt/:promptId` | JWT + política de recurso | `promptRouter.ts` |
| PUT | `/prompt/:promptId` | JWT + política de recurso | `promptRouter.ts` |
| DELETE | `/prompt/:promptId` | JWT + política de recurso | `promptRouter.ts` |
| GET | `/queueIntegration` | JWT + política de recurso | `queueIntegrationRoutes.ts` |
| POST | `/queueIntegration` | JWT + política de recurso | `queueIntegrationRoutes.ts` |
| GET | `/queueIntegration/:integrationId` | JWT + política de recurso | `queueIntegrationRoutes.ts` |
| PUT | `/queueIntegration/:integrationId` | JWT + política de recurso | `queueIntegrationRoutes.ts` |
| DELETE | `/queueIntegration/:integrationId` | JWT + política de recurso | `queueIntegrationRoutes.ts` |
| GET | `/queue-options` | JWT + política de recurso | `queueOptionRoutes.ts` |
| POST | `/queue-options` | JWT + política de recurso | `queueOptionRoutes.ts` |
| GET | `/queue-options/:queueOptionId` | JWT + política de recurso | `queueOptionRoutes.ts` |
| PUT | `/queue-options/:queueOptionId` | JWT + política de recurso | `queueOptionRoutes.ts` |
| DELETE | `/queue-options/:queueOptionId` | JWT + política de recurso | `queueOptionRoutes.ts` |
| POST | `/queue-options/:queueOptionId/media-upload` | JWT + política de recurso | `queueOptionRoutes.ts` |
| DELETE | `/queue-options/:queueOptionId/media-upload` | JWT + política de recurso | `queueOptionRoutes.ts` |
| GET | `/queue` | JWT + política de recurso | `queueRoutes.ts` |
| POST | `/queue` | JWT + política de recurso | `queueRoutes.ts` |
| GET | `/queue/:queueId` | JWT + política de recurso | `queueRoutes.ts` |
| PUT | `/queue/:queueId` | JWT + política de recurso | `queueRoutes.ts` |
| DELETE | `/queue/:queueId` | JWT + política de recurso | `queueRoutes.ts` |
| POST | `/queue/:queueId/media-upload` | JWT + política de recurso | `queueRoutes.ts` |
| DELETE | `/queue/:queueId/media-upload` | JWT + política de recurso | `queueRoutes.ts` |
| GET | `/quick-messages/list` | JWT + política de recurso | `quickMessageRoutes.ts` |
| GET | `/quick-messages` | JWT + política de recurso | `quickMessageRoutes.ts` |
| GET | `/quick-messages/:id` | JWT + política de recurso | `quickMessageRoutes.ts` |
| POST | `/quick-messages` | JWT + política de recurso | `quickMessageRoutes.ts` |
| PUT | `/quick-messages/:id` | JWT + política de recurso | `quickMessageRoutes.ts` |
| DELETE | `/quick-messages/:id` | JWT + política de recurso | `quickMessageRoutes.ts` |
| POST | `/quick-messages/:id/media-upload` | JWT + política de recurso | `quickMessageRoutes.ts` |
| DELETE | `/quick-messages/:id/media-upload` | JWT + política de recurso | `quickMessageRoutes.ts` |
| GET | `/schedules` | JWT + política de recurso | `scheduleRoutes.ts` |
| POST | `/schedules` | JWT + política de recurso | `scheduleRoutes.ts` |
| PUT | `/schedules/:scheduleId` | JWT + política de recurso | `scheduleRoutes.ts` |
| GET | `/schedules/:scheduleId` | JWT + política de recurso | `scheduleRoutes.ts` |
| DELETE | `/schedules/:scheduleId` | JWT + política de recurso | `scheduleRoutes.ts` |
| POST | `/schedules/:id/media-upload` | JWT + política de recurso | `scheduleRoutes.ts` |
| DELETE | `/schedules/:id/media-upload` | JWT + política de recurso | `scheduleRoutes.ts` |
| GET | `/settings` | JWT + política de recurso | `settingRoutes.ts` |
| GET | `/settings/:settingKey` | JWT + política de recurso | `settingRoutes.ts` |
| PUT | `/settings/:settingKey` | JWT + política de recurso | `settingRoutes.ts` |
| POST | `/settings/media-upload` | JWT + política de recurso + manutenção explícita | `settingRoutes.ts` |
| POST | `/subscription` | JWT + política de recurso | `subScriptionRoutes.ts` |
| POST | `/subscription/create/webhook` | JWT + política de recurso | `subScriptionRoutes.ts` |
| POST | `/subscription/webhook/:type?` | JWT + política de recurso | `subScriptionRoutes.ts` |
| GET | `/tags/list` | JWT + política de recurso | `tagRoutes.ts` |
| GET | `/tags` | JWT + política de recurso | `tagRoutes.ts` |
| GET | `/tags/kanban` | JWT + política de recurso | `tagRoutes.ts` |
| POST | `/tags` | JWT + política de recurso | `tagRoutes.ts` |
| PUT | `/tags/:tagId` | JWT + política de recurso | `tagRoutes.ts` |
| GET | `/tags/:tagId` | JWT + política de recurso | `tagRoutes.ts` |
| DELETE | `/tags/:tagId` | JWT + política de recurso | `tagRoutes.ts` |
| POST | `/tags/sync` | JWT + política de recurso | `tagRoutes.ts` |
| GET | `/ticket-notes/list` | JWT + política de recurso | `ticketNoteRoutes.ts` |
| GET | `/ticket-notes` | JWT + política de recurso | `ticketNoteRoutes.ts` |
| GET | `/ticket-notes/:id` | JWT + política de recurso | `ticketNoteRoutes.ts` |
| POST | `/ticket-notes` | JWT + política de recurso | `ticketNoteRoutes.ts` |
| PUT | `/ticket-notes/:id` | JWT + política de recurso | `ticketNoteRoutes.ts` |
| DELETE | `/ticket-notes/:id` | JWT + política de recurso | `ticketNoteRoutes.ts` |
| GET | `/tickets` | JWT + política de recurso | `ticketRoutes.ts` |
| GET | `/tickets/:ticketId` | JWT + política de recurso | `ticketRoutes.ts` |
| GET | `/ticket/kanban` | JWT + política de recurso | `ticketRoutes.ts` |
| GET | `/tickets/u/:uuid` | JWT + política de recurso | `ticketRoutes.ts` |
| POST | `/tickets` | JWT + política de recurso | `ticketRoutes.ts` |
| PUT | `/tickets/:ticketId` | JWT + política de recurso | `ticketRoutes.ts` |
| DELETE | `/tickets/:ticketId` | JWT + política de recurso | `ticketRoutes.ts` |
| POST | `/tickets/closeAll` | JWT + política de recurso | `ticketRoutes.ts` |
| PUT | `/ticket-tags/:ticketId/:tagId` | JWT + política de recurso | `ticketTagRoutes.ts` |
| DELETE | `/ticket-tags/:ticketId` | JWT + política de recurso | `ticketTagRoutes.ts` |
| GET | `/users` | JWT + política de recurso | `userRoutes.ts` |
| GET | `/users/list` | JWT + política de recurso | `userRoutes.ts` |
| POST | `/users` | JWT + política de recurso | `userRoutes.ts` |
| PUT | `/users/:userId` | JWT + política de recurso | `userRoutes.ts` |
| GET | `/users/:userId` | JWT + política de recurso | `userRoutes.ts` |
| DELETE | `/users/:userId` | JWT + política de recurso | `userRoutes.ts` |
| GET | `/version` | Pública | `versionRoutes.ts` |
| GET | `/whatsapp/` | JWT + política de recurso | `whatsappRoutes.ts` |
| POST | `/whatsapp/` | JWT + política de recurso | `whatsappRoutes.ts` |
| GET | `/whatsapp/:whatsappId` | JWT + política de recurso | `whatsappRoutes.ts` |
| PUT | `/whatsapp/:whatsappId` | JWT + política de recurso | `whatsappRoutes.ts` |
| POST | `/whatsapp-restart/` | JWT + política de recurso | `whatsappRoutes.ts` |
| DELETE | `/whatsapp/:whatsappId` | JWT + política de recurso | `whatsappRoutes.ts` |
| POST | `/whatsappsession/:whatsappId` | JWT + política de recurso | `whatsappSessionRoutes.ts` |
| PUT | `/whatsappsession/:whatsappId` | JWT + política de recurso | `whatsappSessionRoutes.ts` |
| POST | `/whatsappsession/:whatsappId/pairing-code` | JWT + política de recurso | `whatsappSessionRoutes.ts` |
| DELETE | `/whatsappsession/:whatsappId` | JWT + política de recurso | `whatsappSessionRoutes.ts` |

## Downloads e assets antes do router

- `/public/*`: sessão válida via Bearer ou cookie HttpOnly `mediaAccess`, seguida de autorização pela referência persistida e confinamento do caminho. Não usa `express.static` genérico.
- `/assets/*` e alias legado `/public/logotipos/*`: somente a lista fechada de imagens de identidade visual de `publicAssets.ts`. Nenhum anexo pode ser colocado nessa lista pelo cliente.
- `/version`: informação pública de versão já existente, sem dados de empresa.

## Socket.IO

Handshake em `auth.token`, usando o mesmo carregamento de sessão de REST. Query `token` deixou de ser aceita. Namespace padrão autenticado; o namespace dinâmico legado de exclusão de mensagem foi removido.

| Evento recebido | Autorização |
|---|---|
| `joinChatBox` / `leaveChatBox` | ID numérico; entrada exige empresa e fila autorizadas ou administrador da empresa |
| `joinTickets` / `leaveTickets` | Status enumerado; salas de empresa para admin ou somente filas vinculadas ao operador |
| `joinNotification` / `leaveNotification` | Mesma política das filas; nenhuma sala `queue-null` compartilhada |

Salas administrativas recebem conexões/QR, integrações, configuração, campanhas e listas. Chat interno publica conteúdo somente para membros. Ticket/mensagem usa ticket, fila ou administrador da mesma empresa. Alterações de usuário e bloqueio de empresa desconectam sockets; cada pacote revalida sessão e permissões e há verificação de inatividade a cada dez segundos. A expiração/revogação por alteração direta fora dos serviços também é detectada nessa verificação; revogação por serviços da aplicação é imediata.

## Limite da evidência

Este inventário lista registro e guardas das rotas; não afirma teste ponta a ponta de cada controller. A suíte usa controllers reais de contas, recuperação, notas, exportação e faturas, testes de política para outros recursos, sockets reais em loopback e PostgreSQL em memória. Não inicia workers ou sessões WhatsApp.
