export class Score {
  constructor(playerId) {
    this.playerId = playerId;
    this.total = 0;
    this.perLevel = {}; // levelIndex -> score
  }

  addLevelScore(levelIndex, score) {
    this.perLevel[levelIndex] = score;
    this.updateTotal();
  }

  addToTotal(delta) {
    this.total += delta;
  }

  updateTotal() {
    this.total = Object.values(this.perLevel).reduce((a, b) => a + b, 0);
  }

  toJSON() {
    return {
      playerId: this.playerId,
      total: this.total,
      perLevel: this.perLevel,
    };
  }

  static fromJSON(data) {
    const score = new Score(data.playerId);
    score.total = data.total;
    score.perLevel = data.perLevel;
    return score;
  }
}
