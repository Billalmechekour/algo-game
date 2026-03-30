export class TimerManager {
  constructor(durationSec, onTick, onEnd) {
    this.durationSec = durationSec;
    this.timeRemaining = durationSec;
    this.onTick = onTick;
    this.onEnd = onEnd;
    this.interval = null;
    this.isPaused = false;
    this.startedAt = null;
    this.pausedAt = null;
  }

  start() {
    this.startedAt = Date.now();
    this.isPaused = false;

    // Envoyer le premier tick immédiatement
    this.onTick(this.timeRemaining);

    // Puis tous les secondes
    this.interval = setInterval(() => {
      this.timeRemaining--;

      if (this.timeRemaining <= 0) {
        this.timeRemaining = 0;
        // Envoyer explicitement le tick 0 pour permettre
        // aux clients de déclencher l'auto-soumission locale.
        this.onTick(this.timeRemaining);
        this.stop();
        this.onEnd();
      } else {
        this.onTick(this.timeRemaining);
      }
    }, 1000);
  }

  pause() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isPaused = true;
    this.pausedAt = Date.now();
  }

  resume() {
    if (!this.isPaused) return;

    this.isPaused = false;
    this.startedAt = Date.now() - (this.durationSec - this.timeRemaining) * 1000;

    // Redémarrer l'intervalle
    this.interval = setInterval(() => {
      this.timeRemaining--;

      if (this.timeRemaining <= 0) {
        this.timeRemaining = 0;
        // Même comportement qu'au start: tick 0 avant la fin.
        this.onTick(this.timeRemaining);
        this.stop();
        this.onEnd();
      } else {
        this.onTick(this.timeRemaining);
      }
    }, 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getTimeRemaining() {
    return Math.max(0, this.timeRemaining);
  }
}
