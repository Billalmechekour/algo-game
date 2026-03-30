import { useEffect, useMemo, useRef, useState } from "react";
import ws, { wsSend } from "../ws";
import { AVATAR_IMAGES, getRandomAvatarId } from "../avatarMap";
import { useLanguage } from "../context/LanguageContext";
import "../styles/lobby.css";

export default function Lobby({ room, socketId, setScreen }) {
  const { t } = useLanguage();
  const [errorMsg, setErrorMsg] = useState("");
  const [localReady, setLocalReady] = useState(false);
  const [gameStarting, setGameStarting] = useState(false);
  const [fallbackAvatarBySocket, setFallbackAvatarBySocket] = useState({});
  const initializedRef = useRef(false);

  const players = useMemo(
    () => (Array.isArray(room?.players) ? room.players : []),
    [room?.players]
  );
  const isHost = room?.hostSocketId === socketId;
  const storedHostAvatarId =
    typeof window !== "undefined" ? window.sessionStorage.getItem("hostAvatarId") : null;

  // Initialiser localReady UNE FOIS au montage
  useEffect(() => {
    if (!initializedRef.current && room && socketId) {
      const me = room.players?.find((p) => p.socketId === socketId);
      setLocalReady(!!me?.ready);
      initializedRef.current = true;
    }
  }, [room, socketId]);

  // Synchroniser localReady quand ROOM_UPDATE arrive (pour autres joueurs)
  useEffect(() => {
    if (room && socketId && initializedRef.current) {
      const me = room.players?.find((p) => p.socketId === socketId);
      const serverReady = !!me?.ready;
      // Seulement mettre à jour si différent (évite de bloquer après un clic)
      setLocalReady((prev) => (prev === serverReady ? prev : serverReady));
    }
  }, [room, socketId]);

  useEffect(() => {
    const onMessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "ERROR") {
          setGameStarting(false);
          setErrorMsg(msg.message || t("lobby.unknownError"));
          setTimeout(() => setErrorMsg(""), 2500);
        }
      } catch {
        // Ignore les messages non valides.
      }
    };

    ws.addEventListener("message", onMessage);
    return () => ws.removeEventListener("message", onMessage);
  }, [t]);

  useEffect(() => {
    setFallbackAvatarBySocket((previousMap) => {
      const nextMap = {};
      const activeSocketIds = new Set(players.map((player) => player.socketId));

      Object.entries(previousMap).forEach(([socket, avatarId]) => {
        if (activeSocketIds.has(socket) && AVATAR_IMAGES[avatarId]) {
          nextMap[socket] = avatarId;
        }
      });

      const usedAvatarIds = new Set(Object.values(nextMap));
      players.forEach((player) => {
        let explicitAvatarId = player?.avatarId ? String(player.avatarId) : null;
        if (
          isHost &&
          player.socketId === socketId &&
          storedHostAvatarId &&
          AVATAR_IMAGES[storedHostAvatarId]
        ) {
          explicitAvatarId = storedHostAvatarId;
        }
        if (explicitAvatarId && AVATAR_IMAGES[explicitAvatarId]) {
          nextMap[player.socketId] = explicitAvatarId;
          usedAvatarIds.add(explicitAvatarId);
        }
      });

      players.forEach((player) => {
        if (nextMap[player.socketId]) {
          usedAvatarIds.add(nextMap[player.socketId]);
          return;
        }
        const fallbackAvatarId = getRandomAvatarId(Array.from(usedAvatarIds));
        nextMap[player.socketId] = fallbackAvatarId;
        usedAvatarIds.add(fallbackAvatarId);
      });

      const previousKeys = Object.keys(previousMap);
      const nextKeys = Object.keys(nextMap);
      const unchanged =
        previousKeys.length === nextKeys.length &&
        previousKeys.every((key) => previousMap[key] === nextMap[key]);

      return unchanged ? previousMap : nextMap;
    });
  }, [players, isHost, socketId, storedHostAvatarId]);

  if (!room) {
    return (
      <div className="lobby-container">
        <div className="lobby-frame-glow">
          <div className="lobby-frame">
            <div className="lobby-bg"></div>
            <div className="lobby-loading">{t("lobby.loading")}</div>
          </div>
        </div>
      </div>
    );
  }

  const connectedPlayers = players.filter((player) => player.isConnected !== false);
  const roomConfig = room?.config || {};
  const languageLabels = {
    python: "Python",
    java: "Java",
    c: "C",
    cpp: "C++",
  };
  const questionTypeLabels = {
    flash: t("lobby.typeFlash"),
    code: t("lobby.typeCode"),
    mixte: t("lobby.typeMixte"),
  };
  const rawLanguage =
    typeof roomConfig.language === "string" ? roomConfig.language.toLowerCase() : "";
  const rawQuestionType =
    typeof roomConfig.questionType === "string"
      ? roomConfig.questionType.toLowerCase()
      : "mixte";
  const languageValue = languageLabels[rawLanguage] || roomConfig.language || "—";
  const questionTypeValue = questionTypeLabels[rawQuestionType] || t("lobby.typeMixte");
  const levelCountValue = Number.parseInt(roomConfig.levelCount, 10);
  const questionsPerLevelValue = Number.parseInt(roomConfig.questionsPerLevel, 10);
  const timePerLevelValue = Number.parseInt(roomConfig.timePerLevelSec, 10);
  const configItems = [
    {
      id: "language",
      label: t("lobby.language"),
      value: languageValue,
      icon: "⌨",
      modifier: "language",
    },
    {
      id: "levels",
      label: t("lobby.levels"),
      value: Number.isFinite(levelCountValue) ? String(levelCountValue) : "—",
      icon: "🏁",
      modifier: "levels",
    },
    {
      id: "questions",
      label: t("lobby.questionsPerLevel"),
      value: Number.isFinite(questionsPerLevelValue)
        ? String(questionsPerLevelValue)
        : "—",
      icon: "❓",
      modifier: "questions",
    },
    {
      id: "question-type",
      label: t("lobby.questionType"),
      value: questionTypeValue,
      icon: "🧩",
      modifier: "question-type",
    },
    {
      id: "time",
      label: t("lobby.timePerLevel"),
      value: Number.isFinite(timePerLevelValue) ? `${timePerLevelValue}s` : "—",
      icon: "⏱",
      modifier: "time",
    },
  ];

  // Vérifier si TOUS les joueurs connectés sont prêts
  const allPlayersReady =
    connectedPlayers.length >= 2 && connectedPlayers.every((player) => player.ready);
  const readyPlayers = connectedPlayers.filter((player) => player.ready);
  const readyCount = readyPlayers.length;
  const hostIsSolo = isHost && connectedPlayers.length === 1;
  const canHostStart = hostIsSolo || allPlayersReady;
  const readyButtonDisabled = hostIsSolo && isHost;

  function toggleReady() {
    const newReady = !localReady;
    setLocalReady(newReady); // Optimistic update: affiche immédiatement
    wsSend({ type: "SET_READY", ready: newReady }); // Envoie au serveur
  }

  function startGame() {
    if (!canHostStart || gameStarting) {
      return;
    }
    setGameStarting(true);
    wsSend({ type: "START_GAME" });
  }

  function leaveRoom() {
    wsSend({ type: "LEAVE_ROOM" });
  }

  function kickPlayerFromRoom(targetSocketId) {
    if (!isHost || !targetSocketId || targetSocketId === socketId) {
      return;
    }
    wsSend({ type: "KICK_PLAYER", socketId: targetSocketId });
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(room.code);
      setErrorMsg(t("lobby.copySuccess"));
      setTimeout(() => setErrorMsg(""), 1200);
    } catch {
      setErrorMsg(t("lobby.copyError"));
      setTimeout(() => setErrorMsg(""), 2000);
    }
  }

  function openConfigEditor() {
    if (!isHost) return;
    setScreen("configure");
  }

  return (
    <div className="lobby-container">
      <div className="lobby-frame-glow">
        <div className="lobby-frame">
          <div className="lobby-bg"></div>

          <div className="lobby-header-wrap">
            <h1 className="lobby-title">{t("lobby.title")}</h1>
            <span
              className={`lobby-header-ready-count ${
                readyCount === 0 ? "is-zero" : "is-active"
              }`}
            >
              {readyCount}/{connectedPlayers.length}
            </span>
          </div>

          <div className="lobby-code-wrap">
            <div className="lobby-code-bar">
              <span className="lobby-code-book">📒</span>
              <span className="lobby-code-label">{t("lobby.roomCode")}</span>
              <span className="lobby-code-value">{room.code}</span>
              <button className="lobby-copy-btn" onClick={copyCode} aria-label={t("lobby.copyAria")}>
                📋
              </button>
            </div>
          </div>

          <div className="lobby-config-wrap">
            <div className="lobby-config-card">
              {isHost ? (
                <button
                  type="button"
                  className="lobby-config-edit-btn"
                  onClick={openConfigEditor}
                >
                  {t("lobby.editConfig")}
                </button>
              ) : null}
              <div className="lobby-config-title">{t("lobby.configTitle")}</div>
              <div className="lobby-config-grid">
                {configItems.map((item) => (
                  <div
                    key={item.id}
                    className={`lobby-config-item lobby-config-item--${item.modifier}`}
                  >
                    <div className="lobby-config-key-row">
                      <span className="lobby-config-icon" aria-hidden="true">
                        {item.icon}
                      </span>
                      <span className="lobby-config-key">{item.label}</span>
                    </div>
                    <span className="lobby-config-value">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lobby-list">
            {players.map((player, index) => {
              const avatarId = fallbackAvatarBySocket[player.socketId];
              const avatarSrc = avatarId ? AVATAR_IMAGES[avatarId] : null;
              const playerIsHost = player?.socketId === room.hostSocketId;
              const playerReady = !!player?.ready;
              const canKickThisPlayer = isHost && !playerIsHost;

              return (
                <div
                  key={player?.socketId || `player-${index}`}
                  className={`lobby-player-card ${playerReady ? "is-ready" : "is-waiting"}`}
                >
                  <div className="lobby-rank">{index + 1}</div>
                  <div
                    className={`lobby-player-inner ${playerReady ? "is-ready" : "is-waiting"} ${
                      canKickThisPlayer ? "has-kick" : ""
                    }`}
                  >
                    {canKickThisPlayer ? (
                      <button
                        className="lobby-kick-btn-corner"
                        onClick={() => kickPlayerFromRoom(player.socketId)}
                        title={t("lobby.kickPlayer", { name: player.name })}
                        aria-label={t("lobby.kickPlayer", { name: player.name })}
                      >
                        ✕
                      </button>
                    ) : null}
                    <div className="lobby-player-head">
                      <div className="lobby-player-avatar">
                        {avatarSrc ? (
                          <img className="lobby-player-avatar-img" src={avatarSrc} alt={`Avatar ${player.name}`} />
                        ) : (
                          <span>{(player.name?.charAt(0) || "?").toUpperCase()}</span>
                        )}
                      </div>
                      <div className="lobby-player-text">
                        <div className="lobby-player-name">{player.name}</div>
                        <div className="lobby-player-role">
                          {playerIsHost ? t("lobby.hostRole") : t("lobby.playerRole")}
                        </div>
                      </div>
                      <div className={`lobby-player-status ${playerReady ? "ready" : "waiting"}`}>
                        {playerReady ? t("lobby.ready") : t("lobby.waiting")}
                      </div>
                    </div>
                    <div className={`lobby-player-bar ${playerReady ? "ready" : "waiting"}`}>
                      <span className="lobby-player-bar-label">
                        {playerReady ? t("lobby.ready") : t("lobby.waiting")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {errorMsg ? <div className="lobby-error-msg">{errorMsg}</div> : null}

          <div className="lobby-actions">
            <button className="lobby-btn lobby-btn-quit" onClick={leaveRoom}>
              {t("lobby.quit")}
            </button>

            <button
              className={`lobby-btn ${localReady ? "lobby-btn-unready" : "lobby-btn-ready"}`}
              onClick={toggleReady}
              disabled={readyButtonDisabled}
              title={readyButtonDisabled ? t("lobby.soloHostDisabled") : undefined}
            >
              {localReady ? t("lobby.unready") : t("lobby.setReady")}
            </button>

            {isHost ? (
              <button
                className="lobby-btn lobby-btn-start"
                onClick={startGame}
                disabled={gameStarting || !canHostStart}
              >
                {gameStarting ? t("lobby.startPending") : t("lobby.startGame")}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
