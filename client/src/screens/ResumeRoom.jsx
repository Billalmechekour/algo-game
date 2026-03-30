import { useMemo, useState } from "react";
import { wsSend } from "../ws";
import "../styles/configure.css";
import "../styles/join-room.css";
import { getOrCreatePlayerToken, getReconnectSession } from "../session";
import { useLanguage } from "../context/LanguageContext";

export default function ResumeRoom({ setScreen }) {
  const { t } = useLanguage();
  const reconnectSession = useMemo(() => getReconnectSession(), []);
  const [code, setCode] = useState(reconnectSession?.roomCode || "");
  const sanitizedCode = code.trim().toUpperCase();
  const canResume = sanitizedCode.length === 6;

  function resume() {
    if (!canResume) return;

    const playerToken = reconnectSession?.playerToken || getOrCreatePlayerToken();
    wsSend({
      type: "RECONNECT",
      roomCode: sanitizedCode,
      playerToken,
    });
  }

  return (
    <div className="cfg-container">
      <div className="cfg-frame-glow">
        <div className="cfg-frame">
          <div className="cfg-bg"></div>

          <div className="cfg-header">
            <span className="cfg-title">{t("resume.title")}</span>
            <button className="cfg-close" onClick={() => setScreen("home")} aria-label={t("common.back")}>
              ✕
            </button>
          </div>

          <div className="join-center-wrap">
            <div className="join-center-card">
              <h2 className="join-card-title">{t("resume.codeTitle")}</h2>

              <div className="join-input-wrap">
                <span className="join-input-icon">123456</span>
                <input
                  className="join-input"
                  value={code}
                  onChange={(e) =>
                    setCode(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 6)
                    )
                  }
                  placeholder={t("resume.roomCodePlaceholder")}
                  maxLength={6}
                />
              </div>

              <button className="join-btn join-btn-green" onClick={resume} disabled={!canResume}>
                <span className="join-btn-main">{t("resume.resumeButton")}</span>
              </button>

              <button className="join-btn join-btn-red" onClick={() => setScreen("home")}>
                <span className="join-btn-main">{t("common.cancel")}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
