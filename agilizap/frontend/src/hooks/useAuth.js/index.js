import { getSessionToken, setSessionToken } from "../../services/sessionToken";
import { useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";
import { has, isArray } from "lodash";

import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { SocketContext } from "../../context/Socket/SocketContext";
import moment from "moment";
const useAuth = () => {
  const history = useHistory();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({});

  const setAuthHeader = (token) => {
    if (token) {
      if (api.defaults.headers?.common) {
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      }
      api.defaults.headers.Authorization = `Bearer ${token}`;
    } else {
      if (api.defaults.headers?.common) {
        delete api.defaults.headers.common["Authorization"];
        delete api.defaults.headers.common["authorization"];
      }
      delete api.defaults.headers.Authorization;
      api.defaults.headers.Authorization = undefined;
    }
  };

  api.interceptors.request.use(
    (config) => {
      const token = getSessionToken();
      const destination = new URL(config.url, config.baseURL || window.location.origin);
      const backend = new URL(process.env.REACT_APP_BACKEND_URL || window.location.origin);
      if (destination.origin !== backend.origin) {
        if (config.headers?.delete) {
          config.headers.delete("Authorization");
          config.headers.delete("authorization");
        }
        delete config.headers["Authorization"];
        delete config.headers["authorization"];
        config.withCredentials = false;
        return config;
      }
      if (token) {
        if (config.headers?.set) {
          config.headers.set("Authorization", `Bearer ${token}`);
        } else {
          config.headers["Authorization"] = `Bearer ${token}`;
        }
        setIsAuth(true);
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  api.interceptors.response.use(
    (response) => {
      return response;
    },
    async (error) => {
      const originalRequest = error.config;
      if (error?.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes("/auth/")) {
        originalRequest._retry = true;

        const { data } = await api.post("/auth/refresh_token");
        if (data) {
          setSessionToken(data.token);
          setAuthHeader(data.token);
        }
        return api(originalRequest);
      }
      if (error?.response?.status === 401) {
        setSessionToken(null);
        localStorage.removeItem("companyId");
        setAuthHeader(null);
        setIsAuth(false);
      }
      return Promise.reject(error);
    }
  );

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    (async () => {
        try {
          const { data } = await api.post("/auth/refresh_token");
          setSessionToken(data.token);
          setAuthHeader(data.token);
          setIsAuth(true);
          setUser(data.user);
        } catch (err) {
          if (err.response?.status !== 401) toastError(err);
        }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    if (companyId) {
   
      const socket = socketManager.getSocket(companyId);

      socket.on(`company-${companyId}-user`, (data) => {
        if (data.action === "update" && data.user.id === user.id) {
          setUser(data.user);
        }
      });
    
    
    return () => {
      socket.disconnect();
    };
  }
  }, [socketManager, user]);

  const handleLogin = async (userData) => {
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", userData);
      const {
        user: { companyId, id, company },
      } = data;

      if (has(company, "settings") && isArray(company.settings)) {
        const setting = company.settings.find(
          (s) => s.key === "campaignsEnabled"
        );
        if (setting && setting.value === "true") {
          localStorage.setItem("cshow", null); //regra pra exibir campanhas
        }
      }

      moment.locale('pt-br');
      const dueDate = data.user.company.dueDate;
      const hoje = moment(moment()).format("DD/MM/yyyy");
      const vencimento = moment(dueDate).format("DD/MM/yyyy");

      var diff = moment(dueDate).diff(moment(moment()).format());

      var before = moment(moment().format()).isBefore(dueDate);
      var dias = moment.duration(diff).asDays();

      if (before === true) {
        setSessionToken(data.token);
        localStorage.setItem("companyId", companyId);
        localStorage.setItem("userId", id);
        localStorage.setItem("companyDueDate", vencimento);
        setAuthHeader(data.token);
        setUser(data.user);
        setIsAuth(true);
        toast.success(i18n.t("auth.toasts.success"));
        if (Math.round(dias) < 5) {
          toast.warn(`Sua assinatura vence em ${Math.round(dias)} ${Math.round(dias) === 1 ? 'dia' : 'dias'} `);
        }
        history.push("/tickets");
        setLoading(false);
      } else {
        toastError(`Opss! Sua assinatura venceu ${vencimento}.
Entre em contato com o Suporte para mais informações! `);
        setLoading(false);
      }

      //quebra linha 
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);

    try {
      await api.delete("/auth/logout");
      setIsAuth(false);
      setUser({});
      setSessionToken(null);
      localStorage.removeItem("companyId");
      localStorage.removeItem("userId");
      localStorage.removeItem("cshow");
      setAuthHeader(null);
      setLoading(false);
      history.push("/login");
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const getCurrentUserInfo = async () => {
    try {
      const { data } = await api.get("/auth/me");
      return data;
    } catch (err) {
      toastError(err);
    }
  };

  return {
    isAuth,
    user,
    loading,
    handleLogin,
    handleLogout,
    getCurrentUserInfo,
  };
};

export default useAuth;
