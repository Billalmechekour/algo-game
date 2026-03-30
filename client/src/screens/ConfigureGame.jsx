import { useEffect, useRef, useState } from "react";
import { wsSend } from "../ws";
import "../styles/configure.css";
import { getOrCreatePlayerToken } from "../session";
import { useLanguage } from "../context/LanguageContext";

import pythonIcon from "../assets/icone de programmation/python.png";
import cppIcon from "../assets/icone de programmation/icons8-c++-48.png";
import cIcon from "../assets/icone de programmation/icons8-programmation-en-c-48.png";
import javaIcon from "../assets/icone de programmation/java.png";
import { AVATAR_IMAGES, getRandomAvatarId } from "../avatarMap";

const LANGS = [
  { label: "Python", value: "python", logo: pythonIcon },
  { label: "Java", value: "java", logo: javaIcon },
  { label: "C++", value: "cpp", logo: cppIcon },
  { label: "C", value: "c", logo: cIcon },
];
const LEVELS = [3, 6, 9];
const LEVEL_COLORS = ["opt-blue", "opt-green", "opt-red"];
const QPER = [1, 2, 3];
const QPER_COLORS = ["opt-blue", "opt-green", "opt-yellow"];
const QUESTION_TYPES = [
  { label: "Flash", value: "flash", color: "opt-green" },
  { label: "Code", value: "code", color: "opt-blue" },
  { label: "Mixte", value: "mixte", color: "opt-yellow" },
];
const TIMES = [60, 90, 120];

function parseAllowedNumber(value, allowed, fallback) {
  const parsed = Number.parseInt(value, 10);
  return allowed.includes(parsed) ? parsed : fallback;
}

