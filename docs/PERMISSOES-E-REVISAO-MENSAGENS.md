# Permissões e revisão dos fluxos de mensagens

Validação: 27/10/2026. Branch: `codex/fix-permissoes-admin-mensagens`.

## Resumo por perfil

| Recurso | Admin | Supervisor | User |
| --- | --- | --- | --- |
| Atendimentos | Todos da empresa, inclusive sem fila e sem associação pessoal à fila | Filas vinculadas | Consulta as filas vinculadas; assume para si |
| Texto, anexos, áudio, respostas, edição, reações e reenvio | Atendimentos da empresa | Atendimentos das filas vinculadas | Atendimentos das filas vinculadas atribuídos a si |
| Transferência de atendimento | Admin pode receber em qualquer fila da empresa; destinatários user/supervisor precisam pertencer à fila | Redistribui dentro das filas vinculadas, respeitando o vínculo do destinatário | Não transfere a outro responsável nem muda a fila |
| Filas, usuários, conexões, prompts e integrações | Administração da empresa | Sem administração | Sem administração |
| Campanhas, listas de contatos, arquivos e exportação em massa | Permitidos na empresa | Bloqueados | Bloqueados |
| Dashboard geral | Permitido | Bloqueado: consultas atuais agregam a empresa inteira | Bloqueado |
| Alertas de espera | Todos da empresa | Filas vinculadas | Sem acesso à gestão dos alertas |
| Agendamentos | Gestão da empresa | Listagem padrão dos próprios; consulta direta, edição, revisão e interrupção na empresa | Próprios |
| Respostas rápidas | Gestão da empresa | Próprias e leitura das compartilhadas | Próprias e leitura das compartilhadas |
| Chat interno | Conversas da empresa, mesmo sem ser participante | Conversas das quais participa | Conversas das quais participa |
| Exclusões administrativas | Permitidas na empresa | Bloqueadas | Bloqueadas |

O isolamento entre empresas vale para todos. Validar IDs, arquivos, senhas e campos internos continua obrigatório, inclusive para admin. A gestão global da plataforma (empresas, planos e identidade visual compartilhada) e as contas protegidas por `super` mantêm suas salvaguardas específicas; não representam autorização para acessar dados de outro tenant.

## Problemas corrigidos

1. O envio de texto, a edição e a saudação automática enviavam `mediaUrl: ""`, campo protegido. Os clientes agora enviam apenas os dados necessários. Respostas citadas enviam somente o ID, e a API carrega o conteúdo autorizado.
2. A atribuição de um ticket exigia vínculo de fila até para destinatários admin. A regra agora exige vínculo apenas para user e supervisor. Uma atualização sem reatribuição não revalida o vínculo do responsável existente.
3. Transferir um atendimento aberto podia gerar conflito de aceite. O controlador distingue a redistribuição explícita autorizada, usando atualização condicional; o cliente não pode habilitar essa permissão por um campo no corpo. O aceite concorrente continua retornando 409.
4. Cadastros de avisos, campanhas e agendamentos reenviavam metadados de mídia recebidos na leitura. Agora enviam somente campos editáveis.
5. O envio de imagens dependia de uma espera fixa de dois segundos. Agora aguarda toda a compressão e preserva os anexos se a preparação ou o upload falhar. Respostas rápidas com mídia preservam o rascunho se o download/envio falhar. A edição de mensagem também mostra o erro e mantém o texto.
6. A saudação após aceite consultava todas as configurações, gerando 403 para user/supervisor. A leitura foi limitada à chave operacional `sendGreetingAccepted`; configurações administrativas e segredos permanecem bloqueados.
7. O admin ainda dependia de participação para abrir/listar mensagens de chat interno e marcar leitura podia falhar sem vínculo. O acesso agora é consistente dentro da empresa, sem inserir o admin como participante.
8. O encaminhamento verifica o destino antes de alterar um atendimento de fila alheia. Arquivos são localizados pelo caminho persistido, confinado ao armazenamento autorizado, preservando nomes com vários pontos.

## Evidências

- Backend: `npm run build` aprovado.
- Frontend: `npm run typecheck` e `npm run build` aprovados.
- Backend: `test:security` 41/41; `test:governance` 12/12; `test:reliability` 14/14; `test:ai-supervision` 14/14; `test:operation` 15/15; `test:homologation` 16/16. **Total: 112/112.**
- Frontend: `npm run test:forms` com 47 verificações; `npm run test:messages` com 16 verificações, incluindo payloads de texto/edição/saudação, resposta citada, compressão assíncrona, anexos, áudio, recuperação de falha e cadastros com metadados persistidos.
- Navegador: quatro verificações com componentes reais, cobrindo envio e edição, preservação do texto após falha e nova tentativa bem-sucedida; zero exceções JavaScript.
- A matriz de segurança usa rotas e controladores reais para mensagens, uploads, transferências, configurações operacionais e chat interno, em PostgreSQL/WASM isolado. O transporte externo de WhatsApp é simulado; os testes não enviam mensagens a clientes.

A cobertura automatizada protege os cenários descritos contra regressões; não equivale a uma garantia de ausência de qualquer defeito em todo o produto. Esta branch também inclui as correções anteriores ainda pendentes de merge na `main`.
