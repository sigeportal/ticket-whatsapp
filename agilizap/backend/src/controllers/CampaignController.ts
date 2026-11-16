import { confinedPath } from "../security/media";
import uploadConfig from "../config/upload";
import { Request, Response } from "express";
import fs from "fs";
import { head } from "lodash";
import path from "path";
import * as Yup from "yup";
import { getIO } from "../libs/socket";

import CreateService from "../services/CampaignService/CreateService";
import DeleteService from "../services/CampaignService/DeleteService";
import FindService from "../services/CampaignService/FindService";
import ListService from "../services/CampaignService/ListService";
import ShowService from "../services/CampaignService/ShowService";
import UpdateService from "../services/CampaignService/UpdateService";

import Campaign from "../models/Campaign";

import AppError from "../errors/AppError";
import Contact from "../models/Contact";
import ContactList from "../models/ContactList";
import ContactListItem from "../models/ContactListItem";
import Tag from "../models/Tag";
import Ticket from "../models/Ticket";
import TicketTag from "../models/TicketTag";
import { CancelService } from "../services/CampaignService/CancelService";
import { RestartService } from "../services/CampaignService/RestartService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  companyId: string | number;
};

type StoreData = {
  name: string;
  status: string;
  confirmation: boolean;
  scheduledAt: string;
  companyId: number;
  contactListId: number;
  tagListId: number | string;
  fileListId: number;
};

type FindParams = {
  companyId: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;
  const { companyId } = req.user;

  const { records, count, hasMore } = await ListService({
    searchParam,
    pageNumber,
    companyId
  });

  return res.json({ records, count, hasMore });
};

/** Builds a tenant-scoped contact list from tickets tagged with `tagId`. */
async function createContactListFromTag(
  tagId: number,
  campanhaNome: string,
  companyId: number
): Promise<number> {
  const tag = await Tag.findOne({ where: { id: tagId, companyId } });
  if (!tag) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const formattedDate = new Date().toISOString();
  const ticketTags = await TicketTag.findAll({ where: { tagId } });
  const ticketIds = ticketTags.map(ticketTag => ticketTag.ticketId);

  const tickets = await Ticket.findAll({
    where: { id: ticketIds, companyId }
  });
  const contactIds = tickets.map(ticket => ticket.contactId);

  const contacts = await Contact.findAll({
    where: { id: contactIds, companyId }
  });

  const randomName = `${campanhaNome} | TAG: ${tagId} - ${formattedDate}`;
  const contactList = await ContactList.create({
    name: randomName,
    companyId
  });

  const { id: contactListId } = contactList;

  const contactListItems = contacts.map(contact => ({
    name: contact.name,
    number: contact.number,
    email: contact.email,
    contactListId,
    companyId,
    isWhatsappValid: true
  }));

  await ContactListItem.bulkCreate(contactListItems);

  return contactListId;
}

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = req.body as StoreData;

  const schema = Yup.object().shape({
    name: Yup.string().required()
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  let contactListId = data.contactListId;

  if (typeof data.tagListId === "number") {
    contactListId = await createContactListFromTag(
      data.tagListId,
      data.name,
      companyId
    );
  }

  const record = await CreateService({
    ...data,
    companyId,
    contactListId
  });

  const io = getIO();
  io.to(`company-${companyId}-admin`).emit(`company-${companyId}-campaign`, {
    action: "create",
    record
  });

  return res.status(200).json(record);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;

  const record = await ShowService(id);

  return res.status(200).json(record);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const data = req.body as StoreData;
  const { companyId } = req.user;

  const schema = Yup.object().shape({
    name: Yup.string().required()
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const { id } = req.params;

  const record = await UpdateService({
    ...data,
    id
  });

  const io = getIO();
  io.to(`company-${companyId}-admin`).emit(`company-${companyId}-campaign`, {
    action: "update",
    record
  });

  return res.status(200).json(record);
};

export const cancel = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;

  await CancelService(+id);

  return res.status(204).json({ message: "Cancelamento realizado" });
};

export const restart = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;

  await RestartService(+id);

  return res.status(204).json({ message: "Reinício dos disparos" });
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  await DeleteService(id);

  const io = getIO();
  io.to(`company-${companyId}-admin`).emit(`company-${companyId}-campaign`, {
    action: "delete",
    id
  });

  return res.status(200).json({ message: "Campaign deleted" });
};

export const findList = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const params = { ...req.query, companyId: String(req.user.companyId), userId: req.user.id } as FindParams;
  const records: Campaign[] = await FindService(params);

  return res.status(200).json(records);
};

export const mediaUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const files = req.files as Express.Multer.File[];
  const file = head(files);

  try {
    const campaign = await Campaign.findByPk(id);
    campaign.mediaPath = file.filename;
    campaign.mediaName = file.originalname;
    await campaign.save();
    return res.send({ mensagem: "Mensagem enviada" });
  } catch (err: any) {
    throw new AppError(err.message);
  }
};

export const deleteMedia = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;

  try {
    const campaign = await Campaign.findByPk(id);
    const filePath = confinedPath(uploadConfig.directory, campaign.mediaPath);
    const fileExists = fs.existsSync(filePath);
    if (fileExists) {
      fs.unlinkSync(filePath);
    }

    campaign.mediaPath = null;
    campaign.mediaName = null;
    await campaign.save();
    return res.send({ mensagem: "Arquivo excluído" });
  } catch (err: any) {
    throw new AppError(err.message);
  }
};
