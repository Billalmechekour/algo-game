import heroImage from "../assets/home-hero.png";
import cupIcon from "../assets/cup.png";
import joinIcon from "../assets/salon.png";
import { useLanguage } from "../context/LanguageContext";
import "../styles/home.css";

export default function Home({ setScreen, onResumeGame = null, onOpenSettings = null }) {
  const { t } = useLanguage();

  return (
    <div className="home-container">
      <div className="home-frame-glow">
        <div className="home-frame">
        <div className="home-background"></div>

        {/* Icônes flottantes des langages */}
        <div className="floating-langs">
          <div className="float-icon float-python">
            <svg viewBox="0 0 128 128"><defs><linearGradient id="pyY" x1="12.96" y1="12.04" x2="79.64" y2="78.72" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#387EB8"/><stop offset="1" stopColor="#366994"/></linearGradient><linearGradient id="pyB" x1="48.36" y1="49.28" x2="115.04" y2="115.96" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#FFE052"/><stop offset="1" stopColor="#FFC331"/></linearGradient></defs><path fill="url(#pyY)" d="M63.4 1.2C31.3 1.2 33.2 15 33.2 15l.1 14.3h30.8v4.3H20.6S1 30.5 1 63.3s17.1 31.6 17.1 31.6h10.2V80.4s-.5-17.1 16.8-17.1h29s16.3.3 16.3-15.8V19.2S93 1.2 63.4 1.2zM46.7 11.4a5.5 5.5 0 110 11 5.5 5.5 0 010-11z"/><path fill="url(#pyB)" d="M64.6 126.8c32.1 0 30.2-13.8 30.2-13.8l-.1-14.3H64v-4.3h43.5S127 97.5 127 64.7s-17.1-31.6-17.1-31.6H99.7v14.5s.5 17.1-16.8 17.1h-29S37.6 64.4 37.6 80.5v28.3s-2.6 18 27 18zM81.3 116.6a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/></svg>
          </div>
          <div className="float-icon float-cpp">
            <span className="lang-text">C++</span>
          </div>
          <div className="float-icon float-c">
            <span className="lang-text">C</span>
          </div>
          <div className="float-icon float-java">
            <span className="lang-text lang-java">Java</span>
          </div>
        </div>
        <div className="home-content">
          <div className="home-illustration">
            <img
              src={heroImage}
              alt={t("home.heroAlt")}
              className="home-hero-image"
            />
          </div>
          <div className="home-buttons">
            <button
              className="home-btn home-btn-green"
              onClick={() => setScreen("configure")}
            >
              <img src={cupIcon} alt={t("home.cupAlt")} className="home-btn-icon-img" />
              <span className="btn-text">{t("home.createRoom")}</span>
              <div className="btn-sparkles">
                <span className="btn-sparkle s1">✦</span>
                <span className="btn-sparkle s2">✧</span>
                <span className="btn-sparkle s3">✦</span>
                <span className="btn-sparkle s4">⋆</span>
              </div>
            </button>
            <button
              className="home-btn home-btn-blue"
              onClick={() => setScreen("join")}
            >
              <img src={joinIcon} alt={t("home.joinAlt")} className="home-btn-icon-img" />
              <span className="btn-text">{t("home.joinRoom")}</span>
              <div className="btn-sparkles">
                <span className="btn-sparkle s1">✦</span>
                <span className="btn-sparkle s2">✧</span>
                <span className="btn-sparkle s3">✦</span>
                <span className="btn-sparkle s4">⋆</span>
              </div>
            </button>
          </div>
          <div className="home-bottom-actions">
            <button
              type="button"
              className="home-btn home-btn-purple home-btn-resume"
              onClick={onResumeGame || undefined}
            >
              <svg className="resume-icon" viewBox="0 0 24 24">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
              <span className="btn-text">{t("home.resumeGame")}</span>
            </button>
            <button
              type="button"
              className="home-settings-circle"
              aria-label={t("home.settingsAria")}
              title={t("home.settingsTitle")}
              onClick={() => {
                if (typeof onOpenSettings === "function") {
                  onOpenSettings("home");
                } else {
                  setScreen("settings");
                }
              }}
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
                <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.5 1.5 0 0 1-2.1 2.1l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V19a1.5 1.5 0 0 1-3 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.5 1.5 0 1 1-2.1-2.1l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H5a1.5 1.5 0 0 1 0-3h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.5 1.5 0 1 1 2.1-2.1l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V5a1.5 1.5 0 0 1 3 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.5 1.5 0 1 1 2.1 2.1l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H19a1.5 1.5 0 0 1 0 3h-.2a1 1 0 0 0-.9.6Z" />
              </svg>
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
