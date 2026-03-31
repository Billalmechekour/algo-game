import { useCallback, useEffect, useRef, useState } from "react";
import ws, { wsSend } from "./ws";

import Home from "./screens/Home";
import ConfigureGame from "./screens/ConfigureGame";
import JoinRoom from "./screens/JoinRoom";
import ResumeRoom from "./screens/ResumeRoom";
import Lobby from "./screens/Lobby";
import Level from "./screens/Level";
import Scoreboard from "./screens/Scoreboard";
import GameEnd from "./screens/GameEnd";
import Settings from "./screens/Settings";
import Toast from "./components/Toast";

import { GameContextProvider } from "./context/GameContext";
import { UIContextProvider } from "./context/UIContext";
import { useLanguage } from "./context/LanguageContext";
import "./styles/modern.css";
import { clearRoomCode, getReconnectSession, saveRoomCode } from "./session";
import {
  gameAudioEngine,
  normalizeAudioSettings,
  readAudioSettings,
} from "./audio/gameAudio";

const THEME_MODE_STORAGE_KEY = "algo-theme-mode";
const THEME_MODES = new Set(["default", "light", "night"]);
const SCREEN_LOCK_STORAGE_KEY = "algo-screen-lock-v1";
const LOCKABLE_SCREENS = new Set([
  "home",
  "settings",
  "configure",
  "join",
  "resume",
  "lobby",
  "level",
  "scoreboard",
  "gameend",
]);
const RECONNECT_REQUIRED_SCREENS = new Set([
  "lobby",
  "level",
  "scoreboard",
  "gameend",
]);

function normalizeThemeMode(mode) {
  return THEME_MODES.has(mode) ? mode : "default";
}

function readLockedScreen() {
  if (typeof window === "undefined" || !window.sessionStorage) return "home";

  // Si l'utilisateur ouvre explicitement /accueil, on force la page d'accueil.
  const currentPath = (window.location.pathname || "").replace(/\/+$/, "") || "/";
  if (currentPath === "/accueil" || currentPath === "/") {
    return "home";
  }

  try {
    const raw = window.sessionStorage.getItem(SCREEN_LOCK_STORAGE_KEY);
    if (!raw) return "home";
    const parsed = JSON.parse(raw);
    const value = typeof parsed?.screen === "string" ? parsed.screen : "home";
    if (!LOCKABLE_SCREENS.has(value)) return "home";
    if (RECONNECT_REQUIRED_SCREENS.has(value) && !getReconnectSession()) {
      return "home";
    }
    return value;
  } catch {
    return "home";
  }
}

function getPathForScreen(screen, level, lastLevelEnded) {
  if (screen === "settings") return "/parametres";
  if (screen === "configure") return "/configuration";
  if (screen === "join") return "/rejoindre";
  if (screen === "resume") return "/reprendre";
  if (screen === "lobby") return "/salon";
  if (screen === "level") {
    const levelNumber = Number.isInteger(level?.index) ? level.index + 1 : 1;
    return `/niveau-${levelNumber}`;
  }
  if (screen === "scoreboard") {
    const endedLevel = Number.isInteger(lastLevelEnded) ? lastLevelEnded + 1 : null;
    return endedLevel ? `/scoreboard-niveau-${endedLevel}` : "/scoreboard";
  }
  if (screen === "gameend") return "/classement-final";
  return "/accueil";
}

