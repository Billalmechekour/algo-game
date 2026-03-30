import { nanoid } from "nanoid";
import { Game } from "../models/Game.js";
import { Level } from "../models/Level.js";
import { Score } from "../models/Score.js";
import { Submission } from "../models/Submission.js";
import { QuestionBank } from "./QuestionBank.js";
import { ScoreCalculator } from "./ScoreCalculator.js";
import { CodeEvaluator } from "./CodeEvaluator.js";

const games = new Map();

function getLevelSubmissions(game, levelIndex) {
  if (!game.submissions[levelIndex]) {
    game.submissions[levelIndex] = {};
  }
  return game.submissions[levelIndex];
}

function ensureQuestionBucket(game, levelIndex, questionId) {
  const levelSubmissions = getLevelSubmissions(game, levelIndex);
  if (!levelSubmissions[questionId]) {
    levelSubmissions[questionId] = [];
  }
  return levelSubmissions[questionId];
}

function getLevelDraftAnswers(game, levelIndex) {
  if (!game.draftAnswers || typeof game.draftAnswers !== "object") {
    game.draftAnswers = {};
  }
  if (!game.draftAnswers[levelIndex]) {
    game.draftAnswers[levelIndex] = {};
  }
  return game.draftAnswers[levelIndex];
}

function getLatestSubmissionForPlayer(levelSubmissions, questionId, playerId) {
  const submissions = levelSubmissions?.[questionId];
  if (!Array.isArray(submissions) || submissions.length === 0) {
    return null;
  }

  // On prend la dernière soumission réellement enregistrée pour ce joueur.
  // Cela garantit que la dernière soumission prévaut, même si deux soumissions ont
  // exactement le même submittedAt (même milliseconde).
  for (let i = submissions.length - 1; i >= 0; i -= 1) {
    const submission = submissions[i];
    if (submission.playerId === playerId) {
      return submission;
    }
  }
  return null;
}

function getDifficultyCoeff(difficulty) {
  if (difficulty === "MEDIUM") return 1.2;
  if (difficulty === "HARD") return 1.5;
  return 1.0;
}

