import { getSessionToken } from "../../services/sessionToken";
import { createContext } from "react";
import openSocket from "socket.io-client";
import { isExpired } from "react-jwt";

class ManagedSocket {
  constructor(socketManager) {
    this.socketManager = socketManager;
    this.rawSocket = socketManager.currentSocket;
    this.callbacks = [];
    this.joins = new Map();
    this.roomSubscriptions = socketManager.roomSubscriptions;
    this.closed = false;
  }
  
  on(event, callback) {
    if (this.closed) return;
    if (event === "connect") event = "ready";
    this.callbacks.push({event, callback});
    this.rawSocket.on(event, callback);
    if (event === "ready" && this.socketManager.socketReady) callback();
  }
  
  off(event, callback) {
    if (event === "connect") event = "ready";
    const i = this.callbacks.findIndex((c) => c.event === event && c.callback === callback);
    if (i !== -1) this.callbacks.splice(i, 1);
    return this.rawSocket.off(event, callback);
  }
  
  emit(event, ...params) {
    if (this.closed) return;
    if (event.startsWith("join")) {
      const key = JSON.stringify([event, ...params]);
      if (this.joins.has(key)) return;
      this.joins.set(key, { event, params });
      const subscription = this.roomSubscriptions.get(key);
      if (subscription) {
        subscription.count++;
      } else {
        this.roomSubscriptions.set(key, { event, params, count: 1 });
        if (this.socketManager.socketReady) this.rawSocket.emit(event, ...params);
      }
      return;
    }
    return this.rawSocket.emit(event, ...params);
  }
  
  disconnect() {
    if (this.closed) return;
    this.closed = true;
    for (const c of this.callbacks) {
      this.rawSocket.off(c.event, c.callback);
    }
    this.callbacks = [];
    for (const [key, j] of this.joins) {
      const subscription = this.roomSubscriptions.get(key);
      if (--subscription.count === 0) {
        this.roomSubscriptions.delete(key);
        if (this.rawSocket.connected) this.rawSocket.emit(`leave${j.event.substring(4)}`, ...j.params);
      }
    }
    this.joins.clear();
  }
}

class DummySocket {
  on(..._) {}
  off(..._) {}
  emit(..._) {}
  disconnect() {}
}

const SocketManager = {
  currentCompanyId: -1,
  currentUserId: -1,
  currentSocket: null,
  socketReady: false,
  roomSubscriptions: new Map(),

  getSocket: function(companyId) {
    let userId = null;
    if (localStorage.getItem("userId")) {
      userId = localStorage.getItem("userId");
    }

    if (!companyId && !this.currentSocket) {
      return new DummySocket();
    }

    if (companyId && typeof companyId !== "string") {
      companyId = `${companyId}`;
    }

    if (companyId !== this.currentCompanyId || userId !== this.currentUserId) {
      this.socketReady = false;
      this.roomSubscriptions = new Map();
      if (this.currentSocket) {
        console.warn("closing old socket - company or user changed");
        this.currentSocket.removeAllListeners();
        this.currentSocket.disconnect();
        this.currentSocket = null;
        this.currentCompanyId = null;
		    this.currentUserId = null;
      }

      let token = getSessionToken();
      if (!token) {
        return new DummySocket();
      }
      
      if ( isExpired(token) ) {
        console.warn("Expired token, reload after refresh");
        setTimeout(() => {
          window.location.reload();
        },1000);
        return new DummySocket();
      }

      this.currentCompanyId = companyId;
      this.currentUserId = userId;
      
      this.currentSocket = openSocket(process.env.REACT_APP_BACKEND_URL, {
        transports: ["websocket"],
        pingTimeout: 18000,
        pingInterval: 18000,
        auth: { token },
      });

      this.currentSocket.io.on("reconnect_attempt", () => {
        token = getSessionToken();
        if ( isExpired(token) ) {
          console.warn("Refreshing");
          window.location.reload();
        } else {
          console.warn("Using new token");
          this.currentSocket.auth = { token };
        }
      });
      
      this.currentSocket.on("disconnect", (reason) => {
        this.socketReady = false;
        console.warn(`socket disconnected because: ${reason}`);
        if (reason.startsWith("io server disconnect")) {
          console.warn("Reconnecting socket");
          token = getSessionToken();
          
          if ( isExpired(token) ) {
            console.warn("Expired token - refreshing");
            window.location.reload();
            return;
          }
          console.warn("Reconnecting using refreshed token");
          this.currentSocket.auth = { token };
          this.currentSocket.connect();
        }        
      });
      
      this.currentSocket.on("connect", (...params) => {
        console.warn("socket connected", params);
      })
      
      this.currentSocket.on("ready", () => {
        this.socketReady = true;
        // The server drops rooms on disconnect. Restore each shared subscription once.
        for (const { event, params } of this.roomSubscriptions.values()) {
          this.currentSocket.emit(event, ...params);
        }
      });

    }
    
    return new ManagedSocket(this);
  },
  
  onReady: function( callbackReady ) {
    if (this.socketReady) {
      callbackReady();
      return
    }
    
    this.currentSocket.once("ready", () => {
      callbackReady();
    });
  },
  
  onConnect: function( callbackReady ) { this.onReady( callbackReady ) },

};

const SocketContext = createContext()

export { SocketContext, SocketManager };
