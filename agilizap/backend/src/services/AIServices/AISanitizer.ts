export interface SanitizedAIResult {
  clientText: string;
  summary: string;
  transferAction: {
    detected: boolean;
    targetQueueName?: string;
  };
}

export const sanitizeAIResponse = (raw: string): SanitizedAIResult => {
  if (!raw || typeof raw !== "string") {
    return {
      clientText: "",
      summary: "",
      transferAction: { detected: false }
    };
  }

  let text = raw;
  let summary = "";
  let transferDetected = false;
  let targetQueueName: string | undefined = undefined;

  // 1. Detect closed [RESUMO_IA]...[/RESUMO_IA] block
  const closedSummaryMatch = text.match(/\[RESUMO_IA\]([\s\S]*?)\[\/RESUMO_IA\]/i);
  if (closedSummaryMatch) {
    summary = closedSummaryMatch[1].trim();
    text = text.replace(closedSummaryMatch[0], "").trim();
  } else {
    // Truncated summary block where opening tag exists but model stopped generating before closing tag
    const truncatedSummaryMatch = text.match(/\[RESUMO_IA\]([\s\S]*)$/i);
    if (truncatedSummaryMatch) {
      summary = truncatedSummaryMatch[1].trim();
      text = text.replace(truncatedSummaryMatch[0], "").trim();
    }
  }

  // 2. Detect transfer commands:
  // e.g., "Ação: Transferir para a fila [Financeiro]" or "Ação: Transferir para o setor Suporte"
  const dynamicQueueMatch = text.match(
    /\*{0,2}Ação:\*{0,2}\s*Transferir para (?:a fila|o setor(?: de)?)\s*\[?\*{0,2}([^\]\n\r.*]+?)\*{0,2}\]?(?:[.!\s]*$|\r?\n)/i
  );

  if (dynamicQueueMatch) {
    transferDetected = true;
    targetQueueName = dynamicQueueMatch[1].trim();
    text = text.replace(dynamicQueueMatch[0], "").trim();
  } else if (/Ação:\s*Transferir para o setor de atendimento/i.test(text)) {
    transferDetected = true;
    text = text.replace(/\*{0,2}Ação:\*{0,2}\s*Transferir para o setor de atendimento[.!]*/gi, "").trim();
  } else if (/\[TRANSFERIR\]/i.test(text)) {
    transferDetected = true;
    text = text.replace(/\[TRANSFERIR\]/gi, "").trim();
  }

  // 3. Strip any residual internal instruction markers or system prompt leakage
  text = text
    .replace(/\[\/?RESUMO_IA\]/gi, "")
    .replace(/\[\/?SYSTEM\]/gi, "")
    .replace(/\[\/?INSTRU[CÇ][AÃ]O\]/gi, "")
    .replace(/^\s*\*{0,2}Ação:\*{0,2}.*$/gim, "")
    .trim();

  return {
    clientText: text,
    summary,
    transferAction: {
      detected: transferDetected,
      targetQueueName
    }
  };
};
