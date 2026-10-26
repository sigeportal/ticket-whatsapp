import ContactList from "../../models/ContactList";
import ContactListItem from "../../models/ContactListItem";

// All counts use the authenticated tenant; never load contact rows for a KPI.
export default async function StatsService(companyId: number, contactListId?: number) {
  const where = { companyId, ...(contactListId ? { contactListId } : {}) };
  const [totalLists, totalContacts, validContacts] = await Promise.all([
    ContactList.count({ where: { companyId, ...(contactListId ? { id: contactListId } : {}) } }),
    ContactListItem.count({ where }),
    ContactListItem.count({ where: { ...where, isWhatsappValid: true } })
  ]);
  return { totalLists, totalContacts, validContacts };
}
