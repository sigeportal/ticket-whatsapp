import "../bootstrap";
import sequelize from "../database";
import Company from "../models/Company";
import Setting from "../models/Setting";
import Queue from "../models/Queue";
import Whatsapp from "../models/Whatsapp";
import WhatsappQueue from "../models/WhatsappQueue";
import User from "../models/User";
import UserQueue from "../models/UserQueue";
import Announcement from "../models/Announcement";
import ContactList from "../models/ContactList";
import ContactListItem from "../models/ContactListItem";
import Campaign from "../models/Campaign";
import CampaignSetting from "../models/CampaignSetting";
import QuickMessage from "../models/QuickMessage";

const DEFAULT_SCHEDULES = [
  { weekday: "Segunda-feira", weekdayEn: "monday", startTime: "08:00", endTime: "17:30" },
  { weekday: "Terça-feira", weekdayEn: "tuesday", startTime: "08:00", endTime: "17:30" },
  { weekday: "Quarta-feira", weekdayEn: "wednesday", startTime: "08:00", endTime: "17:30" },
  { weekday: "Quinta-feira", weekdayEn: "thursday", startTime: "08:00", endTime: "17:30" },
  { weekday: "Sexta-feira", weekdayEn: "friday", startTime: "08:00", endTime: "17:30" },
  { weekday: "Sábado", weekdayEn: "saturday", startTime: "08:00", endTime: "12:00" },
  { weekday: "Domingo", weekdayEn: "sunday", startTime: "", endTime: "" }
];

const DEFAULT_SETTINGS: Array<{ key: string; value: string }> = [
  { key: "chatBotType", value: "text" },
  { key: "scheduleType", value: "queue" },
  { key: "sendGreetingAccepted", value: "enabled" },
  { key: "sendMsgTransfTicket", value: "enabled" },
  { key: "sendGreetingMessageOneQueues", value: "enabled" },
  { key: "userRating", value: "enabled" },
  { key: "CheckMsgIsGroup", value: "enabled" }
];

const DEFAULT_QUEUES = [
  {
    name: "Suporte",
    color: "#2563EB",
    fallbackColors: ["#1D4ED8", "#3B82F6", "#0284C7"],
    orderQueue: 1,
    greetingMessage:
      "Olá! Você entrou em contato com o setor de *Suporte*. Por favor, descreva seu chamado ou dúvida e aguarde um instante que nossa equipe já vai te atender.",
    outOfHoursMessage:
      "Olá! Nosso setor de *Suporte* atende de segunda a sexta das 08:00 às 17:30 e aos sábados das 08:00 às 12:00 (horário de MS). Recebemos sua mensagem e responderemos assim que retornarmos!"
  },
  {
    name: "Financeiro",
    color: "#059669",
    fallbackColors: ["#047857", "#10B981", "#0D9488"],
    orderQueue: 2,
    greetingMessage:
      "Olá! Você está no setor *Financeiro*. Informe seu nome ou empresa e como podemos ajudar (boletos, notas fiscais ou pagamentos) que em breve daremos retorno.",
    outOfHoursMessage:
      "Olá! Nosso setor *Financeiro* atende de segunda a sexta das 08:00 às 17:30 e aos sábados das 08:00 às 12:00 (horário de MS). Sua solicitação ficou registrada e responderemos no próximo expediente!"
  },
  {
    name: "Comercial",
    color: "#D97706",
    fallbackColors: ["#B45309", "#F59E0B", "#EA580C"],
    orderQueue: 3,
    greetingMessage:
      "Olá! Seja bem-vindo(a) ao setor *Comercial*. Conte para nós o que você procura e um consultor já vai dar sequência ao seu atendimento!",
    outOfHoursMessage:
      "Olá! Nosso setor *Comercial* atende de segunda a sexta das 08:00 às 17:30 e aos sábados das 08:00 às 12:00 (horário de MS). Assim que estivermos disponíveis, entraremos em contato!"
  }
];

