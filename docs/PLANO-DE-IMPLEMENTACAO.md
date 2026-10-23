# Plano de implementação — seis etapas

Data de organização: 21/10/2026. Estado inicial: somente análise e documentação; nenhuma alteração funcional implementada neste trabalho.

A [spec](SPEC-PRONTIDAO-EMPRESARIAL.md) define os requisitos e critérios de aceite. Este plano define a ordem, entregas e registro de execução. O [guia de continuidade](CONTINUIDADE-NOVO-CHAT.md) contém o contexto para um novo chat. Decisões explícitas do usuário prevalecem; registrar qualquer mudança nos documentos afetados.

## Regras de execução

- Trabalhar uma etapa por vez, em entregas pequenas, revisáveis e testadas. Corrigir a causa nos caminhos compartilhados e verificar os chamadores.
- Revalidar os achados estáticos no código atual; não assumir que toda suspeita é falha demonstrada ou que nada mudou desde a análise.
- Preservar trabalho existente do usuário. Inspecionar instruções locais e estado de versionamento antes de editar; não presumir que Git está operacional só porque existe `.git`.
- Não registrar segredos, dados reais de clientes ou conteúdo de `.env` em relatórios e saídas de ferramentas.
- Testar com dados fictícios e provedores simulados. WhatsApp real somente em número de teste e com autorização específica de envio.
- Nenhuma conclusão documental equivale a deploy, teste aprovado ou recurso funcionando. Registrar precisamente o que foi executado e o que permanece pendente.
- Não introduzir infraestrutura complexa ou dependências sem necessidade concreta; reutilizar a stack existente.

## Pré-condições antes de alterar dados

Estas verificações não são uma sétima etapa: são condições de segurança das seis etapas.

- [ ] Identificar se existe instalação ativa e dados reais; distinguir desenvolvimento, homologação e produção.
- [ ] Ter banco de teste isolado e credenciais exclusivas; impedir conexão acidental com produção.
- [ ] Antes de qualquer migração em ambiente com dados, obter backup recuperável de banco e arquivos afetados e documentar reversão.
- [ ] Validar o destino das ferramentas antes de rodar testes: scripts existentes do backend executam migrations, seeds e reversão de migrations.
- [ ] Não conectar uma cópia de sessão Baileys simultaneamente à produção.

Se ambiente externo ou credenciais não estiverem disponíveis, avançar em código, testes isolados e documentação que não dependam disso; registrar o impedimento específico sem marcar a etapa inteira como concluída.

## Visão geral e andamento

| Etapa | Requisitos | Estado inicial | Condição de conclusão |
|---|---|---|---|
| 1. Segurança e acesso | SEC-01 a SEC-05 | Aprovada pelo usuário em 22/10/2026; pendências externas registradas | Segurança de contas, arquivos e permissões testada |
| 2. Dados e auditoria | GOV-01 e GOV-02 | Aprovada pelo usuário em 22/10/2026; pendências externas registradas | Histórico e ciclo de vida dos dados testados |
| 3. Confiabilidade do atendimento | REL-01 a REL-04 | Aprovada pelo usuário em 22/10/2026; pendências externas registradas | Concorrência e recuperação de falhas testadas |
| 4. IA e supervisão | AI-01 e OPS-04 | Aprovada pelo usuário em 22/10/2026; pendências externas registradas | Encaminhamento humano e alerta de espera testados |
| 5. Infraestrutura e operação | OPS-01 a OPS-03, DOC-01 | Aprovada pelo usuário em 22/10/2026; pendências externas registradas | Ambiente, deploy, backup e recuperação demonstrados |
| 6. Homologação e liberação | UX-01 e aceite global | Implementada e testada em 22/10/2026; pronta para homologação | Todos os P0/P1 aplicáveis aprovados |

Estados futuros: não iniciada, em andamento, parcialmente entregue, concluída. Para conclusão, anexar referências a testes/evidências e pendências residuais. P2 não impede conclusão se não esconder requisito P0/P1 ou dependência real.

## Etapa 1 — Segurança e acesso

Objetivo: fechar os bloqueadores de exposição antes de um piloto com dados reais.

Trabalho:

1. Inventariar rotas, autenticação, autorização, downloads e salas de socket; elaborar matriz de recurso × ação × papel usando D-02.
2. Corrigir recuperação de senha: consultas seguras, senha no corpo, token temporário por hash e de uso único, respostas e SMTP coerentes, revogação de sessões.
3. Impedir alteração indevida de papel/empresa e acesso por IDs alheios; implementar supervisor com permissões explícitas. Revisar REST, sockets e tarefas relacionadas.
4. Proteger anexos existentes e novos; preservar referências, confinar caminhos e validar conteúdo e limites de upload.
5. Remover credenciais padrão e bootstrap inseguro; exigir configuração segura e revisar sessões, cookies, CSRF, CORS, proteção contra abuso e MFA administrativo externo.

Pontos de partida: backend `src/routes`, `src/middleware`, `src/controllers/UserController.ts`, `src/services/UserServices`, `src/services/TicketNoteService`, `src/services/ResetPasswordService`, `src/services/ForgotPassWordServices`, `src/config/upload.ts`, `src/libs/socket.ts`, `src/app.ts` e Compose. Caminhos são relativos a `agilizap/backend` quando iniciam por `src`; conferir também frontend e os demais consumidores de cada contrato.

Aceite mínimo: matriz testada com dois conjuntos de empresas fictícias e todos os papéis; tentativas de promoção e acesso cruzado negadas; redefinição concorrente permite um consumo de token; anexos antigos continuam utilizáveis pelos autorizados; acesso anônimo, upload inválido e escape de caminho são negados. Cumprir todos os aceites SEC-01 a SEC-05.

Dependências externas: domínio/HTTPS e MFA em ambiente real podem exigir D-06. Isso não impede correções e testes locais, mas mantém a validação externa aberta.

## Etapa 2 — Dados e auditoria

Objetivo: tornar ações e retenção de dados rastreáveis.

Trabalho:

1. Registrar ações críticas sem segredos ou conteúdo pessoal desnecessário; restringir acesso ao histórico.
2. Mapear conversas, ciclos de ticket, anexos, resumos, transcrições, logs, backups e integrações.
3. Implementar política de retenção aprovada: conversas dois anos e anexos um ano após encerramento do ticket, sem renovar tickets anteriores em novos atendimentos.
4. Resolver como o legado reutiliza/reabre tickets antes de implementar expurgo. Prever prévia/simulação de seleção para validar o que seria removido.
5. Implementar exportação e exclusão autorizadas, exceções de conservação justificadas, controle de solicitações e opt-out de campanhas.
6. Definir justificativa de guarda e condições de envio/retenção no provedor de IA antes de ativar o processamento real correspondente.

Aceite mínimo: reconstruir ações por ator/empresa; exportar/excluir dados fictícios com anexos; demonstrar fronteiras de prazo, exceções de guarda e ausência de renovação indevida. Validar separadamente logs, backups e dados derivados. Não habilitar expurgo real com a política incompleta. Cumprir GOV-01 e GOV-02.

Dependência: autorização da etapa 1. A política escolhida não é um prazo determinado pela LGPD nem uma certificação jurídica.

## Etapa 3 — Confiabilidade do atendimento

Objetivo: recuperar falhas sem perda silenciosa ou repetição cega de envio.

Trabalho:

1. Corrigir concorrência ao assumir, transferir, encerrar, criar e reabrir tickets; validar vínculos de empresa, conexão, fila e usuário.
2. Definir estados persistentes de mensagem e chaves de operação; tratar recebimento duplicado, ordenação e resultado de envio incerto.
3. Reconciliar tarefas presas entre banco e Redis e estabelecer tentativas limitadas para falhas recuperáveis.
4. Agendamento vencido durante uma parada deve ir para revisão humana, sem envio automático; preservar cancelamento/reagendamento e auditar autorização posterior.
5. Validar a reconexão Baileys já existente e proteger credenciais; distinguir erro temporário de situações que exigem novo login.

