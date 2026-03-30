import http from "http";
import { WebSocketServer } from "ws";
import { nanoid } from "nanoid";
import {
  createRoom,
  getRoom,
  joinRoom,
  setReady,
  startGame,
  kickPlayer,
  removePlayer,
  closeRoom,
  updateConfig,
} from "./roomManager.js";
import {
  startNextLevel,
  submitAnswer,
  updateAnswerDraft,
  runCodePreview,
  endLevel,
  getGame,
  removePlayerFromGame,
} from "./services/GameManager.js";
import { TimerManager } from "./services/TimerManager.js";
import { SaveManager } from "./services/SaveManager.js";

const PORT = process.env.PORT || 8080;
const server = http.createServer();
const wss = new WebSocketServer({ server });
const activeTimers = new Map();
const levelTransitionTimeouts = new Map();
const roomCodeToGameId = new Map(); // Mapping roomCode -> gameId
const pendingDisconnects = new Map();
const RECONNECT_GRACE_MS = 2 * 60 * 1000;
const AUTO_SUBMIT_GRACE_MS = 1200;

function isRoomInGame(room) {
  return room?.state === "IN_GAME" || room?.state === "IN_PROGRESS";
}

function buildScoresPayload(game) {
  const scores = {};
  if (!game) return scores;

  Object.keys(game.scores || {}).forEach((playerId) => {
    scores[playerId] = game.scores?.[playerId]?.total || 0;
  });
  return scores;
}

function getDisconnectKey(code, socketId) {
  return `${code}::${socketId}`;
}

function clearPendingDisconnect(code, socketId) {
  const key = getDisconnectKey(code, socketId);
  if (!pendingDisconnects.has(key)) return;
  clearTimeout(pendingDisconnects.get(key));
  pendingDisconnects.delete(key);
}

function clearPendingDisconnectsForRoom(code) {
  const prefix = `${code}::`;
  for (const [key, timerId] of pendingDisconnects.entries()) {
    if (!key.startsWith(prefix)) continue;
    clearTimeout(timerId);
    pendingDisconnects.delete(key);
  }
}

function clearLevelTransitionTimeout(code) {
  if (!levelTransitionTimeouts.has(code)) return;
  clearTimeout(levelTransitionTimeouts.get(code));
  levelTransitionTimeouts.delete(code);
}

function send(ws, data) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

function normalizeClientIp(clientIp) {
  if (typeof clientIp !== "string") return null;
  const firstSegment = clientIp.split(",")[0]?.trim() || "";
  if (!firstSegment) return null;
  return firstSegment.startsWith("::ffff:")
    ? firstSegment.slice("::ffff:".length)
    : firstSegment;
}

function extractClientIp(req, ws) {
  const forwarded = req?.headers?.["x-forwarded-for"];
  const realIp = req?.headers?.["x-real-ip"];
  const reqSocketIp = req?.socket?.remoteAddress;
  const wsSocketIp = ws?._socket?.remoteAddress;

  if (typeof forwarded === "string" && forwarded.trim()) {
    return normalizeClientIp(forwarded);
  }
  if (typeof realIp === "string" && realIp.trim()) {
    return normalizeClientIp(realIp);
  }
  return normalizeClientIp(reqSocketIp || wsSocketIp || null);
}

function broadcastToRoom(code, data) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client.roomCode === code) {
      client.send(JSON.stringify(data));
    }
  });
}

function getClientBySocketId(socketId) {
  for (const client of wss.clients) {
    if (client.socketId === socketId) {
      return client;
    }
  }
  return null;
}

function clearRoomCodeForRoom(code) {
  wss.clients.forEach((client) => {
    if (client.roomCode === code) {
      client.roomCode = null;
    }
  });
}

function closeRoomAndExpelAll(code, reason = "Le salon a été fermé") {
  if (!code) return;
  if (!getRoom(code)) return;

  if (activeTimers.has(code)) {
    activeTimers.get(code).stop();
    activeTimers.delete(code);
  }
  clearLevelTransitionTimeout(code);
  roomCodeToGameId.delete(code);
  clearPendingDisconnectsForRoom(code);

  broadcastToRoom(code, { type: "ROOM_CLOSED", message: reason });
  clearRoomCodeForRoom(code);
  closeRoom(code);
}

