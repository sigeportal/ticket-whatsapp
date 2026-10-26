# Plano Arquitetural: Transição de ORM (Sequelize v5 -> Drizzle ORM)

**Projeto:** Agilizap (Ticket WhatsApp)  
**Data:** Outubro de 2026  
**Status:** Planejado para execução assistida  

---

## 1. Contexto e Motivação da Transição

O backend do Agilizap utiliza atualmente `sequelize@5.22.3` com `sequelize-typescript@1.1.0`. 
* O **Sequelize v5 atingiu fim de vida (EOL) oficial em 2020** (mais de 4 anos descontinuado).
* Requer decorators experimentais legados e depende de construções JavaScript defasadas.
* O runtime é pesado, consome memória excessiva na instanciação de classes de modelo e não fornece tipagem estática inferida nativamente a partir das consultas SQL.

### Comparativo Arquitetural de Alternativas

| Critério | Sequelize v5 (Atual) | Prisma ORM | Drizzle ORM (Recomendado) |
|---|---|---|---|
| **Status / Suporte** | ❌ EOL desde 2020 | ✅ Ativo | ✅ Moderno & Ativo |
| **Paradigma** | Active Record (Classes) | Query Engine em Rust / Binário | TypeScript / SQL-First |
| **Overhead de Memória** | Alto (instâncias complexas) | Moderado (binário Rust adicional) | **Zero (compila para SQL puro)** |
| **Performance de Consultas** | Lenta / Mappers pesados | Moderada (IPC com Rust engine) | **Máxima (velocidade de driver puro pg)** |
| **Multi-Tenancy Isolation** | Manual / Where clause | Manual / Middleware | **Nativo via schemas ou SQL builders** |
| **Compatibilidade Docker/Alpine** | Precisa de libs C | Problemas comuns com musl libc | **100% JS/TS nativo (Node 22 / pglite)** |
| **Migrations** | Procedurais (Sequelize CLI) | Declarativas (Prisma migrate) | **Drizzle Kit (SQL puro + TS)** |

**Decisão Recomendada:** **Drizzle ORM**.
O Drizzle é a ferramenta ideal para a stack atual porque:
1. Não introduz binários externos de compilação C/Rust no container Docker (ao contrário do Prisma).
2. Funciona diretamente sobre o driver `pg` (já instalado e testado) e `@electric-sql/pglite` (nos testes).
3. Permite convivência progressiva (Dual-ORM): novos serviços podem usar Drizzle enquanto serviços antigos migram gradualmente do Sequelize.

---

## 2. Estratégia de Convivência Progressiva (Dual-ORM)

A substituição de ORM em uma base de produção com 87 testes automatizados e multi-tenant ativo não deve ser feita em "big bang". A transição segue a estratégia de convivência:

```
┌────────────────────────────────────────────────────────┐
│                   BACKEND RUNTIME                      │
├───────────────────────────┬────────────────────────────┤
│ Serviços Legados          │ Novos Módulos e Refatorados│
│ (ex: Typebot, Reports)    │ (ex: Tickets, Users, Auth) │
├───────────────────────────┼────────────────────────────┤
│ Sequelize v5              │ Drizzle ORM                │
└─────────────┬─────────────┴──────────────┬─────────────┘
              │                            │
              ▼                            ▼
      Pool Compartilhado PostgreSQL (pg / node-postgres)
```

1. **Compartilhamento de Conexão:** Tanto o Sequelize quanto o Drizzle compartilham a mesma instância do banco PostgreSQL (mesmo `pg.Pool`).
2. **Introspecção via Baseline:** O arquivo `src/database/baseline/schema.sql` gerado na Fase 3 permite rodar `npx drizzle-kit introspect` para gerar os esquemas tipados do Drizzle instantaneamente.
3. **Migração Serviço por Serviço:**
   - 1º: Serviços de Leitura e Relatórios (baixo risco).
   - 2º: Serviços de Autenticação e Usuários.
   - 3º: Serviços de Filas e Conexões WhatsApp.
   - 4º: Núcleo de Tickets e Mensagens.
4. **Remoção Final:** Ao zerar os imports de `sequelize` e `sequelize-typescript`, removem-se os pacotes do `package.json`.

---

## 3. Mapeamento de Schemas (Exemplo Ilustrativo)

### Modelo Legado (Sequelize-Typescript)
```typescript
@Table({ tableName: "Users" })
class User extends Model<User> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @Column email: string;
  @Column passwordHash: string;
  @ForeignKey(() => Company) @Column companyId: number;
}
```

### Schema Moderno (Drizzle ORM)
```typescript
import { pgTable, serial, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const users = pgTable("Users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  profile: varchar("profile", { length: 255 }).default("admin").notNull(),
  tokenVersion: integer("tokenVersion").default(0).notNull(),
  super: boolean("super").default(false).notNull(),
  companyId: integer("companyId").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull()
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

---

## 4. Próximos Passos
- Na Fase 4 e Fase 5 o frontend será desacoplado e tipado.
- A implementação prática do Drizzle ORM poderá ser acionada como evolução técnica subsequente sobre a base limpa e o schema baseline agora estabelecidos.