Pontos de partida: `src/queues.ts`, `src/libs/wbot.ts`, `src/services/TicketServices`, `src/services/MessageServices`, `src/services/WbotServices` e controllers correspondentes no backend.

Aceite mínimo: dois atendentes assumindo geram um vencedor; repetir evento não duplica operação; testar queda antes/depois de enfileirar e depois do envio antes de persistir confirmação. Todo item termina em estado identificável e recuperável. Testar logout, restart e sessão substituída. Cumprir REL-01 a REL-04.

Decisão fixa: manter Baileys. Não incluir migração para API oficial ou mecanismos que prometam evitar bloqueios.

## Etapa 4 — IA e supervisão

Objetivo: manter responsabilidade humana quando automação falha e avisar sobre espera.

Trabalho:

1. Em timeout, quota, resposta inválida ou provedor indisponível, encaminhar à fila humana e tornar a situação visível.
2. Validar ação/fila no servidor e impedir vazamento de resumo/instrução interna; parar o bot quando houver atendimento humano.
3. Permitir à IA somente texto e áudio necessários; limitar áudio a dez minutos e ao tamanho aceito. Excedentes seguem para humano.
4. Implementar orçamento e margem para chamadas em andamento após definição do teto mensal; incluir texto, transcrição e eventual voz. Não escolher provedor/modelo pago implicitamente.
5. Implementar expediente e dez minutos de espera humana por fila, com pausa/retomada, sem reinício por mensagens extras do cliente ou do bot.
6. Entregar um alerta rastreável por episódio ao supervisor autorizado; definir substituto e calendário antes da liberação.

Aceite mínimo: simular erros do provedor, fila inválida, texto malformado, áudio excedente e concorrência com humano. Testar sábado 11h55 → segunda 08h05 sem feriado; assumir sem responder não encerra espera. Testar nova espera após resposta humana, pausa fora do expediente e não duplicação de alertas. Cumprir AI-01 e OPS-04.

Pendências: teto mensal de IA, condições do provedor, feriados/exceções e destinatário substituto. Implementação e testes simulados podem avançar sem contratação, orçamento inventado ou chamadas pagas.

## Etapa 5 — Infraestrutura e operação

Objetivo: comprovar instalação segura, manutenção e recuperação.

Trabalho:

1. Resolver D-06: host/sistema, domínio, backup externo, homologação e destinatário dos alertas.
2. Selecionar runtime suportado compatível; auditar dependências, tornar build reproduzível e usar permissões mínimas.
3. Separar bootstrap, migrações e execução; retirar seeds de restart, tratar falha de migração e fechar workers/sessões corretamente no deploy.
4. Implementar backup, retenção própria dos backups, monitoramento de execução e restauração isolada.
5. Implementar saúde/prontidão, métricas, logs seguros, rotação e alertas acionáveis.
6. Criar pipeline e procedimentos de instalação, atualização, rollback, reconexão e incidente.

Aceite mínimo: instalar e restaurar em ambiente limpo, medir perda de dados até 24h e retorno até 4h, conferir mensagens e anexos; induzir falha de backup e alertas. Ensaiar deploy/rollback e auditar portas, segredos e dependências. Cumprir OPS-01 a OPS-03 e DOC-01.

Nota de dependência: ajustes essenciais de runtime/build e backup inicial podem precisar ocorrer antes para viabilizar testes/migrações das outras etapas; registrar essa antecipação. A numeração não obriga adiar uma pré-condição de segurança.

## Etapa 6 — Homologação e liberação

Objetivo: comprovar os requisitos integrados antes de autorizar produção.

Trabalho:

1. Executar a matriz de homologação da seção 9 da spec, confirmando perfil de carga e metas propostas com o responsável.
2. Validar dez atendentes simultâneos, isolamento, falhas e recuperação, anexos, IA, campanhas e alertas.
3. Validar fluxos essenciais em desktop/celular e acessibilidade básica; preservar rascunho em falha e mostrar estados reais.
4. Corrigir regressões, repetir apenas testes afetados ou necessários e consolidar evidências.
5. Conferir checklist global, procedimentos, pendências e aceite do responsável.

Aceite mínimo: todos os P0/P1 aplicáveis passam; backup e recuperação comprovados; pendências e limitações conhecidas registradas. Publicação exige autorização própria, não concedida por este documento.

Metas ainda propostas, não aprovadas: perfil de carga da seção 9; p95 de APIs comuns menor que dois segundos e persistência de recebidas em até cinco segundos, nas condições descritas na spec. A ausência de SLA contratual não elimina a necessidade de validar desempenho.

## Pendências e ponto de resolução

| Pendência | Pode avançar sem resposta? | Precisa estar resolvida antes de |
|---|---|---|
| Hospedagem, SO, domínio, backup externo e responsável | Sim, localmente | Validações de ambiente e liberação da etapa 5 |
| Teto mensal de IA | Resolvido em 22/10/2026: R$ 50,00/mês | Habilitar IA em produção |
| Feriados municipais e expediente | Resolvido em 22/10/2026: Fátima do Sul/MS, dispensado cadastro de feriados locais | Liberar alertas operacionais |
| Justificativas e exceções de retenção | Sim, sem expurgo real | Habilitar expurgo e aprovar política final |
| Reabertura/reutilização de tickets | Sim, investigação e testes | Finalizar implementação de retenção |
| Metas técnicas e perfil de carga | Sim | Aceite final de homologação |

## Registro a preencher em cada entrega

Copiar o modelo abaixo dentro desta seção, sem marcar conclusão sem evidência:

```text
Data:
Etapa / requisitos:
Estado:
Alterações e motivo:
Arquivos / migrations / commits (se houver):
Testes executados e resultado:
Evidências (caminhos locais ou links, sem dados sensíveis):
Testes não executados e motivo:
Impacto em dados, compatibilidade e procedimento de reversão:
Pendências / decisões novas:
Próxima ação concreta:
```

Registro inicial: nenhuma etapa de implementação iniciada. Apenas a spec, este plano e o guia de continuidade foram preparados. Não foram executados build, migrações, testes funcionais, carga ou deploy neste trabalho documental.


### Entrega de 21/10/2026 — etapa 1

**Data:** 21/10/2026 (America/Cuiaba).

**Etapa / requisitos:** 1 — Segurança e acesso, SEC-01 a SEC-05.

**Estado:** parcialmente entregue. Controles locais implementados e verificados; não marcar concluída nem liberar piloto com dados reais sem as verificações externas abaixo. Etapas 2 a 6 não foram iniciadas nesta entrega.

**Alterações e motivo:**

