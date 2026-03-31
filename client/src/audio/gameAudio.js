import clickButtonSound from "../assets/sounds/clique buttton.mp3";
import submitButtonSound from "../assets/sounds/soumission button.mp3";
import tenSecondsSound from "../assets/sounds/10s.mp3";
import levelScoreSound from "../assets/sounds/nouvelle niveau.mp3";
import startLevelSound from "../assets/sounds/start level.mp3";
import winnerSound from "../assets/sounds/winner.mp3";
import fireSound from "../assets/sounds/fire.mp3";
import generalGameSound from "../assets/sounds/music de jeu.mp3";

export const AUDIO_SETTINGS_STORAGE_KEY = "algo-audio-settings-v2";

const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  enabled: true,
  masterVolume: 1,
  musicVolume: 0.3,
  generalVolume: 0.8,
  clickVolume: 0.7,
});

function clamp01(value, fallback) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
}

export function normalizeAudioSettings(rawSettings = {}) {
  const normalized = {
    enabled:
      typeof rawSettings.enabled === "boolean"
        ? rawSettings.enabled
        : DEFAULT_AUDIO_SETTINGS.enabled,
    masterVolume: clamp01(rawSettings.masterVolume, DEFAULT_AUDIO_SETTINGS.masterVolume),
    musicVolume: clamp01(rawSettings.musicVolume, DEFAULT_AUDIO_SETTINGS.musicVolume),
    generalVolume: clamp01(rawSettings.generalVolume, DEFAULT_AUDIO_SETTINGS.generalVolume),
    clickVolume: clamp01(rawSettings.clickVolume, DEFAULT_AUDIO_SETTINGS.clickVolume),
  };

  return normalized;
}

export function readAudioSettings() {
  if (typeof window === "undefined" || !window.localStorage) {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }

  try {
    const storedValue = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    if (!storedValue) return { ...DEFAULT_AUDIO_SETTINGS };
    const parsed = JSON.parse(storedValue);
    return normalizeAudioSettings(parsed);
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

function persistAudioSettings(settings) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      AUDIO_SETTINGS_STORAGE_KEY,
      JSON.stringify(settings)
    );
  } catch {
    // Ignore les erreurs de quota ou de sérialisation.
  }
}

class GameAudioEngine {
  constructor() {
    this.settings = normalizeAudioSettings(readAudioSettings());
    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.ambientGain = null;
    this.clickAudioElement = null;
    this.submitAudioElement = null;
    this.tenSecondAudioElement = null;
    this.levelScoreAudioElement = null;
    this.startLevelAudioElement = null;
    this.generalGameAudioElement = null;
    this.generalThemeActive = false;
    this.useMusicFallback = false;
    this.generalPlaybackProbeTimeout = null;
    // Ne plus forcer les effets synthétiques sur Chrome:
    // on tente toujours d'abord les vrais fichiers audio, puis fallback si échec.
    this.forceSynthEffects = false;
    this.winnerAudioElement = null;
    this.fireAudioElement = null;
    this.finalFireworksInterval = null;
    this.finalFireworksStopTimeout = null;
    this.rhythmTimer = null;
    this.rhythmStep = 0;
    this.mediaPrimed = false;
  }

