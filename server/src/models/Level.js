import { Question } from "./Question.js";

export class Level {
  constructor(index, difficulty, timeLimitSec) {
    this.index = index;
    this.difficulty = difficulty; // Valeurs possibles: SIMPLE, MEDIUM, HARD
    this.timeLimitSec = timeLimitSec;
    this.questions = [];
    this.state = "NOT_STARTED"; // États possibles: NOT_STARTED, ACTIVE, LOCKED, ENDING, RESULTS
    this.startedAt = null;
    this.endsAt = null;
  }

  getQuestion(i) {
    return this.questions[i] || null;
  }

  toJSON() {
    return {
      index: this.index,
      difficulty: this.difficulty,
      timeLimitSec: this.timeLimitSec,
      questions: this.questions.map((q) => q.toJSON()),
      state: this.state,
      startedAt: this.startedAt,
      endsAt: this.endsAt,
    };
  }

  static fromJSON(data) {
    const level = new Level(data.index, data.difficulty, data.timeLimitSec);
    // Reconstruit correctement les questions pour conserver correctChoiceIndex.
    level.questions = (data.questions || []).map((q) => 
      typeof q.toJSON === 'function' ? q : Question.fromJSON(q)
    );
    level.state = data.state;
    level.startedAt = data.startedAt;
    level.endsAt = data.endsAt;
    return level;
  }
}
