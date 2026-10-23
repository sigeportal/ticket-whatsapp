# Etapa 1 — Segurança e acesso

**Aceite registrado em 22/10/2026:** o usuário aprovou expressamente a etapa 1 — Segurança e acesso, com login somente por e-mail/senha e sem troca obrigatória inicial. Implementação e comportamento apresentados aceitos. Pendências externas de implantação já documentadas continuam abertas; este aceite não comprova essas verificações nem autoriza publicação, uso de produção ou envio real. Etapa 2 não iniciada e depende de nova orientação. Registros anteriores de aceite parcial são históricos.


Data: 21/10/2026. Estado: implementação local entregue, aceite da etapa **parcial** até as validações externas e de integração abaixo. Não autoriza piloto com dados reais, migração em ambiente existente ou publicação.

Atualização da homologação: cadeia de 150 migrations, 73 FKs, concorrência de reset em duas conexões, Redis e backup/restauração fictícios agora verificados em PostgreSQL 14/Redis 7 reais no Docker/WSL. Detalhes, limites e roteiro humano em [HOMOLOGACAO-ETAPA-1.md](HOMOLOGACAO-ETAPA-1.md). As afirmações abaixo de que a cadeia histórica não foi ensaiada descrevem a entrega inicial; esta atualização cobre esse ensaio sem certificar todas as constraints ou o painel completo.

Continuação: painel local Node 22/PostgreSQL preparado com dez contas fictícias, caixa de e-mail simulada e integrações bloqueadas. 12/12 grupos HTTP reais e verificações pelo navegador aprovados; 23/23 grupos isolados repetidos. Ver o roteiro acima para acessar/iniciar/parar. Aceite humano e configuração do ambiente de destino continuam abertos; a etapa não está concluída.

## Escopo e decisões preservadas

Uma empresa na operação inicial, com segunda empresa apenas fictícia nos testes; Baileys mantido; atendente por filas, supervisor por filas geridas, administrador da empresa e manutenção de plataforma separada. Nenhuma retenção, expurgo, regra de recuperação de agendamentos, SLA, IA paga ou alerta de espera foi habilitado. Alterações de workers nesta entrega somente revalidam empresa/vínculos e caminhos de mídia.

O estado inicial e o diff anterior foram guardados em `.security-work/before-status.txt` e `.security-work/before.patch`, ignorados pelo Git. Alterações de interface, IA, contatos e identificação LID já existentes foram preservadas. Manifesto/lock da raiz sem relação com esta etapa também foram preservados. Não houve commit nem execução contra banco, Redis, SMTP ou WhatsApp de produção.

## Matriz aplicada no servidor

`user` representa atendente; `supervisor` é o novo perfil. Vínculos de `UserQueue` representam filas atendidas/geridas. `allTicket` não contorna essa política. Ausência de fila não concede acesso a operador: o administrador deve classificar esses tickets.

| Recurso / ação | Atendente | Supervisor | Administrador da empresa |
|---|---|---|---|
| Ler ticket, mensagens, notas e mídia | Filas vinculadas | Filas geridas | Sua empresa |
| Criar ticket e assumir disponível | Fila vinculada, para si | Filas geridas | Sua empresa |
| Alterar/transferir ticket | Próprio, sem redistribuir para outro operador/fila | Redistribui nas filas geridas; destinatário precisa pertencer à fila | Sua empresa, com validação de destinatário/fila/conexão |
| Criar/editar notas | Ticket acessível; autor derivado da sessão | Mesmo controle | Sua empresa |
| Excluir definitivamente tickets, notas, mensagens ou contatos | Negado | Negado | Sua empresa |
| Contatos comuns | Sua empresa | Sua empresa | Sua empresa |
| Exportação em massa de contatos | Negado | Negado | Endpoint autorizado, limitado à sua empresa; CSV protege células de fórmula |
| Editar usuário | Próprios nome/e-mail/senha | Próprios nome/e-mail/senha | Usuários da sua empresa; papéis, filas e bloqueio explícitos |
| Criar/excluir usuário e alterar papel/vínculos | Negado | Negado | Sua empresa; não altera empresa nem concede `super` |
| Filas | Dados básicos de filas vinculadas | Dados básicos de filas geridas | Configuração da sua empresa |
| Conexões, QR, integrações, prompts, configurações, campanhas, listas e arquivos administrativos | Negado | Negado | Sua empresa |
| Relatórios legados agregados | Negado | Negado enquanto não houver consultas por filas | Sua empresa |
| Agendamentos | Leitura/criação próprios; alterações administrativas continuam restritas | Mesmo controle | Sua empresa |
| Respostas rápidas | Próprias ou gerais na leitura; edição própria | Mesmo controle | Sua empresa |
| Chat interno | Membro do chat da empresa | Mesmo controle | Sua empresa; publicação de conteúdo restrita aos membros |
| Faturas | Negado | Negado | Leitura da sua empresa; alteração exige manutenção |
| Manutenção da plataforma, planos e identidade visual pública | Negado | Negado | Exige também `super` e `PLATFORM_MAINTENANCE_ENABLED=true`, com registro seguro em log |

