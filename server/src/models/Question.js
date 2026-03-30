export class Question {
  constructor(id, type, language, prompt, difficulty, pointsBase) {
    this.id = id;
    this.type = type; // Type de question: FLASH ou CODE
    this.language = language;
    this.prompt = prompt;
    this.difficulty = difficulty; // Difficulté: SIMPLE, MEDIUM, HARD
    this.pointsBase = pointsBase;

    // Champs propres aux questions FLASH.
    this.choices = [];
    this.correctChoiceIndex = -1;

    // Champs propres aux questions CODE.
    this.starterCode = "";
    this.tests = [];
    this.maxLines = 12;
  }

  isFlash() {
    return this.type === "FLASH";
  }

  isCode() {
    return this.type === "CODE";
  }

  toJSON() {
    const obj = {
      id: this.id,
      type: this.type,
      language: this.language,
      prompt: this.prompt,
      difficulty: this.difficulty,
      pointsBase: this.pointsBase,
    }
    if (this.isFlash()) {
      obj.choices = this.choices;
      obj.correctChoiceIndex = this.correctChoiceIndex;
    } else {
      obj.starterCode = this.starterCode;
      obj.tests = this.tests;
      obj.maxLines = this.maxLines;
    }

    return obj;
  }

  // Pour envoyer au client (sans les réponses correctes)
  toClientJSON() {
    const obj = {
      id: this.id,
      type: this.type,
      language: this.language,
      prompt: this.prompt,
      difficulty: this.difficulty,
      pointsBase: this.pointsBase,
    };

    if (this.isFlash()) {
      obj.choices = this.choices;
    } else {
      obj.starterCode = this.starterCode;
      obj.testCount = this.tests.length;
    }

    return obj;
  }

  static fromJSON(data) {
    const q = new Question(
      data.id,
      data.type,
      data.language,
      data.prompt,
      data.difficulty,
      data.pointsBase
    );

    if (data.type === "FLASH") {
      q.choices = data.choices || [];
      q.correctChoiceIndex = Number.isInteger(data.correctChoiceIndex)
        ? data.correctChoiceIndex
        : -1;
    } else {
      q.starterCode = data.starterCode || "";
      q.tests = data.tests || [];
      q.maxLines = Number.isInteger(data.maxLines) && data.maxLines > 0 ? data.maxLines : 12;
    }

    return q;
  }
}
