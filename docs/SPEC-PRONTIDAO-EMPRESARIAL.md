# Spec — Prontidão empresarial do Ticket WhatsApp / Agilizap

Data: 21/10/2026 · Versão: 1.0 · Estado: proposta para revisão, sem implementação autorizada por este documento.

## 1. Objetivo e limites

Preparar o sistema para uma operação inicial de até dez atendentes simultâneos, com proteção de dados, continuidade do atendimento, recuperação de falhas e operação verificável.

Esta spec consolida a análise estática realizada no código. Os achados não representam uma auditoria exaustiva ou uma homologação em execução. Não foram executados testes de invasão, testes de carga ou operações no WhatsApp e no banco. A ausência de um controle no material pesquisado deve ser confirmada no ambiente antes de concluir que ele não existe.

O trabalho atual cria somente esta documentação. Alterações de código, dependências, infraestrutura, dados e publicação ficam para uma etapa posterior.

### Premissas

- Preservar os fluxos já existentes de tickets, filas, mensagens, contatos, campanhas, agendamentos, avaliações, relatórios e integrações.
- Implantação inicial para somente a empresa do responsável. Preservar o isolamento entre empresas já previsto na arquitetura; não ampliar funcionalidades comerciais para múltiplas empresas neste escopo.
- Ramo da empresa: softwares de gestão empresarial. Atendimentos abrangem suporte, financeiro e comercial; configurar esses setores como filas iniciais, sem presumir que todo usuário pode acessar todos eles.
- Reaproveitar Express, Sequelize, PostgreSQL, Bull/Redis e os mecanismos existentes quando suficientes.
- Não exigir microserviços, Kubernetes ou reescrita do frontend para atender ao volume inicial.
- Decisão do responsável: manter Baileys para não ter cobrança pela integração com o WhatsApp (mensalidade de provedor ou tarifa por mensagem). API oficial do WhatsApp e sua migração ficam fora deste escopo. Essa restrição não se aplica aos custos de servidor, armazenamento, backups, IA e demais recursos operacionais, que serão avaliados separadamente.
- Métricas e prazos marcados como propostos precisam ser confirmados pelo responsável da operação antes da homologação final.

## 2. Prioridades e condição de liberação

| Prioridade | Significado | Condição |
|---|---|---|
| P0 | Segurança de contas e dados | Bloqueia piloto com dados reais e produção |
| P1 | Confiabilidade e operação básica | Bloqueia liberação empresarial |
| P2 | Gestão e refinamento | Pode ser entregue depois, com responsável e prazo registrados |

Critério geral: todos os P0 e P1 aplicáveis devem ter evidência de aceite. Uma configuração externa só satisfaz um requisito se estiver documentada e validada no ambiente alvo. Decisões pendentes que afetem segurança, recuperação ou continuidade bloqueiam a liberação correspondente.

## 3. Segurança e isolamento

### SEC-01 — Recuperação de senha [P0]

Evidência: `agilizap/backend/src/services/ResetPasswordService/ResetPassword.ts`, `services/ForgotPassWordServices/SendMail.ts` e `routes/forgotPasswordRoutes.ts`. Há SQL interpolado, senha e token em parâmetros da URL e ausência de expiração evidente nesse fluxo.

Requisitos:

- Substituir SQL interpolado por ORM ou parâmetros vinculados em todas as consultas desse fluxo; inspecionar os demais usos de SQL bruto por entradas externas.
- Receber a nova senha no corpo da requisição; retirar a rota antiga de redefinição com senha na URL.
- Usar token aleatório, armazenado por hash, com validade proposta de 30 minutos e consumo atômico de uso único.
- Respostas de solicitação não devem revelar a existência do e-mail. Nunca registrar senha ou token em logs.
- Invalidar sessões anteriores após redefinição e aplicar a política de senha vigente.
- Corrigir o tratamento de resultado/erro e validar a configuração SMTP, incluindo coerência entre porta e modo TLS.

Aceite:

- Entradas com aspas e caracteres especiais não alteram a semântica das consultas.
- Token inválido, expirado ou já usado não altera senha; duas tentativas simultâneas com o mesmo token permitem no máximo um sucesso.
- Senha não aparece na URL nem nos logs; falha de SMTP é observável sem expor existência de conta ao solicitante.
- Fluxo completo de solicitação, recebimento e troca de senha funciona em homologação; sessões antigas perdem acesso.

### SEC-02 — Autorização no servidor e isolamento por empresa [P0]

Evidência: `services/UserServices/UpdateUserService.ts` aceita perfil sem exigir administrador e valida a empresa enviada no corpo, em vez da empresa do alvo. `services/TicketNoteService/ShowTicketNoteService.ts` e `UpdateTicketNoteService.ts` buscam por ID sem contexto do solicitante. `CompanyController.updateSchedules` não valida a empresa do usuário.

