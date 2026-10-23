let token = null;
export const getSessionToken = () => token;
export const setSessionToken = value => { token = value; };
// Drop persisted legacy credentials once. Access tokens now live only in this module.
localStorage.removeItem("token");