const DEFAULT_ANNOUNCEMENTS = [
  {
    priority: 1,
    title: "Horário de Atendimento Oficial (Horário de MS)",
    text:
      "Nosso expediente padrão está configurado para segunda a sexta-feira das 08:00 às 17:30 e aos sábados das 08:00 às 12:00 (America/Campo_Grande). Mensagens recebidas fora desse horário disparam automaticamente o aviso de ausência da fila."
  },
  {
    priority: 2,
    title: "Fluxo Manual: Saudação, Filas e Transferência",
    text:
      "As filas Suporte, Financeiro e Comercial estão ativas com mensagens automáticas de saudação, transferência entre departamentos/atendentes e pesquisa de satisfação habilitadas no modo manual (sem IA)."
  },
  {
    priority: 3,
    title: "Dicas: Respostas Rápidas e Quadro Kanban",
    text:
      "Use '/' no campo de mensagem para acessar as respostas rápidas cadastradas (/boasvindas, /aguarde, /horario, /encerramento). No Kanban, todos os novos atendimentos iniciam na coluna 'Em aberto'."
  }
];

const DEFAULT_QUICK_MESSAGES = [
  {
    shortcode: "boasvindas",
    message: "Olá! Tudo bem? Como posso ajudar você hoje?"
  },
  {
    shortcode: "aguarde",
    message: "Só um instante, por favor. Já estou verificando essa informação para você!"
  },
  {
    shortcode: "transferencia",
    message: "Vou transferir seu atendimento para o setor responsável para darmos sequência mais rápido. Aguarde um momento!"
  },
  {
    shortcode: "horario",
    message: "Nosso horário de atendimento é de segunda a sexta das 08:00 às 17:30 e aos sábados das 08:00 às 12:00 (horário de MS)."
  },
  {
    shortcode: "encerramento",
    message: "Atendimento concluído! Se precisar de algo mais, é só nos chamar novamente por aqui."
  }
];

const DEFAULT_CAMPAIGN_SETTINGS = [
  { key: "messageInterval", value: JSON.stringify(20) },
  { key: "longerIntervalAfter", value: JSON.stringify(20) },
  { key: "greaterInterval", value: JSON.stringify(60) },
  { key: "variables", value: JSON.stringify([]) }
];

const DEFAULT_TEST_CONTACTS = [
  { name: "Contato Teste 01", number: "5567999990001", email: "teste01@exemplo.local" },
  { name: "Contato Teste 02", number: "5567999990002", email: "teste02@exemplo.local" },
  { name: "Contato Teste 03", number: "5567999990003", email: "teste03@exemplo.local" }
];

const DEFAULT_TEST_CAMPAIGNS = [
  {
    name: "[TESTE] Boas-vindas e Apresentação",
    message1: "Olá {nome}! Esta é uma campanha de teste (variação 1) do nosso canal oficial.",
    message2: "Oi {nome}, tudo bem? Mensagem de teste (variação 2) da nossa equipe.",
    message3: "Olá {nome}! Passando para validar o disparo de campanhas (variação 3).",
    confirmation: false
  },
  {
    name: "[TESTE] Aviso de Horário de Atendimento",
    message1: "Olá {nome}! Lembrando que atendemos de seg a sex (08:00–17:30) e sábados (08:00–12:00), horário de MS.",
    message2: "Oi {nome}! Nosso expediente é de segunda a sexta das 08:00 às 17:30 e sábado até 12:00 (MS).",
    confirmation: false
  },
  {
    name: "[TESTE] Pesquisa de Satisfação (Com Confirmação)",
    message1: "Olá {nome}! Você gostaria de receber uma rápida pesquisa sobre nosso atendimento?",
    confirmation: true,
    confirmationMessage1: "Obrigado por confirmar, {nome}! Sua opinião ajuda muito nossa equipe."
  }
];

const pickAvailableColor = async (
  preferred: string,
  fallbacks: string[]
): Promise<string> => {
  const candidates = [preferred, ...fallbacks];
  for (const hex of candidates) {
    const existing = await Queue.findOne({ where: { color: hex } });
    if (!existing) return hex;
  }
  const randomHex = `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0")
    .toUpperCase()}`;
  return randomHex;
};

