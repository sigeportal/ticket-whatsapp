import { validateUploads } from "./uploadLimits";
import axios from "axios";

const api = axios.create({
	baseURL: process.env.REACT_APP_BACKEND_URL,
	withCredentials: true,
});

export const openApi = axios.create({
	baseURL: process.env.REACT_APP_BACKEND_URL
});

api.interceptors.request.use(config => {
  if (config.data instanceof FormData) {
    validateUploads(Array.from(config.data.values()).filter(value => value instanceof Blob));
  }
  return config;
});
export default api;