Requisitos:

- Formalizar a matriz de ator × recurso × ação com o modelo aprovado em D-02: atendente, supervisor e administrador da empresa. Supervisor é um perfil a implementar, com permissões explícitas. O superadministrador existente fica restrito à manutenção da plataforma, sem ser necessário como papel cotidiano da operação inicial.
- Derivar identidade, empresa e permissões de contexto autenticado confiável, nunca de campos livres do cliente.
- Validar empresa do registro alvo e autorização sobre tickets, notas, usuários, filas, conexões, mídias, relatórios, integrações e exportações.
- Alteração de papel, empresa, permissões e vínculos administrativos exige autorização explícita; usuário comum só altera os campos pessoais permitidos.
- Administrador de empresa não administra outras empresas. Poderes de superadministrador devem ser restritos e auditados.
- Aplicar a mesma política a REST, sockets e tarefas assíncronas; revisar também salas compartilhadas sem empresa no nome.
- Revisar cadastro público de empresas e signup: habilitação explícita, campos permitidos, plano atribuído pelo servidor e controles contra abuso.
- Revogar acesso após exclusão, bloqueio, troca de senha ou redução de privilégios, incluindo conexões socket existentes.

Aceite:

- Testes com duas empresas e todos os papéis cobrem leitura, criação, alteração e exclusão relevantes.
- Trocar IDs ou `companyId` em corpo, URL e query não permite ler ou alterar dados alheios.
- Atendente não promove a si mesmo ou outra conta; campos não autorizados são rejeitados.
- Eventos de socket e downloads não vazam dados entre empresas; revogação encerra acesso já estabelecido.
- Publicar a matriz final com exemplos permitidos e negados, usando resposta consistente de negação sem revelar dados.

### SEC-03 — Mídias privadas e uploads [P0]

Evidência: `app.ts` publica `/public` sem autenticação; `config/upload.ts` usa `typeArch` e `fileId` para resolver diretórios, sem confinamento explícito. A configuração consultada não estabelece limites de upload.

Requisitos:

- Separar assets públicos de anexos privados. Download privado exige autorização por empresa e recurso; se o provedor precisar baixar mídia, usar URL assinada de escopo e validade limitados.
- Migrar referências de anexos existentes sem perda e impedir que URLs públicas antigas continuem expondo conteúdo privado.
- Gerar nomes internos seguros, validar o caminho absoluto final e impedir travessia de diretórios, sobrescrita e execução de arquivos.
- Definir lista de tipos aceitos por finalidade e validar extensão, MIME e assinatura de conteúdo quando aplicável.
- Limitar tamanho, quantidade, duração de processamento e consumo de disco; rejeitar antes de processamentos custosos quando possível.
- Limites aprovados em D-07: até 20 MB por arquivo e cinco arquivos por envio. Definir a unidade exata em bytes na implementação e alinhar backend, frontend e proxy; validar fronteiras e o limite agregado de até 100 MB por envio. Respeitar limites menores do formato/provedor e comunicar a restrição antes do envio quando conhecida.
- Remover permissões amplas como `0777`; limpar uploads interrompidos e arquivos temporários.

Aceite: acesso anônimo e entre empresas é negado; arquivos legítimos continuam utilizáveis no painel e no WhatsApp; caminhos maliciosos, tipos proibidos e arquivos excedentes são rejeitados sem gravar fora do destino. Valores dos limites devem estar documentados e testados nas fronteiras.

### SEC-04 — Instalação, credenciais e exposição [P0]

Evidência: segredos padrão no Compose/configuração de autenticação, administrador padrão no seed e senha de fallback em `CreateCompanyService.ts`; publicação de portas do banco e Redis no Compose.

Requisitos:

- Exigir segredos de autenticação fortes e credenciais únicas; falhar na inicialização quando ausentes ou conhecidamente padrão.
- Usar conta inicial com e-mail/senha definidos explicitamente na configuração, sem credenciais previsíveis no código. Por decisão do usuário em 22/10/2026, não exigir troca de senha no primeiro acesso nem campo adicional no login. Cadastro de empresa não pode gerar senha previsível.
- Banco e Redis acessíveis apenas pela rede necessária; publicação no host desativada por padrão em produção.
- Configurar HTTPS no ponto de entrada e URLs de produção coerentes, incluindo sockets e cookies.
- Inventariar e rotacionar credenciais que tenham sido compartilhadas ou expostas; manter segredos fora de código, imagens e logs.