- Revalidado o código atual e preservadas as alterações anteriores; inventário de 191 registros de rota, além de downloads/assets e sockets, e matriz de recurso × ação × papel publicados.
- Recuperação substituída por ORM/consultas vinculadas, senha no corpo, token aleatório por hash com validade de 30 minutos, consumo condicional atômico e revogação de sessões. Resposta de solicitação genérica; SMTP/TLS e logs sem segredos. SQL interpolado de mensagens e relatórios também corrigido.
- Contexto de autenticação recarregado do banco; empresa real do alvo e vínculos relacionados verificados. Supervisor implementado por filas; promoção indevida, troca de empresa, IDs cruzados, alterações de campos privilegiados e salas compartilhadas indevidas bloqueados. Guardas usam o padrão canônico da rota para impedir bypass por caixa da URL. Bloqueio administrativo passa a revogar versões de sessão.
- Faturas, exportação de contatos, notas, relatórios, listas, chat interno, respostas rápidas, conexões e integrações receberam os controles correspondentes. Mensagens/citações e tarefas verificam empresa/vínculos. Eventos sensíveis são enviados às salas administrativas ou aos membros autorizados; transferência remove acesso ao ticket antes de novos eventos.
- Mídia privada exige sessão e referência persistida autorizada. Referências/diretórios legados preservados, sem mover nem apagar arquivos existentes. Nomes aleatórios, caminhos confinados, validação de tipo/conteúdo, limites exatos de 20 MiB × 5, limites de expansão Office, tempo, concorrência e espaço livre. Recebimento por stream limitado e processamento de áudio sem shell. Identidade visual pública é uma lista fechada separada.
- JWT HS256 restrito, cookies HttpOnly/Secure/SameSite, CSRF por Origin exato e SameSite, tokens de acesso apenas em memória, limites de abuso, proxy explícito e headers de segurança. MFA TOTP individual para administradores em produção, com consumo atômico e procedimento de provisionamento/recuperação documentado.
- Bootstrap exige credencial explícita e troca inicial; cadastro anônimo fechado, sem senha previsível; seeds removidos do restart. Segredos inseguros impedem inicialização; banco/Redis sem portas publicadas e painel/API limitados a loopback no Compose por padrão.

**Pré-condições técnicas antecipadas, sem avançar funcionalmente a etapa 5:** atualização de Multer para 2.4.0 e Baileys para 6.7.24 após confirmação de aviso crítico oficial; Baileys foi mantido. A versão corrigida exige compatibilidade ESM: backend ajustado para Node 22.19+ da linha 22, com remoção de cache upstream sem consumidores. Nenhuma sessão WhatsApp foi carregada para testar isso. Lockfile de backend passou a ser versionável e dependências de teste isolado declaradas.

**Arquivos / migrations / commits:** módulos `src/security`, autenticação, modelos/controllers/serviços/rotas afetados, Compose principal e espelho, exemplos sem credenciais funcionais, Dockerfile do backend, consumidores de autenticação/upload/exportação no frontend, `backend/tests/security/run.cjs`. Migração nova `20261021000000-security-access.ts`. Sem commit. Consultar diff atual e documentação detalhada; o diff anterior está preservado em `.security-work/before.patch` (ignorado).

**Testes executados e resultado:**

- `npm run test:security`: **23/23 grupos passaram**; PostgreSQL/WASM (PGlite) em memória, Sequelize real, duas empresas fictícias e todos os papéis; API e sockets somente em 127.0.0.1; SMTP simulado e importação de runtime de WhatsApp/fila proibida pelo harness.
- Casos incluem promoção/troca de empresa/IDs, autorização por fila/recurso, campos pessoais, notas, expiração/reutilização/consumo concorrente de token, aspas/SQL, revogação REST/refresh/socket, bloqueio/desbloqueio, exportação/faturas, bootstrap/troca obrigatória, MFA/replay, cookies/CSRF/abuso, tipos/caminhos, cinco arquivos e fronteiras reais de 20 MiB/100 MiB, streaming limitado, mídia legada, citações e colisões de mensagens entre empresas, casing de rotas e saída de sala após transferência.
- Migração de segurança `up` e `down` executada somente no banco descartável, com resultado positivo.
- `npm run build -- --pretty false` no backend: passou.
- `npm run build` no frontend: passou; aviso de depreciação da API CJS do Vite registrado, sem falha de compilação.
- Carregamento dos exports do Baileys corrigido no Node 22 sem iniciar conexão: passou. `git diff --check`: passou.

**Evidências:** [detalhamento e matriz](ETAPA-1-SEGURANCA.md), [inventário](INVENTARIO-ACESSO-ETAPA-1.md), [suíte](../agilizap/backend/tests/security/run.cjs), [resultado de testes](evidencias/etapa-1/security-tests.txt), [build backend](evidencias/etapa-1/backend-build.txt), [build frontend](evidencias/etapa-1/frontend-build.txt). Nenhuma credencial real foi incorporada às evidências.

**Testes não executados e motivo:** não foram iniciados aplicação/worker de produção, Redis, sessões Baileys, SMTP real ou navegador ponta a ponta. Não foram enviados e-mails/mensagens reais nem feitas contratação/publicação. A cadeia histórica de migrações, constraints/FKs e locks entre processos não são comprovados pelo harness: os modelos legados têm ciclos, os schemas de teste são criados sem FKs e somente a migração nova é aplicada. Sem ensaio de proxy/HTTPS, portas externas, fluxo completo de mídia no WhatsApp, instalação/restauração real ou recuperação de MFA com responsáveis. A suíte legada `npm test` não foi executada, pois tem hooks que migram/semeiam/revertem banco configurado. Auditoria integral das dependências transitivas fica pendente, sem declarar ausência de vulnerabilidades.

**Impacto em dados, compatibilidade e reversão:** nenhum dado existente foi alterado. A migração preparada acrescenta colunas de segurança, limpa tokens legados de recuperação e revoga sessões anteriores por versão; não apaga conversas/anexos. Aplicação em qualquer banco existente exige backup/restauração isolada e revisão prévia da cadeia. Frontend/backend precisam ser entregues juntos: rotas antigas de senha na URL, token de socket em query e acesso anônimo a anexo foram retirados. O `down` não recupera sessões/tokens antigos e não desfaz senha já redefinida. Não fazer rollback cego para código vulnerável; detalhes no documento da etapa.

**Pendências / decisões novas:** nenhuma decisão de negócio aprovada foi reaberta. Permanecem D-06 (ambiente/domínio e responsáveis), rotação/inventário de credenciais reais, HTTPS/origem/proxy, provisionamento e recuperação de MFA, SMTP real, cadeia histórica/constraints, mídia legada ambígua, quotas/monitoramento e ensaio controlado do canal. Limitador local pressupõe um processo; múltiplas réplicas exigem estado compartilhado. Assets/arquivos sem referência autorizável não ganham acesso público para contornar pendência. Continuam pendentes todos os aceites externos da etapa 1.

**Próxima ação concreta:** permanecer na etapa 1 e montar homologação descartável com PostgreSQL/Redis reais e dados fictícios, sem copiar/reconectar sessão WhatsApp de produção. Ensaiar migrações/bootstrap, constraints e fluxos do painel; depois validar HTTPS/proxy, SMTP/TLS, MFA e mídia no ambiente autorizado. Não iniciar a etapa 2 automaticamente nem publicar/enviar mensagens reais sem orientação própria.

### Continuação de 21/10/2026 — homologação técnica da etapa 1

**Estado:** parcialmente entregue; nenhum aceite humano ou de produção presumido.

**Alterações:** adicionados Compose exclusivo e scripts em `backend/tests/security` para PostgreSQL 14/Redis 7 reais, rede interna sem portas, dados tmpfs e teardown automático. Sem leitura de `.env` ou montagem de sessões/mídias existentes. Migration histórica `20241016140000-change-temperature-to-float-in-prompts.ts` corrigida para converter tipo antes do default decimal, em transação: pré-condição indispensável da instalação, pois falhava em banco vazio. Alterações anteriores desse arquivo preservadas.

**Verificações:** 150 migrations passaram com 73 FKs; usuário legado fictício preservado com reset antigo limpo/versão incrementada; referência a empresa inexistente recusada; UPDATE condicional de reset consumido uma única vez entre duas conexões físicas; down/up de segurança sem ressuscitar credenciais; Redis autenticado com chave TTL; pg_dump/pg_restore em segundo banco conferindo usuário e FKs. Build backend e repetição dos 23/23 grupos de segurança passaram. `git diff --check` sem erros de whitespace, com avisos de conversão LF/CRLF em arquivos existentes.