function clearRoomRuntime(code) {
  if (!code) return;
  if (activeTimers.has(code)) {
    activeTimers.get(code).stop();
    activeTimers.delete(code);
  }
  clearLevelTransitionTimeout(code);
  roomCodeToGameId.delete(code);
  clearPendingDisconnectsForRoom(code);
}

function buildDetailedScoresPayload(game) {
  const scores = {};
  if (!game) return scores;

  Object.keys(game.scores || {}).forEach((playerId) => {
    const scoreObj = game.scores?.[playerId] || null;
    scores[playerId] = {
      total: scoreObj?.total || 0,
      perLevel: scoreObj?.perLevel || {},
    };
  });
  return scores;
}

function buildPlayerNamesPayload(game, room = null) {
  const playerNames = { ...(game?.playerNames || {}) };
  (room?.players || []).forEach((player) => {
    if (!player?.socketId) return;
    playerNames[player.socketId] = player.name || "Joueur";
  });
  return playerNames;
}

function broadcastGameEnd(roomCode, gameId, endReason = null) {
  const game = getGame(gameId);
  if (!game) return;
  game.status = "FINISHED";
  const room = getRoom(roomCode);
  if (room) {
    room.state = "FINISHED";
    room.lastActivity = Date.now();
    broadcastToRoom(roomCode, { type: "ROOM_UPDATE", room: room.toJSON() });
  }
  broadcastToRoom(roomCode, {
    type: "GAME_END",
    scores: buildScoresPayload(game),
    detailedScores: buildDetailedScoresPayload(game),
    playerNames: buildPlayerNamesPayload(game, room),
    endReason,
  });
}

function maybeFinishGameOnSinglePlayer(roomCode, gameId, endReason = null) {
  if (!gameId) return false;
  const room = getRoom(roomCode);
  if (!room || !isRoomInGame(room)) return false;

  const game = getGame(gameId);
  if (!game || game.status === "FINISHED") return false;

  const activeCount = Object.keys(game.scores || {}).length;
  if (activeCount > 1) return false;

  clearRoomRuntime(roomCode);
  game.status = "FINISHED";
  broadcastGameEnd(roomCode, gameId, endReason || "VICTOIRE_PAR_FORFAIT");
  return true;
}

function scheduleNextLevel(roomCode, gameId, delayMs = 5000) {
  clearLevelTransitionTimeout(roomCode);
  const timeoutId = setTimeout(() => {
    levelTransitionTimeouts.delete(roomCode);
    const room = getRoom(roomCode);
    const game = getGame(gameId);
    if (!room || !game || game.status === "FINISHED") return;
    startLevelForRoom(roomCode, gameId);
  }, delayMs);
  levelTransitionTimeouts.set(roomCode, timeoutId);
}

function handleLevelTimerEnd(roomCode, gameId, levelIndex) {
  // Laisse un court délai après le tick 0 pour que les auto-soumissions
  // côté client arrivent avant le calcul final du niveau.
  setTimeout(async () => {
    const ended = await endLevel(gameId, levelIndex);
    const game = getGame(gameId);
    activeTimers.delete(roomCode);
    if (!game || !ended) return;

    broadcastToRoom(roomCode, {
      type: "LEVEL_END",
      levelIndex,
      levelScores: ended.levelScores,
      scores: ended.totalScores,
      questionDetails: ended.questionDetails,
    });

    scheduleNextLevel(roomCode, gameId);
  }, AUTO_SUBMIT_GRACE_MS);
}

function startLevelForRoom(roomCode, gameId) {
  const nextLevelRes = startNextLevel(gameId);
  if (!nextLevelRes.ok) {
    broadcastGameEnd(roomCode, gameId);
    return false;
  }

  const level = nextLevelRes.level;
  broadcastToRoom(roomCode, {
    type: "LEVEL_START",
    levelIndex: level.index,
    difficulty: level.difficulty,
    questions: nextLevelRes.questions.map((q) => q.toClientJSON()),
    timeLimitSec: level.timeLimitSec,
    endsAt: level.endsAt,
  });

  if (activeTimers.has(roomCode)) {
    activeTimers.get(roomCode).stop();
    activeTimers.delete(roomCode);
  }

  const timer = new TimerManager(
    level.timeLimitSec,
    () => {
      broadcastToRoom(roomCode, {
        type: "TICK",
        timeRemaining: timer.timeRemaining,
      });
    },
    () => {
      handleLevelTimerEnd(roomCode, gameId, level.index);
    }
  );

  timer.start();
  activeTimers.set(roomCode, timer);
  return true;
}

