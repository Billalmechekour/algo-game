import { Room } from "./models/Room.js";
import { Player } from "./models/Player.js";
import { GameConfig } from "./models/GameConfig.js";
import { createGame } from "./services/GameManager.js";

const rooms = new Map();
const kickCountsByRoom = new Map(); // roomCode -> { tokenCounts: Map, ipCounts: Map }
const AVATAR_IDS = ["1", "2", "3", "4"];
const MAX_NAME_LENGTH = 15;
const MAX_TOKEN_LENGTH = 128;
const MAX_KICKS_BEFORE_BAN = 3;

function normalizePlayerName(name) {
  if (typeof name !== "string") return "";
  return name
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_NAME_LENGTH);
}

function containsReservedHostWord(name) {
  return normalizePlayerName(name).toLowerCase().includes("host");
}

function normalizePlayerToken(playerToken) {
  if (typeof playerToken !== "string") return null;
  const token = playerToken.trim().slice(0, MAX_TOKEN_LENGTH);
  return token.length > 0 ? token : null;
}

function normalizeClientIp(clientIp) {
  if (typeof clientIp !== "string") return null;
  const firstSegment = clientIp.split(",")[0]?.trim() || "";
  if (!firstSegment) return null;
  return firstSegment.startsWith("::ffff:")
    ? firstSegment.slice("::ffff:".length)
    : firstSegment;
}

function getRoomKickState(code) {
  if (!kickCountsByRoom.has(code)) {
    kickCountsByRoom.set(code, {
      tokenCounts: new Map(),
      ipCounts: new Map(),
    });
  }
  return kickCountsByRoom.get(code);
}

function getKickCountByToken(code, playerToken) {
  const token = normalizePlayerToken(playerToken);
  if (!code || !token) return 0;
  return getRoomKickState(code).tokenCounts.get(token) || 0;
}

function getKickCountByIp(code, clientIp) {
  const normalizedIp = normalizeClientIp(clientIp);
  if (!code || !normalizedIp) return 0;
  return getRoomKickState(code).ipCounts.get(normalizedIp) || 0;
}

function registerKick(code, playerToken, clientIp = null) {
  const token = normalizePlayerToken(playerToken);
  const normalizedIp = normalizeClientIp(clientIp);
  if (!code) return 0;

  const roomKickState = getRoomKickState(code);
  let nextTokenKickCount = 0;
  let nextIpKickCount = 0;

  if (token) {
    nextTokenKickCount = (roomKickState.tokenCounts.get(token) || 0) + 1;
    roomKickState.tokenCounts.set(token, nextTokenKickCount);
  }

  if (normalizedIp) {
    nextIpKickCount = (roomKickState.ipCounts.get(normalizedIp) || 0) + 1;
    roomKickState.ipCounts.set(normalizedIp, nextIpKickCount);
  }

  return Math.max(nextTokenKickCount, nextIpKickCount);
}

function clearRoomKickHistory(code) {
  if (!code) return;
  kickCountsByRoom.delete(code);
}

function pickRandomAvatarId(usedAvatarIds = new Set(), preferredAvatarId = null) {
  if (
    typeof preferredAvatarId === "string" &&
    AVATAR_IDS.includes(preferredAvatarId) &&
    !usedAvatarIds.has(preferredAvatarId)
  ) {
    return preferredAvatarId;
  }

  const availableAvatarIds = AVATAR_IDS.filter((id) => !usedAvatarIds.has(id));
  const pool = availableAvatarIds.length > 0 ? availableAvatarIds : AVATAR_IDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function ensureRoomPlayersHaveAvatars(room) {
  const usedAvatarIds = new Set();

  room.players.forEach((player) => {
    if (player.avatarId && AVATAR_IDS.includes(player.avatarId) && !usedAvatarIds.has(player.avatarId)) {
      usedAvatarIds.add(player.avatarId);
      return;
    }

    player.avatarId = pickRandomAvatarId(usedAvatarIds);
    usedAvatarIds.add(player.avatarId);
  });
}

function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  if (rooms.has(code)) {
    return generateRoomCode();
  }

  return code;
}