function parseStrictInteger(value) {
  if (Number.isSafeInteger(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseNonNegativeNumber(value) {
  if (value == null) return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

function normalizeSubmittedAnswer(answerInput) {
  if (answerInput && typeof answerInput === "object" && !Array.isArray(answerInput)) {
    return {
      answer:
        answerInput.answer == null
          ? ""
          : String(answerInput.answer),
      answerIndex: parseStrictInteger(answerInput.answerIndex),
      answerText:
        typeof answerInput.answerText === "string"
          ? answerInput.answerText
          : "",
      timeRemainingSec: parseNonNegativeNumber(answerInput.timeRemainingSec),
    };
  }

  return {
    answer: answerInput == null ? "" : String(answerInput),
    answerIndex: null,
    answerText: "",
    timeRemainingSec: null,
  };
}

function normalizeFlashText(value) {
  if (value == null) return "";
  return String(value)
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function hasMeaningfulFlashAnswer(submittedAnswer, choiceCount = 0) {
  const explicitIndex = submittedAnswer?.answerIndex;
  if (
    Number.isInteger(explicitIndex) &&
    explicitIndex >= 0 &&
    (choiceCount <= 0 || explicitIndex < choiceCount)
  ) {
    return true;
  }

  const normalizedAnswer = normalizeFlashText(submittedAnswer?.answer);
  const normalizedAnswerText = normalizeFlashText(submittedAnswer?.answerText);
  return Boolean(normalizedAnswer || normalizedAnswerText);
}

function evaluateFlashAnswer(question, submittedAnswer) {
  const choices = Array.isArray(question?.choices) ? question.choices : [];
  const correctIndex = Number(question?.correctChoiceIndex);
  const choiceCount = choices.length;
  const answer = submittedAnswer?.answer || "";
  const explicitAnswerIndex = submittedAnswer?.answerIndex;
  const answerText = submittedAnswer?.answerText || "";
  const parsed = parseStrictInteger(answer);

  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= choiceCount) {
    return {
      isCorrect: false,
      mode: "invalid_question",
      parsedIndex: Number.isInteger(parsed) ? parsed : null,
      resolvedIndex: null,
      correctIndex: null,
    };
  }

  const correctChoice = choices[correctIndex];
  const normalizedAnswer = normalizeFlashText(answerText || answer);
  const normalizedCorrectChoice = normalizeFlashText(correctChoice);
  const normalizedChoices = choices.map((choice) => normalizeFlashText(choice));
  const normalizedAnswerText = normalizeFlashText(answerText);
  const normalizedRawAnswer = normalizeFlashText(answer);
  const hasExplicitIndex =
    Number.isInteger(explicitAnswerIndex) &&
    explicitAnswerIndex >= 0 &&
    explicitAnswerIndex < choiceCount;

  // Si le client fournit le texte de la réponse, on le privilégie:
  // cela évite les ambiguïtés avec les choix numériques ("0", "1", ...).
  if (normalizedAnswerText) {
    const textChoiceIndex = normalizedChoices.findIndex(
      (choice) => choice === normalizedAnswerText
    );
    if (textChoiceIndex >= 0) {
      if (hasExplicitIndex && explicitAnswerIndex !== textChoiceIndex) {
        const indexSaysCorrect = explicitAnswerIndex === correctIndex;
        const textSaysCorrect = textChoiceIndex === correctIndex;
        const resolvedIndex = indexSaysCorrect
          ? explicitAnswerIndex
          : (textSaysCorrect ? textChoiceIndex : explicitAnswerIndex);
        return {
          isCorrect: indexSaysCorrect || textSaysCorrect,
          mode: "index_text_conflict_either",
          parsedIndex: explicitAnswerIndex,
          resolvedIndex,
          correctIndex,
          correctChoice,
          normalizedAnswer,
          normalizedCorrectChoice,
        };
      }
      return {
        isCorrect: textChoiceIndex === correctIndex,
        mode: "choice_text_explicit",
        parsedIndex: Number.isInteger(parsed) ? parsed : null,
        resolvedIndex: textChoiceIndex,
        correctIndex,
        correctChoice,
        normalizedAnswer,
        normalizedCorrectChoice,
      };
    }
  }

  // Format standard du client actuel: answerIndex explicite en base 0.
  // On le traite après answerText pour rester robuste si un client envoie
  // un index ambigu mais un texte de réponse valide.
  if (hasExplicitIndex) {
    return {
      isCorrect: explicitAnswerIndex === correctIndex,
      mode: "index_explicit_0_based",
      parsedIndex: explicitAnswerIndex,
      resolvedIndex: explicitAnswerIndex,
      correctIndex,
      correctChoice,
      normalizedAnswer,
      normalizedCorrectChoice,
    };
  }

  // Repli sur le texte brut contenu dans "answer".
  if (normalizedRawAnswer) {
    const rawChoiceIndex = normalizedChoices.findIndex(
      (choice) => choice === normalizedRawAnswer
    );
    if (rawChoiceIndex >= 0) {
      if (hasExplicitIndex && explicitAnswerIndex !== rawChoiceIndex) {
        const indexSaysCorrect = explicitAnswerIndex === correctIndex;
        const rawSaysCorrect = rawChoiceIndex === correctIndex;
        const resolvedIndex = indexSaysCorrect
          ? explicitAnswerIndex
          : (rawSaysCorrect ? rawChoiceIndex : explicitAnswerIndex);
        return {
          isCorrect: indexSaysCorrect || rawSaysCorrect,
          mode: "index_raw_conflict_either",
          parsedIndex: explicitAnswerIndex,
          resolvedIndex,
          correctIndex,
          correctChoice,
          normalizedAnswer,
          normalizedCorrectChoice,
        };
      }
      return {
        isCorrect: rawChoiceIndex === correctIndex,
        mode: "choice_text_raw",
        parsedIndex: Number.isInteger(parsed) ? parsed : null,
        resolvedIndex: rawChoiceIndex,
        correctIndex,
        correctChoice,
        normalizedAnswer,
        normalizedCorrectChoice,
      };
    }
  }

  // Compatibilité: anciens clients qui envoient uniquement answer en 1-based ("1".."N")
  if (Number.isInteger(parsed) && parsed > 0 && parsed <= choiceCount) {
    const resolvedIndex = parsed - 1;
    return {
      isCorrect: resolvedIndex === correctIndex,
      mode: "index_1_based",
      parsedIndex: parsed,
      resolvedIndex,
      correctIndex,
      correctChoice,
      normalizedAnswer,
      normalizedCorrectChoice,
    };
  }

  // Compatibilité: clients qui envoient uniquement answer en 0-based ("0".."N-1")
  if (Number.isInteger(parsed) && parsed >= 0 && parsed < choiceCount) {
    return {
      isCorrect: parsed === correctIndex,
      mode: "index_0_based",
      parsedIndex: parsed,
      resolvedIndex: parsed,
      correctIndex,
      correctChoice,
      normalizedAnswer,
      normalizedCorrectChoice,
    };
  }

  // Compatibilité: anciens clients qui envoient le texte du choix
  if (!normalizedAnswer) {
    return {
      isCorrect: false,
      mode: "empty",
      parsedIndex: Number.isInteger(parsed) ? parsed : null,
      resolvedIndex: null,
      correctIndex,
      correctChoice,
      normalizedAnswer,
      normalizedCorrectChoice,
    };
  }

  return {
    isCorrect: normalizedAnswer === normalizedCorrectChoice,
    mode: "choice_text",
    parsedIndex: Number.isInteger(parsed) ? parsed : null,
    resolvedIndex: null,
    correctIndex,
    correctChoice,
    normalizedAnswer,
    normalizedCorrectChoice,
  };
}

function getMaxQuestionScore(question, levelDifficulty = null) {
  const effectiveDifficulty = levelDifficulty || question?.difficulty;
  const coeff = getDifficultyCoeff(effectiveDifficulty);
  const maxBeforeCoeff = question?.type === "CODE" ? 120 : 70;
  return Math.round(maxBeforeCoeff * coeff);
}

export function createGame(room) {
  const gameId = nanoid();
  const game = new Game(gameId, room.code, room.config.language);

  const levelCount = room.config.levelCount;
  for (let i = 0; i < levelCount; i++) {
    const difficulty = QuestionBank.getDifficulty(i, levelCount);
    const level = new Level(i, difficulty, room.config.timePerLevelSec);
    level.questions = QuestionBank.selectRandomQuestions(
      room.config.language,
      difficulty,
      room.config.questionsPerLevel,
      room.config.questionType
    );
    game.levels.push(level);
  }

  room.players.forEach((player) => {
    game.scores[player.socketId] = new Score(player.socketId);
    game.playerNames[player.socketId] = player.name || "Joueur";
  });

  game.levels.forEach((_, idx) => {
    game.submissions[idx] = {};
    game.draftAnswers[idx] = {};
  });

  games.set(gameId, game);
  return game;
}

export function getGame(gameId) {
  return games.get(gameId) || null;
}

export function startNextLevel(gameId) {
  const game = games.get(gameId);
  if (!game) {
    return { ok: false };
  }

  if (!game.nextLevel()) {
    game.status = "FINISHED";
    return { ok: false };
  }

  const level = game.getCurrentLevel();
  if (!level) {
    return { ok: false };
  }

  level.state = "ACTIVE";
  level.startedAt = Date.now();
  level.endsAt = Date.now() + level.timeLimitSec * 1000;
  getLevelDraftAnswers(game, level.index);

  return {
    ok: true,
    level,
    questions: level.questions || [],
  };
}

export function updateAnswerDraft(gameId, levelIndex, playerId, questionId, answerInput) {
  const game = games.get(gameId);
  if (!game) return false;

  const level = game.levels[levelIndex];
  if (!level) return false;
  if (!game.scores[playerId]) return false;

  const question = level.questions.find((q) => q.id === questionId);
  if (!question) return false;

  if (level.state !== "ACTIVE" && level.state !== "LOCKED") {
    return false;
  }

  const normalized = normalizeSubmittedAnswer(answerInput);
  const levelDrafts = getLevelDraftAnswers(game, levelIndex);
  if (!levelDrafts[playerId]) {
    levelDrafts[playerId] = {};
  }

  levelDrafts[playerId][questionId] = {
    answer: normalized.answer,
    answerIndex: Number.isInteger(normalized.answerIndex) ? normalized.answerIndex : null,
    answerText: normalized.answerText || "",
    timeRemainingSec: Number.isFinite(Number(normalized.timeRemainingSec))
      ? Math.max(0, Number(normalized.timeRemainingSec))
      : null,
    type: question.type,
    updatedAt: Date.now(),
  };
  return true;
}

export async function submitAnswer(gameId, levelIndex, playerId, questionId, answerInput) {
  const game = games.get(gameId);
  if (!game) return null;

  const level = game.levels[levelIndex];
  if (!level) return null;
  if (!game.scores[playerId]) return null;

  const question = level.questions.find((q) => q.id === questionId);
  if (!question) return null;

  const levelSubmissions = getLevelSubmissions(game, levelIndex);
  const latestSubmission = getLatestSubmissionForPlayer(
    levelSubmissions,
    questionId,
    playerId
  );

  // Soumission idempotente: si le niveau n'est plus actif, on renvoie
  // la dernière soumission existante au lieu de signaler une erreur.
  if (level.state !== "ACTIVE") {
    return latestSubmission || null;
  }

  const submission = new Submission(
    nanoid(),
    playerId,
    questionId,
    question.type,
    Date.now()
  );
  const submittedAnswer = normalizeSubmittedAnswer(answerInput);
  submission.payload = submittedAnswer.answer;
  submission.timeRemainingSec = submittedAnswer.timeRemainingSec;

  if (question.isFlash()) {
    const choiceCount = Array.isArray(question.choices) ? question.choices.length : 0;
    const hasAnswer = hasMeaningfulFlashAnswer(submittedAnswer, choiceCount);

    // Ne pas enregistrer une réponse vide en FLASH:
    // - si une vraie réponse existe déjà, on la conserve
    // - sinon on écarte cette soumission vide
    if (!hasAnswer) {
      return latestSubmission || null;
    }

    const flashEval = evaluateFlashAnswer(question, submittedAnswer);
    submission.flashDebug = {
      mode: flashEval.mode,
      receivedAnswer: submittedAnswer.answer,
      receivedAnswerIndex:
        Number.isInteger(submittedAnswer.answerIndex)
          ? submittedAnswer.answerIndex
          : null,
      receivedAnswerText: submittedAnswer.answerText || null,
      parsedIndex: flashEval.parsedIndex,
      resolvedIndex: flashEval.resolvedIndex,
      correctChoiceIndex: flashEval.correctIndex,
      correctChoice: flashEval.correctChoice,
      normalizedAnswer: flashEval.normalizedAnswer,
      normalizedCorrectChoice: flashEval.normalizedCorrectChoice,
    };
    submission.status = flashEval.isCorrect ? "ACCEPTED" : "WRONG";
  } else if (!submittedAnswer.answer || !String(submittedAnswer.answer).trim()) {
    submission.status = "WRONG";
    submission.totalTests = question.tests?.length || 0;
    submission.passedTests = 0;
  } else {
    const evalResult = await CodeEvaluator.runTests(
      submittedAnswer.answer,
      question,
      game.language
    );
    if (!evalResult.ok) {
      if (evalResult?.errorType === "COMPILE") {
        submission.status = "COMPILE_ERROR";
        submission.totalTests = evalResult.totalTests || question.tests?.length || 0;
        submission.passedTests = 0;
        submission.compilationError = true;
      } else {
        submission.status = "RUNTIME_ERROR";
        submission.totalTests = evalResult.totalTests || question.tests?.length || 0;
        submission.passedTests = Number(evalResult.passedTests) || 0;
        submission.compilationError = false;
      }
    } else {
      submission.status = evalResult.runtimeError ? "RUNTIME_ERROR" : "ACCEPTED";
      submission.totalTests = evalResult.totalTests || question.tests?.length || 0;
      submission.passedTests = evalResult.passedTests || 0;
      submission.compilationError = false;
    }
  }

  ensureQuestionBucket(game, levelIndex, questionId).push(submission);

  // Calcul immédiat du score de la soumission (utile pour fiabiliser l'affichage en fin de niveau)
  submission.scorePreview = ScoreCalculator.calculateScore(
    submission,
    question,
    level.timeLimitSec,
    level.startedAt,
    level.difficulty
  );

  // IMPORTANT:
  // Ne pas verrouiller le niveau dès que tous les joueurs ont soumis.
  // On autorise la modification des réponses jusqu'à la fin du timer.
  // Le niveau passera à ENDING/RESULTS uniquement dans endLevel().

  return submission;
}

export async function runCodePreview(
  gameId,
  levelIndex,
  playerId,
  questionId,
  code
) {
  const game = games.get(gameId);
  if (!game) {
    return { ok: false, error: "Partie introuvable" };
  }

  const level = game.levels[levelIndex];
  if (!level || (level.state !== "ACTIVE" && level.state !== "LOCKED")) {
    return { ok: false, error: "Niveau non actif" };
  }

  if (!game.scores[playerId]) {
    return { ok: false, error: "Joueur non autorisé" };
  }

  const question = level.questions.find((q) => q.id === questionId);
  if (!question) {
    return { ok: false, error: "Question introuvable" };
  }
  if (!question.isCode()) {
    return { ok: false, error: "Prévisualisation disponible uniquement pour les questions CODE" };
  }

  const sourceCode = typeof code === "string" ? code : "";
  if (!sourceCode.trim()) {
    return { ok: false, error: "Code vide" };
  }

  return CodeEvaluator.runPreview(sourceCode, question, game.language);
}

export async function autoSubmitMissingAnswers(gameId, levelIndex, submittedAt = Date.now()) {
  const game = games.get(gameId);
  if (!game) return 0;

  const level = game.levels[levelIndex];
  if (!level) return 0;

  const levelSubmissions = getLevelSubmissions(game, levelIndex);
  const levelDrafts = getLevelDraftAnswers(game, levelIndex);
  const playerIds = Object.keys(game.scores);
  let createdCount = 0;

  for (const playerId of playerIds) {
    for (const question of level.questions) {
      const latestSubmission = getLatestSubmissionForPlayer(
        levelSubmissions,
        question.id,
        playerId
      );
      if (latestSubmission) continue;

      const draft = levelDrafts?.[playerId]?.[question.id] || null;
      if (draft) {
        const submittedFromDraft = await submitAnswer(
          gameId,
          levelIndex,
          playerId,
          question.id,
          {
            answer: draft.answer,
            answerIndex: draft.answerIndex,
            answerText: draft.answerText,
            // Fin de timer: bonus temps = 0.
            timeRemainingSec: 0,
          }
        );

        if (submittedFromDraft) {
          submittedFromDraft.isAutoSubmit = true;
          submittedFromDraft.timeRemainingSec = 0;
          submittedFromDraft.submittedAt = submittedAt;
          submittedFromDraft.scorePreview = ScoreCalculator.calculateScore(
            submittedFromDraft,
            question,
            level.timeLimitSec,
            level.startedAt,
            level.difficulty
          );
          createdCount += 1;
          continue;
        }
      }

      if (question.isCode()) {
        const starterCode = typeof question.starterCode === "string"
          ? question.starterCode
          : "";
        if (starterCode.trim()) {
          const submittedFromStarter = await submitAnswer(
            gameId,
            levelIndex,
            playerId,
            question.id,
            {
              answer: starterCode,
              timeRemainingSec: 0,
            }
          );

          if (submittedFromStarter) {
            submittedFromStarter.isAutoSubmit = true;
            submittedFromStarter.timeRemainingSec = 0;
            submittedFromStarter.submittedAt = submittedAt;
            submittedFromStarter.scorePreview = ScoreCalculator.calculateScore(
              submittedFromStarter,
              question,
              level.timeLimitSec,
              level.startedAt,
              level.difficulty
            );
            createdCount += 1;
            continue;
          }
        }
      }

      const autoSubmission = new Submission(
        nanoid(),
        playerId,
        question.id,
        question.type,
        submittedAt
      );
      autoSubmission.isAutoSubmit = true;
      autoSubmission.payload = question.isFlash() ? null : "";
      autoSubmission.status = "WRONG";

      if (question.isCode()) {
        autoSubmission.totalTests = question.tests?.length || 0;
        autoSubmission.passedTests = 0;
      }

      autoSubmission.timeRemainingSec = 0;
      autoSubmission.scorePreview = ScoreCalculator.calculateScore(
        autoSubmission,
        question,
        level.timeLimitSec,
        level.startedAt,
        level.difficulty
      );

      ensureQuestionBucket(game, levelIndex, question.id).push(autoSubmission);
      createdCount += 1;
    }
  }

  return createdCount;
}

export async function endLevel(gameId, levelIndex) {
  const game = games.get(gameId);
  if (!game) return null;

  const level = game.levels[levelIndex];
  if (!level) return null;
  if (level.state === "RESULTS") {
    return null;
  }

  await autoSubmitMissingAnswers(gameId, levelIndex, level.endsAt || Date.now());
  level.state = "ENDING";

  const levelSubmissions = getLevelSubmissions(game, levelIndex);
  const levelScores = {};
  const totalScores = {};
  const questionDetails = {};

  Object.keys(game.scores).forEach((playerId) => {
    let levelScore = 0;
    const perQuestion = {};

    level.questions.forEach((question) => {
      const latestSubmission = getLatestSubmissionForPlayer(
        levelSubmissions,
        question.id,
        playerId
      );

      let questionScore = 0;
      let breakdown = null;
      if (latestSubmission) {
        breakdown = ScoreCalculator.calculateScoreBreakdown(
          latestSubmission,
          question,
          level.timeLimitSec,
          level.startedAt,
          level.difficulty
        );
        questionScore = Number.isFinite(Number(breakdown?.score))
          ? Number(breakdown.score)
          : 0;
      }

      levelScore += questionScore;
      perQuestion[question.id] = {
        score: questionScore,
        maxScore: getMaxQuestionScore(question, level.difficulty),
        type: question.type,
        status: latestSubmission?.status || "NO_SUBMISSION",
        breakdown,
      };
    });

    game.scores[playerId].addLevelScore(levelIndex, levelScore);
    levelScores[playerId] = levelScore;
    totalScores[playerId] = game.scores[playerId].total;
    questionDetails[playerId] = perQuestion;
  });

  level.state = "RESULTS";

  return {
    level,
    levelScores,
    totalScores,
    questionDetails,
  };
}

export function getGameScores(gameId) {
  const game = games.get(gameId);
  if (!game) return null;

  const scores = {};
  Object.entries(game.scores).forEach(([playerId, scoreObj]) => {
    scores[playerId] = {
      total: scoreObj.total,
      perLevel: scoreObj.perLevel,
    };
  });
  return scores;
}

export function deleteGame(gameId) {
  games.delete(gameId);
}

export function removePlayerFromGame(gameId, playerId, playerName = null) {
  const game = games.get(gameId);
  if (!game) return false;

  if (!game.playerNames || typeof game.playerNames !== "object") {
    game.playerNames = {};
  }
  if (!game.playerNames[playerId]) {
    game.playerNames[playerId] = playerName || "Joueur";
  }

  delete game.scores[playerId];

  Object.values(game.draftAnswers || {}).forEach((levelDrafts) => {
    if (!levelDrafts || typeof levelDrafts !== "object") return;
    delete levelDrafts[playerId];
  });

  Object.values(game.submissions).forEach((levelSubmissions) => {
    if (!levelSubmissions || typeof levelSubmissions !== "object") return;

    Object.keys(levelSubmissions).forEach((questionId) => {
      const submissions = levelSubmissions[questionId];
      if (!Array.isArray(submissions)) return;

      const keptSubmissions = submissions.filter(
        (submission) => submission.playerId !== playerId
      );

      if (keptSubmissions.length === 0) {
        delete levelSubmissions[questionId];
        return;
      }

      levelSubmissions[questionId] = keptSubmissions;
    });
  });

  return true;
}
