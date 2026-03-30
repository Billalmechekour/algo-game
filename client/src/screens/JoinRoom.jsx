import { useState } from "react";
import { wsSend } from "../ws";
import "../styles/configure.css";
import "../styles/join-room.css";
import { getOrCreatePlayerToken } from "../session";
import { useLanguage } from "../context/LanguageContext";

export default function JoinRoom({ setScreen }) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const sanitizedCode = code.trim().toUpperCase();
  const canJoin = name.trim().length > 0 && sanitizedCode.length === 6;

  function join() {
    if (!canJoin) return;

    wsSend({
      type: "JOIN_ROOM",
      code: sanitizedCode,
      name: name.trim() || t("common.player"),
      playerToken: getOrCreatePlayerToken(),
    });
  }

  return (
    <div className="cfg-container">
      <div className="cfg-frame-glow">
        <div className="cfg-frame">
          <div className="cfg-bg"></div>

          <div className="cfg-header">
            <span className="cfg-title">{t("join.title")}</span>
            <button className="cfg-close" onClick={() => setScreen("home")} aria-label={t("common.back")}>
              ✕
            </button>
          </div>

          <div className="join-center-wrap">
            <div className="join-center-card">
              <h2 className="join-card-title">{t("join.codeTitle")}</h2>

              <div className="join-input-wrap join-input-wrap-pseudo">
                <span className="join-input-icon join-input-icon-player">{t("join.pseudoLabel")}</span>
                <input
                  className="join-input join-input-name"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 15))}
                  placeholder={t("join.pseudoPlaceholder")}
                  maxLength={15}
                />
              </div>

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
                  placeholder={t("join.roomCodePlaceholder")}
                  maxLength={6}
                />
              </div>

              <button className="join-btn join-btn-green" onClick={join} disabled={!canJoin}>
                <span className="join-btn-main">{t("join.joinButton")}</span>
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