Exemplos: atendente A em suporte lê ticket pendente de suporte A e o assume; não assume para outro usuário, não acessa financeiro nem empresa B. Supervisor de suporte redistribui dentro de suporte, mas não ganha administração de usuários ou integrações. Administrador A não troca `companyId` para administrar B. `super` não é concedido por formulário e não substitui as checagens de empresa nas rotas operacionais.

O inventário de registros de rota e sockets está em [INVENTARIO-ACESSO-ETAPA-1.md](INVENTARIO-ACESSO-ETAPA-1.md). O inventário não substitui os testes de controller.

## Recuperação e sessões

- `POST /forgetpassword`, corpo `{ "email": "..." }`: resposta 202 genérica. SMTP aguardado, falhas observáveis por evento sem e-mail, senha, token ou erro bruto do provedor.
- `POST /resetpasswords`, corpo `{ "email": "...", "token": "...", "password": "..." }`. Rotas antigas com senha/e-mail/token na URL foram removidas.
- Token aleatório de 32 bytes, SHA-256 persistido, validade de 30 minutos. Um `UPDATE` condicional consome token e incrementa versão; duas tentativas concorrentes permitem no máximo um sucesso.
- Política de senha: mínimo oito caracteres, maiúscula, minúscula e número, máximo 72 bytes UTF-8 para impedir truncamento pelo bcrypt; novas senhas usam custo 12.
- Access token: HS256, 15 minutos, somente em memória do navegador. Refresh: cookie HttpOnly, Secure em produção, SameSite Strict, sete dias renováveis. Cookie `mediaAccess`: HttpOnly, escopo `/public`, 15 minutos. Ambos são revogáveis pela versão da conta; cookies não carregam senha.
- REST recarrega perfil, bloqueio, empresa e filas atuais. Logout, troca/redefinição de senha, edição administrativa de usuário e bloqueio invalidam sessões; exclusão impede recarga. Transferência remove imediatamente assinantes que perderam acesso à fila, antes dos novos eventos. Sockets usam `auth.token`, revalidam cada pacote e verificam expiração/permissões ociosas a cada dez segundos; serviços de revogação desconectam imediatamente.
- Operações com cookies exigem Origin idêntico a `FRONTEND_URL`. CORS de produção só permite a origem configurada. A implantação precisa manter painel/API no mesmo site para SameSite Strict, validar HTTPS e ajustar o proxy explicitamente.
- Login: 10 tentativas por IP e por conta em 15 minutos; recuperação: cinco em 15 minutos; envio: 60 por IP/minuto. Janelas expiram e têm memória limitada. Limitador local atende um processo; antes de múltiplas réplicas, usar limitador compartilhado. `TRUSTED_PROXIES` aceita IPs/sub-redes explícitos, nunca confiar em qualquer `X-Forwarded-For`.

## Login administrativo e bootstrap

Decisão revisada e implementada em 22/10/2026: administradores (inclusive contas `super`) entram somente com e-mail e senha, sem autenticador. O usuário reconheceu e aceitou a redução de segurança. Campo OTP, validação TOTP e configuração MFA foram retirados; política de senha, bloqueio, revogação, isolamento e limites de abuso permanecem. A coluna histórica `mfaLastStep` fica inerte por compatibilidade; nenhuma migração adicional ou alteração em dados existentes é necessária.

