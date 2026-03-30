import { QUESTION_BANK, pickRandom } from "./questions/bank.js";

export function difficultyFor(levelIndex, totalLevels) {
  const third = Math.ceil(totalLevels / 3);
  if (levelIndex <= third) return "SIMPLE";
  if (levelIndex <= 2 * third) return "MEDIUM";
  return "HARD";
}

function buildLevelQuestions({ room, difficulty }) {
  const n = room.config.questionsPerLevel;

  // Pour l'instant, ce moteur utilise uniquement des questions FLASH.
  const pool = QUESTION_BANK.FLASH[difficulty] || [];
  const chosen = pickRandom(pool, n);

  // Ne jamais envoyer la réponse correcte au client.
  const forClient = chosen.map(({ correct, ...q }) => q);

  // Clé de correction côté serveur
  const correctById = {};
  chosen.forEach((q) => (correctById[q.id] = q.correct));

  return { forClient, correctById };
}

function computeScoresForCurrentLevel(room) {
  if (!room.game) return;

  const correctById = room.game.correctById || {};
  const levelAnswers = room.game.levelAnswers || {}; // socketId -> { qid: {answer, submittedAt, auto} }

  // Score FLASH simple: +10 si correct, 0 sinon.
  // Le bonus temps est géré dans une autre étape.
  room.players.forEach((p) => {
    const sid = p.socketId;
    const answersMap = levelAnswers[sid] || {};

    let points = 0;
    Object.entries(answersMap).forEach(([qid, obj]) => {
      const correct = correctById[qid];
      if (correct != null && obj?.answer === correct) {
        points += 10;
      }
    });

    room.game.scores[sid] = (room.game.scores[sid] || 0) + points;
  });
}

export function startGameLoop({ room, broadcastToRoom }) {
  room.state = "IN_GAME";

  room.game = {
    currentLevel: 0,
    totalLevels: room.config.levels,
    levelDurationSec: room.config.levelDurationSec,
    status: "RUNNING",
    _timer: null,

    // scores cumulés par socketId
    scores: {},

    // correction du niveau courant
    correctById: {},

    // réponses du niveau courant
    levelAnswers: {},

    // Questions du niveau (côté serveur uniquement, utile pour le diagnostic).
    levelQuestions: [],
  };

  startNextLevel({ room, broadcastToRoom });
}

export function startNextLevel({ room, broadcastToRoom }) {
  room.game.currentLevel += 1;

  // fin de partie
  if (room.game.currentLevel > room.game.totalLevels) {
    room.state = "FINISHED";
    room.game.status = "FINISHED";

    broadcastToRoom(room.code, {
      type: "GAME_END",
      scores: room.game.scores,
    });
    return;
  }

  const levelIndex = room.game.currentLevel;
  const durationSec = room.game.levelDurationSec;
  const difficulty = difficultyFor(levelIndex, room.game.totalLevels);

  const startedAt = Date.now();
  const endsAt = startedAt + durationSec * 1000;

  room.game.level = { index: levelIndex, difficulty, startedAt, endsAt };

  // Génère les questions du niveau (FLASH)
  const { forClient, correctById } = buildLevelQuestions({ room, difficulty });
  room.game.correctById = correctById;
  room.game.levelQuestions = forClient; // sans correct

  // reset réponses du niveau (par joueur)
  room.game.levelAnswers = {}; // socketId -> { [questionId]: {answer, submittedAt, auto} }

  broadcastToRoom(room.code, {
    type: "LEVEL_START",
    level: room.game.level,
    config: room.config,
    questions: forClient,
  });

  if (room.game._timer) clearInterval(room.game._timer);

  room.game._timer = setInterval(() => {
    const now = Date.now();
    const remainingMs = endsAt - now;
    const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));

    broadcastToRoom(room.code, {
      type: "TICK",
      levelIndex,
      remainingSec,
    });

    if (remainingMs <= 0) {
      clearInterval(room.game._timer);
      room.game._timer = null;

      // Calcule le score avant d'envoyer LEVEL_END.
      computeScoresForCurrentLevel(room);

      // fin de niveau: envoie scoreboard
      broadcastToRoom(room.code, {
        type: "LEVEL_END",
        levelIndex,
        scores: room.game.scores,
      });

      setTimeout(() => {
        startNextLevel({ room, broadcastToRoom });
      }, 900);
    }
  }, 1000);
}
