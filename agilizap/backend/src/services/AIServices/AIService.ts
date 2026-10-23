import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import Prompt from "../../models/Prompt";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import { logger } from "../../utils/logger";
import { sanitizeAIResponse } from "./AISanitizer";
import { validateAudioForAI } from "./AIAudioValidator";
import { checkCompanyAIBudget, recordAIUsage } from "./AIBudgetService";

export interface AIRequestOptions {
  prompt: Prompt;
  ticket: Ticket;
  contact: Contact;
  userMessage?: string;
  audioFilePath?: string;
  historyMessages?: Message[];
  timeoutMs?: number;
}

export interface AIResponseResult {
  text: string;
  transferQueue: boolean;
  queueId?: number;
  summary?: string;
  isFallback?: boolean;
  fallbackReason?: string;
}

const sanitizeName = (name: string): string => {
  let sanitized = (name || "").split(" ")[0];
  sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, "");
  return sanitized.substring(0, 60);
};

const VALID_TEXT_MEDIA_TYPES = new Set([
  "chat",
  "conversation",
  "extendedTextMessage",
  "editedMessage"
]);

const SESSION_GAP_MS = 4 * 60 * 60 * 1000; // 4 horas

const isTransferBoundaryMessage = (m: Message): boolean => {
  if (m.mediaType === "ai_summary") return true;
  if (!m.fromMe || !m.body) return false;
  const text = m.body.toLowerCase();
  return (
    text.includes("transferindo para atendimento humano") ||
    text.includes("você foi direcionado para o setor") ||
    text.includes("você foi encaminhado(a) para a nossa equipe")
  );
};

export const extractCurrentSessionMessages = (
  historyMessages: Message[] | undefined,
  currentMessage: string,
  maxCount: number = 15
): Message[] => {
  if (!historyMessages || historyMessages.length === 0) {
    return [];
  }

  const chronological = [...historyMessages].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeA - timeB;
  });

  let sessionStartIdx = 0;
  for (let i = 0; i < chronological.length; i++) {
    const msg = chronological[i];
    if (isTransferBoundaryMessage(msg)) {
      sessionStartIdx = i + 1;
      continue;
    }
    if (i > sessionStartIdx) {
      const prevTime = chronological[i - 1].createdAt
        ? new Date(chronological[i - 1].createdAt).getTime()
        : 0;
      const currTime = msg.createdAt ? new Date(msg.createdAt).getTime() : 0;
      if (prevTime > 0 && currTime > 0 && currTime - prevTime > SESSION_GAP_MS) {
        sessionStartIdx = i;
      }
    }
  }

  const sessionMsgs = chronological.slice(sessionStartIdx);

  const validTextMsgs = sessionMsgs.filter(m => {
    if (!m.body || m.body.trim() === "") return false;
    if (m.mediaType === "ai_summary" || m.mediaType === "reactionMessage") return false;
    return VALID_TEXT_MEDIA_TYPES.has(m.mediaType) || !m.getDataValue?.("mediaUrl");
  });

  if (
    validTextMsgs.length > 0 &&
    !validTextMsgs[validTextMsgs.length - 1].fromMe &&
    currentMessage &&
    validTextMsgs[validTextMsgs.length - 1].body.trim() === currentMessage.trim()
  ) {
    validTextMsgs.pop();
  }

  return validTextMsgs.slice(-Math.min(maxCount, validTextMsgs.length));
};

export const buildValidGeminiHistory = (
  historyMessages: Message[] | undefined,
  currentMessage: string,
  maxCount: number = 15
) => {
  const history: Array<{
    role: "user" | "model";
    parts: Array<{ text: string }>;
  }> = [];

  const sliced = extractCurrentSessionMessages(
    historyMessages,
    currentMessage,
    maxCount
  );

  if (sliced.length === 0) {
    return history;
  }

  for (const m of sliced) {
    const role: "user" | "model" = m.fromMe ? "model" : "user";
    const text = m.body.trim();

    if (history.length === 0 && role === "model") {
      continue;
    }

    if (history.length > 0 && history[history.length - 1].role === role) {
      history[history.length - 1].parts[0].text += `\n${text}`;
    } else {
      history.push({
        role,
        parts: [{ text }]
      });
    }
  }

  if (history.length > 0 && history[history.length - 1].role === "user") {
    history.pop();
  }

  return history;
};