Seed de administrador exige `BOOTSTRAP_ADMIN_EMAIL` e senha explícita que cumpra a política; não usa e-mail/senha padrão. `BOOTSTRAP_PLATFORM_ADMIN` é falso salvo habilitação explícita. Decisão de 22/10/2026: a conta entra diretamente com a senha configurada, sem troca obrigatória. O campo extra do login foi removido; flags históricas de troca são inertes, sem alterar dados existentes. Remover credenciais de bootstrap do ambiente após o procedimento. Seeds não rodam mais no restart Docker. Cadastro anônimo de empresas/usuários foi fechado; licenciamento/plano não é escolhido por cliente anônimo.

## Mídias e limites

- Arquivo: **20.971.520 bytes (20 MiB)**. Envio: cinco arquivos, **104.857.600 bytes (100 MiB)** de conteúdo; overhead multipart é separado. Proxy preparado para 101 MiB e 60 segundos; aplicar os mesmos limites no proxy externo da API, que não foi configurado nesta entrega.
- Tipos: JPEG, PNG, GIF, WebP, ICO, PDF, MP3, OGG/Opus, WAV, MP4/M4A, WebM, TXT/CSV, DOCX/XLSX. Extensão, MIME e assinatura precisam concordar. Importação de contatos aceita CSV/XLSX. Identidade visual aceita PNG/ICO enumerados, sem SVG executável.
- Office: tipo interno DOCX/XLSX, até mil entradas, 20 MiB expandidos por entrada, 50 MiB totais, sem macros/embeddings e sem caminhos de escape; processamento limitado. Não é antivírus nem certificação de segurança do documento.
- Arquivos usam nomes aleatórios, caminhos confinados e checagem de symlinks/junctions. Não há `0777`. Falhas de upload e importações temporárias são limpas. Até quatro uploads simultâneos e um por identidade; reserva de 256 MiB de disco, além do conteúdo potencial em processamento. Quotas persistentes e monitoramento do volume dependem do ambiente.
- Recebimento do WhatsApp usa stream com limite real de bytes/tempo, validação e nome aleatório; formatos/tamanhos recusados mantêm atendimento via placeholder. Não são enviados automaticamente à IA como consequência dessa mudança.
- Áudio de saída usa `execFile` sem shell, timeout, limites de saída e nomes aleatórios. O limite de dez minutos para IA pertence à etapa 4 e não foi implementado aqui.
- URLs privadas antigas continuam exigindo autenticação. Referências persistidas de mensagens, filas, agendamentos, campanhas, respostas rápidas, anúncios e listas são verificadas no banco. Diretórios legados `quickMessage`, `fileList`, anúncios e arquivos planos são preservados; nenhum arquivo existente foi movido/apagado neste trabalho.
- Arquivos legados com nome compartilhado entre empresas são recusados quando a referência é ambígua: reconciliar cópia/referências em homologação, com backup, sem abrir acesso público para contornar a falha. Mídias que não tenham referência autorizável também são recusadas.
- Assets públicos são somente a lista fechada de logotipos/ícones, em `/assets` e alias legado `/public/logotipos`. O upload de identidade visual valida o conteúdo antes de substituir um recurso enumerado; não aceita caminho arbitrário.
- Baileys usa arquivo/bytes locais para envio, então não foi necessário criar URL pública assinada para provedor.

## Configuração e dependências

A inicialização valida segredos antes de módulos de banco/fila/sessão: JWTs diferentes, com pelo menos 32 caracteres e diversidade mínima; padrões conhecidos são recusados. Produção exige BACKEND_URL/FRONTEND_URL HTTPS e credenciais fortes de banco/Redis. Exemplos possuem campos vazios para preenchimento local, sem credenciais funcionais. Gerar senhas de Redis compatíveis com URI (por exemplo, aleatórias em hexadecimal), pois o Compose monta `REDIS_URI`.

