// Constantes de configuration du jeu

export const GAME_CONFIG = {
  // WebSocket
  WS_URL: "ws://localhost:8080",

  // Salons
  ROOM_CODE_LENGTH: 6,
  MAX_PLAYERS_PER_ROOM: 4,
  MIN_PLAYERS_TO_START: 2,

  // Niveaux
  VALID_LEVEL_COUNTS: [3, 6, 9],
  VALID_QUESTIONS_PER_LEVEL: [1, 2, 3],
  VALID_TIME_PER_LEVEL: { min: 30, max: 300 },

  // Langages supportés
  SUPPORTED_LANGUAGES: ["python", "java", "c", "cpp"],
  LANGUAGE_NAMES: {
    python: "Python",
    java: "Java",
    c: "C",
    cpp: "C++",
  },

  // Difficulté
  DIFFICULTIES: ["SIMPLE", "MEDIUM", "HARD"],
  DIFFICULTY_COEFFICIENTS: {
    SIMPLE: 1.0,
    MEDIUM: 1.2,
    HARD: 1.5,
  },

  // Types de questions
  QUESTION_TYPES: {
    FLASH: "FLASH",
    CODE: "CODE",
  },

  // Score
  SCORE: {
    BASE_SCORE: 70,
    TIME_BONUS_MAX: 30,
    CODE_TESTS_MULTIPLIER: 70,
  },

  // Minuteur
  TIMER: {
    TICK_INTERVAL: 1000, // 1 seconde
    CODE_VALIDATION_TIMEOUT: 2000, // 2 secondes
  },

  // États du jeu
  ROOM_STATES: {
    WAITING: "WAITING",
    IN_PROGRESS: "IN_PROGRESS",
    FINISHED: "FINISHED",
    PAUSED: "PAUSED",
  },

  LEVEL_STATES: {
    NOT_STARTED: "NOT_STARTED",
    ACTIVE: "ACTIVE",
    LOCKED: "LOCKED",
    ENDING: "ENDING",
    RESULTS: "RESULTS",
  },

  // Messages d'erreur
  ERRORS: {
    ROOM_NOT_FOUND: "Salon introuvable",
    ROOM_FULL: "Salon complet (maximum 4 joueurs)",
    INVALID_CODE: "Code invalide",
    NOT_HOST: "Seul le host peut effectuer cette action",
    GAME_ALREADY_STARTED: "La partie a déjà commencé",
    NOT_ALL_READY: "Tous les joueurs doivent être prêts",
    CONNECTION_LOST: "Connexion perdue",
    INVALID_ANSWER: "Réponse invalide",
    SERVER_ERROR: "Erreur serveur",
  },

  // Persistance
  SAVE_DIRECTORY: "./saves",
  SAVE_EXTENSION: ".json",
  SAVE_CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 heure
  SAVE_MAX_AGE: 24 * 60 * 60 * 1000, // 24 heures
  ROOM_INACTIVITY_TIMEOUT: 60 * 60 * 1000, // 1 heure

  // Limitation de débit
  RATE_LIMIT: {
    MAX_MESSAGES_PER_SECOND: 10,
    MAX_LOGIN_ATTEMPTS_PER_MINUTE: 3,
    BAN_DURATION: 5 * 60 * 1000, // 5 minutes
  },
};

export default GAME_CONFIG;
