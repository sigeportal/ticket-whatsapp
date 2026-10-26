# Baseline Schema Migration (PostgreSQL 14+)

## Propósito
Este diretório consolida a estrutura final e estável do banco de dados do Agilizap, após a execução de todas as 153 migrações herdadas do Whaticket e as expansões corporativas de segurança e governança (Etapas 1 a 6).

## Benefícios
1. **Provisionamento Instantâneo:** Ambientes de teste, CI/CD, homologação e novos clientes podem inicializar o banco diretamente a partir do `schema.sql` em < 1 segundo, sem reprocessar 153 migrações procedurais uma a uma.
2. **Ponte para o Novo ORM:** Serve como especificação formal e canônica de DDL para a geração automática dos schemas do **Drizzle ORM** (`drizzle-kit introspect`).
3. **Preservação Histórica:** As migrações incrementais em `src/database/migrations/` permanecem ativas para instâncias legadas já em produção através da tabela `SequelizeMeta`.