**Evidências:** [ensaio e limites](HOMOLOGACAO-ETAPA-1.md), [log PostgreSQL/Redis e restauração](evidencias/etapa-1/postgres-redis-homologacao.txt). Sem commit. Containers/rede exclusivos removidos ao terminar; dados fictícios descartados. Nenhum dado real, worker, SMTP externo, sessão WhatsApp ou aplicação publicada.

**Limites/pendências:** runner de migrations Node 20 não certifica runtime Node 22 da aplicação. Ensaio SQL concorrente não substitui controller HTTP em PostgreSQL real; os 23 grupos continuam usando WASM. Não foi testado bookkeeping do Sequelize CLI, rollback de toda a cadeia, todas as FKs, Bull completo, backup externo/mídia ou metas RPO/RTO. Permanecem painel isolado e aceite humano, SMTP/TLS, HTTPS/proxy, provisionamento/recuperação de MFA e amostra representativa de mídias antigas. D-06 continua pendente para validações do ambiente de destino. Etapas 2–6 não iniciadas.

**Próxima ação:** preparar frontend/backend Node 22 com fixtures de duas empresas, papéis/filas e integrações bloqueadas ou simuladas para validar navegador e disponibilizar o roteiro de aceite humano. Não iniciar o servidor com `.env` real, pois ele ativa workers/cron/sessões.

### Continuação de 21/10/2026 — painel para aceite humano

**Etapa/requisitos/estado:** etapa 1, SEC-01 a SEC-05, permanece parcialmente entregue. Painel local disponível; aceite humano e verificações do ambiente de destino pendentes. Etapas 2–6 não iniciadas.

**Alterações:** entry point de teste `backend/tests/security/panel.cjs`, Compose exclusivo `panel-compose.yml`, página de contas/MFA/caixa simulada, scripts PowerShell de iniciar/parar e ensaio `panel-check.cjs`. Frontend com configuração/build separados, banner e hostname `homologacao.localhost` para separar cookies do sistema existente. Não importa servidor/cron/workers, não lê `.env`, bloqueia integrações e conexões de saída fora de banco/Redis locais; banco/Redis e mídias somente fictícios/descartáveis. Segredos de sessão/MFA gerados por processo. Service worker omitido apenas no build de homologação para não conservar cache de ensaios.

**Correções encontradas na validação:** frontend deixa de consultar conexões administrativas/assinar seus eventos para atendentes/supervisores (antes provocava toast de permissão ao entrar); campos MFA/nova senha com rótulos associados; recuperação passa a retornar ao login em vez de indicar cadastro público fechado. Guardas do servidor preservados. Alterações existentes mantidas; sem commit.

**Verificações/resultados:** 12/12 grupos HTTP contra rotas/controllers reais no Node 22.19/PostgreSQL 14, com duas empresas: login incorreto, MFA ausente/correto/replay, ID/UUID/listagem por empresa/fila, anexos, promoção/exportação, primeiro acesso, recuperação/uso único, bloqueio e revogação, transferência pelo controller, integrações recusadas e logout. 23/23 grupos de segurança isolados repetidos. Build separado do frontend aprovado. Scripts de parar/recriar/iniciar executados; base final recriada sem alterações dos ensaios HTTP. Pelo navegador, conferidos login de atendente/filas/aceite permitido, tentativa de URL de outra fila, login administrativo com MFA, usuários apenas da empresa B, logout e solicitação de recuperação recebida na caixa simulada. No build final, atendente entrou sem erro de permissão/service worker; sessão encerrada depois da captura, tickets deixados pendentes para o usuário.

**Evidências:** [HTTP no banco real](evidencias/etapa-1/panel-http-tests.txt), [regressão](evidencias/etapa-1/security-tests.txt), [atendente](evidencias/etapa-1/panel-attendant.png), [administração da empresa B](evidencias/etapa-1/panel-users.png), [recuperação](evidencias/etapa-1/panel-recovery.png). Contas, comandos e limites em [HOMOLOGACAO-ETAPA-1.md](HOMOLOGACAO-ETAPA-1.md).

**Dados/reversão:** sem acesso a dados/sessões de produção, SMTP externo ou envio WhatsApp. Serviços fictícios permanecem rodando apenas localmente para o aceite. Parar com `./agilizap/backend/tests/security/stop-panel.ps1`: valida PID e caminho temporário, remove somente os containers/rede/tmpfs do painel. Não altera o sistema já aberto em localhost:3000. Recriar descarta senhas/tokens/tickets fictícios alterados. Não publicar este entry point nem usar credenciais reais nele.

**Pendências:** aceite humano da matriz, troca de senha digitada/confirmada pelo próprio usuário no navegador, cenários simultâneos no painel, amostra representativa de mídias antigas, HTTPS/proxy/cookies Secure e SMTP/TLS no destino, provisionamento/recuperação operacional de MFA e decisões D-06. Caixa/código MFA simulados validam a lógica, não a operação real dos provedores. Bull/cron e entrega de WhatsApp não são exercitados. Auditoria completa de dependências continua pendente. Nenhuma dessas verificações foi presumida aprovada.

**Próxima ação concreta:** usuário executar o roteiro humano no painel local e registrar observado/esperado; corrigir divergências da etapa 1. Em seguida, definir o ambiente/responsáveis somente quando necessário para homologação externa. Não avançar etapa 2, publicar ou enviar mensagens reais automaticamente.

### Pausa solicitada — 21/10/2026

**Decisão revisada:** administrador acessará somente com e-mail e senha, sem código de autenticador. Usuário reconheceu a redução de segurança e aprovou essa opção. Substitui a exigência anterior de MFA; não reabrir a decisão sem motivo novo.

**Estado:** trabalho interrompido a pedido do usuário. Apenas contexto/documentação atualizados. Código, testes e painel ainda refletem a exigência anterior; nenhuma remoção de MFA implementada nesta pausa. Nenhum processo encerrado ou dado alterado.

**Preferência futura:** executar etapas mais rapidamente e com menor consumo de tokens, reaproveitando contexto/evidências e limitando verificações ao necessário. Organização desse fluxo fica para depois.

**Próxima ação, somente após retomada autorizada:** adequar login administrativo para e-mail/senha, retirar exigência/campos de MFA e atualizar testes, critérios e roteiro de homologação, preservando os demais controles de segurança. Etapa 1 permanece parcial; não avançar para outras etapas automaticamente.

### Retomada de 22/10/2026 — login administrativo sem autenticador

**Estado:** decisão do usuário implementada; etapa 1 permanece parcial, sem avanço para etapas 2–6.

**Alterações:** login de administrador e superadministrador passa a exigir somente e-mail e senha. Removidos validação/helper TOTP, campo OTP e repasse do código no controller, configuração MFA em exemplos/Compose e geração/exposição de códigos no painel fictício. Testes atualizados para permitir logins administrativos normais, inclusive em NODE_ENV=production, e continuar rejeitando senha errada. Política de senha, troca inicial, bloqueio, revogação, limite de abuso, cookies e isolamento preservados. Migration/coluna histórica mfaLastStep mantidas inertes por compatibilidade; nenhuma mudança de schema ou dados existentes necessária.

**Verificações:** 23/23 grupos isolados passaram; 12/12 grupos HTTP passaram contra PostgreSQL real e rotas/controllers reais do painel. Build backend e build separado do frontend passaram; sintaxe dos scripts e git diff --check aprovados (avisos LF/CRLF em arquivos existentes). Não repetidos navegador, ensaio de backup nem suíte histórica de migrações, pois não houve mudança nesses mecanismos. Evidências anteriores preservadas.

**Evidências atuais:** docs/evidencias/etapa-1/security-tests-sem-mfa.txt e docs/evidencias/etapa-1/panel-http-sem-mfa.txt. Sem commit. Alterações anteriores preservadas. Painel fictício recriado após os testes para restaurar as contas; nenhuma conexão WhatsApp/SMTP externo ou publicação. Dados de produção intocados.