  resetAudioElement(audio) {
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // Ignore les erreurs de réinitialisation média.
    }
  }

  stopAllGameplaySounds() {
    this.stopFinalFireworks();
    this.clearGeneralPlaybackProbe();

    this.resetAudioElement(this.tenSecondAudioElement);
    this.resetAudioElement(this.levelScoreAudioElement);
    this.resetAudioElement(this.startLevelAudioElement);
    this.resetAudioElement(this.winnerAudioElement);
    this.resetAudioElement(this.fireAudioElement);

    if (this.context && this.masterGain) {
      const now = this.context.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(0, now);
    }
  }

  getSettings() {
    return { ...this.settings };
  }

  setSettings(nextSettings) {
    this.settings = normalizeAudioSettings(nextSettings);
    persistAudioSettings(this.settings);
    this.applyVolumes();
    this.syncGeneralThemePlayback();
    this.syncRhythmLoop();
    if (!this.settings.enabled) {
      this.stopFinalFireworks();
    }
  }

  ensureContext() {
    if (typeof window === "undefined") return null;
    if (this.context) return this.context;

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;

    const context = new AudioContextCtor();
    this.context = context;

    this.masterGain = context.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(context.destination);

    this.musicGain = context.createGain();
    this.musicGain.gain.value = 0;
    this.musicGain.connect(this.masterGain);

    this.createAmbientBed();
    this.applyVolumes(true);
    this.syncRhythmLoop();
    return context;
  }

  unlock() {
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }
    if (!this.mediaPrimed) {
      this.primeAudioMediaFromGesture();
      this.mediaPrimed = true;
    }
    this.syncGeneralThemePlayback();
  }

  primeSingleAudioElement(audio) {
    if (!audio) return;
    try {
      // Précharge via un clone temporaire pour ne jamais couper un son en cours.
      const primer = audio.cloneNode(true);
      primer.preload = "auto";
      primer.muted = true;
      primer.volume = 0;
      primer.playsInline = true;
      const playPromise = primer.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise
          .then(() => {
            primer.pause();
            primer.src = "";
          })
          .catch(() => {
            primer.src = "";
          });
        return;
      }
      primer.pause();
      primer.src = "";
    } catch {
      // Ignore les erreurs de préchargement propres au navigateur.
    }
  }

  primeAudioMediaFromGesture() {
    const audios = [
      this.ensureGeneralGameAudioElement(),
      this.ensureClickAudioElement(),
      this.ensureSubmitAudioElement(),
      this.ensureTenSecondAudioElement(),
      this.ensureLevelScoreAudioElement(),
      this.ensureStartLevelAudioElement(),
      this.ensureWinnerAudioElement(),
      this.ensureFireAudioElement(),
    ];
    audios.forEach((audio) => this.primeSingleAudioElement(audio));
  }

  applyVolumes(immediate = false) {
    if (!this.context || !this.masterGain || !this.musicGain) return;
    const now = this.context.currentTime;
    const rampDuration = immediate ? 0.01 : 0.08;

    const masterTarget = this.settings.enabled ? 1 : 0;
    const musicTarget =
      this.settings.enabled && this.generalThemeActive ? this.settings.musicVolume : 0;

    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(masterTarget, now + rampDuration);

    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(musicTarget, now + rampDuration);

    if (this.ambientGain) {
      this.ambientGain.gain.cancelScheduledValues(now);
      this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, now);
      this.ambientGain.gain.linearRampToValueAtTime(0, now + rampDuration);
    }
  }

  createAmbientBed() {
    if (!this.context || !this.musicGain || this.ambientGain) return;
    const context = this.context;

    const ambientGain = context.createGain();
    ambientGain.gain.value = 0;
    ambientGain.connect(this.musicGain);
    this.ambientGain = ambientGain;
  }

  playAmbientPulse() {
    const context = this.context;
    if (!context || context.state !== "running") return;
    if (!this.settings.enabled || this.settings.musicVolume <= 0.01 || !this.musicGain) return;

    const progression = [
      { root: 146.83, fifth: 220, ninth: 329.63, lead: [587.33, 739.99] },
      { root: 164.81, fifth: 246.94, ninth: 369.99, lead: [659.25, 830.61] },
      { root: 130.81, fifth: 196.0, ninth: 293.66, lead: [523.25, 659.25] },
      { root: 174.61, fifth: 261.63, ninth: 392.0, lead: [698.46, 880.0] },
    ];
    const frame = progression[this.rhythmStep % progression.length];
    this.rhythmStep += 1;

    const now = context.currentTime;
    const padTransitionTime = now + 0.6;
    if (this.padVoices) {
      this.padVoices.toneA.frequency.exponentialRampToValueAtTime(frame.root, padTransitionTime);
      this.padVoices.toneB.frequency.exponentialRampToValueAtTime(frame.fifth, padTransitionTime);
      this.padVoices.toneC.frequency.exponentialRampToValueAtTime(frame.ninth, padTransitionTime);
    }

    const triggerPulse = (frequency, offset) => {
      const pulseStart = now + offset;
      const pulseStop = pulseStart + 0.26;
      const pulseGain = context.createGain();
      const pulseOsc = context.createOscillator();

      pulseOsc.type = "triangle";
      pulseOsc.frequency.setValueAtTime(frequency, pulseStart);
      pulseOsc.frequency.exponentialRampToValueAtTime(frequency * 1.18, pulseStop);

      const pulseVolume = Math.max(0.01, this.settings.musicVolume * 0.26);
      pulseGain.gain.setValueAtTime(0.0001, pulseStart);
      pulseGain.gain.exponentialRampToValueAtTime(pulseVolume, pulseStart + 0.02);
      pulseGain.gain.exponentialRampToValueAtTime(0.0001, pulseStop);

      pulseOsc.connect(pulseGain);
      pulseGain.connect(this.musicGain);
      pulseOsc.start(pulseStart);
      pulseOsc.stop(pulseStop + 0.015);
      pulseOsc.onended = () => {
        pulseOsc.disconnect();
        pulseGain.disconnect();
      };
    };

    triggerPulse(frame.lead[0], 0.03);
    triggerPulse(frame.lead[1], 0.42);

    const kickGain = context.createGain();
    const kickOsc = context.createOscillator();
    const kickStart = now + 0.01;
    const kickStop = kickStart + 0.14;
    const kickVolume = Math.max(0.01, this.settings.musicVolume * 0.18);

    kickOsc.type = "sine";
    kickOsc.frequency.setValueAtTime(152, kickStart);
    kickOsc.frequency.exponentialRampToValueAtTime(52, kickStop);

    kickGain.gain.setValueAtTime(0.0001, kickStart);
    kickGain.gain.exponentialRampToValueAtTime(kickVolume, kickStart + 0.018);
    kickGain.gain.exponentialRampToValueAtTime(0.0001, kickStop);

    kickOsc.connect(kickGain);
    kickGain.connect(this.musicGain);
    kickOsc.start(kickStart);
    kickOsc.stop(kickStop + 0.015);
    kickOsc.onended = () => {
      kickOsc.disconnect();
      kickGain.disconnect();
    };
  }

  syncRhythmLoop() {
    const shouldRun =
      this.useMusicFallback &&
      this.generalThemeActive &&
      this.settings.enabled &&
      this.settings.musicVolume > 0.01;

    if (!shouldRun) {
      if (this.rhythmTimer) {
        globalThis.clearInterval(this.rhythmTimer);
        this.rhythmTimer = null;
      }
      return;
    }

    if (!this.rhythmTimer && typeof window !== "undefined") {
      this.rhythmTimer = window.setInterval(() => {
        this.playAmbientPulse();
      }, 1200);
    }
  }

  setGeneralThemeActive(active) {
    this.generalThemeActive = Boolean(active);
    this.applyVolumes();
    this.syncGeneralThemePlayback();
    this.syncRhythmLoop();
  }

  ensureGeneralGameAudioElement() {
    if (typeof window === "undefined") return null;
    if (this.generalGameAudioElement) return this.generalGameAudioElement;
    if (!generalGameSound) return null;

    const audio = new Audio(generalGameSound);
    audio.preload = "auto";
    audio.loop = true;
    audio.playsInline = true;
    audio.volume = 0.5;
    audio.load();
    audio.addEventListener("error", () => {
      this.useMusicFallback = true;
      this.syncRhythmLoop();
    });
    this.generalGameAudioElement = audio;
    return audio;
  }

  clearGeneralPlaybackProbe() {
    if (this.generalPlaybackProbeTimeout) {
      clearTimeout(this.generalPlaybackProbeTimeout);
      this.generalPlaybackProbeTimeout = null;
    }
  }

  scheduleGeneralPlaybackProbe(audio) {
    this.clearGeneralPlaybackProbe();
    this.generalPlaybackProbeTimeout = setTimeout(() => {
      this.generalPlaybackProbeTimeout = null;
      if (!this.generalThemeActive || !this.settings.enabled) return;
      if (!audio || audio.paused) return;
      // Sur Chrome, play() peut réussir alors que le son reste bloqué/silencieux.
      if (audio.currentTime <= 0.05) {
        this.useMusicFallback = true;
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {
          // Ignore les erreurs lors de la remise à zéro.
        }
        this.syncRhythmLoop();
      }
    }, 1400);
  }

  syncGeneralThemePlayback() {
    const audio = this.ensureGeneralGameAudioElement();
    if (!audio) return;

    const shouldPlay =
      this.generalThemeActive &&
      this.settings.enabled &&
      this.settings.musicVolume > 0.01;

    const themeVolume = Math.max(
      0,
      Math.min(1, this.settings.musicVolume * 0.95)
    );

    audio.volume = themeVolume;
    if (shouldPlay) {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise
          .then(() => {
            this.useMusicFallback = false;
            this.syncRhythmLoop();
            this.scheduleGeneralPlaybackProbe(audio);
          })
          .catch(() => {
            this.useMusicFallback = true;
            this.syncRhythmLoop();
          });
      } else {
        this.useMusicFallback = false;
        this.syncRhythmLoop();
        this.scheduleGeneralPlaybackProbe(audio);
      }
      return;
    }

    audio.pause();
    this.clearGeneralPlaybackProbe();
    this.useMusicFallback = false;
    this.syncRhythmLoop();
  }

  ensureClickAudioElement() {
    if (typeof window === "undefined") return null;
    if (this.clickAudioElement) return this.clickAudioElement;
    if (!clickButtonSound) return null;

    const audio = new Audio(clickButtonSound);
    audio.preload = "auto";
    audio.volume = 0.5;
    this.clickAudioElement = audio;
    return audio;
  }

  ensureSubmitAudioElement() {
    if (typeof window === "undefined") return null;
    if (this.submitAudioElement) return this.submitAudioElement;
    if (!submitButtonSound) return null;

    const audio = new Audio(submitButtonSound);
    audio.preload = "auto";
    audio.volume = 0.5;
    this.submitAudioElement = audio;
    return audio;
  }

  ensureTenSecondAudioElement() {
    if (typeof window === "undefined") return null;
    if (this.tenSecondAudioElement) return this.tenSecondAudioElement;
    if (!tenSecondsSound) return null;

    const audio = new Audio(tenSecondsSound);
    audio.preload = "auto";
    audio.volume = 0.5;
    this.tenSecondAudioElement = audio;
    return audio;
  }

  ensureLevelScoreAudioElement() {
    if (typeof window === "undefined") return null;
    if (this.levelScoreAudioElement) return this.levelScoreAudioElement;
    if (!levelScoreSound) return null;

    const audio = new Audio(levelScoreSound);
    audio.preload = "auto";
    audio.volume = 0.5;
    this.levelScoreAudioElement = audio;
    return audio;
  }

  ensureStartLevelAudioElement() {
    if (typeof window === "undefined") return null;
    if (this.startLevelAudioElement) return this.startLevelAudioElement;
    if (!startLevelSound) return null;

    const audio = new Audio(startLevelSound);
    audio.preload = "auto";
    audio.volume = 0.5;
    this.startLevelAudioElement = audio;
    return audio;
  }

  ensureWinnerAudioElement() {
    if (typeof window === "undefined") return null;
    if (this.winnerAudioElement) return this.winnerAudioElement;
    if (!winnerSound) return null;

    const audio = new Audio(winnerSound);
    audio.preload = "auto";
    audio.volume = 0.5;
    this.winnerAudioElement = audio;
    return audio;
  }

  ensureFireAudioElement() {
    if (typeof window === "undefined") return null;
    if (this.fireAudioElement) return this.fireAudioElement;
    if (!fireSound) return null;

    const audio = new Audio(fireSound);
    audio.preload = "auto";
    audio.volume = 0.5;
    this.fireAudioElement = audio;
    return audio;
  }

  tryPlayButtonClickFromFile() {
    if (this.forceSynthEffects) return false;
    const audio = this.ensureClickAudioElement();
    if (!audio) return false;

    const clickVolume = Math.max(
      0,
      Math.min(1, this.settings.clickVolume)
    );
    if (clickVolume <= 0.001) return false;

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = clickVolume;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          this.playButtonClickSynth();
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  tryPlaySubmitFromFile() {
    if (this.forceSynthEffects) return false;
    const audio = this.ensureSubmitAudioElement();
    if (!audio) return false;

    const submitVolume = Math.max(
      0,
      Math.min(1, this.settings.clickVolume)
    );
    if (submitVolume <= 0.001) return false;

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = submitVolume;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          this.playButtonClickSynth();
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  tryPlayTenSecondWarningFromFile() {
    if (this.forceSynthEffects) return false;
    const audio = this.ensureTenSecondAudioElement();
    if (!audio) return false;

    const warningVolume = Math.max(
      0,
      Math.min(
        1,
        this.settings.generalVolume
      )
    );
    if (warningVolume <= 0.001) return false;

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = warningVolume;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          this.playTenSecondWarningSynth();
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  tryPlayLevelScoreFromFile() {
    if (this.forceSynthEffects) return false;
    const audio = this.ensureLevelScoreAudioElement();
    if (!audio) return false;

    const levelScoreVolume = Math.max(
      0,
      Math.min(
        1,
        this.settings.generalVolume
      )
    );
    if (levelScoreVolume <= 0.001) return false;

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = levelScoreVolume;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          this.playLevelScoreSynth();
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  tryPlayStartLevelFromFile() {
    if (this.forceSynthEffects) return false;
    const audio = this.ensureStartLevelAudioElement();
    if (!audio) return false;

    const startLevelVolume = Math.max(
      0,
      Math.min(
        1,
        this.settings.generalVolume
      )
    );
    if (startLevelVolume <= 0.001) return false;

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = startLevelVolume;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          this.playStartLevelSynth();
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  tryPlayWinnerFromFile() {
    if (this.forceSynthEffects) return false;
    const audio = this.ensureWinnerAudioElement();
    if (!audio) return false;

    const winnerVolume = Math.max(
      0,
      Math.min(
        1,
        this.settings.generalVolume
      )
    );
    if (winnerVolume <= 0.001) return false;

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = winnerVolume;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          this.playWinnerSynth();
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  playButtonClickSynth() {
    const context = this.ensureContext();
    if (!context || !this.masterGain) return;
    if (!this.settings.enabled || this.settings.clickVolume <= 0.01) return;
    if (context.state === "suspended") {
      context
        .resume()
        .then(() => this.playButtonClick())
        .catch(() => {});
      return;
    }

    const now = context.currentTime;
    const clickGain = context.createGain();
    const clickToneMain = context.createOscillator();
    const clickToneAccent = context.createOscillator();

    const clickVolume = Math.max(0.01, this.settings.clickVolume * 0.28);
    clickGain.gain.setValueAtTime(0.0001, now);
    clickGain.gain.exponentialRampToValueAtTime(clickVolume, now + 0.01);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    clickToneMain.type = "triangle";
    clickToneMain.frequency.setValueAtTime(1280, now);
    clickToneMain.frequency.exponentialRampToValueAtTime(760, now + 0.09);

    clickToneAccent.type = "sine";
    clickToneAccent.frequency.setValueAtTime(920, now);
    clickToneAccent.frequency.exponentialRampToValueAtTime(620, now + 0.09);

    clickToneMain.connect(clickGain);
    clickToneAccent.connect(clickGain);
    clickGain.connect(this.masterGain);

    clickToneMain.start(now);
    clickToneAccent.start(now);
    clickToneMain.stop(now + 0.11);
    clickToneAccent.stop(now + 0.11);
    clickToneAccent.onended = () => {
      clickToneMain.disconnect();
      clickToneAccent.disconnect();
      clickGain.disconnect();
    };
  }

  playButtonClick() {
    if (!this.settings.enabled || this.settings.clickVolume <= 0.01) return;
    if (this.tryPlayButtonClickFromFile()) return;
    this.playButtonClickSynth();
  }

  playSubmitButton() {
    if (!this.settings.enabled || this.settings.clickVolume <= 0.01) return;
    if (this.tryPlaySubmitFromFile()) return;
    this.playButtonClickSynth();
  }

  playTenSecondWarningSynth() {
    const context = this.ensureContext();
    if (!context || !this.masterGain) return;
    if (!this.settings.enabled) return;
    if (context.state === "suspended") {
      context
        .resume()
        .then(() => this.playTenSecondWarning())
        .catch(() => {});
      return;
    }

    const warningVolume = Math.max(
      0.01,
      Math.min(
        0.35,
        this.settings.generalVolume * 0.6
      )
    );

    const sequence = [
      { frequency: 920, start: 0, duration: 0.14 },
      { frequency: 920, start: 0.2, duration: 0.14 },
      { frequency: 730, start: 0.4, duration: 0.2 },
    ];

    const now = context.currentTime;
    sequence.forEach((tone) => {
      const beepGain = context.createGain();
      const beepOsc = context.createOscillator();
      const startAt = now + tone.start;
      const stopAt = startAt + tone.duration;

      beepOsc.type = "triangle";
      beepOsc.frequency.setValueAtTime(tone.frequency, startAt);
      beepOsc.frequency.exponentialRampToValueAtTime(
        Math.max(100, tone.frequency * 0.92),
        stopAt
      );

      beepGain.gain.setValueAtTime(0.0001, startAt);
      beepGain.gain.exponentialRampToValueAtTime(warningVolume, startAt + 0.02);
      beepGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

      beepOsc.connect(beepGain);
      beepGain.connect(this.masterGain);
      beepOsc.start(startAt);
      beepOsc.stop(stopAt + 0.01);
      beepOsc.onended = () => {
        beepOsc.disconnect();
        beepGain.disconnect();
      };
    });
  }

  playTenSecondWarning() {
    if (!this.settings.enabled) return;
    if (this.tryPlayTenSecondWarningFromFile()) return;
    this.playTenSecondWarningSynth();
  }

  playLevelScoreSynth() {
    const context = this.ensureContext();
    if (!context || !this.masterGain) return;
    if (!this.settings.enabled) return;
    if (context.state === "suspended") {
      context
        .resume()
        .then(() => this.playLevelScore())
        .catch(() => {});
      return;
    }

    const levelScoreVolume = Math.max(
      0.01,
      Math.min(
        0.4,
        this.settings.generalVolume * 0.72
      )
    );

    const melody = [
      { frequency: 523.25, start: 0, duration: 0.18 },
      { frequency: 659.25, start: 0.12, duration: 0.18 },
      { frequency: 783.99, start: 0.24, duration: 0.22 },
      { frequency: 1046.5, start: 0.42, duration: 0.3 },
    ];

    const now = context.currentTime;
    melody.forEach((note) => {
      const noteGain = context.createGain();
      const noteOsc = context.createOscillator();
      const startAt = now + note.start;
      const stopAt = startAt + note.duration;

      noteOsc.type = "triangle";
      noteOsc.frequency.setValueAtTime(note.frequency, startAt);
      noteOsc.frequency.exponentialRampToValueAtTime(
        Math.max(120, note.frequency * 1.04),
        stopAt
      );

      noteGain.gain.setValueAtTime(0.0001, startAt);
      noteGain.gain.exponentialRampToValueAtTime(levelScoreVolume, startAt + 0.03);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

      noteOsc.connect(noteGain);
      noteGain.connect(this.masterGain);
      noteOsc.start(startAt);
      noteOsc.stop(stopAt + 0.015);
      noteOsc.onended = () => {
        noteOsc.disconnect();
        noteGain.disconnect();
      };
    });
  }

  playLevelScore() {
    if (!this.settings.enabled) return;
    if (this.tryPlayLevelScoreFromFile()) return;
    this.playLevelScoreSynth();
  }

  playStartLevelSynth() {
    const context = this.ensureContext();
    if (!context || !this.masterGain) return;
    if (!this.settings.enabled) return;
    if (context.state === "suspended") {
      context
        .resume()
        .then(() => this.playStartLevel())
        .catch(() => {});
      return;
    }

    const startLevelVolume = Math.max(
      0.01,
      Math.min(
        0.38,
        this.settings.generalVolume * 0.68
      )
    );

    const melody = [
      { frequency: 493.88, start: 0, duration: 0.16 },
      { frequency: 659.25, start: 0.12, duration: 0.18 },
      { frequency: 880.0, start: 0.26, duration: 0.24 },
    ];

    const now = context.currentTime;
    melody.forEach((note) => {
      const noteGain = context.createGain();
      const noteOsc = context.createOscillator();
      const startAt = now + note.start;
      const stopAt = startAt + note.duration;

      noteOsc.type = "triangle";
      noteOsc.frequency.setValueAtTime(note.frequency, startAt);
      noteOsc.frequency.exponentialRampToValueAtTime(
        Math.max(120, note.frequency * 1.02),
        stopAt
      );

      noteGain.gain.setValueAtTime(0.0001, startAt);
      noteGain.gain.exponentialRampToValueAtTime(startLevelVolume, startAt + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

      noteOsc.connect(noteGain);
      noteGain.connect(this.masterGain);
      noteOsc.start(startAt);
      noteOsc.stop(stopAt + 0.015);
      noteOsc.onended = () => {
        noteOsc.disconnect();
        noteGain.disconnect();
      };
    });
  }

  playStartLevel() {
    if (!this.settings.enabled) return;
    if (this.tryPlayStartLevelFromFile()) return;
    this.playStartLevelSynth();
  }

  playWinnerSynth() {
    const context = this.ensureContext();
    if (!context || !this.masterGain) return;
    if (!this.settings.enabled) return;
    if (context.state === "suspended") {
      context
        .resume()
        .then(() => this.playFinalWinner())
        .catch(() => {});
      return;
    }

    const winnerVolume = Math.max(
      0.01,
      Math.min(
        0.45,
        this.settings.generalVolume * 0.78
      )
    );

    const melody = [
      { frequency: 523.25, start: 0, duration: 0.16 },
      { frequency: 659.25, start: 0.12, duration: 0.16 },
      { frequency: 783.99, start: 0.24, duration: 0.18 },
      { frequency: 1046.5, start: 0.38, duration: 0.26 },
      { frequency: 1318.51, start: 0.56, duration: 0.36 },
    ];

    const now = context.currentTime;
    melody.forEach((note) => {
      const noteGain = context.createGain();
      const noteOsc = context.createOscillator();
      const startAt = now + note.start;
      const stopAt = startAt + note.duration;

      noteOsc.type = "triangle";
      noteOsc.frequency.setValueAtTime(note.frequency, startAt);
      noteOsc.frequency.exponentialRampToValueAtTime(
        Math.max(120, note.frequency * 1.04),
        stopAt
      );

      noteGain.gain.setValueAtTime(0.0001, startAt);
      noteGain.gain.exponentialRampToValueAtTime(winnerVolume, startAt + 0.03);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

      noteOsc.connect(noteGain);
      noteGain.connect(this.masterGain);
      noteOsc.start(startAt);
      noteOsc.stop(stopAt + 0.015);
      noteOsc.onended = () => {
        noteOsc.disconnect();
        noteGain.disconnect();
      };
    });
  }

  playFireworkBurstSynth() {
    const context = this.ensureContext();
    if (!context || !this.masterGain) return;
    if (!this.settings.enabled) return;
    if (context.state === "suspended") return;

    const fireVolume = Math.max(
      0.01,
      Math.min(
        0.34,
        this.settings.generalVolume * 0.62
      )
    );
    const now = context.currentTime;

    const popCount = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < popCount; i += 1) {
      const startAt = now + Math.random() * 0.24;
      const duration = 0.05 + Math.random() * 0.07;
      const stopAt = startAt + duration;
      const frequency = 360 + Math.random() * 1400;

      const popOsc = context.createOscillator();
      const popFilter = context.createBiquadFilter();
      const popGain = context.createGain();

      popOsc.type = Math.random() > 0.5 ? "square" : "sawtooth";
      popOsc.frequency.setValueAtTime(frequency, startAt);
      popOsc.frequency.exponentialRampToValueAtTime(
        Math.max(80, frequency * 0.48),
        stopAt
      );

      popFilter.type = "bandpass";
      popFilter.frequency.value = 900 + Math.random() * 2800;
      popFilter.Q.value = 3.5 + Math.random() * 4;

      const popAmp = fireVolume * (0.24 + Math.random() * 0.4);
      popGain.gain.setValueAtTime(0.0001, startAt);
      popGain.gain.exponentialRampToValueAtTime(popAmp, startAt + 0.02);
      popGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

      popOsc.connect(popFilter);
      popFilter.connect(popGain);
      popGain.connect(this.masterGain);
      popOsc.start(startAt);
      popOsc.stop(stopAt + 0.01);
      popOsc.onended = () => {
        popOsc.disconnect();
        popFilter.disconnect();
        popGain.disconnect();
      };
    }

    const boomOsc = context.createOscillator();
    const boomFilter = context.createBiquadFilter();
    const boomGain = context.createGain();
    const boomStart = now + 0.04;
    const boomStop = boomStart + 0.4;

    boomOsc.type = "sine";
    boomOsc.frequency.setValueAtTime(180 + Math.random() * 80, boomStart);
    boomOsc.frequency.exponentialRampToValueAtTime(42 + Math.random() * 20, boomStop);

    boomFilter.type = "lowpass";
    boomFilter.frequency.value = 260;
    boomFilter.Q.value = 0.8;

    boomGain.gain.setValueAtTime(0.0001, boomStart);
    boomGain.gain.exponentialRampToValueAtTime(fireVolume * 0.75, boomStart + 0.04);
    boomGain.gain.exponentialRampToValueAtTime(0.0001, boomStop);

    boomOsc.connect(boomFilter);
    boomFilter.connect(boomGain);
    boomGain.connect(this.masterGain);
    boomOsc.start(boomStart);
    boomOsc.stop(boomStop + 0.02);
    boomOsc.onended = () => {
      boomOsc.disconnect();
      boomFilter.disconnect();
      boomGain.disconnect();
    };
  }

  tryPlayFireworkBurstFromFile() {
    if (this.forceSynthEffects) return false;
    const template = this.ensureFireAudioElement();
    if (!template) return false;

    const fireVolume = Math.max(
      0,
      Math.min(
        1,
        this.settings.generalVolume
      )
    );
    if (fireVolume <= 0.001) return false;

    try {
      const burst = template.cloneNode(true);
      burst.preload = "auto";
      burst.volume = fireVolume;
      const playPromise = burst.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          this.playFireworkBurstSynth();
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  playFinalWinner() {
    if (!this.settings.enabled) return;
    if (this.tryPlayWinnerFromFile()) return;
    this.playWinnerSynth();
  }

  startFinalFireworks({ durationMs = null, intervalMs = 980 } = {}) {
    if (!this.settings.enabled) return;
    this.stopFinalFireworks();

    if (!this.tryPlayFireworkBurstFromFile()) {
      this.playFireworkBurstSynth();
    }

    if (typeof window !== "undefined") {
      this.finalFireworksInterval = window.setInterval(() => {
        if (!this.tryPlayFireworkBurstFromFile()) {
          this.playFireworkBurstSynth();
        }
      }, intervalMs);
      if (Number.isFinite(durationMs) && durationMs > 0) {
        this.finalFireworksStopTimeout = window.setTimeout(() => {
          this.stopFinalFireworks();
        }, durationMs);
      } else {
        this.finalFireworksStopTimeout = null;
      }
    }
  }

  stopFinalFireworks() {
    if (this.finalFireworksInterval) {
      globalThis.clearInterval(this.finalFireworksInterval);
      this.finalFireworksInterval = null;
    }
    if (this.finalFireworksStopTimeout) {
      globalThis.clearTimeout(this.finalFireworksStopTimeout);
      this.finalFireworksStopTimeout = null;
    }
  }
}

export const gameAudioEngine = new GameAudioEngine();