Aceite: instalação limpa não cria acesso administrativo previsível; configuração insegura é recusada; varredura de portas do ambiente externo só encontra serviços intencionalmente publicados. A existência de fallbacks no repositório não comprova, por si, uso dessas credenciais na instalação atual.

### SEC-05 — Sessões, abuso e política de conta [P1]

- Definir política de senha, duração de sessão, revogação e permissões atualizadas; restringir algoritmos aceitos na validação JWT.
- Revisar armazenamento de tokens no navegador e definir cookies `Secure`, `HttpOnly` e `SameSite` conforme a arquitetura; adicionar proteção CSRF onde houver autenticação por cookie.
- Aplicar limites por origem e conta a login, recuperação, cadastro e APIs de envio, sem permitir bloqueio abusivo permanente de outra conta. Configurar proxy confiável corretamente.
- Decisão revisada pelo usuário em 21/10/2026: administradores entram somente com e-mail e senha, sem código de autenticador. O usuário reconheceu a redução de segurança e aprovou essa opção para o propósito atual. Substitui a exigência anterior de MFA; adequação do código/testes implementada em 22/10/2026.
- Revisar CORS e headers de segurança; evitar tokens em URLs, logs e mensagens de erro.

Aceite: testar revogação, expiração, abuso de login e recuperação, login administrativo somente com e-mail/senha e comportamento legítimo atrás do proxy. Registrar limites. Provisionamento/recuperação de MFA deixam de ser exigência desta etapa conforme decisão revisada.

## 4. Atendimento, filas e mensagens

### REL-01 — Recuperação de agendamentos e tarefas [P1]

Evidência: `queues.ts` busca `sendAt >= agora`, altera status antes de inserir o job e aplica atraso fixo de 40 segundos. Não há política explícita de tentativas nesse caminho.

- Recuperar pendências vencidas após indisponibilidade segundo política de negócio, sem disparar em massa sem controle.
- Decisão aprovada: qualquer agendamento vencido durante indisponibilidade exige revisão humana; não enviar automaticamente na retomada. Usar o horário original persistido e o registro da interrupção para identificar esses itens, sem classificar a latência normal de processamento como parada. A revisão permite cancelar ou autorizar o envio, com auditoria, revalidação de cancelamento e proteção contra duplicidade.
- Tornar recuperável a transição entre registro persistido e fila, com identificador estável e reconciliação de tarefas presas.
- Definir tentativas limitadas, espera progressiva, distinção entre erro temporário/permanente e reprocessamento manual auditado.
- Preservar cancelamento e reagendamento, inclusive se um job já estiver na fila; remover atraso fixo injustificado.
- Documentar persistência e recuperação do Redis; não depender da mera existência de volume para afirmar durabilidade.

Aceite: simular parada antes/depois de enfileirar e durante envio; todos os itens devem terminar enviados, cancelados, em erro ou em revisão, sem sumir. Testar tarefas vencidas, cancelamento, mudança de horário e retomada sem rajada indevida.

### REL-02 — Entrega e desduplicação de mensagens [P1]

Evidência: há cache de desduplicação em memória e consulta ao banco no listener, além de `Message.upsert`. Isso não comprova recuperação de todos os pontos de falha nem garantia de envio único.

- Definir identificadores persistentes de operação e desduplicação de recebimento por empresa/conexão/mensagem.
- Distinguir aguardando, processando, aceito pelo provedor, entregue, lido, falhou e resultado incerto, conforme os sinais disponíveis do canal.
- Preservar e reconciliar pendências em reinício; não repetir automaticamente uma operação cujo envio pode ter ocorrido sem confirmação persistida.
- Exibir erro e permitir nova tentativa controlada; manter ordenação por conversa quando necessária e limitar processamento concorrente.

Aceite: repetir eventos recebidos e requisições com a mesma chave não duplica operação; testar falha após envio e antes de gravar resultado. Não prometer entrega exatamente uma vez se o provedor não fornecer garantia: estado incerto deve ser visível e recuperável.

### REL-03 — Concorrência e consistência de tickets [P1]

Evidência: `UpdateTicketService.ts` lê e depois atualiza o ticket sem controle de concorrência evidente nesse fluxo.

- Assumir ticket por atualização condicional atômica ou mecanismo equivalente, com resposta clara de conflito.
- Validar transições de status e vínculos de usuário/fila/conexão; impedir efeitos parciais em alterações relacionadas.
- Revisar criação/reabertura simultânea de tickets e limites das consultas de fallback por contato/conexão/empresa.
- Publicar eventos somente após persistência bem-sucedida; alinhar tela, histórico e banco após conflito.

