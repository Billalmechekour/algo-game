export class GameConfig {
  constructor(language, levelCount, questionsPerLevel, questionType, timePerLevelSec) {
    this.language = typeof language === "string" ? language.toLowerCase().trim() : language;
    this.levelCount = Number.parseInt(levelCount, 10);
    this.questionsPerLevel = Number.parseInt(questionsPerLevel, 10);
    const normalizedType =
      typeof questionType === "string" ? questionType.toLowerCase().trim() : "mixte";
    this.questionType = normalizedType === "mixed" ? "mixte" : normalizedType;
    this.timePerLevelSec = Number.parseInt(timePerLevelSec, 10);
  }

  isValid() {
    const validLanguages = ["python", "java", "c", "cpp"];
    const validLevelCounts = [3, 6, 9];
    const validQuestionsPerLevel = [1, 2, 3];
    const validQuestionTypes = ["flash", "code", "mixte"];
    const minTime = 30;
    const maxTime = 300;

    return (
      validLanguages.includes(this.language) &&
      validLevelCounts.includes(this.levelCount) &&
      validQuestionsPerLevel.includes(this.questionsPerLevel) &&
      validQuestionTypes.includes(this.questionType) &&
      this.timePerLevelSec >= minTime &&
      this.timePerLevelSec <= maxTime
    );
  }

  toJSON() {
    return {
      language: this.language,
      levelCount: this.levelCount,
      questionsPerLevel: this.questionsPerLevel,
      questionType: this.questionType,
      timePerLevelSec: this.timePerLevelSec,
    };
  }

  static fromJSON(data) {
    return new GameConfig(
      data.language,
      data.levelCount,
      data.questionsPerLevel,
      data.questionType ?? "mixte",
      data.timePerLevelSec
    );
  }
}