export function createRoom({ hostSocketId, hostName, hostAvatarId, playerToken, config }) {
  const code = generateRoomCode();
  const gameConfig = new GameConfig(
    config?.language ?? "python",
    config?.levelCount ?? 9,
    config?.questionsPerLevel ?? 3,
    config?.questionType ?? "mixte",
    config?.timePerLevelSec ?? 120
  );

  if (!gameConfig.isValid()) {
    return { ok: false, error: "Configuration invalide" };
  }

  const room = new Room(code, hostSocketId, gameConfig);
  const safeHostName =
    typeof hostName === "string" && hostName.trim().length > 0
      ? hostName.trim().slice(0, MAX_NAME_LENGTH)
      : "Host";
  const assignedHostAvatarId = pickRandomAvatarId(new Set(), hostAvatarId);
  const host = new Player(
    hostSocketId,
    safeHostName,
    assignedHostAvatarId,
    normalizePlayerToken(playerToken)
  );
  room.addPlayer(host);

  rooms.set(code, room);
  return { ok: true, room };
}

export function getRoom(code) {
  return rooms.get(code) || null;
}

export function joinRoom(code, { socketId, name, playerToken, clientIp = null }) {
  const room = rooms.get(code);
  if (!room) return { ok: false, error: "Salon introuvable" };
  if (room.isFull()) return { ok: false, error: "Salon plein (max 4 joueurs)" };
  if (room.state !== "WAITING") {
    return { ok: false, error: "Partie déjà commencée" };
  }

  // Attribue un avatar aux joueurs plus anciens qui n'en ont pas encore.
  ensureRoomPlayersHaveAvatars(room);

  // Empêche doublon
  if (room.getPlayer(socketId)) {
    return { ok: true, room };
  }

  const normalizedToken = normalizePlayerToken(playerToken);
  const normalizedIp = normalizeClientIp(clientIp);
  const tokenKickCount = normalizedToken ? getKickCountByToken(code, normalizedToken) : 0;
  const ipKickCount = normalizedIp ? getKickCountByIp(code, normalizedIp) : 0;
  if (Math.max(tokenKickCount, ipKickCount) >= MAX_KICKS_BEFORE_BAN) {
    return {
      ok: false,
      error: "Accès refusé: vous avez été expulsé 3 fois de ce salon (navigateur/appareil bloqué).",
    };
  }

  const usedAvatarIds = new Set(room.players.map((player) => player.avatarId).filter(Boolean));
  const assignedAvatarId = pickRandomAvatarId(usedAvatarIds);
  const safeName =
    typeof name === "string" && name.trim().length > 0
      ? name.trim().slice(0, MAX_NAME_LENGTH)
      : "Joueur";
  if (containsReservedHostWord(safeName)) {
    return {
      ok: false,
      error: "Pseudo refusé: seul l'hôte peut utiliser un pseudo contenant 'host'.",
    };
  }
  const normalizedNewName = normalizePlayerName(safeName);
  const duplicateName = room.players.some(
    (player) =>
      player.socketId !== socketId &&
      normalizePlayerName(player.name) === normalizedNewName
  );
  if (duplicateName) {
    return {
      ok: false,
      error: "Ce pseudo est déjà utilisé par un membre du salon. Merci de le changer.",
    };
  }

  const newPlayer = new Player(
    socketId,
    safeName,
    assignedAvatarId,
    normalizedToken
  );
  room.addPlayer(newPlayer);
  return { ok: true, room };
}

export function setReady(code, socketId, ready) {
  const room = rooms.get(code);
  if (!room) return { ok: false, error: "Salon introuvable" };

  room.setReady(socketId, ready);
  return { ok: true, room };
}

export function canStart(code, byId) {
  const room = rooms.get(code);
  if (!room) return false;

  return room.canStartGame(byId);
}

