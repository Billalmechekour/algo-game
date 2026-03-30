import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const QUESTIONS_DIR = path.join(__dirname, "../src/questions");

const LANGUAGES = ["python", "java", "c", "cpp"];
const DIFFICULTIES = ["simple", "medium", "hard"];
const TYPES = ["flash", "code"];
const EXPECTED_COUNT_PER_FILE = 30;

const EXPECTED_POINTS = {
  simple: { flash: 10, code: 15 },
  medium: { flash: 15, code: 20 },
  hard: { flash: 20, code: 25 },
};

function normalizePrompt(prompt) {
  return String(prompt || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function expectedFiles() {
  const out = [];
  for (const language of LANGUAGES) {
    for (const difficulty of DIFFICULTIES) {
      for (const type of TYPES) {
        out.push({
          language,
          difficulty,
          type,
          fileName: `${language}_${difficulty}_${type}.json`,
        });
      }
    }
  }
  return out;
}

function validateFlashQuestion(question, context, errors) {
  if (!Array.isArray(question.choices) || question.choices.length !== 4) {
    errors.push(`${context}: "choices" doit contenir exactement 4 choix`);
  } else if (question.choices.some((choice) => !isNonEmptyString(choice))) {
    errors.push(`${context}: chaque choix FLASH doit être une chaîne non vide`);
  }

  if (
    !Number.isInteger(question.correctChoiceIndex) ||
    question.correctChoiceIndex < 0 ||
    question.correctChoiceIndex > 3
  ) {
    errors.push(`${context}: "correctChoiceIndex" doit être un entier entre 0 et 3`);
  }
}

function validateCodeQuestion(question, context, errors) {
  if (!isNonEmptyString(question.starterCode)) {
    errors.push(`${context}: "starterCode" manquant ou vide`);
  }

  if (!Number.isInteger(question.maxLines) || question.maxLines <= 0) {
    errors.push(`${context}: "maxLines" doit etre un entier > 0`);
  }

  if (!Array.isArray(question.tests) || question.tests.length < 3) {
    errors.push(`${context}: "tests" doit contenir au moins 3 cas`);
    return;
  }

  question.tests.forEach((test, idx) => {
    const testContext = `${context} -> test #${idx + 1}`;
    if (!test || typeof test !== "object") {
      errors.push(`${testContext}: test invalide`);
      return;
    }

    if (!isNonEmptyString(test.input)) {
      errors.push(`${testContext}: "input" manquant ou vide`);
    }
    if (!isNonEmptyString(test.expected)) {
      errors.push(`${testContext}: "expected" manquant ou vide`);
    }
    if (!isNonEmptyString(test.description)) {
      errors.push(`${testContext}: "description" manquante ou vide`);
    }
  });
}

function validate() {
  const errors = [];
  const files = expectedFiles();
  const globalIds = new Map();

  for (const info of files) {
    const filePath = path.join(QUESTIONS_DIR, info.fileName);
    if (!fs.existsSync(filePath)) {
      errors.push(`Fichier manquant: ${info.fileName}`);
      continue;
    }

    let payload;
    try {
      payload = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (error) {
      errors.push(`JSON invalide (${info.fileName}): ${error.message}`);
      continue;
    }

    if (!Array.isArray(payload)) {
      errors.push(`${info.fileName}: le contenu doit être un tableau`);
      continue;
    }

    if (payload.length !== EXPECTED_COUNT_PER_FILE) {
      errors.push(
        `${info.fileName}: ${EXPECTED_COUNT_PER_FILE} questions attendues, ${payload.length} trouvées`
      );
    }

    const promptSet = new Set();
    const expectedType = info.type.toUpperCase();
    const expectedDifficulty = info.difficulty.toUpperCase();
    const expectedPoints = EXPECTED_POINTS[info.difficulty][info.type];

    payload.forEach((question, index) => {
      const context = `${info.fileName} #${index + 1}`;

      if (!question || typeof question !== "object") {
        errors.push(`${context}: question invalide`);
        return;
      }

      if (!isNonEmptyString(question.id)) {
        errors.push(`${context}: "id" manquant ou vide`);
      } else if (globalIds.has(question.id)) {
        errors.push(
          `${context}: id dupliqué "${question.id}" déjà utilisé dans ${globalIds.get(question.id)}`
        );
      } else {
        globalIds.set(question.id, info.fileName);
      }

      if (question.type !== expectedType) {
        errors.push(`${context}: "type" attendu=${expectedType}, reçu=${question.type}`);
      }

      if (question.language !== info.language) {
        errors.push(
          `${context}: "language" attendu=${info.language}, reçu=${question.language}`
        );
      }

      if (question.difficulty !== expectedDifficulty) {
        errors.push(
          `${context}: "difficulty" attendu=${expectedDifficulty}, reçu=${question.difficulty}`
        );
      }

      if (question.pointsBase !== expectedPoints) {
        errors.push(
          `${context}: "pointsBase" attendu=${expectedPoints}, reçu=${question.pointsBase}`
        );
      }

      if (!isNonEmptyString(question.prompt)) {
        errors.push(`${context}: "prompt" manquant ou vide`);
      } else {
        const key = normalizePrompt(question.prompt);
        if (promptSet.has(key)) {
          errors.push(`${context}: prompt dupliqué dans le bucket`);
        } else {
          promptSet.add(key);
        }
      }

      if (expectedType === "FLASH") {
        validateFlashQuestion(question, context, errors);
      } else {
        validateCodeQuestion(question, context, errors);
      }
    });
  }

  if (errors.length > 0) {
    console.error("Validation de la banque de questions: ECHEC");
    errors.forEach((error) => console.error(` - ${error}`));
    process.exit(1);
  }

  console.log("Validation de la banque de questions: OK");
  console.log(` - Fichiers validés: ${files.length}`);
  console.log(` - IDs uniques: ${globalIds.size}`);
}

validate();