function broadcastHostChangedIfNeeded(code, previousHostSocketId, updatedRoom) {
  if (
    previousHostSocketId === updatedRoom?.hostSocketId ||
    !updatedRoom?.hostSocketId ||
    !previousHostSocketId
  ) {
    return;
  }

  const newHost = updatedRoom.getPlayer(updatedRoom.hostSocketId);
  broadcastToRoom(code, {
    type: "HOST_CHANGED",
    hostSocketId: updatedRoom.hostSocketId,
    hostName: newHost?.name || "Joueur",
  });
}

function scheduleDisconnectedPlayerRemoval(code, socketId) {
  clearPendingDisconnect(code, socketId);
  const key = getDisconnectKey(code, socketId);

  const timerId = setTimeout(() => {
    pendingDisconnects.delete(key);

    const room = getRoom(code);
    if (!room) return;

    const player = room.getPlayer(socketId);
    if (!player || player.isConnected) return;

    const roomIsInGame = isRoomInGame(room);
    const isDisconnectedHostInLobby = !roomIsInGame && room.hostSocketId === socketId;
    if (isDisconnectedHostInLobby) {
      closeRoomAndExpelAll(code, "L'hôte a quitté le salon");
      return;
    }

    const previousHostSocketId = room.hostSocketId;
    const currentGameId = roomIsInGame ? room.gameId : null;
    if (currentGameId) {
      removePlayerFromGame(currentGameId, socketId, player.name || "Joueur");
    }

    const updatedRoom = removePlayer(code, socketId);
    if (!updatedRoom || updatedRoom.players.length === 0) {
      clearRoomRuntime(code);
      clearRoomCodeForRoom(code);
      return;
    }

    broadcastToRoom(code, { type: "ROOM_UPDATE", room: updatedRoom.toJSON() });
    broadcastHostChangedIfNeeded(code, previousHostSocketId, updatedRoom);
    if (roomIsInGame && currentGameId) {
      maybeFinishGameOnSinglePlayer(code, currentGameId, "VICTOIRE_PAR_ABANDON");
    }
  }, RECONNECT_GRACE_MS);

  pendingDisconnects.set(key, timerId);
}

function sendRoomRecoveryState(ws, room) {
  if (!room || !isRoomInGame(room)) return;

  const gameId = room.gameId || roomCodeToGameId.get(room.code);
  if (!gameId) return;

  roomCodeToGameId.set(room.code, gameId);

  const game = getGame(gameId);
  if (!game) return;

  if (game.status === "FINISHED") {
    send(ws, {
      type: "GAME_END",
      scores: buildScoresPayload(game),
      detailedScores: buildDetailedScoresPayload(game),
      playerNames: buildPlayerNamesPayload(game, room),
      endReason: null,
    });
    return;
  }

  const currentLevel = game.getCurrentLevel?.();
  if (!currentLevel) return;

  if (currentLevel.state === "ACTIVE" || currentLevel.state === "LOCKED") {
    send(ws, {
      type: "LEVEL_START",
      levelIndex: currentLevel.index,
      difficulty: currentLevel.difficulty,
      questions: (currentLevel.questions || []).map((q) =>
        typeof q.toClientJSON === "function" ? q.toClientJSON() : q
      ),
      timeLimitSec: currentLevel.timeLimitSec,
      endsAt: currentLevel.endsAt,
    });
    return;
  }

  if (currentLevel.state === "ENDING" || currentLevel.state === "RESULTS") {
    send(ws, {
      type: "LEVEL_END",
      levelIndex: currentLevel.index,
      scores: buildScoresPayload(game),
    });
  }
}