Aceite: dois atendentes assumindo ao mesmo tempo resultam em um vencedor; o outro recebe conflito e atualiza a tela. Transferência e encerramento concorrentes preservam estado válido e histórico coerente.

### REL-04 — Conexão WhatsApp e continuidade [P1]

- Validar os mecanismos existentes de reconexão, persistência de credenciais e espera progressiva, em vez de substituí-los sem evidência.
- Distinguir falha temporária, logout, sessão inválida e conexão substituída; apresentar ação necessária ao operador.
- Alertar desconexão persistente e documentar reconexão e canal alternativo de atendimento.
- Definir responsável e testes antes de atualizar a biblioteca de integração.

Aceite: queda de internet, restart, logout e sessão substituída não criam sessões duplicadas ou reconexão descontrolada; painel e alertas refletem o estado real.

Decisão D-01 definida pelo responsável: manter Baileys para evitar contratação da API oficial, cuja migração fica fora do escopo. Registrar os riscos residuais de restrição da conta, mudanças no protocolo, desconexão, manutenção sem prazo garantido e entrega incerta. Essa escolha não implica aceite irrestrito de indisponibilidade: continuam obrigatórios monitoramento, recuperação de pendências, proteção de sessões e contingência. Não há garantia de evitar bloqueios por limitar volume; evitar disparos não solicitados e manter canal alternativo divulgado. Reavaliar a decisão somente se o responsável mudar o escopo.

## 5. IA e encaminhamento humano

### AI-01 — Falha segura e transferência determinística [P1]

Evidência: `AIService.ts` interpreta instruções textuais por regex; em alguns erros retorna `transferQueue: false`. O listener captura outros erros apenas em log.

- Em timeout, quota, resposta inválida ou indisponibilidade, transferir para fila humana válida da empresa e notificar o operador, com mensagem curta ao cliente.
- Definir timeout e tentativas limitadas; não deixar conversa indefinidamente sob responsabilidade da IA.
- Usar saída estruturada validada quando disponível; validar fila e ação no servidor, independentemente do texto gerado.
- Garantir que resumo e instruções internas não sejam enviados ao cliente, inclusive em respostas truncadas ou malformadas.
- Interromper automação ao assumir atendimento humano; impedir respostas concorrentes do robô e atendente.
- Validar modelos configurados em homologação, sem substituir silenciosamente o modelo escolhido por nomes fixos.
- Limitar custo, áudio, histórico e requisições por empresa; minimizar dados enviados ao provedor.
- D-07: áudio enviado à IA limitado a dez minutos e ao limite de tamanho aplicável. Medir duração no servidor, com processamento limitado; não confiar em metadados do cliente. Áudios excedentes seguem para atendimento humano sem chamada à IA. O teto mensal em reais permanece a definir; antes da liberação da IA, definir teto, contabilização de texto/transcrição/voz, margem para chamadas em andamento e encaminhamento humano ao esgotar orçamento, sem prometer bloqueio financeiro exato apenas por estimativa local.
- Escopo aprovado de entrada da IA: texto e áudios necessários ao atendimento atual. Imagens, PDFs, planilhas e demais anexos não podem ser enviados nem ter seu conteúdo extraído para a IA automaticamente. Essa permissão funcional não dispensa base legal, transparência e avaliação do provedor previstas em GOV-02.

Aceite: simular timeout, quota, erro do provedor, fila inválida, resposta malformada e pedido explícito de humano. Cada caso termina com responsável definido; nenhum bloco interno chega ao cliente. Validar texto e áudio, inclusive falha de síntese/transcrição.

## 6. Infraestrutura e operação

### OPS-01 — Backup e restauração [P1]

- Cobrir banco, mídias, credenciais de sessão e configurações necessárias, com criptografia, controle de acesso e cópia fora do host.
- Definir retenção e recuperação coerentes entre banco e arquivos; proteger segredos sem copiá-los para documentação.
- Metas aprovadas pelo responsável: RPO de 24 horas (perda máxima de dados recentes) e RTO de quatro horas (retorno após perda total do servidor). A estratégia de backup e recuperação deve demonstrar essas metas em ensaio antes da liberação; ainda não são capacidades comprovadas do ambiente.
- Documentar e testar restauração em ambiente isolado, incluindo riscos de reconectar a mesma sessão WhatsApp em dois ambientes.

Aceite: restaurar backup em instalação limpa, conferir conversas e anexos por amostragem, medir RPO/RTO e comprovar alerta em falha de backup. Registrar limites de retenção e recuperação de exclusões.

### OPS-02 — Saúde, métricas e alertas [P1]

