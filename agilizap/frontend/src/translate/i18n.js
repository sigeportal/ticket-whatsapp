import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import { messages } from "./languages";

// Garantir que todos os recursos usem português para evitar termos em inglês
const localizedMessages = {
	...messages,
	en: messages.pt,
	"en-US": messages.pt,
	"pt-BR": messages.pt,
};

i18n.init({
	debug: false,
	defaultNS: ["translations"],
	lng: "pt",
	fallbackLng: "pt",
	ns: ["translations"],
	resources: localizedMessages,
});

export { i18n };