function reconnectPlayerToRoom(ws, room, playerToken) {
  if (!room || !playerToken) {
    return { ok: false, reason: "INVALID_SESSION" };
  }

  const player = room.getPlayerByToken(playerToken);
  if (!player) {
    return { ok: false, reason: "PLAYER_NOT_FOUND" };
  }

  if (isRoomInGame(room)) {
    const gameId = room.gameId || roomCodeToGameId.get(room.code);
    const game = gameId ? getGame(gameId) : null;
    if (!game || game.status === "FINISHED" || room.state === "FINISHED") {
      return { ok: false, reason: "GAME_FINISHED" };
    }
  }

  const previousSocketId = player.socketId;
  const previousClient = getClientBySocketId(previousSocketId);
  if (previousClient && previousClient !== ws) {
    previousClient.roomCode = null;
    try {
      previousClient.close();
    } catch {
      // Ignore les erreurs éventuelles à la fermeture de l'ancien socket.
    }
  }

  ws.socketId = previousSocketId;
  ws.roomCode = room.code;
  player.setConnected(true);
  room.lastActivity = Date.now();
  clearPendingDisconnect(room.code, previousSocketId);

  if (room.gameId) {
    roomCodeToGameId.set(room.code, room.gameId);
  }

  send(ws, {
    type: "RECONNECTED",
    socketId: ws.socketId,
    room: room.toJSON(),
  });
  broadcastToRoom(room.code, { type: "ROOM_UPDATE", room: room.toJSON() });
  broadcastToRoom(room.code, {
    type: "PLAYER_RECONNECTED",
    socketId: ws.socketId,
    playerName: player.name || "Joueur",
  });
  sendRoomRecoveryState(ws, room);

  return { ok: true };
}

function handleUnexpectedDisconnect(ws) {
  const code = ws.roomCode;
  if (!code) return;

  const room = getRoom(code);
  if (!room) {
    ws.roomCode = null;
    return;
  }

  const player = room.getPlayer(ws.socketId);
  if (!player) {
    ws.roomCode = null;
    return;
  }
  const playerName = player.name || "Joueur";

  player.setConnected(false);
  room.lastActivity = Date.now();
  ws.roomCode = null;

  broadcastToRoom(code, { type: "ROOM_UPDATE", room: room.toJSON() });
  broadcastToRoom(code, {
    type: "PLAYER_DISCONNECTED",
    socketId: ws.socketId,
    playerName,
  });
  scheduleDisconnectedPlayerRemoval(code, ws.socketId);
}

function handlePlayerLeave(ws, { notifySelf = false } = {}) {
  const code = ws.roomCode;
  if (!code) {
    if (notifySelf) {
      send(ws, { type: "QUIT_ACCEPTED" });
    }
    return;
  }

  const room = getRoom(code);
  if (!room) {
    ws.roomCode = null;
    if (notifySelf) {
      send(ws, { type: "QUIT_ACCEPTED" });
    }
    return;
  }
  const leavingPlayer = room.getPlayer(ws.socketId);
  const leavingPlayerName = leavingPlayer?.name || "Joueur";

  clearPendingDisconnect(code, ws.socketId);

  const isHostLeaving = room.hostSocketId === ws.socketId;
  const roomIsInGame = isRoomInGame(room);
  if (isHostLeaving && !roomIsInGame) {
    ws.roomCode = null;
    closeRoomAndExpelAll(code, "L'hôte a quitté le salon");
    if (notifySelf) {
      send(ws, { type: "QUIT_ACCEPTED" });
    }
    return;
  }

  const previousHostSocketId = room.hostSocketId;
  const currentGameId = roomIsInGame ? room.gameId : null;
  if (currentGameId) {
    removePlayerFromGame(currentGameId, ws.socketId, leavingPlayerName);
  }

  const updatedRoom = removePlayer(code, ws.socketId);
  ws.roomCode = null;

  if (!updatedRoom || updatedRoom.players.length === 0) {
    clearRoomRuntime(code);
    clearRoomCodeForRoom(code);
    if (notifySelf) {
      send(ws, { type: "QUIT_ACCEPTED" });
    }
    return;
  }

  broadcastToRoom(code, { type: "ROOM_UPDATE", room: updatedRoom.toJSON() });
  broadcastHostChangedIfNeeded(code, previousHostSocketId, updatedRoom);
  if (roomIsInGame) {
    broadcastToRoom(code, {
      type: "PLAYER_LEFT",
      socketId: ws.socketId,
      playerName: leavingPlayerName,
    });
    if (currentGameId) {
      maybeFinishGameOnSinglePlayer(code, currentGameId, "VICTOIRE_PAR_ABANDON");
    }
  }
  if (notifySelf) {
    send(ws, { type: "QUIT_ACCEPTED" });
  }
}

