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

export interface AIRequestOptions {
  prompt: Prompt;
  ticket: Ticket;
  contact: Contact;
  userMessage?: string;
  audioFilePath?: string;
  historyMessages?: Message[];
}

export interface AIResponseResult {
  text: string;
  transferQueue: boolean;
  queueId?: number;
}

const sanitizeName = (name: string): string => {
  let sanitized = name.split(" ")[0];
  sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, "");
  return sanitized.substring(0, 60);
};

const buildValidGeminiHistory = (
  historyMessages: Message[] | undefined,
  currentMessage: string,
  maxCount: number = 15
) => {
  const history: Array<{
    role: "user" | "model";
    parts: Array<{ text: string }>;
  }> = [];

  if (!historyMessages || historyMessages.length === 0) {
    return history;
  }

  // Filtrar mensagens de chat excluindo a mensagem atual se já estiver no banco
  const filtered = historyMessages.filter((m, idx) => {
    if (idx === historyMessages.length - 1 && !m.fromMe && m.body === currentMessage) {
      return false;
    }
    return m.mediaType === "chat" && m.body && m.body.trim() !== "";
  });

  const sliced = filtered.slice(-Math.min(maxCount, filtered.length));

  for (const m of sliced) {
    const role: "user" | "model" = m.fromMe ? "model" : "user";
    const text = m.body.trim();

    // A conversa do Gemini DEVE iniciar com 'user'. Ignora mensagens do modelo no topo.
    if (history.length === 0 && role === "model") {
      continue;
    }

    // O Gemini proíbe mensagens consecutivas do mesmo papel (ex: user seguido de user)
    if (history.length > 0 && history[history.length - 1].role === role) {
      history[history.length - 1].parts[0].text += `\n${text}`;
    } else {
      history.push({
        role,
        parts: [{ text }]
      });
    }
  }

  // Antes de chat.sendMessage(currentMessage), o histórico não pode terminar com 'user'
  if (history.length > 0 && history[history.length - 1].role === "user") {
    history.pop();
  }

  return history;
};

