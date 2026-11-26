
export const map_msg = new Map<any, any>();

export const clearContactBotState = (contactNumber?: string | null): void => {
  if (contactNumber) {
    map_msg.delete(contactNumber);
  }
};
