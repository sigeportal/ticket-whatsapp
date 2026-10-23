# Continuidade — começar por aqui

**Estado atual em 22/10/2026:**
- **Etapa 1 — Segurança e acesso:** expressamente aprovada pelo usuário em 22/10/2026.
- **Etapa 2 — Dados e auditoria (GOV-01 e GOV-02):** expressamente aprovada pelo usuário em 22/10/2026. Suíte de testes 100% aprovada (12/12 governança, 23/23 segurança) e documentação em [ETAPA-2-DADOS-AUDITORIA.md](ETAPA-2-DADOS-AUDITORIA.md).
- **Etapa 3 — Confiabilidade do atendimento (REL-01 a REL-04):** expressamente aprovada pelo usuário em 22/10/2026. Suíte de testes 100% aprovada (13/13 confiabilidade, 23/23 segurança, 12/12 governança) e documentação em [ETAPA-3-CONFIABILIDADE.md](ETAPA-3-CONFIABILIDADE.md).
- **Etapa 4 — IA e supervisão (AI-01 e OPS-04):** expressamente aprovada pelo usuário em 22/10/2026. Suíte de testes 100% aprovada (14/14 IA/supervisão, 23/23 segurança, 12/12 governança, 13/13 confiabilidade, 0 erros no build) e documentação em [ETAPA-4-IA-SUPERVISAO.md](ETAPA-4-IA-SUPERVISAO.md).
- **Etapa 5 — Operação, observabilidade e implantação (OPS-01 a OPS-03, DOC-01):** expressamente aprovada pelo usuário em 22/10/2026. Suíte de testes 100% aprovada (15/15 operação, 14/14 IA/supervisão, 13/13 confiabilidade, 12/12 governança, 23/23 segurança, 0 erros no build) e documentação em [ETAPA-5-OPERACAO.md](ETAPA-5-OPERACAO.md).
- **Etapa 6 — Homologação e liberação (UX-01 e aceite global):** implementação concluída e testada em 22/10/2026. Suíte de homologação global 100% aprovada (10/10 homologação; total geral de 87/87 testes automatizados aprovados nas 6 etapas com zero regressão e compilações limpas no backend e frontend). Documentação em [ETAPA-6-HOMOLOGACAO.md](ETAPA-6-HOMOLOGACAO.md). Sistema pronto para validação e aceite final do responsável.


Este arquivo permite retomar o projeto sem o histórico da conversa. Preparado em 21/10/2026.

## Estado atual

**Decisão adicional implementada em 22/10/2026:** login tem somente e-mail e senha, sem campo de nova senha ou troca obrigatória no primeiro acesso. Bootstrap usa credenciais explícitas da configuração (nenhuma credencial universal no código). Flags antigas preservadas no schema, sem bloquear sessões. Alteração voluntária e recuperação de senha mantidas. Referências anteriores à troca inicial são históricas.

### Retomada — 22/10/2026

Retomada autorizada pelo usuário. Login administrativo já adequado para somente e-mail e senha; exigência/campo de autenticador e configuração removidos, testes ajustados. Nenhuma migração nova; coluna histórica preservada sem uso. Mantida a preferência por verificações proporcionais e comunicação concisa. Ver resultado e próxima ação no registro mais recente do plano.

### Pausa e decisão anterior — 21/10/2026 (histórico)

- O usuário pediu para parar e apenas guardar o contexto. Não continuar implementação/homologação até nova orientação.
- Decisão aprovada: administrador deve entrar **somente com e-mail e senha**, sem código de autenticador. O usuário declarou conhecer a redução de segurança e considerá-la adequada ao propósito atual. Substitui a exigência anterior de MFA; não solicitar nova confirmação.
- **Estado na pausa, superado pela retomada:** código e painel continuam com MFA nas condições anteriores. Na retomada, remover essa exigência e os campos correspondentes, ajustar testes/documentação e preservar os demais controles de senha, sessão, abuso e isolamento. MFA deixa de ser pendência de aceite após essa adequação.
- Preferência futura: etapas mais rápidas e menor consumo de tokens, com verificações proporcionais, reaproveitamento de evidências e comunicação concisa, preservando os controles necessários. O usuário deixou a organização desse fluxo para um futuro próximo; não redesenhar o processo agora.
- Nesta pausa, somente documentação atualizada; nenhum código, dado ou processo alterado. O painel havia sido deixado em execução local e não foi encerrado neste pedido. Conferir disponibilidade na retomada.

