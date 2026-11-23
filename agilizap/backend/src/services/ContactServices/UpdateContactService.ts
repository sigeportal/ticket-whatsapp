import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import { deny } from "../../security/policy";

interface ExtraInfo {
  id?: number;
  name: string;
  value: string;
}
interface ContactData {
  email?: string;
  number?: string;
  name?: string;
  active?: boolean;  
  extraInfo?: ExtraInfo[];
}

interface Request {
  contactData: ContactData;
  contactId: string;
  companyId: number;
}

const UpdateContactService = async ({
  contactData,
  contactId,
  companyId
}: Request): Promise<Contact> => {
  const { email, name, number, extraInfo, active } = contactData;

  const contact = await Contact.findOne({
    where: { id: contactId },
    attributes: ["id", "name", "number", "email", "companyId", "profilePicUrl", "active", "isLid"],
    include: ["extraInfo"]
  });

  if (contact?.companyId !== companyId) {
    throw new AppError("Não é possível alterar registros de outra empresa");
  }

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  if (extraInfo) {
    const existingIds = new Set(contact.extraInfo.map(old => Number(old.id)));
    // Validate all submitted IDs before mutating so foreign custom fields cannot be hijacked via upsert.
    for (const info of extraInfo) {
      if (
        info.id !== undefined &&
        info.id !== null &&
        String(info.id) !== "" &&
        !existingIds.has(Number(info.id))
      ) {
        deny();
      }
    }

    await Promise.all(
      extraInfo.map(async (info: any) => {
        const payload: { id?: number; name: string; value: string; contactId: number } = {
          name: info.name,
          value: info.value,
          contactId: contact.id
        };
        if (info.id !== undefined && info.id !== null && String(info.id) !== "") {
          payload.id = Number(info.id);
        }
        await ContactCustomField.upsert(payload);
      })
    );

    await Promise.all(
      contact.extraInfo.map(async oldInfo => {
        const stillExists = extraInfo.findIndex(
          info =>
            info.id !== undefined &&
            info.id !== null &&
            String(info.id) !== "" &&
            Number(info.id) === Number(oldInfo.id)
        );

        if (stillExists === -1) {
          await ContactCustomField.destroy({ where: { id: oldInfo.id, contactId: contact.id } });
        }
      })
    );
  }

  await contact.update({
    name,
    number,
    email,
	active
  });

  await contact.reload({
    attributes: ["id", "name", "number", "email", "profilePicUrl","active", "isLid"],
    include: ["extraInfo"]
  });

  return contact;
};

export default UpdateContactService;