**Pendências/próxima ação:** aceite humano pelo roteiro atualizado em HOMOLOGACAO-ETAPA-1.md; depois verificações do ambiente de destino (HTTPS/proxy/SMTP), mídia legada representativa e auditoria de dependências ainda pendentes. MFA e sua recuperação/provisionamento deixam de ser exigências. Preferência do usuário aplicada: leitura dos trechos afetados, reaproveitamento de evidências, testes proporcionais e comunicação concisa.

### Ajuste de 22/10/2026 — conta inicial sem troca obrigatória

**Decisão/alterações:** usuário pediu retirar o campo “Nova senha (somente primeiro acesso)” e usar uma conta inicial com e-mail/senha definidos. Campo e parâmetro retirados do login; bootstrap passa a criar conta sem troca obrigatória; flags históricas de troca não bloqueiam autenticação/sessões. Credenciais iniciais continuam explícitas em BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD, sem senha universal no código. Nenhuma conta real criada/alterada e nenhuma migration nova. Recuperação e alteração voluntária de senha, política, bloqueio e revogação preservados.

**Verificações:** 23/23 grupos isolados e 12/12 HTTP no PostgreSQL descartável aprovados; builds backend e frontend separados aprovados. Incluído caso de conta legada marcada para troca ainda conseguir login/sessão e senha incorreta continuar negada. Asserção antiga de troca obrigatória corrigida antes da execução final. Tela atualizada conferida no navegador com somente e-mail e senha. Evidências em docs/evidencias/etapa-1/security-tests-login-simples.txt, panel-http-login-simples.txt e login-simples.png.

**Estado/próxima ação:** etapa 1 continua parcial; prosseguir com aceite humano no painel e pendências externas já registradas, sem iniciar etapas seguintes. Painel local atualizado; dados fictícios alterados pelos testes HTTP não são dados reais (a conta primeiro.b foi usada no teste de recuperação). Conta administrativa de homologação permanece admin.a@example.invalid / Homologacao123. Documentação de continuidade/spec/roteiro atualizada. Produção e alterações anteriores preservadas.


### Aceite do usuário — 22/10/2026

**Aceite registrado em 22/10/2026:** o usuário aprovou expressamente a etapa 1 — Segurança e acesso, com login somente por e-mail/senha e sem troca obrigatória inicial. Implementação e comportamento apresentados aceitos. Pendências externas de implantação já documentadas continuam abertas; este aceite não comprova essas verificações nem autoriza publicação, uso de produção ou envio real. Etapa 2 não iniciada e depende de nova orientação. Registros anteriores de aceite parcial são históricos.

**Verificações:** nenhuma nova execução nesta atualização documental; mantidas as evidências já registradas (23/23 grupos isolados, 12/12 HTTP, builds e conferência visual).

**Próxima ação:** aguardar orientação para a etapa 2; tratar as pendências de implantação antes da respectiva liberação operacional. Nenhum código, dado, processo ou serviço alterado neste registro.

### Entrega da Etapa 2 — Dados e auditoria (22/10/2026)

**Estado:** implementação local da Etapa 2 entregue para homologação; suíte de testes automatizados 100% aprovada (12/12 governança e 23/23 segurança sem regressões). Aceite humano realizado em 22/10/2026.

**Requisitos atendidos:** GOV-01 (trilha de auditoria segura e estruturada) e GOV-02 (ciclo de vida, retenção temporal, legal hold e direitos dos titulares / LGPD).

**Alterações no código:**
- `AuditLog.ts`, `audit.ts`, `AuditLogController.ts`, `auditLogRoutes.ts`: modelo imutável, higienização estrita de credenciais/segredos, consultas paginadas, exportação em lote e RBAC (somente admin/super; tentativas de atendentes/supervisores barradas com 403 e registradas com `result: "denied"`).
- Instrumentação de auditoria em pontos críticos: criação/edição/exclusão de usuários, conclusão de reset de senha, encerramento/reabertura/transferência de tickets, exclusão de contatos e exportações em CSV.
- `Ticket.ts`, `Contact.ts`, `ContactListItem.ts`: colunas `closedAt`, `legalHold`, `legalHoldReason`, `legalHoldAt`, `optOutCampaign`.
- Migration `20261022000000-data-governance.ts`: criação de `AuditLogs`, colunas de governança, índices de performance e restrição de tickets ativos únicos. Totalmente reversível.
- `FindOrCreateTicketService.ts`: separação entre tickets ativos e tickets passados. Reabertura restrita à janela de tolerância; interações fora da tolerância geram um novo ticket, preservando o `closedAt` e o relógio de retenção dos tickets passados.
- `DataRetentionService.ts`, `DataRetentionController.ts`, `dataRetentionRoutes.ts`:
  - `GET /retention/preview`: simulação dry-run com cálculo exato de elegibilidade para expurgo de mensagens (> 2 anos) e anexos (> 1 ano), sem modificar banco ou arquivos.
  - `POST /retention/purge`: expurgo seguro de anexos em disco (`confinedPath`) e remoção de conversas antigas, preservando estritamente tickets com `legalHold: true`.
  - `PUT /retention/tickets/:ticketId/legal-hold`: ativação/desativação de bloqueio cautelar com motivo obrigatório e auditoria.
  - `GET /retention/data-subject/:contactId`: exportação estruturada de dados pessoais do titular.
  - `POST /retention/data-subject/:contactId/anonymize`: anonimização/esquecimento com expurgo físico de mídias, bloqueada com 409 se houver legal hold ativo.
  - `POST /retention/contacts/:contactId/opt-out`: marcação de opt-out em contatos e listas, respeitada pelos workers de envio em `queues.ts`.

**Verificações:**
- `npm run test:governance`: **12/12 grupos passaram** (PostgreSQL/WASM PGlite em memória, zero serviços externos ou mensagens reais).
- `npm run test:security`: **23/23 grupos passaram** (regressão zero para os requisitos da Etapa 1).
- `npm run build`: compilação TypeScript limpa com zero erros.

**Evidências:** [documento da etapa](ETAPA-2-DADOS-AUDITORIA.md), [testes de governança](evidencias/etapa-2/governance-tests.txt), [regressão de segurança](evidencias/etapa-2/security-regression-tests.txt), [build backend](evidencias/etapa-2/backend-build.txt).

### Aceite do usuário da Etapa 2 — 22/10/2026

**Aceite registrado em 22/10/2026:** o usuário aprovou expressamente a etapa 2 — Dados e auditoria (GOV-01 e GOV-02). Implementação e comportamento apresentados aceitos (trilha de auditoria higienizada e isolada, ciclo de vida de tickets com `closedAt`, retenção de conversas por 2 anos e anexos por 1 ano, simulação dry-run e expurgo físico seguro, Legal Hold com motivo obrigatório, exportação e anonimização de titular LGPD e opt-out de campanhas). Pendências externas de implantação continuam abertas; este aceite não autoriza publicação, uso em produção ou envio de mensagens reais. Etapa 3 não iniciada e depende de nova orientação.

**Verificações mantidas:** 12/12 grupos de teste de governança aprovados (`npm run test:governance`), 23/23 grupos de teste de segurança da Etapa 1 aprovados sem regressão (`npm run test:security`) e build backend TypeScript limpo (`npm run build`).

**Próxima ação:** aguardar orientação para iniciar a etapa 3 — Confiabilidade do atendimento (REL-01 a REL-04). Nenhum dado de produção ou serviço externo foi alterado.
### Entrega da Etapa 3 — Confiabilidade do atendimento (22/10/2026)

**Estado:** implementação local da Etapa 3 concluída e pronta para homologação; suíte de testes de confiabilidade 100% aprovada (13/13 testes em PostgreSQL/WASM em memória). Regressão zero nas suítes anteriores (23/23 testes de segurança da Etapa 1 e 12/12 testes de governança da Etapa 2 aprovados). Compilação TypeScript limpa (0 erros).