Referências a MFA e próximas ações nos registros anteriores são históricas e ficam subordinadas a esta decisão e à pausa.

- Painel isolado preparado em 21/10/2026 para aceite humano: `http://homologacao.localhost:18081/__homologacao`, Node 22.19, PostgreSQL/Redis descartáveis, dez contas e quatro tickets fictícios, e-mail capturado e integrações bloqueadas. **12/12 grupos HTTP reais e 23/23 grupos isolados passaram**, além de validação pelo navegador. Comandos de iniciar/parar, contas, evidências e limites em [HOMOLOGACAO-ETAPA-1.md](HOMOLOGACAO-ETAPA-1.md). Mantido em execução local para o usuário; não confundir com o sistema já aberto em localhost:3000. Aceite humano e ambiente de destino ainda pendentes.

- Continuação da homologação em 21/10/2026: Docker disponível no Ubuntu/WSL; 150 migrations, 73 FKs, concorrência em duas conexões, Redis e backup/restauração fictícios passaram em containers descartáveis. Corrigida pré-condição na migration existente de temperatura (tipo antes do default decimal). Ver [HOMOLOGACAO-ETAPA-1.md](HOMOLOGACAO-ETAPA-1.md). Etapa permanece parcial. As pendências históricas abaixo devem ser lidas com estas atualizações.

- Projeto local: `F:\Projetos\ticket-whatsapp`.
- Sistema: Ticket WhatsApp / Agilizap, baseado no ecossistema Whaticket; backend Express/TypeScript/Sequelize, PostgreSQL, Bull/Redis, Baileys e frontend React/Vite. Confirmar versões no código ao iniciar; o README tem divergências conhecidas.
- Após a análise e decisões, a etapa 1 recebeu implementação local em 21/10/2026: autenticação/recuperação, autorização por empresa/fila, supervisor, mídias, bootstrap e MFA. Há 23 grupos de testes isolados aprovados e builds de backend/frontend. A migração nova somente rodou em PostgreSQL descartável em memória; dados e infraestrutura de produção não foram alterados. Ver [ETAPA-1-SEGURANCA.md](ETAPA-1-SEGURANCA.md) e o registro do plano.
- Etapa 1 parcialmente entregue: implementação local pronta, mas homologação externa, cadeia histórica de migrations/constraints, SMTP/HTTPS/MFA no ambiente e ensaio autorizado do canal permanecem abertos. Etapas 2 a 6 não iniciadas; não avançar sem nova orientação.
- O pedido que originou estes documentos autorizou somente organização e documentação. Usar o pedido do novo chat para determinar qual implementação está autorizada; não executar automaticamente só por ler este arquivo.

## Ordem de leitura

1. Este guia: contexto e decisões aprovadas.
2. [SPEC-PRONTIDAO-EMPRESARIAL.md](SPEC-PRONTIDAO-EMPRESARIAL.md): requisitos, prioridades, referências no código e critérios de aceite.
3. [PLANO-DE-IMPLEMENTACAO.md](PLANO-DE-IMPLEMENTACAO.md): seis etapas, pré-condições, testes e registro de andamento.
4. Instruções locais aplicáveis e implementação atual dos módulos da etapa autorizada.

## Decisões aprovadas — não reabrir sem necessidade

