// Gestion du WebSocket côté client.
const WS_URL =
  typeof import.meta.env.VITE_WS_URL === "string" &&
  import.meta.env.VITE_WS_URL.trim().length > 0
    ? import.meta.env.VITE_WS_URL.trim()
    : "ws://localhost:8080";

let socket = null;
let reconnectTimer = null;
let latestSocketId = null;

const pendingPayloads = [];
const listeners = {
  open: new Set(),
  message: new Set(),
  error: new Set(),
  close: new Set(),
};
const handlers = {
  open: null,
  message: null,
  error: null,
  close: null,
};

function emit(type, event) {
  const handler = handlers[type];
  if (typeof handler === "function") {
    try {
      handler(event);
    } catch (err) {
      console.error(`[ws.js] Erreur handler on${type}:`, err);
    }
  }

  listeners[type].forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      console.error(`[ws.js] Erreur listener ${type}:`, err);
    }
  });
}

function flushPending() {
  while (socket && socket.readyState === WebSocket.OPEN && pendingPayloads.length > 0) {
    const payload = pendingPayloads.shift();
    socket.send(payload);
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 700);
}

function connect() {
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  socket = new WebSocket(WS_URL);

  socket.onopen = (event) => {
    console.log("WebSocket connecté");
    emit("open", event);
    flushPending();
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (
        (msg?.type === "HELLO" || msg?.type === "RECONNECTED") &&
        typeof msg.socketId === "string"
      ) {
        latestSocketId = msg.socketId;
      }
    } catch {
      // Ignore les messages non JSON.
    }
    emit("message", event);
  };

  socket.onerror = (event) => {
    console.error("WebSocket erreur", event);
    emit("error", event);
  };

  socket.onclose = (event) => {
    console.log("WebSocket fermé");
    emit("close", event);
    scheduleReconnect();
  };
}

connect();

const ws = {
  get readyState() {
    return socket ? socket.readyState : WebSocket.CLOSED;
  },
  get socketId() {
    return latestSocketId;
  },
  addEventListener(type, listener) {
    if (!listeners[type]) return;
    listeners[type].add(listener);
  },
  removeEventListener(type, listener) {
    if (!listeners[type]) return;
    listeners[type].delete(listener);
  },
  close(code, reason) {
    if (socket) {
      socket.close(code, reason);
    }
  },
  get onopen() {
    return handlers.open;
  },
  set onopen(fn) {
    handlers.open = typeof fn === "function" ? fn : null;
  },
  get onmessage() {
    return handlers.message;
  },
  set onmessage(fn) {
    handlers.message = typeof fn === "function" ? fn : null;
  },
  get onerror() {
    return handlers.error;
  },
  set onerror(fn) {
    handlers.error = typeof fn === "function" ? fn : null;
  },
  get onclose() {
    return handlers.close;
  },
  set onclose(fn) {
    handlers.close = typeof fn === "function" ? fn : null;
  },
};

// Point d'entrée unique pour envoyer les messages au serveur.
export function wsSend(data) {
  const payload = JSON.stringify(data);

  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log("[ws.js] Envoi message:", data.type);
    socket.send(payload);
    return true;
  }

  pendingPayloads.push(payload);

  if (!socket || socket.readyState === WebSocket.CLOSING || socket.readyState === WebSocket.CLOSED) {
    connect();
  }

  console.warn("[ws.js] Socket indisponible, message mis en attente:", data.type);
  return true;
}

export default ws;