async function resolveCompanyId(): Promise<number> {
  const arg = process.argv.find(a => a.startsWith("--companyId="));
  if (arg) {
    const parsed = Number(arg.split("=")[1]);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  const firstCompany = await Company.findOne({ order: [["id", "ASC"]] });
  if (!firstCompany) {
    throw new Error("Nenhuma empresa encontrada no banco de dados.");
  }
  return firstCompany.id;
}

async function run(): Promise<void> {
  await sequelize.authenticate();
  const companyId = await resolveCompanyId();
  const company = await Company.findByPk(companyId);
  if (!company) {
    throw new Error(`Empresa #${companyId} não encontrada.`);
  }

  console.log(`==> Iniciando pré-configuração padrão para empresa #${company.id} (${company.name})...`);

  // 1. Horário padrão da empresa (MS)
  if (!Array.isArray(company.schedules) || company.schedules.length === 0) {
    await company.update({ schedules: DEFAULT_SCHEDULES as any });
    console.log("  [OK] Horário de expediente padrão (MS) aplicado na empresa.");
  } else {
    console.log("  [SKIP] Empresa já possui horários configurados.");
  }

  // 2. Configurações operacionais manuais
  for (const item of DEFAULT_SETTINGS) {
    const [setting, created] = await Setting.findOrCreate({
      where: { companyId, key: item.key },
      defaults: { companyId, key: item.key, value: item.value }
    });
    if (!created && setting.value !== item.value) {
      await setting.update({ value: item.value });
    }
  }
  console.log(`  [OK] ${DEFAULT_SETTINGS.length} configurações operacionais manuais garantidas.`);

  // 3. Filas padrão (Suporte, Financeiro, Comercial)
  const queues: Queue[] = [];
  for (const qDef of DEFAULT_QUEUES) {
    let queue = await Queue.findOne({ where: { name: qDef.name, companyId } });
    if (!queue) {
      const color = await pickAvailableColor(qDef.color, qDef.fallbackColors);
      queue = await Queue.create({
        name: qDef.name,
        color,
        companyId,
        orderQueue: qDef.orderQueue,
        greetingMessage: qDef.greetingMessage,
        outOfHoursMessage: qDef.outOfHoursMessage,
        schedules: DEFAULT_SCHEDULES as any
      });
      console.log(`  [OK] Fila criada: ${queue.name} (#${queue.id}, ${queue.color})`);
    } else {
      await queue.update({
        greetingMessage: queue.greetingMessage || qDef.greetingMessage,
        outOfHoursMessage: queue.outOfHoursMessage || qDef.outOfHoursMessage,
        orderQueue: queue.orderQueue ?? qDef.orderQueue,
        schedules:
          Array.isArray(queue.schedules) && queue.schedules.length > 0
            ? queue.schedules
            : (DEFAULT_SCHEDULES as any)
      });
      console.log(`  [OK] Fila existente atualizada/preservada: ${queue.name} (#${queue.id})`);
    }
    queues.push(queue);
  }

  // 4. Mensagens padrão nas conexões WhatsApp + vínculo com as 3 filas
  const whatsapps = await Whatsapp.findAll({ where: { companyId } });
  const defaultWhatsapp = whatsapps.find(w => w.isDefault) || whatsapps[0] || null;
  for (const wapp of whatsapps) {
    await wapp.update({
      greetingMessage:
        wapp.greetingMessage ||
        "Olá! Seja bem-vindo(a) à nossa central de atendimento. Escolha abaixo o setor com quem deseja falar:",
      complationMessage:
        wapp.complationMessage ||
        "Seu atendimento foi encerrado. Caso precise de algo mais, basta enviar uma nova mensagem por aqui!",
      outOfHoursMessage:
        wapp.outOfHoursMessage ||
        "Nosso atendimento funciona de segunda a sexta das 08:00 às 17:30 e aos sábados das 08:00 às 12:00 (horário de MS). Assim que retornarmos, responderemos você!",
      ratingMessage:
        wapp.ratingMessage ||
        "Como você avalia o nosso atendimento de hoje?",
      farewellMessage:
        wapp.farewellMessage ||
        "Obrigado pelo contato! Até breve."
    });

    for (const queue of queues) {
      await WhatsappQueue.findOrCreate({
        where: { whatsappId: wapp.id, queueId: queue.id },
        defaults: { whatsappId: wapp.id, queueId: queue.id }
      });
    }
  }
  console.log(`  [OK] ${whatsapps.length} conexão(ões) WhatsApp atualizada(s) e vinculada(s) às 3 filas.`);

  // 5. Vincular administradores às 3 filas para operação imediata
  const admins = await User.findAll({ where: { companyId, profile: "admin" } });
  for (const admin of admins) {
    for (const queue of queues) {
      await UserQueue.findOrCreate({
        where: { userId: admin.id, queueId: queue.id },
        defaults: { userId: admin.id, queueId: queue.id }
      });
    }
  }
  console.log(`  [OK] ${admins.length} usuário(s) admin vinculado(s) às 3 filas.`);

  // 6. Respostas Rápidas padrão (QuickMessages)
  const ownerAdmin = admins[0] || (await User.findOne({ where: { companyId } }));
  if (ownerAdmin) {
    for (const qm of DEFAULT_QUICK_MESSAGES) {
      await QuickMessage.findOrCreate({
        where: { companyId, shortcode: qm.shortcode },
        defaults: {
          companyId,
          userId: ownerAdmin.id,
          shortcode: qm.shortcode,
          message: qm.message,
          geral: true
        }
      });
    }
    console.log(`  [OK] ${DEFAULT_QUICK_MESSAGES.length} respostas rápidas garantidas.`);
  }

  // 7. Informativos (Announcements)
  for (const ann of DEFAULT_ANNOUNCEMENTS) {
    await Announcement.findOrCreate({
      where: { companyId, title: ann.title },
      defaults: {
        companyId,
        priority: ann.priority,
        title: ann.title,
        text: ann.text,
        status: true
      }
    });
  }
  console.log(`  [OK] ${DEFAULT_ANNOUNCEMENTS.length} informativos garantidos.`);

  // 8. Configurações de Disparo + Lista e Campanhas de Teste (INATIVA)
  for (const cs of DEFAULT_CAMPAIGN_SETTINGS) {
    await CampaignSetting.findOrCreate({
      where: { companyId, key: cs.key },
      defaults: { companyId, key: cs.key, value: cs.value }
    });
  }

  const [contactList] = await ContactList.findOrCreate({
    where: { companyId, name: "Lista de Testes - Pré-configuração" },
    defaults: { companyId, name: "Lista de Testes - Pré-configuração" }
  });

  for (const contact of DEFAULT_TEST_CONTACTS) {
    await ContactListItem.findOrCreate({
      where: { companyId, contactListId: contactList.id, number: contact.number },
      defaults: {
        companyId,
        contactListId: contactList.id,
        name: contact.name,
        number: contact.number,
        email: contact.email,
        isWhatsappValid: false
      }
    });
  }

  for (const camp of DEFAULT_TEST_CAMPAIGNS) {
    await Campaign.findOrCreate({
      where: { companyId, name: camp.name },
      defaults: {
        companyId,
        name: camp.name,
        message1: camp.message1,
        message2: camp.message2 || "",
        message3: camp.message3 || "",
        confirmation: camp.confirmation,
        confirmationMessage1: camp.confirmationMessage1 || "",
        status: "INATIVA",
        contactListId: contactList.id,
        whatsappId: defaultWhatsapp ? defaultWhatsapp.id : null
      }
    });
  }
  console.log(`  [OK] Lista de teste e ${DEFAULT_TEST_CAMPAIGNS.length} campanhas de teste (INATIVA) garantidas.`);
  console.log("==> Pré-configuração concluída com sucesso! (Kanban mantido apenas com 'Em aberto')");
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("==> [ERRO] Falha ao executar pré-configuração padrão:", err);
    process.exit(1);
  });