- Implementar verificações de vida e prontidão da aplicação com timeouts; prontidão verifica dependências essenciais. Conexão WhatsApp degradada deve ser observável separadamente.
- Monitorar indisponibilidade, desconexão, idade/tamanho de filas, falhas de envio, disco, backup e erros de IA.
- Reaproveitar logs e Sentry com correlação por operação, remoção de dados sensíveis e retenção definida.
- Proposta de alerta: indisponibilidade por dois minutos, WhatsApp desconectado por cinco minutos, job devido sem progresso por cinco minutos e disco acima de 80%. Ajustar na homologação.
- Definir destinatário, meio de alerta, responsável e procedimento de resposta; evitar repetição de alertas sem mudança de estado.

Aceite: induzir falhas e comprovar diagnóstico, alerta e recuperação; endpoints de saúde não expõem segredos. Configurar rotação de logs para evitar esgotamento de disco.

### OPS-03 — Runtime, dependências e deploy [P1]

Evidência: Docker usa Node 20, instala com `npm install --legacy-peer-deps`, mantém dependências de desenvolvimento e roda migrations e seeds em cada início, tolerando falhas de seed.

- Migrar para uma versão LTS suportada, escolhida após validar compatibilidade; auditar dependências diretas e transitivas e corrigir vulnerabilidades aplicáveis.
- Garantir instalação reproduzível a partir do lockfile e declarar dependências usadas diretamente.
- Separar bootstrap, migrações e execução; não recriar credenciais ou dados de demonstração em restart.
- Executar aplicação com usuário sem privilégios e permissões mínimas; reduzir conteúdo desnecessário da imagem.
- Criar pipeline de build, testes relevantes e verificação de dependências, com artefato versionado e ambiente de homologação isolado.
- Definir rollback compatível com as migrações, backup anterior a mudanças destrutivas e encerramento de workers/sessões em deploy.
- Revisar continuidade do processo após exceções não tratadas; reiniciar de forma supervisionada quando o estado não for confiável.

Aceite: duas instalações do mesmo artefato usam dependências equivalentes; restart não roda seeds; migração falha impede prontidão; deploy e rollback são ensaiados sem perda de tarefas. Nenhuma vulnerabilidade crítica/alta aplicável fica sem correção ou análise formal de mitigação.

## 7. Gestão, privacidade e experiência

### GOV-01 — Auditoria de ações [P1]

- Registrar ator, empresa, data UTC, recurso, ação e resultado em mudanças de permissão, recuperação de conta, exclusão, exportação, transferência, encerramento e reprocessamento.
- Histórico deve ter acesso restrito e impedir edição pelo usuário comum; excluir senhas, tokens e conteúdo pessoal desnecessário.
- Reaproveitar históricos existentes quando suficientes, acrescentando o que falta.

Aceite: reconstruir uma sequência de transferência, alteração administrativa e exclusão; ação negada relevante também gera evidência segura. Definir retenção, acesso e exportação do histórico.

### GOV-02 — Ciclo de vida dos dados [P1]

- Inventariar dados pessoais, anexos, logs, backups e o que segue para provedores de IA e integrações.
- Definir responsáveis, prazos de retenção, exportação, exclusão/anonimização e tratamento de solicitações, com revisão jurídica quando necessária.
- Política operacional e marco aprovados em D-03: conversas por dois anos e anexos (inclusive áudios) por um ano, contados do encerramento do respectivo ticket. Novo atendimento não renova o prazo de tickets anteriores. Se o fluxo reutilizar o mesmo registro de ticket, distinguir os ciclos de atendimento para preservar esse marco; definir e testar o tratamento de reabertura antes de habilitar o expurgo. Tickets abertos não podem servir de justificativa para retenção indefinida: revisar periodicamente necessidade e pendências de encerramento.
- Contexto declarado: suporte, financeiro e comercial de uma empresa de softwares de gestão. Não presumir que todo conteúdo é necessário ao histórico: orientar equipe a evitar senhas, credenciais e cópias desnecessárias de bases de clientes, e prever tratamento de dados pessoais eventualmente recebidos em prints, áudios ou anexos. A definição do ramo não substitui a avaliação de obrigações específicas de guarda de documentos financeiros e comerciais.
- Esses prazos não são impostos nem automaticamente autorizados pela LGPD. Os arts. 6º, 15 e 16 exigem adequação à finalidade, necessidade e término do tratamento, com hipóteses de conservação. Documentar finalidade, base legal e justificativa de cada prazo; avaliar obrigações legais/regulatórias específicas antes de habilitar expurgo. Eliminar antes quando o tratamento deva terminar e não houver fundamento para conservação; qualquer exceção de guarda exige justificativa, acesso restrito e revisão.
- Tratar resumo e transcrição como dados derivados sujeitos à política de conversas, sem usar sua criação para reiniciar prazos. Definir separadamente retenção no provedor de IA, logs e backups; o prazo local não garante eliminação em serviços externos.
- Implementar exportação restrita à empresa e exclusão consistente, preservando registros que precisem ser mantidos conforme política aprovada.
- Documentar prazo de expurgo de backups e procedimento para não reativar dados excluídos após restauração.
- Para campanhas, definir origem dos contatos, permissões aplicáveis, opt-out e bloqueio efetivo de novos envios ao contato que recusou.