const withTimeout = <T>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    )
  ]);
};

export const generateAIResponse = async (
  options: AIRequestOptions
): Promise<AIResponseResult> => {
  const { prompt, ticket, contact, userMessage, audioFilePath, historyMessages, timeoutMs } = options;

  const defaultTimeout = timeoutMs || (process.env.AI_TIMEOUT_MS ? parseInt(process.env.AI_TIMEOUT_MS, 10) : 20000);

  // 1. Validar orçamento de IA da empresa (D-07)
  const budgetCheck = await checkCompanyAIBudget(ticket.companyId);
  if (!budgetCheck.allowed) {
    logger.warn(`[AIService] Transferência humana imediata: orçamento de IA esgotado na empresa ${ticket.companyId}`);
    return {
      text: "Estou direcionando seu atendimento para a nossa equipe humana. Um instante, por favor.",
      transferQueue: true,
      queueId: prompt.queueId,
      summary: `*Motivo:* Teto orçamentário mensal de IA atingido na empresa.\n*Mensagem do cliente:* ${userMessage || "Sem texto"}\n*Ação:* Atendimento humano assumiu automaticamente.`,
      isFallback: true,
      fallbackReason: "MONTHLY_BUDGET_EXCEEDED"
    };
  }

  // 2. Validar áudio no servidor se houver áudio enviado (D-07: max 10 min e 20 MB)
  if (audioFilePath) {
    const audioValidation = await validateAudioForAI(audioFilePath);
    if (!audioValidation.valid) {
      logger.warn(`[AIService] Áudio excedeu limites da IA: ${audioValidation.reason} (${audioValidation.durationSeconds}s, ${audioValidation.sizeBytes} bytes). Encaminhando para humano.`);
      return {
        text: "Identificamos que seu áudio possui mais de 10 minutos. Para melhor te atender, estou transferindo diretamente para nossa equipe humana.",
        transferQueue: true,
        queueId: prompt.queueId,
        summary: `*Motivo:* Áudio superior a 10 minutos ou 20 MB enviado pelo cliente (${Math.round((audioValidation.durationSeconds || 0) / 60)} min).\n*Ação:* Atendimento humano requerido para audição completa.`,
        isFallback: true,
        fallbackReason: audioValidation.reason
      };
    }
  }

  const provider = (prompt.provider || process.env.AI_PROVIDER || "gemini").toLowerCase();

  // Preservar o modelo escolhido configurado pelo usuário no Prompt sem substituição silenciosa
  const modelName =
    prompt.model && prompt.model.trim() !== ""
      ? prompt.model.trim()
      : provider === "gemini"
      ? process.env.GEMINI_MODEL || "gemini-3.5-flash-lite"
      : process.env.OPENAI_MODEL || "gpt-4o-mini";

  const apiKey =
    prompt.apiKey && prompt.apiKey.trim() !== ""
      ? prompt.apiKey
      : provider === "gemini"
      ? process.env.GEMINI_API_KEY
      : process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    logger.warn(
      `[AIService] Chave de API não configurada para o provedor ${provider} (Prompt ID: ${prompt.id})`
    );
    return {
      text: "Estou transferindo seu atendimento para a nossa equipe humana. Por favor, aguarde um instante.",
      transferQueue: true,
      queueId: prompt.queueId,
      summary: `*Motivo:* Chave de API de IA não configurada para ${provider}.\n*Ação:* Atendimento humano requerido.`,
      isFallback: true,
      fallbackReason: "MISSING_API_KEY"
    };
  }

  const clientName = sanitizeName(contact?.name || "Amigo(a)");

  let companyQueues: Queue[] = [];
  try {
    companyQueues = await Queue.findAll({
      where: { companyId: ticket.companyId },
      attributes: ["id", "name"],
      order: [["id", "ASC"]]
    });
  } catch (e) {
    logger.warn(`[AIService] Erro ao buscar filas da empresa: ${e}`);
  }

  const currentSessionMessages = extractCurrentSessionMessages(
    historyMessages,
    userMessage || "",
    prompt.maxMessages || 15
  );
  const assistantTurnsCount = currentSessionMessages.filter(m => m.fromMe).length;

  const queueOptionsText = companyQueues.length > 0
    ? `SETORES/FILAS DISPONÍVEIS PARA ENCAMINHAMENTO:
${companyQueues.map(q => `- ${q.name}`).join("\n")}

Ao realizar o encaminhamento para a equipe humana, escolha o setor mais adequado ao assunto:
${companyQueues.map(q => `* Se for assunto de ${q.name.toLowerCase()}: inclua ao final da mensagem 'Ação: Transferir para a fila [${q.name}]'`).join("\n")}
* Se não tiver certeza do setor específico: inclua ao final 'Ação: Transferir para a fila [${companyQueues[0].name}]'.`
    : `Ao encaminhar, inclua 'Ação: Transferir para o setor de atendimento' ao final.`;

  const turnControlRule =
    assistantTurnsCount === 0
      ? `- Esta é a PRIMEIRA interação desta conversa. Cumprimente ${clientName} de forma breve e cordial.`
      : assistantTurnsCount === 1
      ? `- ATENÇÃO: Você JÁ cumprimentou ${clientName} anteriormente nesta conversa. É PROIBIDO iniciar a resposta com "Olá", "Oi", "Bom dia/Boa tarde" ou se apresentar novamente! Vá direto ao ponto.
- Se o cliente já informou o problema, a rotina/tela e o erro (ou se for assunto financeiro/comercial claro), TRANSFIRA IMEDIATAMENTE agora. Caso falte saber qual é o erro/tela, faça NO MÁXIMO 1 pergunta direta e objetiva.`
      : `- ATENÇÃO MÁXIMA (LIMITE DE TRIAGEM ATINGIDO - ${assistantTurnsCount} interações anteriores): É TERMINANTEMENTE PROIBIDO iniciar com "Olá" e PROIBIDO fazer novas perguntas! Com base nas informações que o cliente já passou no histórico, ENCAMINHE IMEDIATAMENTE nesta resposta para o setor responsável, incluindo a ação de transferência e o bloco [RESUMO_IA].`;

  const promptSystem = `Você atua como Assistente de Triagem e Encaminhamento Rápido para atendimento.
O nome do cliente é ${clientName}. Sua resposta deve ser curta, objetiva e usar no máximo ${prompt.maxTokens || 500} tokens.

DIRETRIZES DA EMPRESA:
${prompt.prompt}

REGRAS CRÍTICAS DE TRIAGEM E ENCAMINHAMENTO INSTANTÂNEO (PRIORIDADE MÁXIMA):
1. SEU PAPEL É APENAS TRIAGEM E ENCAMINHAMENTO:
   - NÃO tente resolver problemas técnicos do sistema sozinho, NÃO dê diagnósticos técnicos e NÃO tente ensinar o cliente a consertar o erro.
   - Seu único objetivo é acolher rapidamente, coletar o contexto essencial do problema em no máximo 1 ou 2 perguntas rápidas e transferir imediatamente para o setor responsável com um resumo claro para o atendente.

2. CONTROLE DE CONVERSA E ANTI-REPETIÇÃO:
${turnControlRule}
   - NUNCA repita uma pergunta que você já fez ou que o cliente já respondeu no histórico.
   - Se o cliente demonstrar pressa, frustração, não souber responder qual é o erro ou pedir um atendente, TRANSFIRA IMEDIATAMENTE sem fazer mais perguntas.

3. QUANDO PERGUNTAR VS. QUANDO TRANSFERIR IMEDIATAMENTE:
   - Se o cliente enviou apenas uma saudação ou mensagem vaga: pergunte de forma simples e direta qual problema está ocorrendo.
   - Se o cliente relatou um problema no sistema mas ainda não disse qual tela/rotina ou qual erro aparece: faça APENAS UMA pergunta curta.
   - Assim que você tiver o contexto mínimo: TRANSFIRA IMEDIATAMENTE!

4. FORMATO OBRIGATÓRIO AO TRANSFERIR:
   - Quando for transferir, avise o cliente de forma breve que já registrou as informações e está encaminhando agora para o setor responsável.
   - Inclua OBRIGATORIAMENTE a linha de ação de transferência:
${queueOptionsText}
   - E inclua OBRIGATORIAMENTE no final da resposta o bloco de resumo estruturado para o atendente humano:
[RESUMO_IA]
*Setor:* (Nome do setor de destino)
*Problema/Solicitação:* (Resumo direto do que o cliente precisa)
*Rotina/Erro:* (Tela do sistema e mensagem de erro informada pelo cliente, ou "Não aplicável")
*Impacto/Urgência:* (Ex: Crítico - Sistema parado / Normal)
[/RESUMO_IA]
O bloco [RESUMO_IA] e a linha 'Ação: Transferir...' são de uso interno do sistema e serão ocultados automaticamente do WhatsApp do cliente.`;

  let responseRaw = "";

  try {
    if (provider === "gemini") {
      const genAI = new GoogleGenerativeAI(apiKey);

      const runWithModel = async (targetModel: string) => {
        const generativeModel = genAI.getGenerativeModel({
          model: targetModel,
          systemInstruction: promptSystem,
          generationConfig: {
            maxOutputTokens: prompt.maxTokens || 800,
            temperature: prompt.temperature !== undefined ? prompt.temperature : 0.4
          }
        });

        const history = buildValidGeminiHistory(
          historyMessages,
          userMessage || "",
          prompt.maxMessages || 15
        );

        const chat = generativeModel.startChat({ history });

        if (audioFilePath && fs.existsSync(audioFilePath)) {
          logger.info(`[AIService] Processando áudio nativo com Gemini (${targetModel}): ${audioFilePath}`);
          const audioBuffer = fs.readFileSync(audioFilePath);
          const ext = path.extname(audioFilePath).toLowerCase();
          let mimeType = "audio/ogg";
          if (ext === ".mp3") mimeType = "audio/mp3";
          else if (ext === ".wav") mimeType = "audio/wav";
          else if (ext === ".m4a") mimeType = "audio/m4a";

          const result = await chat.sendMessage([
            {
              inlineData: {
                mimeType,
                data: audioBuffer.toString("base64")
              }
            },
            {
              text: "Ouça o áudio enviado pelo cliente e siga as regras de triagem e encaminhamento do sistema."
            }
          ]);
          return result.response.text();
        } else {
          const result = await chat.sendMessage(userMessage || "");
          return result.response.text();
        }
      };

      responseRaw = await withTimeout(
        runWithModel(modelName),
        defaultTimeout,
        `Timeout de resposta da IA (${defaultTimeout}ms)`
      );
    } else {
      // Provedor OpenAI
      const openai = new OpenAI({ apiKey });
      let finalUserMessage = userMessage || "";

      if (audioFilePath && fs.existsSync(audioFilePath)) {
        logger.info(`[AIService] Transcrevendo áudio com Whisper (OpenAI): ${audioFilePath}`);
        const fileStream = fs.createReadStream(audioFilePath) as any;
        const transcription = await withTimeout(
          openai.audio.transcriptions.create({
            model: "whisper-1",
            file: fileStream
          }),
          defaultTimeout,
          `Timeout de transcrição Whisper (${defaultTimeout}ms)`
        );
        finalUserMessage = transcription.text;
      }

      const openAiMessages: Array<any> = [{ role: "system", content: promptSystem }];

      for (const m of currentSessionMessages) {
        openAiMessages.push({
          role: m.fromMe ? "assistant" : "user",
          content: m.body.trim()
        });
      }

      openAiMessages.push({ role: "user", content: finalUserMessage });

      const chat = await withTimeout(
        openai.chat.completions.create({
          model: modelName,
          messages: openAiMessages,
          max_tokens: prompt.maxTokens || 500,
          temperature: prompt.temperature !== undefined ? prompt.temperature : 0.4
        }),
        defaultTimeout,
        `Timeout de resposta OpenAI (${defaultTimeout}ms)`
      );

      responseRaw = chat.choices[0]?.message?.content || "";
    }

    // Sanitizar a resposta: extrai o resumo interno, comandos de transferência e evita vazamento de tags
    const sanitized = sanitizeAIResponse(responseRaw);
    let transfer = sanitized.transferAction.detected;
    let targetQueueId = prompt.queueId;
    let summaryText = sanitized.summary;

    if (sanitized.transferAction.detected && sanitized.transferAction.targetQueueName) {
      const targetName = sanitized.transferAction.targetQueueName.toLowerCase();
      const matchedQueue = companyQueues.find(q =>
        q.name.toLowerCase() === targetName ||
        targetName.includes(q.name.toLowerCase()) ||
        q.name.toLowerCase().includes(targetName)
      );

      if (matchedQueue) {
        targetQueueId = matchedQueue.id;
        logger.info(`[AIService] Transferência dinâmica detectada para a fila: ${matchedQueue.name} (id: ${matchedQueue.id})`);
      } else {
        logger.info(`[AIService] Fila '${targetName}' não encontrada exatamente. Usando fila padrão (id: ${prompt.queueId})`);
      }
    }

    // Fallback de resumo caso tenha transferido mas o modelo não incluiu o bloco [RESUMO_IA]
    if (transfer && (!summaryText || summaryText.trim() === "")) {
      const clientMsgs = currentSessionMessages
        .filter(m => !m.fromMe && m.body)
        .map(m => m.body.trim());
      if (
        userMessage &&
        userMessage.trim() !== "" &&
        (!clientMsgs.length || clientMsgs[clientMsgs.length - 1] !== userMessage.trim())
      ) {
        clientMsgs.push(userMessage.trim());
      }
      summaryText = `*Motivo:* Encaminhamento automático pós-triagem.\n*Relato do cliente:* ${clientMsgs.join(" | ") || "Sem mensagem de texto"}\n*Necessidade/Ação:* Dar continuidade ao atendimento com o operador do setor.`;
    }

    // Registrar o uso de IA com sucesso
    await recordAIUsage(ticket.companyId, 0.005);

    return {
      text: sanitized.clientText,
      transferQueue: transfer,
      queueId: targetQueueId,
      summary: summaryText
    };
  } catch (err: any) {
    logger.error(`[AIService] Erro ao processar requisição com ${provider}: ${err?.message || err}`);

    // AI-01: Em timeout, quota, resposta inválida ou indisponibilidade, transferir determinística e confiavelmente para fila humana
    return {
      text: "Estou transferindo seu atendimento para a nossa equipe humana. Por favor, aguarde um instante.",
      transferQueue: true,
      queueId: prompt.queueId,
      summary: `*Motivo:* Falha no provedor de IA (${provider}): ${err?.message || "Indisponibilidade ou resposta inválida"}\n*Última mensagem do cliente:* ${userMessage || "Sem texto"}\n*Ação:* Atendimento humano requerido com urgência.`,
      isFallback: true,
      fallbackReason: err?.message || "PROVIDER_ERROR"
    };
  }
};