**Requisitos atendidos:** REL-01 (agendamentos e paradas sem disparos acidentais em massa), REL-02 (entrega, desduplicação e máquina de estados de mensagens), REL-03 (concorrência atômica e consistência de tickets) e REL-04 (observabilidade de conexão WhatsApp e continuidade operacional).

**Alterações no código:**
- `ScheduleReconciliationService.ts`, `ScheduleController.ts`, `scheduleRoutes.ts`: varredura de agendamentos vencidos durante indisponibilidade do backend com reconciliação para `EM_REVISAO`, impedindo disparos automáticos em massa. Endpoints de revisão humana (`POST /schedules/:scheduleId/review`) para aprovação ou cancelamento auditados por administradores ou supervisores.
- `queues.ts`: cálculo dinâmico de delay baseado no `sendAt` real do agendamento; checagem de estado antes de despachar jobs (evita envio de itens cancelados, enviados ou em revisão).
- `CreateMessageService.ts`: desduplicação de requisições por chave de idempotência `operationId`. Se o identificador já existir para a empresa, retorna o registro original sem duplicar mensagens.
- `SendWhatsAppMessage.ts`: identificação precisa de falha incerta de envio (timeouts de socket, quebra de conexão Baileys). Mensagens são marcadas com status `uncertain` e justificativa registrada, bloqueando retentativas automáticas cegas.
- `wbotMessageListener.ts`: transição de máquina de estados de mensagens baseada em acks (`sended`, `delivered`, `read`, `failed`).
- `MessageController.ts`, `messageRoutes.ts`: endpoint de retentativa manual controlada `POST /messages/:messageId/retry` exclusivo para mensagens `failed` ou `uncertain`, com contador de retentativas e auditoria.
- `UpdateTicketService.ts`: `Ticket.update` condicional atômico no banco para claim de tickets (`WHERE (userId IS NULL OR userId = :userId)`). Concorrência entre operadores resulta em exatamente um operador atendendo com sucesso (200) e o segundo recebendo **HTTP 409 Conflict** (`ERR_TICKET_ALREADY_CLAIMED`). Bloqueio de encerramento de tickets já fechados (`ERR_TICKET_ALREADY_CLOSED`). Validação de filas, usuários e conexões WhatsApp pertencentes à empresa.
- `FindOrCreateTicketService.ts`: recuperação de corrida concorrente de criação de tickets para o mesmo contato via captura de `UniqueConstraintError` e recarregamento do ticket ativo existente.
- `wbot.ts`: categorização e observabilidade das desconexões da sessão Baileys (`LOGGED_OUT`, `CONNECTION_REPLACED`, `BANNED_OR_FORBIDDEN`, `BAD_SESSION`), com instrução clara de ação para o operador (`actionRequired`). Interrupção de loops infinitos de reconexão após 5 tentativas consecutivas com marcação de `PERSISTENT_NETWORK_FAILURE`.
- Migration `20261022010000-service-reliability.ts`: criação de colunas e índices em `Schedules`, `Messages` e `Whatsapps`. Totalmente reversível (`up` e `down`).
- Modelos atualizados: `Schedule.ts`, `Message.ts`, `Whatsapp.ts`.

**Verificações:**
- `npm run test:reliability`: **13/13 testes passaram** (PostgreSQL/WASM PGlite em memória, zero serviços externos ou envio real).
- `npm run test:security`: **23/23 grupos passaram** (regressão zero para a Etapa 1).
- `npm run test:governance`: **12/12 grupos passaram** (regressão zero para a Etapa 2).
- `npm run build`: compilação TypeScript limpa com zero erros.

**Evidências:** [documento da etapa](ETAPA-3-CONFIABILIDADE.md), [testes de confiabilidade](evidencias/etapa-3/reliability-tests.txt), [build backend](evidencias/etapa-3/backend-build.txt).

**Próxima ação concreta:** aguardar orientação e aprovação do usuário sobre a Etapa 3 antes de iniciar a Etapa 4 — IA e supervisão (AI-01 e OPS-04).

### Aceite do usuário da Etapa 3 — 22/10/2026

**Aceite registrado em 22/10/2026:** o usuário aprovou expressamente a etapa 3 — Confiabilidade do atendimento (REL-01 a REL-04). Implementação e comportamento apresentados aceitos (reconciliação de agendamentos vencidos durante paradas com transição para `EM_REVISAO` e revisão humana auditada; idempotência por `operationId`; máquina de estados de mensagem com detecção de falha incerta sem reenvio cego e retentativa manual controlada; concorrência atômica no claim de tickets com 409 Conflict; resolução de corrida na criação simultânea; e observabilidade detalhada de desconexões Baileys com interrupção de loops infinitos). Pendências externas de implantação já documentadas continuam abertas; este aceite não comprova essas verificações nem autoriza publicação, uso de produção ou envio de mensagens reais. Etapa 4 não iniciada e depende de nova orientação.

**Verificações mantidas:** 13/13 testes da suíte de confiabilidade aprovados (`npm run test:reliability`), 23/23 testes de segurança da Etapa 1 aprovados sem regressão (`npm run test:security`), 12/12 testes de governança da Etapa 2 aprovados sem regressão (`npm run test:governance`) e compilação backend TypeScript limpa com 0 erros (`npm run build`).

**Próxima ação:** aguardar orientação para iniciar a etapa 4 — IA e supervisão (AI-01 e OPS-04). Nenhum dado de produção ou serviço externo foi alterado.

### Entrega da Etapa 4 — IA e supervisão (22/10/2026)

**Estado:** implementação local da Etapa 4 concluída e pronta para homologação; suíte de testes de IA e supervisão 100% aprovada (14/14 testes em PostgreSQL/WASM em memória). Regressão zero nas suítes das etapas anteriores (23/23 testes de segurança da Etapa 1, 12/12 testes de governança da Etapa 2 e 13/13 testes de confiabilidade da Etapa 3 aprovados). Compilação TypeScript limpa (0 erros).

**Requisitos atendidos:** AI-01 (falha segura de IA, higienização estrita contra vazamento de prompts/resumos, validação de áudio e teto orçamentário mensal) e OPS-04 (cálculo de expediente comercial em America/Campo_Grande, alertas de espera em fila acima de 10 minutos úteis, desduplicação por episódio e roteamento estrito para supervisores da fila).