Aceite: exportar e excluir um contato de teste com anexos e referências; comprovar ausência de vazamento entre empresas, propagação às integrações controladas e respeito ao bloqueio de campanhas. O aceite técnico não constitui declaração de conformidade jurídica.

### UX-01 — Clareza operacional e acessibilidade [P1]

- Mostrar responsável, fila, conexão, estado real de envio e falhas com ações de recuperação claras.
- Alertar conflito ao assumir ticket e preservar mensagem digitada em falha de envio.
- Homologar navegação por teclado, foco, rótulos, contraste e os fluxos essenciais em desktop e celular.

Aceite: operador consegue reconhecer conexão caída, envio falho e transferência concluída sem consultar logs; teste manual dos fluxos essenciais com teclado e viewport móvel.

### OPS-04 — Horários e alerta de espera [P1]

- D-08 aprovado para suporte, financeiro e comercial: segunda a sexta das 08:00 às 17:00; sábado das 08:00 às 12:00, no fuso `America/Campo_Grande` (Campo Grande, MS). Domingo sem expediente regular. Não presumir intervalo de almoço não informado; feriados e exceções de calendário precisam ser configurados conforme definição da empresa.
- Cliente aguardando atendimento por dez minutos deve gerar alerta ao supervisor responsável pela fila, sem expor dados a supervisores de outros setores.
- Não há prazo de resposta ou resolução prometido aos clientes. O alerta é uma regra interna de operação, não SLA contratual.
- Semântica aprovada: contar somente minutos dentro do expediente; iniciar ao entrar na fila humana ou quando nova mensagem do cliente ficar pendente de resposta humana; mensagens adicionais do cliente e respostas do bot não reiniciam a espera; pausar fora do expediente e retomar na abertura. Encerrar a espera com resposta humana ou encerramento válido, não apenas ao assumir o ticket. Exemplo aprovado: espera iniciada sábado às 11h55 gera alerta segunda às 08h05, se não houver feriado nem resposta humana. Definir destinatário substituto quando não houver supervisor disponível.
- Gerar um alerta por episódio de espera, com entrega rastreável; não reenviar a cada verificação. Distinguir alerta de indisponibilidade técnica, que pode ocorrer fora do expediente.

Aceite: testar sexta após 17:00, sábado próximo ao fechamento, abertura de segunda-feira, espera com mensagens repetidas, intervenção do bot e resposta humana. Validar o exemplo aprovado, calendário e ausência de alertas duplicados. As exceções de calendário e o destinatário substituto devem estar definidos antes da liberação desse fluxo.

### PROD-01 — Prioridade, SLA e supervisão [P2]

- Definir prioridade de ticket, tempo de primeira resposta, resolução, horário útil e regra de pausa/retomada.
- Exibir tickets sem responsável ou acima do prazo; escalar para supervisor segundo regras aprovadas.
- Consolidar indicadores existentes antes de criar novos dashboards: volume, espera, primeira resposta, resolução, reabertura, avaliação e falha de envio.

Aceite: cada indicador tem definição, origem e teste com dados conhecidos; escalonamento respeita horário útil e não duplica alertas. Se o negócio assumir SLA contratual no lançamento, promover este requisito a P1.

### DOC-01 — Documentação e manutenção [P1]

- Atualizar README e procedimentos para refletir o sistema real: há Vite, mas o manifesto consultado declara React 17, apesar da descrição de React 18.
- Documentar instalação segura, configuração, migração, backup, restauração, atualização, rollback, reconexão e resposta a incidentes.
- Definir responsável operacional, frequência de manutenção e processo de correção de vulnerabilidades.
- Remover arquivos legados e duplicações apenas após confirmar ausência de uso. Unificar bibliotecas visuais e migrar React são melhorias P2, salvo incompatibilidade concreta de segurança/manutenção.

Aceite: outra pessoa instala e recupera a aplicação seguindo a documentação, sem credenciais implícitas nem conhecimento exclusivo do autor.

## 8. Plano de execução e dependências

