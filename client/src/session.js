const PLAYER_TOKEN_KEY = "algo_player_token";
const ROOM_CODE_KEY = "algo_room_code";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function generateToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pt_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function getOrCreatePlayerToken() {
  if (!canUseStorage()) return generateToken();

  const existing = window.localStorage.getItem(PLAYER_TOKEN_KEY);
  if (existing) return existing;

  const created = generateToken();
  window.localStorage.setItem(PLAYER_TOKEN_KEY, created);
  return created;
}

export function saveRoomCode(roomCode) {
  if (!canUseStorage()) return;
  if (typeof roomCode !== "string" || roomCode.trim().length === 0) return;
  window.localStorage.setItem(ROOM_CODE_KEY, roomCode.trim().toUpperCase());
}

export function clearRoomCode() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(ROOM_CODE_KEY);
}

export function getReconnectSession() {
  if (!canUseStorage()) return null;

  const roomCode = window.localStorage.getItem(ROOM_CODE_KEY);
  const playerToken = getOrCreatePlayerToken();
  if (!roomCode || !playerToken) return null;

  return {
    roomCode: roomCode.trim().toUpperCase(),
    playerToken,
  };
}