export default function ConfigureGame({ setScreen, room = null, socketId = null }) {
  const { t } = useLanguage();
  const isHostInRoom = room?.hostSocketId === socketId;
  const isEditMode = Boolean(room && isHostInRoom && room.state === "WAITING");
  const roomHost = room?.players?.find((player) => player.socketId === room?.hostSocketId) || null;
  const initialHostName = (roomHost?.name || "Host").slice(0, 15);
  const initialLanguage = (() => {
    const raw = String(room?.config?.language || "").toLowerCase();
    return LANGS.some((lang) => lang.value === raw) ? raw : "python";
  })();
  const initialLevelCount = parseAllowedNumber(room?.config?.levelCount, LEVELS, 9);
  const initialQuestionsPerLevel = parseAllowedNumber(room?.config?.questionsPerLevel, QPER, 3);
  const initialQuestionType = (() => {
    const raw = String(room?.config?.questionType || "mixte").toLowerCase();
    return QUESTION_TYPES.some((item) => item.value === raw) ? raw : "mixte";
  })();
  const initialTimePerLevelSec = parseAllowedNumber(room?.config?.timePerLevelSec, TIMES, 120);

  const [hostName, setHostName] = useState(initialHostName);
  const [draftHostName, setDraftHostName] = useState(initialHostName);
  const [isEditingHostName, setIsEditingHostName] = useState(false);
  const [hostAvatarId] = useState(() => {
    const currentAvatarId = roomHost?.avatarId ? String(roomHost.avatarId) : null;
    if (currentAvatarId && AVATAR_IMAGES[currentAvatarId]) {
      return currentAvatarId;
    }
    return getRandomAvatarId();
  });
  const [language, setLanguage] = useState(initialLanguage);
  const [levelCount, setLevelCount] = useState(initialLevelCount);
  const [questionsPerLevel, setQuestionsPerLevel] = useState(initialQuestionsPerLevel);
  const [questionType, setQuestionType] = useState(initialQuestionType);
  const [timePerLevelSec, setTimePerLevelSec] = useState(initialTimePerLevelSec);
  const [isCreating, setIsCreating] = useState(false);
  const hostNameInputRef = useRef(null);
  const questionTypeLabelByValue = {
    flash: t("configure.questionTypeFlash"),
    code: t("configure.questionTypeCode"),
    mixte: t("configure.questionTypeMixte"),
  };

  useEffect(() => {
    if (isEditingHostName) {
      hostNameInputRef.current?.focus();
      hostNameInputRef.current?.select();
    }
  }, [isEditingHostName]);

  function toggleHostNameEdit() {
    if (isEditMode) return;
    if (isEditingHostName) {
      const validatedName = draftHostName.trim().slice(0, 15) || "Host";
      setHostName(validatedName);
      setDraftHostName(validatedName);
      setIsEditingHostName(false);
      return;
    }

    setDraftHostName(hostName);
    setIsEditingHostName(true);
  }

  function saveConfig() {
    if (isEditMode) {
      setIsCreating(true);
      const sent = wsSend({
        type: "UPDATE_CONFIG",
        config: {
          language,
          levelCount,
          questionsPerLevel,
          questionType,
          timePerLevelSec,
        },
      });

      if (!sent) {
        setIsCreating(false);
        return;
      }

      setScreen("lobby");
      return;
    }

    const finalHostName = (isEditingHostName ? draftHostName : hostName).trim().slice(0, 15) || "Host";
    if (isEditingHostName) {
      setHostName(finalHostName);
      setDraftHostName(finalHostName);
      setIsEditingHostName(false);
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("hostAvatarId", hostAvatarId);
    }

    setIsCreating(true);
    const playerToken = getOrCreatePlayerToken();
    const sent = wsSend({
      type: "CREATE_ROOM",
      hostName: finalHostName,
      hostAvatarId,
      playerToken,
      config: {
        language,
        levelCount,
        questionsPerLevel,
        questionType,
        timePerLevelSec,
      },
    });

    if (!sent) {
      setIsCreating(false);
    }
  }

  const currentLang = LANGS.find((l) => l.value === language) || LANGS[0];
  const timeIndex = TIMES.indexOf(timePerLevelSec);
  const timeProgress = ((timeIndex + 1) / TIMES.length) * 100;

  return (
    <div className="cfg-container">
      <div className="cfg-frame-glow">
        <div className="cfg-frame">
          <div className="cfg-bg"></div>

          <div className="cfg-header">
            <span className="cfg-title">
              {isEditMode ? t("configure.titleEdit") : t("configure.titleCreate")}
            </span>
            <button className="cfg-close" onClick={() => setScreen(isEditMode ? "lobby" : "home")}>✕</button>
          </div>

          <div className="cfg-card">
            <div className="cfg-profile">
              <div className="cfg-avatar cfg-avatar-image">
                <img src={AVATAR_IMAGES[hostAvatarId]} alt={t("configure.avatarAlt", { name: hostName })} />
              </div>
              <div className="cfg-pinfo">
                {isEditingHostName ? (
                  <input
                    ref={hostNameInputRef}
                    className="cfg-pname-input"
                    value={draftHostName}
                    onChange={(e) => setDraftHostName(e.target.value.slice(0, 15))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        toggleHostNameEdit();
                      }
                      if (e.key === "Escape") {
                        setDraftHostName(hostName);
                        setIsEditingHostName(false);
                      }
                    }}
                    placeholder="Host"
                    maxLength={15}
                  />
                ) : (
                  <span className="cfg-pname">{hostName}</span>
                )}
                <span className="cfg-pbadge">
                  <span className="cfg-pdot"></span> {t("configure.hostBadge")}
                </span>
              </div>
              {!isEditMode ? (
                <button
                  className={`cfg-pseudo-btn ${isEditingHostName ? "editing" : ""}`}
                  onClick={toggleHostNameEdit}
                >
                  {isEditingHostName ? t("configure.nicknameConfirm") : t("configure.nicknameChange")}
                </button>
              ) : null}
            </div>

            <div className="cfg-separator"></div>
            <div className="cfg-row">
              <div className="cfg-label-wrap">
                <span className="cfg-label">{t("configure.levelCount")}</span>
              </div>
              <div className="cfg-btns">
                {LEVELS.map((n, i) => (
                  <button
                    key={n}
                    className={`cfg-opt ${LEVEL_COLORS[i]} ${levelCount === n ? "sel" : ""}`}
                    onClick={() => setLevelCount(n)}
                  >{n}</button>
                ))}
              </div>
            </div>

            <div className="cfg-separator"></div>
            <div className="cfg-row">
              <div className="cfg-label-wrap">
                <span className="cfg-label">{t("configure.questionsPerLevel")}</span>
              </div>
              <div className="cfg-btns">
                {QPER.map((n, i) => (
                  <button
                    key={n}
                    className={`cfg-opt ${QPER_COLORS[i]} ${questionsPerLevel === n ? "sel" : ""}`}
                    onClick={() => setQuestionsPerLevel(n)}
                  >{n}</button>
                ))}
              </div>
            </div>

            <div className="cfg-separator"></div>
            <div className="cfg-row">
              <div className="cfg-label-wrap">
                <span className="cfg-label">{t("configure.questionType")}</span>
              </div>
              <div className="cfg-btns">
                {QUESTION_TYPES.map((item) => (
                  <button
                    key={item.value}
                    className={`cfg-opt cfg-opt-type ${item.color} ${questionType === item.value ? "sel" : ""}`}
                    onClick={() => setQuestionType(item.value)}
                  >
                    {questionTypeLabelByValue[item.value] || item.value}
                  </button>
                ))}
              </div>
            </div>

            <div className="cfg-separator"></div>
            <div className="cfg-row cfg-row-time">
              <div className="cfg-label-wrap">
                <span className="cfg-label">{t("configure.timePerLevel")}</span>
              </div>
              <div className="cfg-time-controls">
                <div className="cfg-time-bar">
                  <span className="cfg-time-fill" style={{ width: `${timeProgress}%` }}></span>
                </div>
                <div className="cfg-time-btns">
                  {TIMES.map((t, i) => (
                    <button
                      key={t}
                      className={`cfg-time-btn ${timePerLevelSec === t ? "sel" : ""}`}
                      onClick={() => setTimePerLevelSec(t)}
                    >
                      {t}s{i === TIMES.length - 1 && <span className="cfg-arrow"> ›</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="cfg-separator"></div>
            <div className="cfg-row cfg-row-lang">
              <div className="cfg-label-wrap">
                <span className="cfg-label">{t("configure.programmingLanguage")}</span>
              </div>
              <div className="cfg-lang-wrap">
                <div className="cfg-lang-logo">
                  <img src={currentLang.logo} alt={currentLang.label} />
                </div>
                <span className="cfg-lang-name">{currentLang.label}</span>
                <select
                  className="cfg-lang-select"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  {LANGS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
                <span className="cfg-lang-arrows">
                  <span>▲</span>
                  <span>▼</span>
                </span>
              </div>
            </div>

            <div className="cfg-actions">
              <button className="cfg-btn-cancel" onClick={() => setScreen(isEditMode ? "lobby" : "home")}>
                {t("configure.cancel")}
              </button>
              <button 
                className={`cfg-btn-go ${isCreating ? "creating" : ""}`} 
                onClick={saveConfig}
                disabled={isCreating}
              >
                {isCreating
                  ? (isEditMode ? t("configure.saving") : t("configure.creating"))
                  : (isEditMode ? t("configure.save") : t("configure.accessRoom"))}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