| Etapa | Entregas | Dependências | Saída esperada |
|---|---|---|---|
| 1 — Segurança e acesso | SEC-01 a SEC-05 | Inventário das rotas e ambiente | Bloqueadores de segurança corrigidos e matriz de acesso testada |
| 2 — Dados e auditoria | GOV-01 e GOV-02 | Etapa 1 e política de dados | Histórico, retenção, exportação e exclusão verificáveis |
| 3 — Confiabilidade do atendimento | REL-01 a REL-04 | Etapa 1 e recuperação persistente | Mensagens, tickets e agendamentos recuperáveis com Baileys |
| 4 — IA e supervisão | AI-01 e OPS-04 | Etapas 1 e 3, filas, calendário e orçamento de IA | Falha segura da IA e alerta de dez minutos de expediente |
| 5 — Infraestrutura e operação | OPS-01 a OPS-03 e DOC-01 | Ambiente definido e compatibilidade validada | Backup, restauração, monitoramento e deploy demonstrados |
| 6 — Homologação e liberação | UX-01, matriz de homologação e todos os P0/P1 | Etapas anteriores | Evidências, correções finais e aceite para publicação |

O detalhamento executável e o registro de andamento ficam em [PLANO-DE-IMPLEMENTACAO.md](PLANO-DE-IMPLEMENTACAO.md). O ponto de entrada para outro chat é [CONTINUIDADE-NOVO-CHAT.md](CONTINUIDADE-NOVO-CHAT.md). PROD-01 e demais melhorias P2 ficam após essas seis etapas, salvo dependência comprovada ou mudança expressa de prioridade. O alerta de espera de OPS-04 já faz parte da etapa 4 e não deve ser adiado junto com dashboards P2.

Backup inicial e isolamento de homologação são pré-condições para qualquer futura execução de migrações, independentemente da ordem das etapas. Fazer entregas pequenas e revisáveis, com testes dos riscos alterados. Não executar suites que recriem/apaguem banco contra dados reais: os scripts de teste existentes incluem migrations, seeds e reversão de migrations.

## 9. Homologação mínima

| Cenário | Resultado exigido | Evidência |
|---|---|---|
| Duas empresas e matriz de papéis | Nenhum acesso ou evento cruzado | Testes de API/socket/download |
| Recuperação de senha e revogação | Token temporário, único e sessões revogadas | Testes positivos, negativos e concorrentes |
| Dez atendentes simultâneos | Tickets e mensagens consistentes | Relatório de carga e conferência do banco |
| Dois operadores assumindo ticket | Um vencedor e conflito explícito | Teste concorrente |
| Queda de rede e restart | Recuperação de conexão e pendências | Linha do tempo e contagem reconciliada |
| Agendamento durante parada | Recuperado ou marcado para revisão | Testes de interrupção e reconciliação |
| Envio com resultado incerto | Estado visível, sem retry cego | Falha induzida após envio |
| IA indisponível ou resposta inválida | Encaminhamento humano sem conteúdo interno | Respostas simuladas e inspeção do canal |
| Upload e acesso a anexos | Limites e autorização preservados | Testes de caminho, tipo, tamanho e acesso |
| Backup, migração e rollback | Recuperação dentro das metas aprovadas | Ensaio isolado e tempos medidos |
| Privacidade e campanhas | Exportação isolada, exclusão e opt-out efetivos | Registro de execução com dados fictícios |
| Alertas e atendimento móvel | Operador identifica e trata falhas | Ensaio operacional e teste manual |

Perfil de carga proposto: dez sessões ativas durante 60 minutos, cem conversas abertas distribuídas, uma mensagem de texto recebida por segundo no total e pico de cinco por segundo por dois minutos. Exercitar envios concorrentes e anexos dentro dos limites aprovados. Usar simulador de provedor para volume e número de teste para ensaio real controlado, evitando disparos a clientes.

Metas propostas: p95 inferior a dois segundos para APIs comuns de leitura/atualização, excluindo tempo do provedor e transferências de arquivos; mensagens recebidas persistidas em até cinco segundos em p95 sob carga nominal; zero perda silenciosa e zero acesso indevido. Registrar hardware, volume histórico do banco, latência externa e exclusões da medição. Ajustar o perfil à operação real antes do aceite; a meta de dez usuários não comprova capacidade ilimitada de campanhas.

Não foi localizada uma suíte automatizada no material pesquisado, embora haja configuração de Jest. Confirmar inventário e criar testes de regressão dos comportamentos críticos usando as ferramentas existentes. Guardar relatórios sem dados reais ou segredos.

## 10. Decisões e pendências