export function startGame(code) {
  const room = rooms.get(code);
  if (!room) return { ok: false, error: "Salon introuvable" };
  if (room.state !== "WAITING") {
    return { ok: false, error: "La partie a déjà commencé" };
  }

  const connectedPlayers = room.players.filter((player) => player.isConnected !== false);

  const hostIsAlone =
    connectedPlayers.length === 1 && connectedPlayers[0]?.socketId === room.hostSocketId;

  if (connectedPlayers.length < 2 && !hostIsAlone) {
    return { ok: false, error: "Il faut au moins 2 joueurs pour démarrer" };
  }

  if (!hostIsAlone && !connectedPlayers.every((player) => player.isReady)) {
    return { ok: false, error: "Tous les joueurs doivent être prêts" };
  }

  let game;
  try {
    // Créer la partie
    game = createGame(room);
  } catch (error) {
    console.error("[startGame] Erreur création partie:", error);
    return {
      ok: false,
      error:
        error instanceof Error && error.message
          ? `Impossible de démarrer: ${error.message}`
          : "Impossible de démarrer la partie",
    };
  }

  room.state = "IN_PROGRESS";
  room.gameId = game.id;
  room.lastActivity = Date.now();
  console.log(
    `[startGame] Room ${room.code} - Game créé avec ID: ${game.id}, assigné à room.gameId: ${room.gameId}`
  );

  return { ok: true, game };
}

export function endGame(code) {
  const room = rooms.get(code);
  if (!room) return null;

  room.endGame();
  return room;
}

export function kickPlayer(code, targetId, byId, options = {}) {
  const room = rooms.get(code);
  if (!room) return { ok: false, error: "Salon introuvable" };
  const targetPlayer = room.getPlayer(targetId);
  const targetToken = targetPlayer?.playerToken || null;
  const targetClientIp = options?.targetClientIp || null;

  if (!room.kickPlayer(targetId, byId)) {
    return { ok: false, error: "Expulsion impossible" };
  }

  registerKick(code, targetToken, targetClientIp);

  return { ok: true, room };
}

export function removePlayer(code, socketId) {
  const room = rooms.get(code);
  if (!room) return null;

  room.removePlayer(socketId);

  if (room.players.length === 0) {
    rooms.delete(code);
    clearRoomKickHistory(code);
  }

  return room;
}

export function closeRoom(code) {
  const room = rooms.get(code);
  if (!room) return null;
  rooms.delete(code);
  clearRoomKickHistory(code);
  return room;
}

export function removePlayerEverywhere(socketId) {
  for (const [code, room] of rooms.entries()) {
    room.removePlayer(socketId);

    if (room.players.length === 0) {
      rooms.delete(code);
      clearRoomKickHistory(code);
    }
  }
}

export function getAllRooms() {
  return Array.from(rooms.values());
}

export function updateConfig(code, hostSocketId, newConfig) {
  const room = rooms.get(code);
  if (!room) return { ok: false, error: "Salon introuvable" };

  if (room.hostSocketId !== hostSocketId) {
    return { ok: false, error: "Seul l'hôte peut modifier la configuration" };
  }

  if (room.state !== "WAITING") {
    return { ok: false, error: "Impossible de modifier la configuration après le démarrage" };
  }

  const config = new GameConfig(
    newConfig?.language ?? room.config.language,
    newConfig?.levelCount ?? room.config.levelCount,
    newConfig?.questionsPerLevel ?? room.config.questionsPerLevel,
    newConfig?.questionType ?? room.config.questionType,
    newConfig?.timePerLevelSec ?? room.config.timePerLevelSec
  );

  if (!config.isValid()) {
    return { ok: false, error: "Configuration invalide" };
  }

  room.config = config;
  room.lastActivity = Date.now();
  return { ok: true, room };
}

// Nettoyage automatique des salons inactifs
setInterval(() => {
  const now = Date.now();
  const maxInactivityTime = 60 * 60 * 1000; // 1 heure

  rooms.forEach((room, code) => {
    if (now - room.lastActivity > maxInactivityTime) {
      rooms.delete(code);
      clearRoomKickHistory(code);
      console.log(`Salon ${code} supprimé (inactivité)`);
    }
  });
}, 10 * 60 * 1000); // Vérifier toutes les 10 minutes