**Alterações no código:**
- `AISanitizer.ts`: extração segura de blocos de resumo interno (`[RESUMO_IA]...[/RESUMO_IA]`), diretivas operacionais (`Ação: Transferir para a fila [...]`) e sanitização de instruções internas de prompt do texto enviado ao cliente, mesmo em respostas truncadas.
- `AIAudioValidator.ts`: validação estrita no servidor de arquivos de áudio (teto de 10 minutos e 20 MB) antes de chamar transcrição ou modelos multimodais, com fallback determinístico para atendente humano caso excedidos.
- `AIBudgetService.ts`: controle de consumo orçamentário mensal de IA por empresa (`aiMonthlyBudgetLimit`, `aiMonthlySpent`, `aiBudgetPeriod`), com virada automática de mês e fallback gracioso quando o teto é atingido.
- `AIService.ts`: invocação com timeout configurável (padrão 25s), preservação dos parâmetros e modelos salvos no banco, e tratamento unificado de exaustão de cota (429), indisponibilidade (503) e chaves inválidas/ausentes com encaminhamento determinístico para fila humana.
- `wbotMessageListener.ts`: proteção anti-colisão (cancela despacho de resposta gerada pela IA se um operador humano já tiver assumido o ticket ou fechado o atendimento); rastreamento de `lastClientMessageAt`, `currentWaitEpisodeId` e `lastHumanResponseAt`.
- `BusinessHoursService.ts`: calendário e cálculo de expediente no fuso `America/Campo_Grande` (MS, UTC-4), de seg-sex 08h-17h e sáb 08h-12h, com pausa fora do expediente, retomada na abertura e suspensão em feriados. Verificado o caso canônico: sáb 11h55 -> seg 08h05 = 10 minutos úteis.
- `QueueWaitAlertService.ts`: monitoramento de tickets em espera na fila, disparo de alerta após 10 minutos úteis com desduplicação estrita por episódio (`episodeId`), roteamento estrito aos supervisores vinculados à fila específica (com fallback para administradores), disparo de eventos Socket.IO e gravação na trilha de auditoria.
- `SendWhatsAppMessage.ts` e `UpdateTicketService.ts`: encerramento do episódio de espera e resolução do alerta pendente acionados estritamente por resposta humana de atendente ou encerramento do ticket. Mensagens adicionais do cliente não reiniciam o relógio de espera, e aceitar ticket sem responder mantém a espera ativa.
- `QueueWaitAlertController.ts`, `queueWaitAlertRoutes.ts`: consulta de alertas com RBAC restrito (supervisores acessam apenas suas filas; atendentes recebem 403; administradores possuem visão ampla da empresa).
- Migration `20261022020000-ai-supervision.ts`: criação da tabela `QueueWaitAlerts`, colunas em `Tickets` e `Companies`, com índices de performance. Totalmente reversível (`up` e `down`).
- Modelos atualizados: `QueueWaitAlert.ts`, `Ticket.ts`, `Company.ts`.

**Verificações:**
- `npm run test:ai-supervision`: **14/14 testes passaram** (PostgreSQL/WASM PGlite em memória, zero serviços externos ou envio real).
- `npm run test:security`: **23/23 grupos passaram** (regressão zero para a Etapa 1).
- `npm run test:governance`: **12/12 grupos passaram** (regressão zero para a Etapa 2).
- `npm run test:reliability`: **13/13 testes passaram** (regressão zero para a Etapa 3).
- `npm run build`: compilação TypeScript limpa com zero erros.

**Evidências:** [documento da etapa](ETAPA-4-IA-SUPERVISAO.md), [testes de IA e supervisão](evidencias/etapa-4/ai-supervision-tests.txt), [regressão segurança](evidencias/etapa-4/regression-security-tests.txt), [regressão governança](evidencias/etapa-4/regression-governance-tests.txt), [regressão confiabilidade](evidencias/etapa-4/regression-reliability-tests.txt), [build backend](evidencias/etapa-4/backend-build.txt).

**Próxima ação concreta:** aguardar orientação e aprovação do usuário sobre a Etapa 4 antes de iniciar a Etapa 5 — Operação, observabilidade e implantação (OPS-01 a OPS-03, DOC-01).

### Aceite do usuário da Etapa 4 — 22/10/2026

**Aceite registrado em 22/10/2026:** o usuário aprovou expressamente a etapa 4 — IA e supervisão (AI-01 e OPS-04). Implementação e comportamento apresentados aceitos (falha segura de IA com transferência determinística para fila humana; sanitização estrita de [RESUMO_IA], comandos de transferência e instruções de prompt; anti-colisão entre operador humano e robô; validação de áudio no servidor em até 10 minutos e 20 MB; teto orçamentário mensal de IA de R$ 50,00 por empresa com virada automática de mês; cálculo de expediente semanal no fuso America/Campo_Grande seg-sex 08h-17h e sáb 08h-12h com dispensa de feriados municipais para Fátima do Sul/MS; alertas de espera em fila acima de 10 minutos úteis com desduplicação por episódio e roteamento estrito para supervisores da fila ou administradores substitutos; e resolução exclusiva por resposta humana ou fechamento de ticket). Pendências externas de infraestrutura e implantação já documentadas continuam abertas; este aceite não comprova essas verificações nem autoriza publicação, uso de produção ou envio real. Etapa 5 não iniciada e depende de nova orientação.

**Verificações mantidas:** 14/14 testes da suíte de IA e supervisão aprovados (pm run test:ai-supervision), 23/23 testes de segurança da Etapa 1 aprovados sem regressão (pm run test:security), 12/12 testes de governança da Etapa 2 aprovados sem regressão (pm run test:governance), 13/13 testes de confiabilidade da Etapa 3 aprovados sem regressão (pm run test:reliability) e compilação backend TypeScript limpa com 0 erros (pm run build).

**Próxima ação:** aguardar orientação para iniciar a etapa 5 — Operação, observabilidade e implantação (OPS-01 a OPS-03, DOC-01). Nenhum dado de produção ou serviço externo foi alterado.

### Entrega da Etapa 5 — Operação, observabilidade e implantação (22/10/2026)

**Estado:** implementação local da Etapa 5 concluída e pronta para homologação; suíte de testes de operação 100% aprovada (15/15 testes em PostgreSQL/WASM em memória). Regressão zero nas suítes das etapas anteriores (23/23 testes de segurança da Etapa 1, 12/12 testes de governança da Etapa 2, 13/13 testes de confiabilidade da Etapa 3 e 14/14 testes de IA/supervisão da Etapa 4 aprovados). Compilação TypeScript limpa (0 erros).

**Requisitos atendidos:** OPS-01 (backup estruturado, integridade com SHA-256, rotação de backups, restauração com conformidade RPO <= 24h e RTO <= 4h, e trava de segurança anti-colisão Baileys), OPS-02 (liveness probe, readiness probe com timeouts e zero vazamento de segredos, observabilidade isolada de WhatsApp, métricas em tempo real, higienização de logs com redação de credenciais e alertas operacionais desduplicados), OPS-03 (runtime Node 22 LTS, execução com usuário não-root `node`, entrypoint Docker estrito que aborta se migrações falharem sem rodar seeds no restart, e graceful shutdown com encerramento ordenado de filas Bull, banco e sockets) e DOC-01 (documentação operacional completa em `docs/ETAPA-5-OPERACAO.md` e atualização do `README.md` refletindo Node 22, React 17 + Vite e isolamento de portas).

**Alterações no código:**
- `BackupService.ts`: exportação de tabelas e mídias confinados com integridade SHA-256 e geração de `manifest.json`; rotina de rotação retendo as N cópias mais recentes.
- `RestoreService.ts`: validação estrita de integridade contra adulteração (`ERR_BACKUP_INTEGRITY_COMPROMISED`), restauração consistente de dados e mídias, trava de segurança de colisão Baileys (`preventSessionCollision: true`) que força `DISCONNECTED` nas conexões WhatsApp restauradas para blindar o ambiente de produção, e validação de cumprimento de RPO e RTO.
- `HealthController.ts`, `healthRoutes.ts`:
  - `GET /health/live` e `/health`: liveness probe retornando status 200 e uptime.
  - `GET /health/ready`: readiness probe com timeouts de 3s para PostgreSQL e Redis, retornando 200 saudável ou 503 degradado, sem expor segredos.
  - `GET /health/whatsapp`: observabilidade de status das conexões Baileys por empresa, separada da saúde da aplicação.
  - `GET /health/metrics`: métricas de memória, filas Bull, mensagens falhas/incertas, alertas de espera ativos e consumo de IA.