export const generateAIResponse = async (
  options: AIRequestOptions
): Promise<AIResponseResult> => {
  const { prompt, ticket, contact, userMessage, audioFilePath, historyMessages } = options;

  const provider = (prompt.provider || process.env.AI_PROVIDER || "gemini").toLowerCase();
  const modelName =
    prompt.model ||
    (provider === "gemini"
      ? process.env.GEMINI_MODEL || "gemini-1.5-flash"
      : process.env.OPENAI_MODEL || "gpt-4o-mini");

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
    throw new Error(
      `Chave de API não configurada para ${provider}. Configure no Prompt ou nas variáveis de ambiente.`
    );
  }

  const clientName = sanitizeName(contact.name || "Amigo(a)");

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

  const queueOptionsText = companyQueues.length > 0
    ? `SETORES/FILAS DISPONÍVEIS PARA ATENDIMENTO HUMANO:
${companyQueues.map(q => `- ${q.name}`).join("\n")}

Ao realizar a transferência para atendimento humano, escolha o setor mais adequado ao assunto:
${companyQueues.map(q => `* Se for assunto de ${q.name.toLowerCase()}: inclua ao final 'Ação: Transferir para a fila [${q.name}]'`).join("\n")}
* Se o cliente pedir apenas atendimento humano geral ou não especificar o assunto: inclua 'Ação: Transferir para a fila [Atendimento]' (ou a fila geral padrão).`
    : `Ao transferir, inclua 'Ação: Transferir para o setor de atendimento' ao final.`;

  const promptSystem = `Nas respostas utilize o nome ${clientName} para identificar o cliente.
Sua resposta deve usar no máximo ${prompt.maxTokens || 500} tokens e cuide para não truncar o final.
Sempre que possível, mencione o nome do cliente de forma amigável e educada.

REGRA CRÍTICA DE TRANSFERÊNCIA PARA ATENDIMENTO HUMANO:
- Você é a recepcionista e assistente virtual inteligente da empresa. Seu papel é tirar dúvidas, prestar informações e acolher o cliente.
- Somente adicione uma ação de transferência se o cliente solicitar EXPLICITAMENTE para falar com uma pessoa, humano ou atendente (exemplos: "quero uma pessoa", "atendente", "falar com humano", "atendimento humano", "quero falar com alguém"), ou se for estritamente necessário passar para um atendente humano.
- NUNCA adicione a ação de transferência se você estiver apenas perguntando, sugerindo ou oferecendo a opção ao cliente. Nesses casos, apenas ofereça a opção cordialmente sem adicionar a ação.
- Ao realizar a transferência solicitada, responda cordialmente avisando o cliente que está realizando o encaminhamento para o setor correspondente e inclua a ação de transferência ao final.

${queueOptionsText}

${prompt.prompt}`;

  let responseRaw = "";

  try {
    if (provider === "gemini") {
      const genAI = new GoogleGenerativeAI(apiKey);

      let primaryModel = modelName;
      if (
        !primaryModel ||
        primaryModel === "gemini-1.5-flash" ||
        primaryModel === "gemini-1.5-pro" ||
        primaryModel === "gemini-2.5-flash" ||
        primaryModel === "gemini-2.5-flash-lite"
      ) {
        primaryModel = "gemini-3.5-flash-lite";
      }

      const fallbackModel = primaryModel === "gemini-3.5-flash-lite" ? "gemini-3.8-flash" : "gemini-3.5-flash-lite";

      const runWithModel = async (targetModel: string) => {
        const generativeModel = genAI.getGenerativeModel({
          model: targetModel,
          systemInstruction: promptSystem,
          generationConfig: {
            maxOutputTokens: prompt.maxTokens || 800,
            temperature: prompt.temperature !== undefined ? prompt.temperature : 0.7
          }
        });

        if (audioFilePath && fs.existsSync(audioFilePath)) {
          logger.info(`[AIService] Processando áudio nativo com Gemini (${targetModel}): ${audioFilePath}`);
          const audioBuffer = fs.readFileSync(audioFilePath);
          const ext = path.extname(audioFilePath).toLowerCase();
          let mimeType = "audio/ogg";
          if (ext === ".mp3") mimeType = "audio/mp3";
          else if (ext === ".wav") mimeType = "audio/wav";
          else if (ext === ".m4a") mimeType = "audio/m4a";

          const result = await generativeModel.generateContent([
            {
              inlineData: {
                mimeType,
                data: audioBuffer.toString("base64")
              }
            },
            {
              text: "Por favor, ouça o áudio do cliente e responda cordialmente atendendo à sua solicitação conforme as instruções do sistema."
            }
          ]);
          return result.response.text();
        } else {
          const history = buildValidGeminiHistory(
            historyMessages,
            userMessage || "",
            prompt.maxMessages || 15
          );

          const chat = generativeModel.startChat({ history });
          const result = await chat.sendMessage(userMessage || "");
          return result.response.text();
        }
      };

      try {
        responseRaw = await runWithModel(primaryModel);
      } catch (primaryErr: any) {
        const errStr = primaryErr?.message || "";
        logger.warn(
          `[AIService] Erro no modelo primário Gemini (${primaryModel}): ${errStr}. Tentando modelo fallback (${fallbackModel})...`
        );
        try {
          responseRaw = await runWithModel(fallbackModel);
        } catch (fallbackErr: any) {
          logger.error(`[AIService] Modelo fallback (${fallbackModel}) também falhou: ${fallbackErr?.message || fallbackErr}`);
          throw fallbackErr;
        }
      }
    } else {
      // Provedor OpenAI
      const openai = new OpenAI({ apiKey });
      let finalUserMessage = userMessage || "";

      if (audioFilePath && fs.existsSync(audioFilePath)) {
        logger.info(`[AIService] Transcrevendo áudio com Whisper (OpenAI): ${audioFilePath}`);
        const fileStream = fs.createReadStream(audioFilePath) as any;
        const transcription = await openai.audio.transcriptions.create({
          model: "whisper-1",
          file: fileStream
        });
        finalUserMessage = transcription.text;
      }

      const openAiMessages: Array<any> = [{ role: "system", content: promptSystem }];

      if (historyMessages && historyMessages.length > 0) {
        const sorted = historyMessages.slice(-Math.min(prompt.maxMessages || 15, historyMessages.length));
        for (const m of sorted) {
          if (m.mediaType === "chat" && m.body) {
            openAiMessages.push({
              role: m.fromMe ? "assistant" : "user",
              content: m.body
            });
          }
        }
      }

      openAiMessages.push({ role: "user", content: finalUserMessage });

      const chat = await openai.chat.completions.create({
        model: modelName,
        messages: openAiMessages,
        max_tokens: prompt.maxTokens || 500,
        temperature: prompt.temperature !== undefined ? prompt.temperature : 0.7
      });

      responseRaw = chat.choices[0]?.message?.content || "";
    }

    let transfer = false;
    let targetQueueId = prompt.queueId;

    // Detectar transferência dinâmica com nome da fila:
    // Ex: "Ação: Transferir para a fila [Comercial]" ou "Ação: Transferir para o setor Suporte"
    const matchDynamicQueue = responseRaw.match(/Ação:\s*Transferir para (?:a fila|o setor(?: de)?)\s*\[?([^\]\n\r.]+?)\]?(?:\.|$)/i);

    if (matchDynamicQueue) {
      transfer = true;
      const targetName = matchDynamicQueue[1].trim().toLowerCase();
      responseRaw = responseRaw.replace(matchDynamicQueue[0], "").trim();

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
    } else if (responseRaw?.includes("Ação: Transferir para o setor de atendimento")) {
      transfer = true;
      responseRaw = responseRaw
        .replace(/Ação:\s*Transferir para o setor de atendimento/gi, "")
        .trim();
    }

    return {
      text: responseRaw,
      transferQueue: transfer,
      queueId: targetQueueId
    };
  } catch (err: any) {
    logger.error(`[AIService] Erro ao processar requisição com ${provider}: ${err?.message || err}`);
    if (err?.message?.includes("503") || err?.message?.includes("high demand") || err?.message?.includes("ResourceExhausted")) {
      return {
        text: "Olá! Nosso assistente virtual está com uma alta demanda de mensagens no momento. Por favor, aguarde um instante e envie sua mensagem novamente.",
        transferQueue: false
      };
    }
    throw err;
  }
};