wss.on("connection", (ws, req) => {
  ws.socketId = nanoid();
  ws.roomCode = null;
  ws.clientIp = extractClientIp(req, ws);
  console.log(`Client connecté: ${ws.socketId}${ws.clientIp ? ` (${ws.clientIp})` : ""}`);
  send(ws, { type: "HELLO", socketId: ws.socketId });

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (e) {
      send(ws, { type: "ERROR", message: "JSON invalide" });
      return;
    }

    if (msg.type === "RECONNECT") {
      const code =
        typeof msg.roomCode === "string" ? msg.roomCode.trim().toUpperCase() : "";
      const playerToken =
        typeof msg.playerToken === "string" ? msg.playerToken.trim() : "";

      if (!code || !playerToken) {
        return send(ws, { type: "RECONNECT_FAILED", message: "Session invalide" });
      }

      const room = getRoom(code);
      if (!room) {
        return send(ws, { type: "RECONNECT_FAILED", message: "Salon introuvable" });
      }

      const reconnectRes = reconnectPlayerToRoom(ws, room, playerToken);
      if (!reconnectRes.ok) {
        if (reconnectRes.reason === "GAME_FINISHED") {
          return send(ws, {
            type: "RECONNECT_FAILED",
            message: "Partie terminée",
          });
        }
        return send(ws, {
          type: "RECONNECT_FAILED",
          message: "Aucun joueur correspondant dans ce salon",
        });
      }
      return;
    }

    if (msg.type === "CREATE_ROOM") {
      const config = msg.config || {
        language: "python",
        levelCount: 9,
        questionsPerLevel: 3,
        questionType: "mixte",
        timePerLevelSec: 120,
      };
      const hostName = typeof msg.hostName === "string" ? msg.hostName : "Host";
      const hostAvatarId = typeof msg.hostAvatarId === "string" ? msg.hostAvatarId : null;
      const playerToken =
        typeof msg.playerToken === "string" ? msg.playerToken : null;

      const res = createRoom({
        hostSocketId: ws.socketId,
        hostName,
        hostAvatarId,
        playerToken,
        config,
      });
      if (!res.ok) {
        return send(ws, { type: "ERROR", message: res.error });
      }

      const room = res.room;
      ws.roomCode = room.code;
      send(ws, { type: "ROOM_CREATED", room: room.toJSON(), socketId: ws.socketId });
      return;
    }

    if (msg.type === "JOIN_ROOM") {
      const { code, name } = msg;
      const normalizedCode =
        typeof code === "string" ? code.trim().toUpperCase() : "";
      const playerToken =
        typeof msg.playerToken === "string" ? msg.playerToken.trim() : "";

      const existingRoom = getRoom(normalizedCode);
      if (existingRoom) {
        const reconnectRes = reconnectPlayerToRoom(ws, existingRoom, playerToken);
        if (reconnectRes.ok) {
          return;
        }
        if (isRoomInGame(existingRoom)) {
          if (reconnectRes.reason === "GAME_FINISHED") {
            return send(ws, {
              type: "ERROR",
              message: "Partie terminée",
            });
          }
          return send(ws, {
            type: "ERROR",
            message: "Partie déjà commencée (reprise non autorisée pour ce joueur)",
          });
        }
      }

      const res = joinRoom(normalizedCode, {
        socketId: ws.socketId,
        name,
        playerToken,
        clientIp: ws.clientIp,
      });
      if (!res.ok) {
        return send(ws, { type: "ERROR", message: res.error });
      }

      const room = res.room;
      ws.roomCode = room.code;
      send(ws, { type: "ROOM_CREATED", room: room.toJSON(), socketId: ws.socketId });
      broadcastToRoom(normalizedCode, { type: "ROOM_UPDATE", room: room.toJSON() });
      return;
    }

    if (msg.type === "SET_READY") {
      const room = getRoom(ws.roomCode);
      if (!room) return send(ws, { type: "ERROR", message: "Salon introuvable" });

      const res = setReady(ws.roomCode, ws.socketId, msg.ready);
      if (!res.ok) return send(ws, { type: "ERROR", message: res.error });

      broadcastToRoom(ws.roomCode, { type: "ROOM_UPDATE", room: res.room.toJSON() });
      return;
    }

    if (msg.type === "UPDATE_CONFIG") {
      const room = getRoom(ws.roomCode);
      if (!room) return send(ws, { type: "ERROR", message: "Salon introuvable" });
      if (room.hostSocketId !== ws.socketId) {
        return send(ws, { type: "ERROR", message: "Seul l'hôte peut modifier" });
      }

      const res = updateConfig(ws.roomCode, ws.socketId, msg.config);
      if (!res.ok) return send(ws, { type: "ERROR", message: res.error });

      broadcastToRoom(ws.roomCode, { type: "ROOM_UPDATE", room: res.room.toJSON() });
      return;
    }

    if (msg.type === "START_GAME") {
      const roomCode = ws.roomCode;
      const room = getRoom(roomCode);
      if (!room) return send(ws, { type: "ERROR", message: "Salon introuvable" });
      if (room.hostSocketId !== ws.socketId) {
        return send(ws, { type: "ERROR", message: "Seul l'hôte peut démarrer" });
      }

      const res = startGame(roomCode);
      if (!res.ok) return send(ws, { type: "ERROR", message: res.error });

      // Sauvegarder le mapping roomCode -> gameId
      roomCodeToGameId.set(roomCode, res.game.id);
      console.log(`[START_GAME] Partie créée avec gameId: ${res.game.id}, roomCode: ${roomCode}`);
      broadcastToRoom(roomCode, { type: "GAME_STARTED", game: res.game.toJSON() });
      clearLevelTransitionTimeout(roomCode);
      startLevelForRoom(roomCode, res.game.id);
      return;
    }

    if (msg.type === "ANSWER_DRAFT") {
      const room = getRoom(ws.roomCode);
      if (!room || !room.gameId) return;

      const levelIndex = Number.isInteger(msg.levelIndex)
        ? msg.levelIndex
        : Number.parseInt(msg.levelIndex, 10);
      if (!Number.isInteger(levelIndex)) return;

      const candidateAnswerIndex =
        msg.answerIndex ??
        msg.choiceIndex ??
        msg.selectedChoiceIndex ??
        null;
      const parseAnswerIndex = Number.parseInt(candidateAnswerIndex, 10);
      const hasAnswerIndex = Number.isInteger(parseAnswerIndex) && parseAnswerIndex >= 0;
      const answerText =
        typeof msg.answerText === "string" && msg.answerText.trim()
          ? msg.answerText
          : (typeof msg.choice === "string" && msg.choice.trim()
            ? msg.choice
            : (typeof msg.selectedChoice === "string" && msg.selectedChoice.trim()
              ? msg.selectedChoice
              : ""));
      const rawAnswerCandidate =
        msg.answer ??
        msg.payload ??
        msg.selectedAnswer ??
        "";
      const answerRaw =
        typeof rawAnswerCandidate === "string"
          ? rawAnswerCandidate
          : (rawAnswerCandidate == null ? "" : String(rawAnswerCandidate));
      const normalizedAnswer =
        answerRaw.trim().length > 0
          ? answerRaw
          : (hasAnswerIndex ? String(parseAnswerIndex) : answerText);

      updateAnswerDraft(
        room.gameId,
        levelIndex,
        ws.socketId,
        msg.questionId,
        {
          answer: normalizedAnswer,
          answerIndex: hasAnswerIndex ? parseAnswerIndex : null,
          answerText: answerText || null,
          timeRemainingSec: Number.isFinite(Number(msg.timeRemainingSec))
            ? Math.max(0, Number(msg.timeRemainingSec))
            : (Number.isFinite(Number(msg.timeRemaining))
              ? Math.max(0, Number(msg.timeRemaining))
              : null),
        }
      );
      return;
    }

    if (msg.type === "RUN_CODE") {
      const room = getRoom(ws.roomCode);
      if (!room) {
        return send(ws, {
          type: "RUN_CODE_RESULT",
          ok: false,
          questionId: msg.questionId,
          message: "Salon introuvable",
        });
      }
      if (!room.gameId) {
        return send(ws, {
          type: "RUN_CODE_RESULT",
          ok: false,
          questionId: msg.questionId,
          message: "Partie non démarrée",
        });
      }

      const levelIndex = Number.isInteger(msg.levelIndex)
        ? msg.levelIndex
        : Number.parseInt(msg.levelIndex, 10);
      if (!Number.isInteger(levelIndex)) {
        return send(ws, {
          type: "RUN_CODE_RESULT",
          ok: false,
          questionId: msg.questionId,
          message: "Niveau invalide",
        });
      }

      // Conserver le dernier code exécuté comme brouillon serveur.
      // Ainsi, s'il n'y a pas de soumission manuelle avant la fin du temps,
      // l'auto-soumission de fin de niveau utilisera ce code.
      updateAnswerDraft(
        room.gameId,
        levelIndex,
        ws.socketId,
        msg.questionId,
        {
          answer: typeof msg.code === "string" ? msg.code : "",
          timeRemainingSec: Number.isFinite(Number(msg.timeRemainingSec))
            ? Math.max(0, Number(msg.timeRemainingSec))
            : (Number.isFinite(Number(msg.timeRemaining))
              ? Math.max(0, Number(msg.timeRemaining))
              : null),
        }
      );

      const preview = await runCodePreview(
        room.gameId,
        levelIndex,
        ws.socketId,
        msg.questionId,
        msg.code
      );

      if (!preview?.ok) {
        return send(ws, {
          type: "RUN_CODE_RESULT",
          ok: false,
          questionId: msg.questionId,
          message: preview?.error || "Impossible d'exécuter le code",
          errorType: preview?.errorType || null,
          executionOutput: preview?.executionOutput || "",
          rawStdout: preview?.rawStdout || "",
          rawStderr: preview?.rawStderr || "",
        });
      }

      send(ws, {
        type: "RUN_CODE_RESULT",
        ok: true,
        questionId: msg.questionId,
        language: preview.language,
        passedTests: preview.passedTests,
        totalTests: preview.totalTests,
        results: preview.results,
        executionOutput: preview.executionOutput || "",
        rawStdout: preview.rawStdout || "",
        rawStderr: preview.rawStderr || "",
      });
      return;
    }

    if (msg.type === "SUBMIT_ANSWER") {
      const room = getRoom(ws.roomCode);
      if (!room) return send(ws, { type: "ERROR", message: "Salon introuvable" });
      if (!room.gameId) return send(ws, { type: "ERROR", message: "Partie non démarrée" });

      const levelIndex = Number.isInteger(msg.levelIndex)
        ? msg.levelIndex
        : Number.parseInt(msg.levelIndex, 10);
      if (!Number.isInteger(levelIndex)) {
        return send(ws, { type: "ERROR", message: "Niveau invalide" });
      }

      const candidateAnswerIndex =
        msg.answerIndex ??
        msg.choiceIndex ??
        msg.selectedChoiceIndex ??
        null;
      const parseAnswerIndex = Number.parseInt(candidateAnswerIndex, 10);
      const hasAnswerIndex = Number.isInteger(parseAnswerIndex) && parseAnswerIndex >= 0;
      const answerText =
        typeof msg.answerText === "string" && msg.answerText.trim()
          ? msg.answerText
          : (typeof msg.choice === "string" && msg.choice.trim()
            ? msg.choice
            : (typeof msg.selectedChoice === "string" && msg.selectedChoice.trim()
              ? msg.selectedChoice
              : ""));
      const rawAnswerCandidate =
        msg.answer ??
        msg.payload ??
        msg.selectedAnswer ??
        "";
      const answerRaw =
        typeof rawAnswerCandidate === "string"
          ? rawAnswerCandidate
          : (rawAnswerCandidate == null ? "" : String(rawAnswerCandidate));
      const normalizedAnswer =
        answerRaw.trim().length > 0
          ? answerRaw
          : (hasAnswerIndex ? String(parseAnswerIndex) : answerText);
      const answerPayload = {
        answer: normalizedAnswer,
        answerIndex: hasAnswerIndex ? parseAnswerIndex : null,
        answerText: answerText || null,
        timeRemainingSec: Number.isFinite(Number(msg.timeRemainingSec))
          ? Math.max(0, Number(msg.timeRemainingSec))
          : (Number.isFinite(Number(msg.timeRemaining))
            ? Math.max(0, Number(msg.timeRemaining))
            : null),
      };

      // Enregistrer d'abord le brouillon serveur pour fiabiliser les soumissions
      // de dernière seconde (surtout CODE), même si l'évaluation prend du temps.
      updateAnswerDraft(
        room.gameId,
        levelIndex,
        ws.socketId,
        msg.questionId,
        answerPayload
      );

      const res = await submitAnswer(
        room.gameId,
        levelIndex,
        ws.socketId,
        msg.questionId,
        answerPayload
      );
      if (!res) {
        return send(ws, {
          type: "ANSWER_RECEIVED",
          accepted: false,
          questionId: msg.questionId,
          message: "Réponse vide ignorée. Choisis une option puis Soumettre.",
          auto: Boolean(msg.auto),
        });
      }

      send(ws, {
        type: "ANSWER_RECEIVED",
        accepted: true,
        questionId: msg.questionId,
        message: "Réponse soumise",
        scorePreview: Number.isFinite(Number(res.scorePreview))
          ? Number(res.scorePreview)
          : 0,
        submissionStatus: res.status || "PENDING",
        passedTests: Number.isFinite(Number(res.passedTests)) ? Number(res.passedTests) : 0,
        totalTests: Number.isFinite(Number(res.totalTests)) ? Number(res.totalTests) : 0,
        isCorrect:
          res.type === "FLASH"
            ? res.status === "ACCEPTED"
            : (res.status === "ACCEPTED" &&
              Number.isFinite(Number(res.totalTests)) &&
              Number.isFinite(Number(res.passedTests)) &&
              Number(res.totalTests) > 0 &&
              Number(res.passedTests) >= Number(res.totalTests)),
        flashDebug: res.flashDebug || null,
        auto: Boolean(msg.auto),
      });
      return;
    }

    if (msg.type === "NEXT_LEVEL") {
      // Le serveur enchaîne automatiquement les niveaux après LEVEL_END.
      return;
    }

    if (msg.type === "KICK_PLAYER") {
      const room = getRoom(ws.roomCode);
      if (!room) return send(ws, { type: "ERROR", message: "Salon introuvable" });
      if (room.hostSocketId !== ws.socketId) {
        return send(ws, { type: "ERROR", message: "Seul l'hôte peut expulser" });
      }
      if (msg.socketId === ws.socketId) {
        return send(ws, { type: "ERROR", message: "Impossible de s'expulser soi-même" });
      }

      const targetClient = getClientBySocketId(msg.socketId);
      const targetPlayer = room.getPlayer(msg.socketId);
      const targetPlayerName = targetPlayer?.name || "Joueur";
      const roomIsInGame = isRoomInGame(room);
      const currentGameId = roomIsInGame ? room.gameId : null;
      const res = kickPlayer(ws.roomCode, msg.socketId, ws.socketId, {
        targetClientIp: targetClient?.clientIp || null,
      });
      if (!res.ok) return send(ws, { type: "ERROR", message: res.error });

      if (currentGameId) {
        removePlayerFromGame(currentGameId, msg.socketId, targetPlayerName);
      }

      if (targetClient) {
        targetClient.roomCode = null;
        send(targetClient, { type: "KICKED", message: "Vous avez été expulsé du salon" });
      }

      broadcastToRoom(ws.roomCode, { type: "ROOM_UPDATE", room: res.room.toJSON() });
      if (currentGameId) {
        maybeFinishGameOnSinglePlayer(ws.roomCode, currentGameId, "VICTOIRE_PAR_ABANDON");
      }
      return;
    }

    if (msg.type === "SAVE_AND_QUIT" || msg.type === "LEAVE_ROOM") {
      handlePlayerLeave(ws, { notifySelf: true });
      return;
    }
  });

  ws.on("close", () => {
    console.log(`Client fermé: ${ws.socketId}`);
    handleUnexpectedDisconnect(ws);
  });

  ws.on("error", (err) => {
    console.error(`Erreur WebSocket:`, err.message);
  });
});

server.listen(PORT, () => {
  console.log(`�� Serveur WebSocket: ws://localhost:${PORT}`);
});
