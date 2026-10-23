# Homologação da etapa 1

**Aceite registrado em 22/10/2026:** o usuário aprovou expressamente a etapa 1 — Segurança e acesso, com login somente por e-mail/senha e sem troca obrigatória inicial. Implementação e comportamento apresentados aceitos. Pendências externas de implantação já documentadas continuam abertas; este aceite não comprova essas verificações nem autoriza publicação, uso de produção ou envio real. Etapa 2 não iniciada e depende de nova orientação. Registros anteriores de aceite parcial são históricos.


## Ensaio técnico descartável

Executar na raiz do projeto, no PowerShell, com Docker disponível no Ubuntu do WSL:

```powershell
wsl -d Ubuntu -- bash -lc 'cd /mnt/f/Projetos/ticket-whatsapp && bash agilizap/backend/tests/security/homologate.sh'
```

O Compose exclusivo `agilizap/backend/tests/security/compose.yml` usa PostgreSQL 14 e Redis 7, rede interna sem portas publicadas e armazenamento tmpfs. Não usa o Compose da aplicação, `.env`, uploads ou sessões existentes. O runner recebe somente migrations, testes e dependências locais em leitura. Credenciais fixas são exclusivamente fictícias, sem exposição de rede externa. Não substituir por credenciais reais.

O script encerra e remove seus containers/rede ao terminar, inclusive em falha. Recusa banco não vazio; se uma execução for interrompida abruptamente, remover apenas esse projeto antes de repetir:

```powershell
wsl -d Ubuntu -- bash -lc 'cd /mnt/f/Projetos/ticket-whatsapp && docker compose -f agilizap/backend/tests/security/compose.yml down'
```

Não usar `npm test`: seus hooks legados podem migrar, semear e reverter o banco configurado.

### Resultado de 21/10/2026

- 150 migrations aplicadas em PostgreSQL real, com 73 FKs. Migrações chamadas com a assinatura do Sequelize CLI; não foi executado o mecanismo de bookkeeping `SequelizeMeta` do CLI.
- Migração existente de temperatura corrigida: mudar tipo antes do default decimal, em transação. Sem essa correção, instalação nova falhava antes da migração de segurança. Pré-condição da instalação, sem nova funcionalidade de IA.
- Conta fictícia legada preservada, reset antigo limpo e versão de sessão incrementada.
- FK de empresa rejeita referência inexistente. Não constitui verificação exaustiva de todas as 73 FKs nem garante isolamento por empresa por si só.
- Duas conexões físicas concorrentes: exatamente uma consome o token pelo UPDATE condicional. Este ensaio valida SQL/locks; o controller HTTP é coberto separadamente pela suíte de segurança.
- `down/up` da migração de segurança preserva usuário e não restaura token/sessão revogados. Não foi revertida toda a cadeia histórica.
- Redis real: autenticação, PING e escrita/leitura de chave com TTL. Não valida ainda o processamento completo do Bull.
- `pg_dump` e `pg_restore` para segundo banco descartável: usuário fictício, versão e FKs conferidos. Não inclui backup externo ou mídia e não comprova RPO/RTO.
- Runner de migrations usa imagem Node 20 já disponível; não carrega aplicação/Baileys. O runtime da aplicação continua exigindo Node 22.19+.

Evidência: [postgres-redis-homologacao.txt](evidencias/etapa-1/postgres-redis-homologacao.txt).

## Painel local disponível para aceite humano

