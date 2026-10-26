-- ==============================================================================
-- AGILIZAP / TICKET-WHATSAPP: CONSOLIDATED BASELINE SCHEMA (POSTGRESQL 14+)
-- ==============================================================================
-- Este arquivo consolida o estado final das 153 migrações históricas (2020 - 2026).
-- Permite provisionamento instantâneo de novos bancos de dados de teste, CI/CD ou 
-- novas instalações limpas sem necessidade de reprocessar 153 migrações incrementais.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. TABELAS CENTRAIS E MULTI-TENANCY
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "Plans" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "users" INTEGER NOT NULL DEFAULT 10,
    "connections" INTEGER NOT NULL DEFAULT 10,
    "queues" INTEGER NOT NULL DEFAULT 10,
    "value" NUMERIC(10, 2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS "Companies" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(255),
    "email" VARCHAR(255),
    "status" BOOLEAN DEFAULT true,
    "planId" INTEGER REFERENCES "Plans"("id") ON UPDATE CASCADE ON DELETE SET NULL,
    "dueDate" TIMESTAMP WITH TIME ZONE,
    "recurrence" VARCHAR(255) DEFAULT 'MENSAL',
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS "Users" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL UNIQUE,
    "passwordHash" VARCHAR(255) NOT NULL,
    "profile" VARCHAR(255) NOT NULL DEFAULT 'admin',
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "super" BOOLEAN NOT NULL DEFAULT false,
    "online" BOOLEAN NOT NULL DEFAULT false,
    "companyId" INTEGER NOT NULL REFERENCES "Companies"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "allTicket" VARCHAR(255) DEFAULT 'disabled',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastAccessAt" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS "Settings" (
    "id" SERIAL PRIMARY KEY,
    "key" VARCHAR(255) NOT NULL,
    "value" TEXT NOT NULL,
    "companyId" INTEGER REFERENCES "Companies"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "settings_key_company_idx" ON "Settings" ("key", "companyId");

-- ------------------------------------------------------------------------------
-- 2. CANAIS, FILAS E ATENDIMENTO
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "Whatsapps" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "session" TEXT,
    "qrcode" TEXT,
    "status" VARCHAR(255) DEFAULT 'DISCONNECTED',
    "battery" VARCHAR(255),
    "plugged" BOOLEAN,
    "retries" INTEGER DEFAULT 0,
    "greetingMessage" TEXT,
    "farewellMessage" TEXT,
    "complationMessage" TEXT,
    "outOfHoursMessage" TEXT,
    "ratingMessage" TEXT,
    "isDefault" BOOLEAN DEFAULT false,
    "companyId" INTEGER NOT NULL REFERENCES "Companies"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "token" TEXT,
    "provider" VARCHAR(255) DEFAULT 'beta',
    "number" VARCHAR(255),
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS "Queues" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "color" VARCHAR(255) NOT NULL,
    "greetingMessage" TEXT,
    "outOfHoursMessage" TEXT,
    "schedules" JSONB,
    "orderQueue" INTEGER DEFAULT 0,
    "integrationId" INTEGER,
    "promptId" INTEGER,
    "companyId" INTEGER NOT NULL REFERENCES "Companies"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS "UserQueues" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES "Users"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "queueId" INTEGER NOT NULL REFERENCES "Queues"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS "WhatsappQueues" (
    "id" SERIAL PRIMARY KEY,
    "whatsappId" INTEGER NOT NULL REFERENCES "Whatsapps"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "queueId" INTEGER NOT NULL REFERENCES "Queues"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS "Contacts" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "number" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "profilePicUrl" TEXT,
    "isGroup" BOOLEAN DEFAULT false,
    "companyId" INTEGER NOT NULL REFERENCES "Companies"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "extraInfo" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_number_company_idx" ON "Contacts" ("number", "companyId");

CREATE TABLE IF NOT EXISTS "Tickets" (
    "id" SERIAL PRIMARY KEY,
    "uuid" VARCHAR(255) NOT NULL DEFAULT uuid_generate_v4(),
    "status" VARCHAR(255) NOT NULL DEFAULT 'pending',
    "unreadMessages" INTEGER DEFAULT 0,
    "lastMessage" TEXT,
    "isGroup" BOOLEAN DEFAULT false,
    "userId" INTEGER REFERENCES "Users"("id") ON UPDATE CASCADE ON DELETE SET NULL,
    "contactId" INTEGER NOT NULL REFERENCES "Contacts"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "whatsappId" INTEGER REFERENCES "Whatsapps"("id") ON UPDATE CASCADE ON DELETE SET NULL,
    "queueId" INTEGER REFERENCES "Queues"("id") ON UPDATE CASCADE ON DELETE SET NULL,
    "companyId" INTEGER NOT NULL REFERENCES "Companies"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "closedAt" TIMESTAMP WITH TIME ZONE,
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "legalHoldReason" TEXT,
    "legalHoldAt" TIMESTAMP WITH TIME ZONE,
    "legalHoldBy" INTEGER REFERENCES "Users"("id") ON UPDATE CASCADE ON DELETE SET NULL,
    "lastClientMessageAt" TIMESTAMP WITH TIME ZONE,
    "lastHumanMessageAt" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX IF NOT EXISTS "tickets_uuid_idx" ON "Tickets" ("uuid");
CREATE INDEX IF NOT EXISTS "tickets_status_company_idx" ON "Tickets" ("status", "companyId");

CREATE TABLE IF NOT EXISTS "Messages" (
    "id" VARCHAR(255) PRIMARY KEY,
    "body" TEXT NOT NULL,
    "ack" INTEGER DEFAULT 0,
    "read" BOOLEAN DEFAULT false,
    "mediaType" VARCHAR(255),
    "mediaUrl" TEXT,
    "ticketId" INTEGER NOT NULL REFERENCES "Tickets"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "fromMe" BOOLEAN DEFAULT false,
    "isDeleted" BOOLEAN DEFAULT false,
    "contactId" INTEGER REFERENCES "Contacts"("id") ON UPDATE CASCADE ON DELETE SET NULL,
    "companyId" INTEGER NOT NULL REFERENCES "Companies"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "operationId" VARCHAR(255),
    "status" VARCHAR(50) DEFAULT 'pending',
    "uncertain" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX IF NOT EXISTS "messages_ticket_idx" ON "Messages" ("ticketId");
CREATE INDEX IF NOT EXISTS "messages_operation_idx" ON "Messages" ("operationId");

-- ------------------------------------------------------------------------------
-- 3. AUDITORIA, COMPLIANCE E OPERAÇÃO (ETAPAS 1 A 6)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "AuditLogs" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER REFERENCES "Companies"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "userId" INTEGER REFERENCES "Users"("id") ON UPDATE CASCADE ON DELETE SET NULL,
    "action" VARCHAR(100) NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "resourceId" VARCHAR(255),
    "details" JSONB,
    "ipAddress" VARCHAR(45),
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX IF NOT EXISTS "audit_logs_company_idx" ON "AuditLogs" ("companyId", "createdAt");

CREATE TABLE IF NOT EXISTS "QueueWaitAlerts" (
    "id" SERIAL PRIMARY KEY,
    "companyId" INTEGER NOT NULL REFERENCES "Companies"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "ticketId" INTEGER NOT NULL REFERENCES "Tickets"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "queueId" INTEGER NOT NULL REFERENCES "Queues"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "episodeId" VARCHAR(255) NOT NULL,
    "waitingSince" TIMESTAMP WITH TIME ZONE NOT NULL,
    "alertedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "businessMinutesWaiting" INTEGER NOT NULL,
    "recipientUserIds" JSONB NOT NULL DEFAULT '[]',
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending_response',
    "resolvedAt" TIMESTAMP WITH TIME ZONE,
    "resolvedByUserId" INTEGER REFERENCES "Users"("id") ON UPDATE CASCADE ON DELETE SET NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX IF NOT EXISTS "queue_wait_alerts_ticket_idx" ON "QueueWaitAlerts" ("ticketId", "status");

-- ------------------------------------------------------------------------------
-- 4. BAILEYS & SESSÕES
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "Baileys" (
    "id" SERIAL PRIMARY KEY,
    "whatsappId" INTEGER NOT NULL REFERENCES "Whatsapps"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "contacts" JSONB,
    "chats" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS "BaileysChats" (
    "id" SERIAL PRIMARY KEY,
    "whatsappId" INTEGER NOT NULL REFERENCES "Whatsapps"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "jid" VARCHAR(255) NOT NULL,
    "conversationTimestamp" BIGINT,
    "unreadCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS "BaileysMessages" (
    "id" SERIAL PRIMARY KEY,
    "whatsappId" INTEGER REFERENCES "Whatsapps"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "baileysChatId" INTEGER REFERENCES "BaileysChats"("id") ON UPDATE CASCADE ON DELETE CASCADE,
    "jsonMessage" JSONB NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);