- `OperationalAlertService.ts`: avaliação periódica com desduplicação de alertas para WhatsApp desconectado > 5 min, mensagens falhas e disco > 80%.
- `logger.ts`: mascaramento de credenciais (`password`, `token`, `secret`, `authorization`, `jwt`, `apiKey`, `db_pass`) via Pino redaction e helper `sanitizeLogData`.
- `queues.ts`: adição de `stopQueueProcess()` para encerramento ordenado de todas as filas Bull.
- `server.ts`: interceptação de `SIGINT` e `SIGTERM` com fechamento de filas, pool Sequelize e sockets; tratamento supervisionado de `uncaughtException` e `unhandledRejection`.
- `Dockerfile` e `docker-entrypoint.sh`: execução como usuário não-privilegiado `USER node`, entrypoint com `set -e` abortando se migrações falharem e desabilitação de seeds no restart.
- `README.md`: correção de divergências históricas (Node 22 LTS, React 17 + Vite, rede interna sem portas públicas de BD/Redis).

**Verificações:**
- `npm run test:operation`: **15/15 testes passaram** (PostgreSQL/WASM PGlite em memória, zero serviços externos).
- `npm run test:ai-supervision`: **14/14 testes passaram** (regressão zero para a Etapa 4).
- `npm run test:reliability`: **13/13 testes passaram** (regressão zero para a Etapa 3).
- `npm run test:governance`: **12/12 testes passaram** (regressão zero para a Etapa 2).
- `npm run test:security`: **23/23 grupos passaram** (regressão zero para a Etapa 1).
- `npm run build`: compilação TypeScript limpa com zero erros.

**Evidências:** [documento da etapa](ETAPA-5-OPERACAO.md), [testes de operação](evidencias/etapa-5-operation-tests.txt), [build backend](evidencias/etapa-5-backend-build.txt).

**Próxima ação concreta:** aguardar orientação e aprovação do usuário sobre a Etapa 5 antes de iniciar a Etapa 6 — Homologação e liberação (UX-01 e aceite global).

### Aceite do usuário da Etapa 5 — 22/10/2026

**Aceite registrado em 22/10/2026:** o usuário aprovou expressamente a etapa 5 — Operação, observabilidade e implantação (OPS-01 a OPS-03, DOC-01). Implementação e comportamento apresentados aceitos (backup estruturado com manifesto de integridade SHA-256 e rotação automática; restauração segura com prevenção de colisão de sessões Baileys e validação das metas RPO <= 24h e RTO <= 4h; probes de saúde `/health/live` e `/health/ready` com zero exposição de segredos e timeouts; observabilidade isolada de status de WhatsApp `/health/whatsapp`; endpoint de métricas operacionais `/health/metrics`; alertas operacionais desduplicados; sanitização de logs confidenciais; execução em container como usuário `node`; script de entrada com falha estrita em migrações e sem seeds no restart; graceful shutdown de filas Bull, banco e sockets; e documentação operacional completa com alinhamento do `README.md`). Pendências de homologação final continuam abertas; este aceite não comprova essas verificações nem autoriza publicação ou envio de mensagens reais. Etapa 6 não iniciada e depende de nova orientação.

**Verificações mantidas:** 15/15 testes da suíte de operação aprovados (`npm run test:operation`), 14/14 testes da suíte de IA/supervisão aprovados sem regressão (`npm run test:ai-supervision`), 13/13 testes de confiabilidade aprovados sem regressão (`npm run test:reliability`), 12/12 testes de governança aprovados sem regressão (`npm run test:governance`), 23/23 testes de segurança aprovados sem regressão (`npm run test:security`) e compilação backend TypeScript limpa com 0 erros (`npm run build`).

**Próxima ação:** aguardar orientação para iniciar a etapa 6 — Homologação e liberação (UX-01 e aceite global). Nenhum dado de produção ou serviço externo foi alterado.


### Entrega da Etapa 6 — Homologação e liberação (22/10/2026)

**Estado:** implementação local da Etapa 6 e suíte de homologação global concluídas e prontas para aceite final do responsável; suíte de testes de homologação 100% aprovada (10/10 cenários em PostgreSQL/WASM em memória). Regressão zero nas suítes das etapas anteriores (23/23 testes de segurança da Etapa 1, 12/12 testes de governança da Etapa 2, 13/13 testes de confiabilidade da Etapa 3, 14/14 testes de IA/supervisão da Etapa 4 e 15/15 testes de operação da Etapa 5 aprovados). Compilações TypeScript (backend) e Vite (frontend) limpas com zero erros (87/87 testes automatizados aprovados no total geral).

**Requisitos atendidos:** UX-01 (clareza operacional, preservação de rascunhos, bloqueio de navegação no perdedor de conflito, traduções amigáveis de erros, visibilidade de responsável/fila/conexão no cabeçalho do ticket e identificação visual clara de falha de envio na conversa) e Homologação Integrada (10 cenários globais cobrindo isolamento multi-tenant, concorrência, idempotência, parada de sistema, IA segura, expediente comercial com alerta de 10 minutos, probes de saúde sem segredos, ciclo de backup/restauração com conformidade RPO <= 24h e RTO <= 4h, retenção com dry-run seguro e concorrência de 10 atendentes virtuais simultâneos).

**Alterações no código:**
- `MessageInput/index.js` e `MessageInputCustom/index.js`: preservação do texto digitado (`inputMessage`) no campo de entrada caso o envio HTTP falhe, evitando perda de mensagem e retrabalho do atendente.
- `TicketListItem/index.js` e `TicketListItemCustom/index.js`: navegação para o ticket (`history.push`) ocorre exclusivamente após confirmação bem-sucedida da requisição no backend. Em caso de conflito (409 Conflict), a navegação é cancelada e o erro amigável é exibido via toast.
- `pt.js`, `en.js`, `es.js`: adição de mensagens amigáveis em português, inglês e espanhol para `ERR_TICKET_ALREADY_CLAIMED`, `ERR_CANNOT_ACCEPT_TICKET_OTHER_USER`, `ERR_RESTRICTED_ATTENDANT_QUEUE`, `ERR_RESTRICTED_SUPERVISOR_QUEUE`, `ERR_CONNECTION_DISCONNECTED`, `ERR_AI_BUDGET_EXCEEDED`, `ERR_AUDIO_TOO_LONG` e `ERR_BACKUP_INTEGRITY_COMPROMISED`.
- `TicketInfo/index.js`: exibição do atendente responsável, fila e conexão WhatsApp vinculados diretamente no cabeçalho da conversa.
- `MessagesList/index.js`: renderização de ícone de erro em vermelho (`ErrorOutline`) com tooltip explicativo contendo o motivo da falha ou incerteza (`uncertainReason`) para mensagens com status `failed` ou `uncertain`.
- `package.json` (backend): adição do script `test:homologation` apontando para `tests/homologation/run.cjs`.
- `tests/homologation/run.cjs`: suíte de homologação completa com 10 cenários cobrindo todos os requisitos integrados e ensaio de carga concorrente com 10 atendentes simultâneos sem deadlocks.

**Verificações:**
- `npm run test:homologation`: **10/10 cenários passaram** (PostgreSQL/WASM PGlite em memória, zero serviços externos).
- `npm run test:operation`: **15/15 testes passaram** (regressão zero para a Etapa 5).
- `npm run test:ai-supervision`: **14/14 testes passaram** (regressão zero para a Etapa 4).
- `npm run test:reliability`: **13/13 testes passaram** (regressão zero para a Etapa 3).
- `npm run test:governance`: **12/12 testes passaram** (regressão zero para a Etapa 2).
- `npm run test:security`: **23/23 grupos passaram** (regressão zero para a Etapa 1).
- `npm run build` (backend): compilação TypeScript limpa com zero erros.
- `npm run build` (frontend): compilação Vite limpa com zero erros.

**Evidências:** [documento da etapa](ETAPA-6-HOMOLOGACAO.md), [testes de homologação](evidencias/etapa-6-homologation-tests.txt), [build backend](evidencias/etapa-6-backend-build.txt), [build frontend](evidencias/etapa-6-frontend-build.txt).

**Próxima ação concreta:** aguardar orientação e aceite final do responsável pelo negócio para autorização de deploy e publicação em ambiente produtivo.