| Tema | Definição |
|---|---|
| Empresa | Uma empresa inicialmente, de softwares de gestão empresarial; preservar isolamento da arquitetura |
| Setores | Suporte, financeiro e comercial |
| WhatsApp | Manter Baileys; API oficial e migração fora do escopo |
| Custos | Restrição de custo zero somente na integração WhatsApp: sem mensalidade de provedor ou tarifa por mensagem. Servidor, backup, IA e demais custos são separados |
| Atendente | Vê tickets das suas filas e assume os disponíveis |
| Supervisor | Acompanha filas sob sua gestão e redistribui tickets |
| Administrador | Gerencia empresa, usuários e integrações; exclusões definitivas e exportações em massa restritas a esse papel na operação |
| Conversas | Dois anos a partir do encerramento do respectivo ticket |
| Anexos | Um ano a partir do encerramento do respectivo ticket, inclusive áudios |
| Novo atendimento | Não renova retenção de tickets anteriores; investigar ciclos/reabertura do legado |
| IA | Somente texto e áudio necessários; demais anexos ficam fora da IA |
| Upload | Até 20 MB por arquivo e cinco arquivos por envio, respeitando limites menores do canal/formato |
| Áudio para IA | Até dez minutos; excedente segue para humano |
| Recuperação | RPO até 24h e RTO até 4h; metas aprovadas, ainda a comprovar |
| Agendamento vencido durante parada | Sempre revisão humana antes de enviar; sem retomada automática desses itens |
| Expediente | Segunda a sexta 08h–17h; sábado 08h–12h; fuso `America/Campo_Grande` |
| Espera | Alerta ao supervisor após dez minutos dentro do expediente; pausa no fechamento, retoma na abertura |
| Contagem | Desde entrada na fila humana ou mensagem pendente de resposta humana; novas mensagens do cliente e respostas do bot não reiniciam o relógio |
| Fim da espera | Resposta humana ou encerramento válido; apenas assumir ticket não basta |
| Exemplo aprovado | Sábado 11h55 → alerta segunda 08h05, se não houver feriado ou resposta humana |
| SLA | Não há prazo contratual de resposta/resolução prometido aos clientes |

A LGPD não fixa um prazo único para guardar essas conversas. Dois anos/um ano são escolhas operacionais, sujeitas à finalidade, necessidade e obrigações aplicáveis. Ver GOV-02 e referências oficiais na spec. Não declarar conformidade jurídica só por implementar esses prazos.

## O que ainda não foi definido

- Infraestrutura: hospedagem, SO, domínio, destino externo de backup e destinatários/responsáveis de alertas.
- Teto mensal de IA: aprovado em 22/10/2026 no valor de R$ 50,00/mês.
- Calendário e localidade: aprovado em 22/10/2026 em Fátima do Sul/MS; dispensado cadastro de feriados locais.
- Justificativa/exceções de retenção e tratamento de ciclos/reabertura de tickets antes de habilitar expurgo.
- Metas técnicas e perfil de carga da seção 9 da spec continuam propostas; validar antes do aceite final.

Não inventar respostas nem pedir novamente decisões já aprovadas. Prosseguir em trabalho independente e solicitar cada pendência quando realmente bloquear a entrega correspondente.

## Achados da análise e estado após a implementação local

- SQL interpolado e senha na URL no fluxo de recuperação de senha.
- Alteração de perfil e validação da empresa do alvo insuficientes em atualização de usuário.
- Consultas/alterações por ID sem checagem suficiente de empresa em alguns recursos.
- `/public` servido sem autenticação e configuração de upload sem confinamento/limites explícitos no caminho analisado.
- Credenciais e segredos de fallback, seeds no restart e publicação de portas de banco/Redis.
- Agendamentos futuros sem recuperação evidente de vencidos durante parada.
- Concorrência de tickets, resultado incerto de envio e recuperação entre banco/fila a validar.
- Erros de IA sem encaminhamento humano consistente.
- Backup, restauração, monitoramento, pipeline e suíte de testes não comprovados pela análise.