Preparado e validado em 21/10/2026. Abrir [contas e caixa de e-mail simulada](http://homologacao.localhost:18081/__homologacao) e [login](http://homologacao.localhost:18081/login). O hostname exclusivo separa cookies e armazenamento do `localhost` da aplicação existente. Acesso somente no próprio computador.

Para iniciar novamente, no PowerShell na raiz do projeto:

```powershell
./agilizap/backend/tests/security/start-panel.ps1
```

Para parar e descartar exclusivamente os dados do painel:

```powershell
./agilizap/backend/tests/security/stop-panel.ps1
```

O início recusa portas 18080/18081 ocupadas. Pare este painel antes de reiniciar; o novo início recria banco e Redis fictícios. Não usar o Compose da aplicação nem `server.ts` para este ensaio. Os scripts requerem Node 22.19+, dependências já instaladas, Docker no Ubuntu/WSL e as imagens PostgreSQL 14/Redis 7 disponíveis.

### Contas e dados

- Senha inicial de todas as contas: `Homologacao123`, exclusiva dos dados fictícios.
- Empresa A: `admin.a@example.invalid`, `supervisor.a@example.invalid`, `suporte.a@example.invalid`, `financeiro.a@example.invalid`, `primeiro.a@example.invalid`.
- Empresa B: mesmas contas com `.b@` no lugar de `.a@`.
- Administradores entram somente com e-mail e senha, conforme decisão aprovada e implementada em 22/10/2026.
- Todas as contas, inclusive as de teste `primeiro`, entram diretamente com e-mail e senha; não há troca obrigatória.
- Há quatro tickets e quatro anexos TXT fictícios, distribuídos entre suporte/financeiro das duas empresas. Links ficam na página de homologação. Começar como `suporte.a@example.invalid`: deve aparecer somente Suporte A em “Aguardando”.
- Solicitações de recuperação são capturadas na caixa de e-mail dessa mesma página; nenhum e-mail é enviado. Atualizar a caixa para obter o código e concluir manualmente a troca no formulário.
- Limites reais de abuso continuam habilitados: dez logins por IP/conta em 15 minutos e cinco solicitações de recuperação. Um 429 é esperado ao exceder os limites; aguardar ou recriar somente este ambiente descartável para um novo ensaio.

### Isolamento e limites do ensaio

`panel.cjs` carrega as rotas/controllers reais, Sequelize e toda a cadeia histórica no PostgreSQL descartável. Não importa `server.ts`, não inicia cron/workers e intercepta bootstrap/dotenv. Segredos JWT são aleatórios e exclusivos do processo. Banco/Redis usam endpoints fixos locais (55441/56391), nomes e credenciais fictícios, tmpfs e nenhum volume existente. Arquivos de teste ficam em diretório temporário exclusivo. Não copiar informações ou credenciais reais para o painel.

No processo do backend, sockets de saída só podem conectar aos endpoints locais do banco/Redis; UDP e criação de processos são bloqueados. Runtime do WhatsApp, IA, filas e helpers de sessões são substituídos por recusas. Leitura de mensagens não envia recibo ao canal. Nodemailer é capturado em memória, sem conexão SMTP. Rotas de ativação do WhatsApp/pagamentos são recusadas. Isso impede ensaiar entrega real, Bull completo e SMTP/TLS neste painel.

O frontend usa configuração/build separados, sem `.env`, com banner e CSP que limita recursos/conexões ao próprio painel. Service worker é desabilitado somente nesse build para evitar cache de ensaios anteriores. Build, PID e logs ficam em `.security-work/panel`, ignorado pelo Git. A caixa de e-mail fictícia são expostos intencionalmente somente no host local de teste; este entry point nunca deve ser publicado ou usado com dados reais.

O processo fica disponível para o aceite humano até executar o comando de parada. A parada valida o PID e o caminho temporário antes de remover seus dados. A instância final foi recriada após os testes HTTP, para restaurar as senhas/contas iniciais; o último teste visual apenas entrou e saiu como atendente, sem assumir ou modificar tickets.

### Verificações históricas de 21/10/2026

As referências a MFA abaixo descrevem a versão anterior. Login sem autenticador implementado em 22/10/2026; resultados atualizados constam no registro do plano e em `security-tests-sem-mfa.txt`.

- **12/12 grupos HTTP passaram** no Node 22.19/PostgreSQL real: credencial incorreta, MFA ausente/válido/replay, leitura ID/UUID/listagem por fila e empresa, mídia privada, promoção negada/exportação, primeiro acesso, recuperação genérica com consumo único, bloqueio/revogação, transferência pelo controller, integrações recusadas e logout. Cliente automatizado usa endereço de loopback distinto do navegador, sem desabilitar o limitador. Executar uma vez por instância limpa: `node tests/security/panel-check.cjs` no backend. Esse comando altera contas/tickets fictícios; recriar o painel antes do aceite humano.
- Pelo navegador: login do atendente, listagem restrita e aceite do ticket permitido; tentativa de URL de outra fila; login de administrador com MFA, lista de usuários limitada à empresa B, logout e solicitação de recuperação capturada em memória. No build final, conferidos login/listagem do atendente sem toast de permissão e sem erro de service worker.
- Correções decorrentes: hook de conexões consulta/assina eventos apenas para administradores; campos MFA/nova senha receberam IDs associados aos rótulos; recuperação retorna ao login em vez de anunciar cadastro público fechado. Sem ampliar permissões no servidor.
- Build separado do frontend e repetição dos **23/23** grupos isolados passaram; scripts de parar/recriar/iniciar verificados. Nenhuma alteração no backend de produção nesta continuação.
- Evidências: [HTTP](evidencias/etapa-1/panel-http-tests.txt), [atendente](evidencias/etapa-1/panel-attendant.png), [usuários da empresa B](evidencias/etapa-1/panel-users.png), [recuperação](evidencias/etapa-1/panel-recovery.png), [regressão](evidencias/etapa-1/security-tests.txt).

**Aceite humano continua pendente.** A automação não substitui a avaliação dos fluxos pelo responsável. Este ambiente HTTP de loopback não valida cookies Secure/HTTPS/proxy externos, SMTP/TLS real, histórico representativo de mídias existentes ou envio no canal. As verificações do ambiente de destino permanecem dependentes da infraestrutura/responsáveis; nenhuma etapa posterior foi iniciada.

No painel isolado, registrar conta, ação, esperado, observado e evidência para cada cenário:

| Cenário | Critério de aprovação |
|---|---|
| Login e primeiro acesso | Conta inicial entra com e-mail e senha configurados; credencial incorreta é negada |
| Login administrativo | E-mail e senha corretos permitem entrar sem autenticador; senha incorreta é negada |
| Recuperação com caixa de e-mail local | Troca funciona; token inválido, vencido ou reutilizado falha; sessão antiga revogada |
| Dois atendentes e supervisor, filas distintas | Somente filas atribuídas; redistribuição limitada às filas geridas |
| Duas empresas fictícias | IDs e links copiados não dão acesso a tickets, notas, mídia ou administração alheios |
| Perfil pessoal | Atendente não altera papel, empresa ou permissões |
| Conta bloqueada e ticket transferido com duas janelas abertas | Acesso e eventos cessam após perda de permissão |
| Exportação | Somente administrador; dados limitados à sua empresa |
| Upload | Formatos permitidos funcionam; limite de 20 MiB/arquivo e cinco/envio respeitado |
| Mídia antiga representativa | Referências válidas continuam utilizáveis; anônimo e outra empresa negados |
| Logout e recarga | Sessão encerrada não recupera acesso |

Anexar resultados sem senhas, tokens ou dados reais. HTTPS/proxy e SMTP/TLS no ambiente de destino dependem de configuração e responsáveis definidos. Nenhum envio real de WhatsApp é autorizado por este roteiro.

### Atualização de 22/10/2026 — sem autenticador

Login administrativo agora funciona somente com e-mail e senha, sem código. Caixa e tabela de contas não expõem mais MFA. Validação atual: **23/23 grupos isolados e 12/12 HTTP em PostgreSQL real aprovados**, com builds backend/frontend aprovados. Evidências: [segurança sem MFA](evidencias/etapa-1/security-tests-sem-mfa.txt) e [HTTP sem MFA](evidencias/etapa-1/panel-http-sem-mfa.txt). Não houve repetição do ensaio visual nesta alteração; screenshots anteriores são históricos. Painel recriado após os testes HTTP para restabelecer as contas fictícias. Aceite humano e validações externas continuam pendentes.

### Login simplificado — 22/10/2026

Retirados campo de nova senha e troca obrigatória. Para entrar no painel, usar `admin.a@example.invalid` e `Homologacao123` (somente homologação). Instalações usam a conta definida explicitamente por BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD. Validado: 23/23 grupos isolados, 12/12 HTTP e builds aprovados; tela conferida no navegador. Evidências com sufixo `-login-simples.txt` e `login-simples.png`. Registros anteriores de troca inicial ficam superados por esta decisão.
