# Documentação Técnica: Modernização Visual do Chat Interno e Listas de Contatos

**Projeto:** Agilizap (Ticket WhatsApp)  
**Módulo:** Frontend (`agilizap/frontend/src/pages/Chat` e `agilizap/frontend/src/pages/ContactLists`)  
**Data:** Outubro de 2026  
**Status:** Proposta Técnica & Protótipo Funcional  
**Protótipo Visual Interativo:** [docs/preview-modernizacao.html](file:///f:/Projetos/ticket-whatsapp/docs/preview-modernizacao.html)

---

## 1. Visão Geral e Justificativa

O Agilizap possui uma infraestrutura sólida de mensageria e atendimento omnichannel, porém determinadas áreas do frontend ainda utilizam estilizações legadas e rudimentares que destoam do restante da aplicação modernizada:

1. **Aba de Chat Interno (`/chats`):**
   - Atualmente possui estilização crua ("pobre visualmente"), com bolhas de mensagem em cores sólidas hardcoded (`backgroundColor: "blue"` e `"green"` em [ChatMessages.js](file:///f:/Projetos/ticket-whatsapp/agilizap/frontend/src/pages/Chat/ChatMessages.js#L51-L61)), ausência de cabeçalho da conversa ativa, sem avatares dinâmicos, sem status online/offline, sem campo de pesquisa de conversas na lista lateral e sem tela de *empty state*.
2. **Interface de Listas de Contatos (`/contact-lists` e `/contact-lists/:id/contacts`):**
   - Utiliza tabelas padrão sem hierarquia visual, ícones antigos padrão do Material-UI v4 (`GetApp`, `People`, `DeleteOutline`) sem identidade visual nem estados de hover estilizados, e validação de WhatsApp feita com `htmlColor="green"` e `htmlColor="grey"` sem badges semânticos.
   - Presença de ícones PNG legados (`assets/icons/chatinterno.png`, `listasdecontatos.png`).

O objetivo desta modernização é fornecer uma interface refinada, profissional, alinhada com as melhores práticas de UX/UI para mensageria corporativa (estilo WhatsApp Web / Slack / Telegram) e gerenciamento de leads.

---

## 2. Diagnóstico Técnico do Código Atual

### 2.1 Chat Interno
* **Arquivo:** [agilizap/frontend/src/pages/Chat/ChatMessages.js](file:///f:/Projetos/ticket-whatsapp/agilizap/frontend/src/pages/Chat/ChatMessages.js)
  * Cores hardcoded nas classes `boxLeft` (`backgroundColor: "blue"`) e `boxRight` (`backgroundColor: "green"`).
  * Falta de cabeçalho fixo na conversa (não exibe participantes, membros do grupo nem ações rápidas).
  * Campo de envio em linha simples com `<Input>` cru e botão de envio quadrado.
* **Arquivo:** [agilizap/frontend/src/pages/Chat/ChatList.js](file:///f:/Projetos/ticket-whatsapp/agilizap/frontend/src/pages/Chat/ChatList.js)
  * Destaque da conversa ativa feito com `borderLeft: "6px solid #002d6e"` sem fundo contextualizado.
  * Falta de avatares com iniciais ou gradientes para as conversas.
  * Ausência de campo de busca/filtro das conversas internas.
* **Arquivo:** [agilizap/frontend/src/pages/Chat/index.js](file:///f:/Projetos/ticket-whatsapp/agilizap/frontend/src/pages/Chat/index.js)
  * Quando nenhuma conversa está selecionada, a coluna da direita fica vazia, sem ilustração ou instruções para o operador.

### 2.2 Listas de Contatos
* **Arquivo:** [agilizap/frontend/src/pages/ContactLists/index.js](file:///f:/Projetos/ticket-whatsapp/agilizap/frontend/src/pages/ContactLists/index.js)
  * Botões de ação em cada linha da tabela usam ícones básicos sem botões de suporte com estilo (Download, People, Edit, DeleteOutline).
  * Ausência de resumo com indicadores (KPIs rápidos de total de listas, contatos e taxa de validação).
* **Arquivo:** [agilizap/frontend/src/pages/ContactListItems/index.js](file:///f:/Projetos/ticket-whatsapp/agilizap/frontend/src/pages/ContactListItems/index.js)
  * Validação do WhatsApp é renderizada apenas com `<CheckCircleIcon htmlColor="green" />` ou `<BlockIcon htmlColor="grey" />`, gerando aspecto amador e pouco legível.

---

## 3. Diretrizes do Novo Design System

| Elemento | Padrão Anterior | Novo Padrão Modernizado |
| :--- | :--- | :--- |
| **Paleta de Destaque** | Azul/Verde puro (`blue`, `green`) | **Emerald & Teal** (`#10b981`, `#059669`, `#0d9488`) |
| **Fundos Dark Mode** | Preto plano | **Slate Dark Surface** (`#0f172a`, `#1e293b`, `#162032`) |
| **Cantos Arredondados** | `borderRadius: 4px` a `10px` | `borderRadius: 12px` (botões/cards) e `16px-20px` (balões/inputs) |
| **Tipografia & Hierarquia** | Tipografia padrão do browser | `Plus Jakarta Sans` ou `Inter`, pesos 500, 600 e 700 |
| **Ícones** | Material Icons v4 outline despadronizados | SVGs modernos estilo Lucide (stroke 2px, 18-20px) |
| **Badges de Status** | Texto simples ou ícone isolado | Status Pills arredondados com cores suaves de fundo (`bg-opacity-10`) |

---

## 4. Detalhamento da Solução por Módulo

### 4.1 Módulo: Chat Interno

```
+-----------------------------------------------------------------------------------+
|  Topbar / Header Agilizap (Status Conexão, Perfil, Modo Escuro/Claro)             |
+---------------------------------------------------+-------------------------------+
|  BARRA LATERAL DE CONVERSAS                       |  ÁREA DA CONVERSA ATIVA       |
|  - Título "Conversas Internas" + Botão "+ Novo"   |  - Header: Avatar + Título    |
|  - Campo de Busca com Lupa                        |    + Membros em Pills + Ações |
|  - Lista de Canais/Usuários:                      |  - Histórico de Mensagens:    |
|    * Avatar com Gradiente + Status Verde Online   |    * Separadores de Data      |
|    * Nome do Canal / Colega                       |    * Balão Recebido (Slate/Cinza)|
|    * Preview da última msg + Horário              |    * Balão Enviado (Gradiente)|
|    * Badge contador de não lidas                  |    * Duplo Check de Leitura   |
|                                                   |  - Input Flutuante (Pill):    |
|                                                   |    * Anexo, Emoji, Digitação  |
|                                                   |    * Botão Redondo com Seta   |
+---------------------------------------------------+-------------------------------+
```

#### Melhorias Chave:
1. **Cabeçalho Ativo da Conversa (`ChatHeader`):**
   - Exibe o nome do canal/chat, avatar colorido correspondente, lista de membros online e botões para buscar no histórico e gerenciar participantes.
2. **Balões de Mensagem Assimétricos:**
   - Mensagens enviadas: Fundo gradiente esmeralda (`from-emerald-600 to-teal-600`) com cantos `rounded-2xl rounded-tr-sm`, sombra suave e indicador de confirmação (dois traços / check duplo).
   - Mensagens recebidas: Fundo neutro com borda sutil, nome do autor em cor semântica e cantos `rounded-2xl rounded-tl-sm`.
3. **Barra de Entrada de Texto:**
   - Formato cápsula (pill), com atalhos de anexos (`paperclip`), emojis e botão flutuante de disparo rápido.
4. **Empty State:**
   - Quando não houver chat selecionado, renderizar ilustração amigável convidando o usuário a escolher um canal ou iniciar um novo.

---

### 4.2 Módulo: Listas de Contatos

#### Melhorias Chave:
1. **Cards de Estatísticas (KPIs Rápidos) no Topo:**
   - **Total de Listas:** Quantidade de listas cadastradas.
   - **Total de Contatos:** Soma total de leads na base.
   - **WhatsApp Válidos:** Porcentagem média de números válidos prontos para disparo.
   - **Download do Modelo:** Acesso direto ao modelo oficial `.xlsx`.
2. **Tabela de Listas Modernizada:**
   - Substituição dos ícones antigos por um grupo de ações com tooltips modernos:
     - `Download` (Download da planilha original em formato limpo)
     - `Eye / Users` (Ver os contatos pertencentes à lista)
     - `Pencil` (Editar configurações da lista)
     - `Trash-2` (Exclusão com modal de confirmação estilizado)
3. **Pills Semânticas de WhatsApp:**
   - Em vez de ícone puro, utilizar:
     - `[✓ Válido]` com fundo verde translúcido (`rgba(16, 185, 129, 0.12)`) e texto verde esmeralda.
     - `[✕ Sem WhatsApp]` com fundo vermelho translúcido (`rgba(239, 68, 68, 0.12)`) e texto vermelho suave.

---

## 5. Exemplo de Código para Migração (React / Material-UI)

### 5.1 Novos Estilos `makeStyles` para `ChatMessages.js`

```javascript
const useStyles = makeStyles((theme) => ({
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    height: "100%",
    backgroundColor: theme.palette.mode === "dark" ? "#0f172a" : "#f8fafc",
    borderRadius: 24,
    overflow: "hidden",
    border: theme.palette.mode === "dark" ? "1px solid #1e293b" : "1px solid #e2e8f0",
  },
  chatHeader: {
    padding: "14px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: theme.palette.mode === "dark" ? "1px solid #1e293b" : "1px solid #e2e8f0",
    backgroundColor: theme.palette.mode === "dark" ? "#162032" : "#ffffff",
  },
  messageList: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    ...theme.scrollbarStyles,
  },
  boxLeft: {
    alignSelf: "flex-start",
    maxWidth: "70%",
    padding: "12px 16px",
    borderRadius: "16px 16px 16px 4px",
    backgroundColor: theme.palette.mode === "dark" ? "#1e293b" : "#ffffff",
    color: theme.palette.mode === "dark" ? "#f1f5f9" : "#0f172a",
    border: theme.palette.mode === "dark" ? "1px solid #334155" : "1px solid #e2e8f0",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  boxRight: {
    alignSelf: "flex-end",
    maxWidth: "70%",
    padding: "12px 16px",
    borderRadius: "16px 16px 4px 16px",
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "#ffffff",
    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
  },
  inputArea: {
    padding: "14px 20px",
    backgroundColor: theme.palette.mode === "dark" ? "#162032" : "#ffffff",
    borderTop: theme.palette.mode === "dark" ? "1px solid #1e293b" : "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  inputPill: {
    backgroundColor: theme.palette.mode === "dark" ? "#0f172a" : "#f1f5f9",
    borderRadius: 24,
    padding: "8px 16px",
    border: theme.palette.mode === "dark" ? "1px solid #334155" : "1px solid #cbd5e1",
  },
  sendButton: {
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "#ffffff",
    borderRadius: 16,
    width: 44,
    height: 44,
    "&:hover": {
      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
    },
  },
}));
```

---

## 6. Protótipo Interativo Criado

Foi gerado um protótipo em arquivo único HTML no diretório de documentação:
* **Caminho:** [`docs/preview-modernizacao.html`](file:///f:/Projetos/ticket-whatsapp/docs/preview-modernizacao.html)

### Recursos do Protótipo para Teste:
1. **Alternância Instantânea de Abas:** Alterne entre a nova interface do **Chat Interno** e a nova interface das **Listas de Contatos**.
2. **Envio Interativo de Mensagens:** Digite qualquer mensagem no campo do chat e dê Enter; a mensagem é adicionada dinamicamente com animação, data/hora e duplo check.
3. **Seleção de Canais:** Clique nos itens da lista lateral para alternar entre os canais internos.
4. **Modal de Detalhes dos Contatos:** Na aba de Listas de Contatos, clique no ícone do "olho" para abrir a gaveta moderna com visualização dos leads e status semânticos de WhatsApp válido/inválido.
5. **Modo Noturno / Claro (Dark & Light Mode):** Botão de alternância com 1 clique no canto superior direito para validar o contraste em ambos os temas.

---

## 7. Roteiro Sugerido de Aplicação no Código

1. **Passo 1 (Chat Interno):**
   - Atualizar [ChatMessages.js](file:///f:/Projetos/ticket-whatsapp/agilizap/frontend/src/pages/Chat/ChatMessages.js) substituindo as classes de bolha (`boxLeft`, `boxRight`) e implementando o cabeçalho ativo da conversa.
   - Atualizar [ChatList.js](file:///f:/Projetos/ticket-whatsapp/agilizap/frontend/src/pages/Chat/ChatList.js) adicionando campo de filtro de busca e avatares estilizados com badges de status.
   - Atualizar [Chat/index.js](file:///f:/Projetos/ticket-whatsapp/agilizap/frontend/src/pages/Chat/index.js) adicionando tela de empty state quando nenhum chat estiver selecionado.

2. **Passo 2 (Listas de Contatos):**
   - Atualizar [ContactLists/index.js](file:///f:/Projetos/ticket-whatsapp/agilizap/frontend/src/pages/ContactLists/index.js) inserindo os 4 cards de KPIs de topo e modernizando os botões de ação da tabela.
   - Atualizar [ContactListItems/index.js](file:///f:/Projetos/ticket-whatsapp/agilizap/frontend/src/pages/ContactListItems/index.js) trocando os ícones puros de validação pelas pills semânticas (`[✓ Válido]` / `[✕ Sem WhatsApp]`).