Postgres/Redis não publicam portas por padrão; painel/API ficam vinculados a loopback para um ponto de entrada HTTPS definido posteriormente. Não foi feita varredura do host nem rotação de credenciais reais; inventariar `.env`, histórico, volumes, imagens e cópias antes de qualquer liberação.

Pré-condições técnicas antecipadas: Multer 2.4.0, Baileys 6.7.24 e Node 22.19+ da linha 22. O aviso [GHSA-qvv5-jq5g-4cgg](https://github.com/WhiskeySockets/Baileys/security/advisories/GHSA-qvv5-jq5g-4cgg) afeta Baileys 6.7.9; o projeto permaneceu no Baileys. A versão corrigida usa ESM e removeu `makeInMemoryStore`; o cache não tinha consumidores no projeto e foi retirado, preservando persistência de sessão. Node 22 permite o carregamento dos módulos usados pelo backend CommonJS. Isso não executou a modernização ampla, reconexão ou plano de deploy da etapa 5. O lockfile do backend passa a ser versionável. Não foi feita auditoria completa de dependências transitivas nesta entrega.

Referência complementar dos controles HTTP: [Express — segurança em produção](https://expressjs.com/en/advanced/best-practice-security/).

## Verificações e limites do aceite

Comando seguro de teste, a partir de `agilizap/backend`: `npm run test:security`. **Não usar `npm test` no ambiente existente**: seus hooks legados ainda executam migrations/seeds/reversão em banco configurado; a suíte nova não os chama.

O harness usa PostgreSQL/WASM (PGlite) em memória, Sequelize real, fixtures de duas empresas, API/socket em 127.0.0.1 e SMTP simulado; importação de runtime de WhatsApp/filas é bloqueada. Arquivos são gerados somente em um diretório temporário exclusivo e removidos ao final. Foi testada a migração de segurança para cima/baixo no banco descartável.

Os schemas do harness são derivados dos modelos sem FKs por causa dos ciclos legados, e só a migração nova é aplicada. Isso **não comprova** a cadeia histórica, constraints, locks entre processos ou restauração de dados existentes. Os controllers que poderiam disparar WhatsApp não são iniciados: parte da matriz testa suas guardas de acesso com handlers sem efeitos externos. Não houve teste ponta a ponta em navegador, SMTP real, recepção/envio WhatsApp ou proxy real. Build não equivale a esses testes.

Evidências: [testes](evidencias/etapa-1/security-tests.txt), [backend](evidencias/etapa-1/backend-build.txt), [frontend](evidencias/etapa-1/frontend-build.txt). Consultar resultados e código em `backend/tests/security/run.cjs`, sem interpretar o número de grupos como cobertura integral de todos os controllers.

## Migração e reversão

`20261021000000-security-access.ts` adiciona hash/expiração de recuperação, bloqueio, passo TOTP e troca obrigatória. Invalida tokens legados de recuperação e incrementa versão de sessão de todos os usuários. Não apaga mensagens/anexos. **Somente foi executada no PostgreSQL descartável do teste.** Antes de aplicar em qualquer banco existente: backup, restauração isolada comprovada, pausa controlada dos processos e revisão da cadeia de migrations.

Entregar frontend e backend juntos: contratos antigos de recuperação, sockets por query e acesso anônimo a mídia deixaram de existir. Rollback de código vulnerável não é um procedimento seguro de recuperação. O `down` da migração remove colunas novas, preserva senhas e versões já alteradas e não ressuscita tokens consumidos. Guardar backup de banco/mídias/configuração e reverter de forma controlada em homologação antes de planejar qualquer reversão real. Nada precisa ser revertido nos dados existentes desta entrega, pois não foram alterados.

## Próxima ação

Permanecer na etapa 1: preparar uma homologação descartável com PostgreSQL/Redis reais, sem credenciais de sessão Baileys copiadas de produção; ensaiar cadeia de migrations/bootstrap, permissões com constraints, mídia legada e fluxo do painel. Depois validar domínio/HTTPS, origem/proxy, SMTP/TLS, portas/credenciais no ambiente escolhido. Qualquer ensaio de envio real ou publicação continua exigindo orientação própria. Só então reavaliar o aceite completo da etapa 1; não iniciar a etapa 2 automaticamente.