export default function App() {
  const { t } = useLanguage();
  const [screen, setScreen] = useState(() => readLockedScreen());
  const [settingsReturnScreen, setSettingsReturnScreen] = useState(() => {
    const initial = readLockedScreen();
    return initial === "settings" ? "home" : initial;
  });
  const [themeMode, setThemeMode] = useState(() => {
    if (typeof window === "undefined") return "default";
    const storedMode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
    return normalizeThemeMode(storedMode);
  });
  const [audioSettings, setAudioSettings] = useState(() =>
    normalizeAudioSettings(readAudioSettings())
  );
  const [room, setRoom] = useState(null);
  const [socketId, setSocketId] = useState(() => ws.socketId || null);
  const [level, setLevel] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [tickRemaining, setTickRemaining] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState("info");
  const [toastDuration, setToastDuration] = useState(3000);
  const [toastSeq, setToastSeq] = useState(0);
  const [scores, setScores] = useState({});
  const [levelScores, setLevelScores] = useState({});
  const [questionDetails, setQuestionDetails] = useState({});
  const [gamePlayerNames, setGamePlayerNames] = useState({});
  const [lastLevelEnded, setLastLevelEnded] = useState(null);
  const [showGameStartFx, setShowGameStartFx] = useState(false);
  const [startFxLevelNumber, setStartFxLevelNumber] = useState(1);
  const [canResume, setCanResume] = useState(() => Boolean(getReconnectSession()));
  const startupReconnectAttemptedRef = useRef(false);
  const lastLevelEndAtRef = useRef(0);
  const pendingGameEndTimeoutRef = useRef(null);
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const closeToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  function showToast(message, type = "info", duration = 3000) {
    setToastDuration(duration);
    setToastType(type);
    setToastMessage(message);
    setToastSeq((prev) => prev + 1);
  }

  function refreshResumeState() {
    setCanResume(Boolean(getReconnectSession()));
  }

  function resumeGameFromHome() {
    if (!getReconnectSession()) {
      setCanResume(false);
      showToast(tRef.current("app.resumeUnavailable"), "info");
      return;
    }
    setScreen("resume");
  }

  function applyThemeMode(nextMode) {
    const normalized = normalizeThemeMode(nextMode);
    setThemeMode(normalized);
  }

  function applyAudioSettings(patchOrSettings) {
    setAudioSettings((previous) => {
      const candidate =
        typeof patchOrSettings === "function"
          ? patchOrSettings(previous)
          : { ...previous, ...patchOrSettings };
      return normalizeAudioSettings(candidate);
    });
  }

  function openSettings(originScreen = screen) {
    const fallbackOrigin =
      typeof originScreen === "string" && originScreen.length > 0
        ? originScreen
        : "home";
    setSettingsReturnScreen(fallbackOrigin);
    setScreen("settings");
  }

  function closeSettings() {
    const targetScreen =
      settingsReturnScreen === "settings" ? "home" : settingsReturnScreen || "home";
    if (RECONNECT_REQUIRED_SCREENS.has(targetScreen) && !getReconnectSession()) {
      setScreen("home");
      return;
    }
    setScreen(targetScreen);
  }

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme-mode", themeMode);
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_MODE_STORAGE_KEY, themeMode);
    }
  }, [themeMode]);

  useEffect(() => {
    gameAudioEngine.setSettings(audioSettings);
  }, [audioSettings]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const canonicalPath = getPathForScreen(screen, level, lastLevelEnded);
    if (window.location.pathname !== canonicalPath) {
      window.history.replaceState({ locked: true, screen }, "", canonicalPath);
    }

    try {
      window.sessionStorage.setItem(
        SCREEN_LOCK_STORAGE_KEY,
        JSON.stringify({
          screen,
          levelIndex: Number.isInteger(level?.index) ? level.index : null,
          lastLevelEnded: Number.isInteger(lastLevelEnded) ? lastLevelEnded : null,
        })
      );
    } catch {
      // Ignore les erreurs de stockage navigateur.
    }
  }, [screen, level?.index, lastLevelEnded]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const enforceCurrentPath = () => {
      const canonicalPath = getPathForScreen(screen, level, lastLevelEnded);
      if (window.location.pathname !== canonicalPath) {
        window.history.replaceState({ locked: true, screen }, "", canonicalPath);
      }
    };

    const onPopState = () => {
      enforceCurrentPath();
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("hashchange", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("hashchange", onPopState);
    };
  }, [screen, level?.index, lastLevelEnded]);

  useEffect(() => {
    const shouldPlayMenuMusic =
      screen !== "level" && screen !== "scoreboard" && screen !== "gameend";
    gameAudioEngine.setGeneralThemeActive(shouldPlayMenuMusic);
  }, [screen]);

  useEffect(() => {
    const onPointerDown = (event) => {
      gameAudioEngine.unlock();

      if (!(event.target instanceof Element)) return;
      const control = event.target.closest("button, [role='button']");
      if (!control) return;
      if (control instanceof HTMLButtonElement && control.disabled) return;
      if (control.getAttribute("data-ui-sound") === "submit") {
        gameAudioEngine.playSubmitButton();
        return;
      }
      gameAudioEngine.playButtonClick();
    };

    const onKeyDown = () => {
      gameAudioEngine.unlock();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  useEffect(() => {
    let gameStartTimer = null;

    const applyGameEnd = (msg) => {
      console.log("[GAME_END] Partie terminée avec scores:", msg.scores);
      setTickRemaining(null);
      setScores(msg.scores || {});
      setGamePlayerNames(msg.playerNames || {});
      setShowGameStartFx(false);
      setScreen("gameend");
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        console.warn("Message WS non-JSON:", event.data);
        return;
      }

      if (msg.type === "HELLO") {
        setSocketId(msg.socketId);
        return;
      }

      if (msg.type === "ROOM_CREATED") {
        setSocketId(msg.socketId || ws.socketId || null);
        setRoom(msg.room);
        saveRoomCode(msg?.room?.code);
        refreshResumeState();
        setScreen("lobby");
        return;
      }

      if (msg.type === "RECONNECTED") {
        setSocketId(msg.socketId || ws.socketId || null);
        const recoveredRoom = msg.room || null;
        setRoom(recoveredRoom);
        saveRoomCode(recoveredRoom?.code);
        refreshResumeState();
        const roomState = String(recoveredRoom?.state || "").toUpperCase();
        const roomIsInGame =
          roomState === "IN_PROGRESS" || roomState === "IN_GAME";
        setScreen((prev) => {
          if (!roomIsInGame) {
            return "lobby";
          }
          return prev === "level" || prev === "scoreboard" || prev === "gameend"
            ? prev
            : "lobby";
        });
        return;
      }

      if (msg.type === "ROOM_UPDATE") {
        setRoom(msg.room);
        if (msg?.room?.code) {
          saveRoomCode(msg.room.code);
          refreshResumeState();
        }
        setScreen((prev) =>
          prev === "level" || prev === "scoreboard" ? prev : "lobby"
        );
        return;
      }

      if (msg.type === "ROOM_CLOSED") {
        gameAudioEngine.stopAllGameplaySounds();
        clearRoomCode();
        refreshResumeState();
        setRoom(null);
        setScreen("home");
        setShowGameStartFx(false);
        showToast(msg.message || tRef.current("app.roomClosed"), "info");
        return;
      }

      if (msg.type === "KICKED") {
        gameAudioEngine.stopAllGameplaySounds();
        clearRoomCode();
        refreshResumeState();
        setRoom(null);
        setScreen("home");
        setShowGameStartFx(false);
        showToast(msg.message || tRef.current("app.kicked"), "error");
        return;
      }

      if (msg.type === "QUIT_ACCEPTED") {
        gameAudioEngine.stopAllGameplaySounds();
        clearRoomCode();
        refreshResumeState();
        setRoom(null);
        setScreen("home");
        setShowGameStartFx(false);
        return;
      }

      if (msg.type === "RECONNECT_FAILED") {
        gameAudioEngine.stopAllGameplaySounds();
        clearRoomCode();
        refreshResumeState();
        setRoom(null);
        setScreen("home");
        showToast(msg.message || tRef.current("app.reconnectFailed"), "error");
        return;
      }

      if (msg.type === "PLAYER_RECONNECTED") {
        if (msg.socketId && msg.socketId === ws.socketId) {
          return;
        }
        showToast(
          tRef.current("app.playerReconnected", {
            player: msg.playerName || tRef.current("common.player"),
          }),
          "info"
        );
        return;
      }

      if (msg.type === "PLAYER_LEFT") {
        if (msg.socketId && msg.socketId === ws.socketId) {
          return;
        }
        showToast(
          tRef.current("app.playerLeft", {
            player: msg.playerName || tRef.current("common.player"),
          }),
          "info",
          4000
        );
        return;
      }

      if (msg.type === "PLAYER_DISCONNECTED") {
        if (msg.socketId && msg.socketId === ws.socketId) {
          return;
        }
        showToast(
          tRef.current("app.playerDisconnected", {
            player: msg.playerName || tRef.current("common.player"),
          }),
          "info"
        );
        return;
      }

      if (msg.type === "HOST_CHANGED") {
        showToast(
          msg.hostName
            ? tRef.current("app.hostChangedWithName", { host: msg.hostName })
            : tRef.current("app.hostChangedGeneric"),
          "info"
        );
        return;
      }

      if (msg.type === "LEVEL_START") {
        const startTime = Number.parseInt(msg.timeLimitSec, 10);
        setTickRemaining(Number.isFinite(startTime) ? startTime : null);
        setGamePlayerNames({});
        setLevel({
          index: msg.levelIndex,
          difficulty: msg.difficulty,
          timeLimitSec: msg.timeLimitSec,
          endsAt: msg.endsAt,
        });
        setQuestions(msg.questions || []);
        setScreen("level");
        setStartFxLevelNumber((msg.levelIndex ?? 0) + 1);
        setShowGameStartFx(true);
        gameAudioEngine.playStartLevel();
        if (gameStartTimer) clearTimeout(gameStartTimer);
        gameStartTimer = setTimeout(() => setShowGameStartFx(false), 2100);
        return;
      }

      if (msg.type === "LEVEL_END") {
        setTickRemaining(null);
        setLevelScores(msg.levelScores || {});
        setScores(msg.scores || {});
        setQuestionDetails(msg.questionDetails || {});
        setLastLevelEnded(msg.levelIndex);
        lastLevelEndAtRef.current = Date.now();
        setScreen("scoreboard");
        return;
      }

      if (msg.type === "GAME_END") {
        const shouldBypassDelay = Boolean(msg.endReason);
        if (shouldBypassDelay) {
          if (pendingGameEndTimeoutRef.current) {
            clearTimeout(pendingGameEndTimeoutRef.current);
            pendingGameEndTimeoutRef.current = null;
          }
          applyGameEnd(msg);
          return;
        }

        const elapsedSinceLevelEnd = Date.now() - (lastLevelEndAtRef.current || 0);
        const minDisplayMs = 5000;
        const remainingMs =
          lastLevelEndAtRef.current > 0 && elapsedSinceLevelEnd < minDisplayMs
            ? (minDisplayMs - elapsedSinceLevelEnd)
            : 0;

        if (pendingGameEndTimeoutRef.current) {
          clearTimeout(pendingGameEndTimeoutRef.current);
          pendingGameEndTimeoutRef.current = null;
        }

        if (remainingMs > 0) {
          pendingGameEndTimeoutRef.current = setTimeout(() => {
            pendingGameEndTimeoutRef.current = null;
            applyGameEnd(msg);
          }, remainingMs);
          return;
        }

        applyGameEnd(msg);
        return;
      }

      // Messages ignorés volontairement
      if (msg.type === "SCORE_UPDATE") return;
      if (msg.type === "ANSWER_RECEIVED") {
        if (msg.accepted && !msg.auto) {
          showToast(tRef.current("app.answerSubmittedDefault"), "success", 1600);
        } else if (!msg.accepted && msg.message && !msg.auto) {
          showToast(msg.message, "warning", 2000);
        }
        return;
      }
      if (msg.type === "RUN_CODE_RESULT") return;
      if (msg.type === "TICK") {
        const serverTime = Number.parseInt(msg.timeRemaining, 10);
        if (Number.isFinite(serverTime)) {
          setTickRemaining(serverTime);
        }
        return;
      }
      if (msg.type === "GAME_STARTED") return;

      if (msg.type === "ERROR") {
        console.error("SERVER ERROR:", msg.message, msg);
        showToast(msg.message || tRef.current("app.serverErrorGeneric"), "error");
        return;
      }

      console.warn("Message WS non géré:", msg);
    };

    ws.onerror = (error) => {
      console.error("WebSocket erreur:", error);
      alert(tRef.current("app.connectionError"));
    };

    ws.onclose = () => {
      console.log("WebSocket fermé");
    };

    if (!startupReconnectAttemptedRef.current) {
      startupReconnectAttemptedRef.current = true;
      if (RECONNECT_REQUIRED_SCREENS.has(screen)) {
        const reconnectSession = getReconnectSession();
        if (!reconnectSession?.roomCode || !reconnectSession?.playerToken) {
          setScreen("home");
        } else {
          wsSend({
            type: "RECONNECT",
            roomCode: reconnectSession.roomCode,
            playerToken: reconnectSession.playerToken,
          });
        }
      }
    }

    return () => {
      if (gameStartTimer) {
        clearTimeout(gameStartTimer);
      }
      if (pendingGameEndTimeoutRef.current) {
        clearTimeout(pendingGameEndTimeoutRef.current);
        pendingGameEndTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <GameContextProvider>
      <UIContextProvider>
        <div className="min-h-screen bg-gray-50">
          {screen === "home" && (
            <Home
              setScreen={setScreen}
              canResume={canResume}
              onResumeGame={resumeGameFromHome}
              onOpenSettings={openSettings}
            />
          )}
          {screen === "settings" && (
            <Settings
              setScreen={setScreen}
              onClose={closeSettings}
              settingsVariant={settingsReturnScreen === "level" ? "ingame" : "main"}
              themeMode={themeMode}
              onThemeModeChange={applyThemeMode}
              audioSettings={audioSettings}
              onAudioSettingsChange={applyAudioSettings}
            />
          )}
          {screen === "configure" && (
            <ConfigureGame
              setScreen={setScreen}
              room={room}
              socketId={socketId}
            />
          )}
          {screen === "join" && <JoinRoom setScreen={setScreen} />}
          {screen === "resume" && <ResumeRoom setScreen={setScreen} />}
          {screen === "lobby" && (
            <Lobby room={room} socketId={socketId} setScreen={setScreen} />
          )}
          {screen === "level" && (
            <Level
              level={level}
              questions={questions}
              room={room}
              socketId={socketId}
              serverTickRemaining={tickRemaining}
              onOpenSettings={openSettings}
            />
          )}
          {screen === "scoreboard" && (
            <Scoreboard
              room={room}
              levelIndex={lastLevelEnded}
              levelScores={levelScores}
              scores={scores}
              questionDetails={questionDetails}
              questions={questions}
              socketId={socketId}
              setScreen={setScreen}
            />
          )}
          {screen === "gameend" && (
            <GameEnd
              room={room}
              scores={scores}
              playerNames={gamePlayerNames}
              socketId={socketId}
              setScreen={setScreen}
            />
          )}
          <div className="app-version-badge">V 1.0</div>
          <Toast
            key={`toast-${toastSeq}`}
            message={toastMessage}
            type={toastType}
            duration={toastDuration}
            onClose={closeToast}
          />
          {showGameStartFx ? (
            <div className="game-start-overlay">
              <div className="game-start-content">
                <div className="game-start-title-row">
                  <span className="game-start-title-text">{t("app.gameStartedTitle")}</span>
                  <span className="game-start-title-bang">!</span>
                </div>
                <div className="game-start-level">
                  {t("app.levelLabel", { level: startFxLevelNumber })}
                </div>
                <div className="game-start-subtitle">{t("app.gameStartedSubtitle")}</div>
              </div>
            </div>
          ) : null}
        </div>
      </UIContextProvider>
    </GameContextProvider>
  );
}
