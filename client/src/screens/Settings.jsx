import "../styles/configure.css";
import "../styles/settings.css";
import { useLanguage } from "../context/LanguageContext";

const THEME_OPTIONS = [
  {
    value: "default",
    icon: "🎮",
    toneClass: "opt-blue",
  },
  {
    value: "light",
    icon: "☀️",
    toneClass: "opt-yellow",
  },
  {
    value: "night",
    icon: "🌙",
    toneClass: "opt-purple",
  },
];

export default function Settings({
  setScreen,
  onClose = null,
  settingsVariant = "main",
  themeMode = "default",
  onThemeModeChange,
  audioSettings = {
    enabled: true,
    masterVolume: 0.72,
    musicVolume: 0.3,
    generalVolume: 0.8,
    clickVolume: 0.7,
  },
  onAudioSettingsChange,
}) {
  const { language, setLanguage, t } = useLanguage();
  const isInGameSettings = settingsVariant === "ingame";
  const resolvedThemeMode = ["default", "light", "night"].includes(themeMode)
    ? themeMode
    : "default";
  const closeSettings = () => {
    if (typeof onClose === "function") {
      onClose();
      return;
    }
    setScreen("home");
  };
  const volumePercent = {
    music: Math.round((audioSettings.musicVolume || 0) * 100),
    general: Math.round((audioSettings.generalVolume || 0) * 100),
    click: Math.round((audioSettings.clickVolume || 0) * 100),
  };

  function updateVolume(key, event) {
    const nextValue = Math.min(
      1,
      Math.max(0, Number.parseInt(event.target.value, 10) / 100)
    );
    onAudioSettingsChange?.({ [key]: nextValue });
  }

  return (
    <div className="cfg-container">
      <div className="cfg-frame-glow">
        <div className="cfg-frame">
          <div className="cfg-bg"></div>

          <div className="cfg-header">
            <span className="cfg-title">{t("settings.title")}</span>
            <button
              className="cfg-close"
              onClick={closeSettings}
              aria-label={t("common.back")}
              title={t("common.back")}
            >
              ✕
            </button>
          </div>

          <div className="cfg-card settings-card">
            <div className="settings-section">
              <h2 className="settings-title">{t("settings.appearanceTitle")}</h2>
              <p className="settings-subtitle">{t("settings.appearanceSubtitle")}</p>
            </div>

            <div className="settings-mode-grid">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`settings-mode-btn ${option.toneClass} ${
                    resolvedThemeMode === option.value ? "sel" : ""
                  }`}
                  onClick={() => onThemeModeChange?.(option.value)}
                >
                  <span className="settings-mode-icon" aria-hidden="true">
                    {option.icon}
                  </span>
                  <span className="settings-mode-text">
                    <span className="settings-mode-label">
                      {t(`settings.theme.${option.value}.label`)}
                    </span>
                    <span className="settings-mode-subtitle">
                      {t(`settings.theme.${option.value}.subtitle`)}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <div className="settings-preview">
              <span className="settings-preview-label">{t("settings.modeActiveLabel")}</span>
              <strong className="settings-preview-value">
                {t(`settings.theme.${resolvedThemeMode}.label`)}
              </strong>
            </div>

            {!isInGameSettings ? (
              <div className="settings-sound-block">
                <div className="settings-sound-head">
                  <h2 className="settings-title">{t("settings.languageTitle")}</h2>
                  <p className="settings-subtitle">{t("settings.languageSubtitle")}</p>
                </div>

                <div className="settings-sound-toggle settings-language-toggle">
                  <button
                    type="button"
                    className={`settings-toggle-btn ${language === "fr" ? "sel" : ""}`}
                    onClick={() => setLanguage("fr")}
                  >
                    <span className="settings-language-option">
                      <span className="settings-language-flag" aria-hidden="true">🇫🇷</span>
                      <span>{t("settings.french")}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`settings-toggle-btn ${language === "en" ? "sel" : ""}`}
                    onClick={() => setLanguage("en")}
                  >
                    <span className="settings-language-option">
                      <span className="settings-language-flag" aria-hidden="true">🇬🇧</span>
                      <span>{t("settings.english")}</span>
                    </span>
                  </button>
                </div>
              </div>
            ) : null}

            <div className="settings-sound-block">
              <div className="settings-sound-head">
                <h2 className="settings-title">{t("settings.soundTitle")}</h2>
                <p className="settings-subtitle">
                  {isInGameSettings ? t("settings.soundSubtitleInGame") : t("settings.soundSubtitle")}
                </p>
              </div>

              <div className="settings-sound-toggle">
                <button
                  type="button"
                  className={`settings-toggle-btn ${audioSettings.enabled ? "sel" : ""}`}
                  onClick={() => onAudioSettingsChange?.({ enabled: true })}
                >
                  <span className="settings-toggle-label">
                    <span className="settings-toggle-icon" aria-hidden="true">🔊</span>
                    <span>{t("settings.enable")}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className={`settings-toggle-btn danger ${audioSettings.enabled ? "" : "sel"}`}
                  onClick={() => onAudioSettingsChange?.({ enabled: false })}
                >
                  <span className="settings-toggle-label">
                    <span className="settings-toggle-icon" aria-hidden="true">🔇</span>
                    <span>{t("settings.mute")}</span>
                  </span>
                </button>
              </div>

              <div className={`settings-sliders ${audioSettings.enabled ? "" : "is-muted"}`}>
                {!isInGameSettings ? (
                  <label className="settings-slider-row">
                    <span>{t("settings.music")}</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volumePercent.music}
                      onChange={(event) => updateVolume("musicVolume", event)}
                    />
                    <strong>{volumePercent.music}%</strong>
                  </label>
                ) : null}

                <label className="settings-slider-row">
                  <span>{t("settings.generalSounds")}</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volumePercent.general}
                    onChange={(event) => updateVolume("generalVolume", event)}
                  />
                  <strong>{volumePercent.general}%</strong>
                </label>

                <label className="settings-slider-row">
                  <span>{t("settings.buttonClicks")}</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volumePercent.click}
                    onChange={(event) => updateVolume("clickVolume", event)}
                  />
                  <strong>{volumePercent.click}%</strong>
                </label>
              </div>
            </div>

            <div className="cfg-actions settings-actions">
              <button
                type="button"
                className="cfg-btn-cancel"
                onClick={closeSettings}
              >
                {t("common.back")}
              </button>
              <button
                type="button"
                className="cfg-btn-go"
                onClick={closeSettings}
              >
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
