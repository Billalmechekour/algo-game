import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Question } from "../models/Question.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const QUESTIONS_DIR = path.join(__dirname, "../questions");

// Cache pour les banques de questions
const questionCache = {};

function normalizeQuestionType(questionType) {
  const normalized = typeof questionType === "string"
    ? questionType.toLowerCase().trim()
    : "mixte";

  if (normalized === "mixed" || normalized === "mix") return "mixte";
  if (normalized === "flash" || normalized === "code" || normalized === "mixte") {
    return normalized;
  }
  return "mixte";
}

export class QuestionBank {
  static cloneQuestion(question) {
    if (!question) return null;
    if (question instanceof Question) {
      return Question.fromJSON(question.toJSON());
    }
    return Question.fromJSON(question);
  }

  static shuffleFlashChoices(question) {
    if (!question || !question.isFlash()) {
      return question;
    }

    const choices = Array.isArray(question.choices) ? [...question.choices] : [];
    if (choices.length <= 1) {
      return question;
    }

    const currentCorrectIndex = Number(question.correctChoiceIndex);
    const hasValidCorrectIndex =
      Number.isInteger(currentCorrectIndex) &&
      currentCorrectIndex >= 0 &&
      currentCorrectIndex < choices.length;

    const indexedChoices = choices.map((choice, index) => ({
      choice,
      originalIndex: index,
    }));

    for (let i = indexedChoices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indexedChoices[i], indexedChoices[j]] = [indexedChoices[j], indexedChoices[i]];
    }

    const sameOrderAsSource = indexedChoices.every(
      (item, index) => item.originalIndex === index
    );
    if (sameOrderAsSource && indexedChoices.length > 1) {
      [indexedChoices[0], indexedChoices[1]] = [indexedChoices[1], indexedChoices[0]];
    }

    question.choices = indexedChoices.map((item) => item.choice);
    question.correctChoiceIndex = hasValidCorrectIndex
      ? indexedChoices.findIndex((item) => item.originalIndex === currentCorrectIndex)
      : -1;

    return question;
  }

  static prepareQuestionsForGame(questions) {
    return (Array.isArray(questions) ? questions : [])
      .map((question) => this.cloneQuestion(question))
      .map((question) => this.shuffleFlashChoices(question));
  }

  static loadQuestions(language, difficulty, questionType) {
    const normalizedLanguage = String(language || "").toLowerCase().trim();
    const normalizedDifficulty = String(difficulty || "").toUpperCase().trim();
    const normalizedType = String(questionType || "").toLowerCase().trim();
    const difficultyFileName = normalizedDifficulty.toLowerCase();
    const cacheKey = `${normalizedLanguage}_${difficultyFileName}_${normalizedType}`;

    if (questionCache[cacheKey]) {
      return questionCache[cacheKey];
    }

    const filePath = path.join(
      QUESTIONS_DIR,
      `${normalizedLanguage}_${difficultyFileName}_${normalizedType}.json`
    );

    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Fichier introuvable: ${path.basename(filePath)}`);
      }

      const data = fs.readFileSync(filePath, "utf-8");
      const questions = JSON.parse(data).map((q) => Question.fromJSON(q));
      questionCache[cacheKey] = questions;
      return questions;
    } catch (error) {
      console.error(
        `Erreur chargement questions ${normalizedLanguage} ${normalizedDifficulty} ${normalizedType}:`,
        error
      );
      return [];
    }
  }

  static shuffleQuestions(questions) {
    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  static pickQuestionsFromPool(pool, count, poolLabel = "questions", context = "") {
    if (!Array.isArray(pool) || pool.length === 0) {
      throw new Error(`Aucune question ${poolLabel} disponible${context ? ` (${context})` : ""}`);
    }

    if (pool.length < count) {
      throw new Error(
        `Pas assez de questions ${poolLabel} disponibles (${pool.length} < ${count})${context ? ` (${context})` : ""}`
      );
    }

    const selected = this.shuffleQuestions(pool).slice(0, count);
    return this.prepareQuestionsForGame(selected);
  }

  static selectRandomQuestions(language, difficulty, count, questionType = "mixte") {
    const parsedCount = Number.parseInt(count, 10);
    const safeCount = Number.isInteger(parsedCount) && parsedCount > 0 ? parsedCount : 1;
    const normalizedType = normalizeQuestionType(questionType);
    const flashQuestions = this.loadQuestions(language, difficulty, "flash");
    const codeQuestions = this.loadQuestions(language, difficulty, "code");
    const context = `${language}/${String(difficulty || "").toUpperCase()}`;

    if (normalizedType === "flash") {
      return this.pickQuestionsFromPool(flashQuestions, safeCount, "flash", context);
    }

    if (normalizedType === "code") {
      return this.pickQuestionsFromPool(codeQuestions, safeCount, "code", context);
    }

    // Mode mixte
    if (safeCount === 1) {
      // Tirage aléatoire 50/50 entre FLASH et CODE pour 1 seule question
      const prefersFlash = Math.random() < 0.5;
      const primaryType = prefersFlash ? "flash" : "code";
      const primaryPool = prefersFlash ? flashQuestions : codeQuestions;
      const fallbackType = prefersFlash ? "code" : "flash";
      const fallbackPool = prefersFlash ? codeQuestions : flashQuestions;

      if (primaryPool.length > 0) {
        return this.pickQuestionsFromPool(primaryPool, 1, primaryType, context);
      }
      return this.pickQuestionsFromPool(fallbackPool, 1, fallbackType, context);
    }

    if (safeCount === 2) {
      const oneFlash = this.pickQuestionsFromPool(flashQuestions, 1, "flash", context);
      const oneCode = this.pickQuestionsFromPool(codeQuestions, 1, "code", context);
      return this.shuffleQuestions([...oneFlash, ...oneCode]);
    }

    const dominantType = Math.random() < 0.5 ? "flash" : "code";
    const dominantPool = dominantType === "flash" ? flashQuestions : codeQuestions;
    const alternateType = dominantType === "flash" ? "code" : "flash";
    const alternatePool = alternateType === "flash" ? flashQuestions : codeQuestions;
    const dominantQuestions = this.pickQuestionsFromPool(
      dominantPool,
      safeCount - 1,
      dominantType,
      context
    );
    const alternateQuestion = this.pickQuestionsFromPool(
      alternatePool,
      1,
      alternateType,
      context
    );

    return this.shuffleQuestions([...dominantQuestions, ...alternateQuestion]);
  }

  static getDifficulty(levelIndex, totalLevels) {
    // Diviser les niveaux en 3 groupes égaux
    const groupSize = Math.ceil(totalLevels / 3);
    
    if (levelIndex < groupSize) return "SIMPLE";
    if (levelIndex < 2 * groupSize) return "MEDIUM";
    return "HARD";
  }
}
