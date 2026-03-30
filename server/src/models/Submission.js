export class Submission {
  constructor(id, playerId, questionId, type, submittedAt) {
    this.id = id;
    this.playerId = playerId;
    this.questionId = questionId;
    this.type = type; // Type de question: FLASH ou CODE
    this.submittedAt = submittedAt;
    this.timeRemainingSec = null; // temps restant au moment de la soumission (si fourni par le client)
    this.payload = ""; // answer or code
    this.isAutoSubmit = false;
    this.passedTests = 0;
    this.totalTests = 0;
    this.status = "PENDING"; // États possibles: ACCEPTED, WRONG, COMPILE_ERROR, RUNTIME_ERROR
    this.compilationError = false; // Flag pour indiquer si le code ne compile pas
    this.scorePreview = null; // score calculé au moment de la soumission
    this.flashDebug = null; // debug validation FLASH
  }

  isCorrect() {
    if (this.type === "FLASH") {
      return this.status === "ACCEPTED";
    } else {
      // En CODE, la réponse est correcte si tous les tests passent.
      return this.passedTests === this.totalTests && this.status === "ACCEPTED";
    }
  }

  toJSON() {
    return {
      id: this.id,
      playerId: this.playerId,
      questionId: this.questionId,
      type: this.type,
      submittedAt: this.submittedAt,
      timeRemainingSec: this.timeRemainingSec,
      payload: this.payload,
      isAutoSubmit: this.isAutoSubmit,
      passedTests: this.passedTests,
      totalTests: this.totalTests,
      status: this.status,
      compilationError: this.compilationError,
      scorePreview: this.scorePreview,
      flashDebug: this.flashDebug,
    };
  }

  static fromJSON(data) {
    const s = new Submission(
      data.id,
      data.playerId,
      data.questionId,
      data.type,
      data.submittedAt
    );
    s.payload = data.payload;
    s.timeRemainingSec = Number.isFinite(Number(data.timeRemainingSec))
      ? Number(data.timeRemainingSec)
      : null;
    s.isAutoSubmit = data.isAutoSubmit;
    s.passedTests = data.passedTests;
    s.totalTests = data.totalTests;
    s.status = data.status;
    s.compilationError = data.compilationError || false;
    s.scorePreview = Number.isFinite(Number(data.scorePreview))
      ? Number(data.scorePreview)
      : null;
    s.flashDebug = data.flashDebug || null;
    return s;
  }
}
