import { Request, Response } from "express";
import Contact from "../models/Contact";
import { deny } from "../security/policy";
export const exportContacts = async (req: Request, res: Response): Promise<void> => {
  if (req.user.profile !== "admin") deny();
  const contacts = await Contact.findAll({ where: { companyId: req.user.companyId }, attributes: ["name", "number", "email"], order: [["id", "ASC"]] });
  const cell = (value: unknown): string => {
    const text = String(value ?? "");
    const safe = /^[=+@\-\t\r]/.test(text) ? `''${text}` : text;
    return `"${safe.replace(/"/g, '\"\"')}"`;
  };
  const csv = ["name;number;email", ...contacts.map(c => [c.name, c.number, c.email].map(cell).join(";"))].join("\r\n");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Disposition", 'attachment; filename="contatos.csv"');
  res.type("text/csv").send(`\uFEFF${csv}`);
};