Os pontos de segurança acima foram tratados localmente na etapa 1, conforme o registro e a matriz; dependências externas e aceites faltantes estão documentados. Os pontos das etapas 2 a 6 permanecem a tratar. Os pontos acima não substituem investigação do código atual. Não foram feitos exploração ativa, testes de carga, auditoria completa de dependências ou validação de produção. Foram executados apenas os testes isolados de segurança e builds registrados. Consultar os arquivos e critérios exatos na spec.

## Como continuar

Continuar o aceite pendente da etapa 1, a primeira etapa incompleta no plano. O backend agora requer Node 22.19+ da linha 22, segredos fortes e configuração explícita; não iniciar o servidor com o `.env` real para verificar a implementação. O comando isolado é `npm run test:security` em `agilizap/backend`, sem os hooks destrutivos de `npm test`. Antes de editar: verificar estado real do workspace, instruções aplicáveis, módulos, chamadores e testes existentes. A presença de pasta `.git` não comprova que os comandos Git funcionam neste ambiente.

Antes de alterar dados ou executar migrations: isolar banco de teste e providenciar backup/reversão onde houver dados existentes. Os scripts de teste do backend incluem migrations, seeds e reversão de migrations; não executá-los contra produção. Não reconectar cópia de sessão Baileys nem enviar mensagens reais sem autorização.

Ao terminar, atualizar o plano com o que mudou, testes, evidências, limitações e próxima ação. Não marcar etapa concluída com verificações obrigatórias faltando. Não publicar ou contratar serviços como consequência implícita da implementação local.

## Texto pronto para abrir um novo chat de implementação

```text
Quero iniciar a implementação da etapa 1 — Segurança e acesso — do projeto
F:\Projetos\ticket-whatsapp.

Leia primeiro docs/CONTINUIDADE-NOVO-CHAT.md,
docs/SPEC-PRONTIDAO-EMPRESARIAL.md e docs/PLANO-DE-IMPLEMENTACAO.md,
além das instruções locais aplicáveis.

Revalide os achados no código atual e implemente a etapa 1 com testes
adequados, preservando as decisões aprovadas. Não avance para as demais
etapas sem nova orientação, salvo pré-condições técnicas indispensáveis
devidamente explicadas. Preserve alterações existentes e use ambiente de
teste isolado. Não altere dados de produção, envie mensagens reais,
contrate serviços ou publique a aplicação.

Ao final, atualize o registro de andamento com alterações, verificações,
pendências e a próxima ação. Se houver uma decisão realmente bloqueante,
pergunte somente o necessário e avance no trabalho independente dela.
```

Para chats posteriores, trocar o número da etapa e consultar primeiro o registro de andamento. O texto acima é uma sugestão para o usuário enviar, não uma instrução de execução automática para quem apenas lê este documento.

## Resultado mais recente — 22/10/2026

Etapa 6 (Homologação e liberação) concluída com sucesso. Todas as seis etapas técnicas do plano foram implementadas e aprovadas por testes automatizados (87/87 testes no total, 0 regressões, 0 erros de compilação em backend TypeScript e frontend Vite):
- Etapa 1 (Segurança e acesso): 23/23 testes aprovados.
- Etapa 2 (Dados e governança): 12/12 testes aprovados.
- Etapa 3 (Confiabilidade): 13/13 testes aprovados.
- Etapa 4 (IA e supervisão): 14/14 testes aprovados.
- Etapa 5 (Operação e observabilidade): 15/15 testes aprovados.
- Etapa 6 (Homologação global UX-01): 10/10 cenários integrados aprovados.

Melhorias de UX-01 no frontend aplicadas (preservação de rascunhos em falha de envio, contenção de navegação em concorrência de tickets, erros amigáveis i18n, visibilidade no header de conversa e indicador visual de mensagens incertas/falhas). Suíte de homologação com 10 cenários complexos passou em banco isolado em memória (PGlite) com ensaio de concorrência com 10 atendentes virtuais simultâneos. Próxima ação: homologação final pelo responsável de negócio para liberação e planejamento de implantação em produção.
