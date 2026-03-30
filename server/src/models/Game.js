import { Score } from "./Score.js";
import { Level } from "./Level.js";

export class Game {
  constructor(id, roomId, language) {
    this.id = id;
    this.roomId = roomId;
    this.language = language;
    this.levels = [];
    this.currentLevelIndex = -1;
    this.status = "IN_PROGRESS";
    this.scores = {}; // playerId -> Score
    this.playerNames = {}; // playerId -> display name (participants initiaux)
    this.submissions = {}; // levelIndex -> { questionId -> [Submission] }
    this.draftAnswers = {}; // levelIndex -> { playerId -> { questionId -> draft payload } }
    this.startedAt = Date.now();
  }

  getCurrentLevel() {
    if (this.currentLevelIndex >= 0 && this.currentLevelIndex < this.levels.length) {
      return this.levels[this.currentLevelIndex];
    }
    return null;
  }

  nextLevel() {
    this.currentLevelIndex++;
    return this.currentLevelIndex < this.levels.length;
  }

  isFinished() {
    return this.status === "FINISHED";
  }

  toJSON() {
    return {
      id: this.id,
      roomId: this.roomId,
      language: this.language,
      levels: this.levels.map((l) => l.toJSON()),
      currentLevelIndex: this.currentLevelIndex,
      status: this.status,
      scores: Object.entries(this.scores).reduce((acc, [key, score]) => {
        acc[key] = score.toJSON();
        return acc;
      }, {}),
      playerNames: this.playerNames,
      submissions: this.submissions,
      draftAnswers: this.draftAnswers,
      startedAt: this.startedAt,
    };
  }

  static fromJSON(data) {
    const game = new Game(data.id, data.roomId, data.language);
    // Reconstruit correctement les niveaux pour conserver correctChoiceIndex dans les questions.
    game.levels = (data.levels || []).map((l) => 
      typeof l.toJSON === 'function' ? l : Level.fromJSON(l)
    );
    game.currentLevelIndex = data.currentLevelIndex;
    game.status = data.status;
    game.scores = Object.entries(data.scores || {}).reduce((acc, [key, score]) => {
      acc[key] = Score.fromJSON(score);
      return acc;
    }, {});
    game.playerNames = data.playerNames || {};
    game.submissions = data.submissions || {};
    game.draftAnswers = data.draftAnswers || {};
    game.startedAt = data.startedAt;
    return game;
  }
}
