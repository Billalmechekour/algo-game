export class ScoreCalculator {
  static FLASH_BASE_SCORE = 50;
  static FLASH_TIME_BONUS_MAX = 20;

  static CODE_CORRECTNESS_MAX = 70;
  static CODE_TIME_BONUS_MAX = 30;
  static CODE_QUALITY_MAX = 20;

  static DEFAULT_MAX_LINES = {
    SIMPLE: 12,
    MEDIUM: 12,
    HARD: 12,
  };

  static getDifficultyCoeff(difficulty) {
    if (difficulty === "MEDIUM") return 1.2;
    if (difficulty === "HARD") return 1.5;
    return 1.0;
  }

  static getTimeRatio(submission, levelDurationSec, levelStartedAt) {
    const durationSec = Number(levelDurationSec);
    const startedAt = Number(levelStartedAt);
    const submittedAt = Number(submission?.submittedAt);

    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      return 1;
    }
    if (!Number.isFinite(startedAt) || !Number.isFinite(submittedAt)) {
      return 1;
    }

    const elapsedSec = (submittedAt - startedAt) / 1000;
    if (!Number.isFinite(elapsedSec)) {
      return 1;
    }

    return Math.max(0, Math.min(1, elapsedSec / durationSec));
  }

  static getElapsedRatio(submission, levelDurationSec, levelStartedAt) {
    const durationSec = Number(levelDurationSec);
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      return 1;
    }

    // Formule demandée: t = T - tempsRestant.
    const remainingFromSubmission = Number(submission?.timeRemainingSec);
    if (Number.isFinite(remainingFromSubmission)) {
      const t = Math.max(0, Math.min(durationSec, durationSec - remainingFromSubmission));
      return t / durationSec;
    }

    // Repli si le client n'a pas envoyé le temps restant.
    return this.getTimeRatio(submission, levelDurationSec, levelStartedAt);
  }

  static getSubmittedLineCount(payload) {
    const code = typeof payload === "string" ? payload : "";
    return code
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0).length;
  }

  static getMaxLinesExpected(question) {
    if (Number.isInteger(question?.maxLines) && question.maxLines > 0) {
      return question.maxLines;
    }
    return this.DEFAULT_MAX_LINES[question?.difficulty] || 12;
  }

  static getLevelDurationSec(levelDurationSec) {
    const durationSec = Number(levelDurationSec);
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      return 0;
    }
    return durationSec;
  }

  static getElapsedSec(submission, levelDurationSec, levelStartedAt) {
    const durationSec = this.getLevelDurationSec(levelDurationSec);
    if (durationSec <= 0) return 0;
    const elapsedRatio = this.getElapsedRatio(submission, levelDurationSec, levelStartedAt);
    return Math.max(0, Math.min(durationSec, elapsedRatio * durationSec));
  }

  static calculateScoreBreakdown(
    submission,
    question,
    levelDurationSec,
    levelStartedAt,
    levelDifficulty = null
  ) {
    const effectiveDifficulty = levelDifficulty || question?.difficulty;
    const diffCoeff = this.getDifficultyCoeff(effectiveDifficulty);
    const durationSec = this.getLevelDurationSec(levelDurationSec);
    const elapsedSec = this.getElapsedSec(submission, levelDurationSec, levelStartedAt);

    if (!submission) {
      return {
        score: 0,
        coefficient: diffCoeff,
        durationSec,
        elapsedSec,
        type: question?.type || "UNKNOWN",
      };
    }

    if (question.isFlash()) {
      if (submission.status !== "ACCEPTED") {
        return {
          score: 0,
          type: "FLASH",
          status: submission.status,
          coefficient: diffCoeff,
          durationSec,
          elapsedSec,
          components: {
            base: 0,
            timeBonus: 0,
          },
          subtotal: 0,
        };
      }

      const elapsedRatio = this.getElapsedRatio(
        submission,
        levelDurationSec,
        levelStartedAt
      );
      const base = this.FLASH_BASE_SCORE;
      const timeBonus = (1 - elapsedRatio) * this.FLASH_TIME_BONUS_MAX;
      const subtotal = base + timeBonus;
      const score = subtotal * diffCoeff;

      return {
        score: Math.max(0, Number(score.toFixed(2))),
        type: "FLASH",
        status: submission.status,
        coefficient: diffCoeff,
        durationSec,
        elapsedSec,
        components: {
          base: Number(base.toFixed(2)),
          timeBonus: Number(timeBonus.toFixed(2)),
        },
        subtotal: Number(subtotal.toFixed(2)),
      };
    }

    // Cas des questions CODE.
    if (submission.compilationError) {
      return {
        score: 0,
        type: "CODE",
        status: submission.status,
        coefficient: diffCoeff,
        durationSec,
        elapsedSec,
        passedTests: 0,
        totalTests: Math.max(0, Number(submission.totalTests) || 0),
        linesSubmitted: this.getSubmittedLineCount(submission.payload),
        linesMax: this.getMaxLinesExpected(question),
        components: {
          correctness: 0,
          timeBonus: 0,
          quality: 0,
        },
        subtotal: 0,
      };
    }

    const totalTests = Math.max(0, Number(submission.totalTests) || 0);
    const passedTests = Math.max(0, Number(submission.passedTests) || 0);
    const correctness =
      totalTests > 0
        ? (Math.min(passedTests, totalTests) / totalTests) * this.CODE_CORRECTNESS_MAX
        : 0;

    let timeBonus = 0;
    let quality = 0;
    const linesMax = this.getMaxLinesExpected(question);
    const linesSubmitted = this.getSubmittedLineCount(submission.payload);

    if (passedTests > 0) {
      const elapsedRatio = this.getElapsedRatio(
        submission,
        levelDurationSec,
        levelStartedAt
      );
      timeBonus = (1 - elapsedRatio) * this.CODE_TIME_BONUS_MAX;

      if (linesSubmitted <= linesMax) {
        quality = (1 - linesSubmitted / linesMax) * this.CODE_QUALITY_MAX;
      } else {
        quality = 0;
      }
    } else {
      // Règle: si 0 test réussi => Bonus temps = 0 et Qualité = 0
      timeBonus = 0;
      quality = 0;
    }

    const subtotal = correctness + timeBonus + quality;
    const score = subtotal * diffCoeff;

    return {
      score: Math.max(0, Number(score.toFixed(2))),
      type: "CODE",
      status: submission.status,
      coefficient: diffCoeff,
      durationSec,
      elapsedSec,
      passedTests,
      totalTests,
      linesSubmitted,
      linesMax,
      components: {
        correctness: Number(correctness.toFixed(2)),
        timeBonus: Number(timeBonus.toFixed(2)),
        quality: Number(quality.toFixed(2)),
      },
      subtotal: Number(subtotal.toFixed(2)),
    };
  }

  /**
   * Calcul du score d'une soumission selon les formules officielles du jeu.
   *
   * FLASH:
   *   Mauvais -> 0
   *   Bon -> (50 + (1 - t/T) * 20) * D
   *   avec t = T - tempsRestant (temps écoulé à la soumission)
   *
   * CODE:
   *   COMPILE_ERROR -> 0
   *   Sinon -> (Justesse + Bonus_temps + Qualite) * D
   *   Justesse = (testsReussis / testsTotaux) * 70
   *   Bonus_temps = (1 - t/T) * 30
   *   Qualite = (1 - lignesSoumises / lignesMax) * 20 (ou 0 si depassement)
  *   Si 0 test reussi -> Bonus_temps = 0 et Qualite = 0
  *   avec t = T - tempsRestant (temps écoulé à la soumission)
  */
  static calculateScore(
    submission,
    question,
    levelDurationSec,
    levelStartedAt,
    levelDifficulty = null
  ) {
    const breakdown = this.calculateScoreBreakdown(
      submission,
      question,
      levelDurationSec,
      levelStartedAt,
      levelDifficulty
    );
    return Number.isFinite(Number(breakdown?.score)) ? Number(breakdown.score) : 0;
  }

  /**
   * Calcul du score total pour un niveau
   * Somme les scores de toutes les questions
   */
  static calculateLevelScore(
    submissions,
    questions,
    levelDurationSec,
    levelStartedAt,
    levelDifficulty = null
  ) {
    let levelScore = 0;

    // Crée un index pour accéder rapidement aux soumissions par question.
    const submissionsByQuestion = {};
    submissions.forEach((sub) => {
      submissionsByQuestion[sub.questionId] = sub;
    });

    // Pour chaque question du niveau
    questions.forEach((question) => {
      const submission = submissionsByQuestion[question.id];
      
      if (submission) {
        // Calculer le score de cette question
        const score = this.calculateScore(
          submission,
          question,
          levelDurationSec,
          levelStartedAt,
          levelDifficulty
        );
        levelScore += score;

        console.log(
          `[ScoreCalculator] Q${question.id} (${question.type}): ${score} pts ` +
          `(base: ${submission.status}, tests: ${submission.passedTests}/${submission.totalTests})`
        );
      } else {
        // Question non répondue = 0 point
        console.log(`[ScoreCalculator] Q${question.id}: 0 pts (non répondue)`);
      }
    });

    console.log(`[ScoreCalculator] Score total du niveau: ${levelScore} pts`);
    return levelScore;
  }
}