| ID | Decisão | Definição ou proposta | Necessária antes de |
|---|---|---|---|
| D-01 | Canal WhatsApp definido: Baileys | API oficial fora do escopo; documentar contingência e riscos residuais | REL-04 e liberação |
| D-02 | Modelo aprovado para uma empresa | Atendente limitado às suas filas; supervisor gerencia suas filas; administrador gerencia a empresa. Detalhamento abaixo | SEC-02 |
| D-03 | Política operacional e marco aprovados | Conversas 2 anos e anexos 1 ano após encerramento de cada ticket, sujeitos à finalidade e obrigações aplicáveis; IA recebe texto e áudios necessários. Validar condições do provedor | GOV-02 e AI-01 |
| D-04 | Metas aprovadas de recuperação | RPO máximo de 24h e RTO máximo de 4h; comprovar em ensaio | OPS-01 |
| D-05 | Regra aprovada de mensagem atrasada | Qualquer agendamento vencido durante parada exige revisão humana antes do envio | REL-01 |
| D-06 | Pendente: ambiente, domínio, recursos e responsável | Responsável informou “a definir” para hospedagem, sistema operacional, domínio, destino externo do backup e destinatário dos alertas. Manter HTTPS, backup externo e homologação isolada como requisitos | OPS-01 a OPS-03 |
| D-07 | Limites aprovados; orçamento pendente | 20 MB por arquivo, 5 arquivos por envio e áudio para IA até 10 min. Teto mensal de IA a definir | SEC-03 e AI-01 |
| D-08 | Horários e contagem do alerta aprovados; detalhes pendentes | Seg–sex 08h–17h, sáb 08h–12h, America/Campo_Grande; alerta após 10 min de expediente, com pausa e retomada; sem SLA contratual. Definir exceções de calendário, destinatário substituto e validar metas técnicas propostas | OPS-04 e homologação |

### D-02 — Modelo de acesso aprovado

- Escopo inicial: somente a empresa do responsável.
- Atendente: vê tickets das filas às quais está vinculado e assume os disponíveis nessas filas.
- Supervisor: acompanha as filas sob sua gestão e redistribui seus tickets.
- Administrador: gerencia a empresa, usuários e integrações. Exclusões definitivas e exportações em massa ficam restritas a esse papel na operação da empresa.
- Permissões não especificadas não são concedidas implicitamente; a matriz detalhada deve seguir esse modelo e ser testada no servidor. A definição não dispensa os testes de isolamento com uma segunda empresa fictícia.

D-01, D-02, D-04 e D-05 estão definidos pelo responsável. D-03 tem prazos operacionais, marco de contagem, ramo de atividade e tipos de entrada da IA escolhidos; a justificativa de retenção e condições do provedor precisam ser validadas antes do expurgo e uso em produção. D-06 foi explicitamente deixada a definir. D-07 tem limites aprovados e orçamento de IA pendente. D-08 tem horários, fuso e contagem do alerta aprovados; exceções de calendário, destinatário substituto e metas técnicas propostas permanecem pendentes. Essas decisões não autorizam contratação, migração do canal, publicação ou envio de mensagens a terceiros. A implementação deve registrar a opção aprovada e revisar os requisitos afetados.

## 11. Definição de pronto

- [ ] Todos os P0 e P1 aplicáveis implementados e revisados, com referências às evidências.
- [ ] Matriz de autorização testada, incluindo duas empresas e acesso direto à API.
- [ ] Nenhuma credencial padrão ativa; segredos e acesso externo revisados.
- [ ] Mensagens, tickets, agendamentos e IA aprovados nos cenários de falha.
- [ ] Backup restaurado e deploy/rollback ensaiados dentro das metas acordadas.
- [ ] Alertas entregues ao responsável e procedimentos operacionais disponíveis.
- [ ] Testes de carga, navegação essencial e acessibilidade básica aprovados.
- [ ] Política de dados e decisões D-01 a D-08 aplicáveis registradas.
- [ ] Pendências P2 com responsável e prazo, sem ocultar risco de produção.
- [ ] Aceite do responsável pelo negócio e liberação de publicação registrados separadamente.

## 12. Referências externas

As referências abaixo complementam o código; não substituem a validação da versão e do ambiente na implementação.

- [OWASP — Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): validação de permissões em cada requisição.
- [Node.js — End of Life](https://nodejs.org/en/about/eol): conferir suporte do runtime; Node 20 já está fora de suporte na data desta spec.
- [Baileys — projeto oficial](https://github.com/WhiskeySockets/Baileys): natureza da integração baseada em WhatsApp Web e capacidades da biblioteca.
- [ANPD — Perguntas frequentes](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes): a LGPD não estipula prazo único de tratamento; considerar circunstâncias e finalidade.
- [LGPD — texto compilado](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm): princípios de necessidade, término do tratamento e hipóteses de conservação (arts. 6º, 15 e 16).
