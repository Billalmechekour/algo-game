import { useEffect, useMemo, useRef, useState } from "react";
import ws, { wsSend } from "../ws";
import { AVATAR_IMAGES } from "../avatarMap";
import { gameAudioEngine } from "../audio/gameAudio";
import { useLanguage } from "../context/LanguageContext";
import { translateQuestionText, translateStarterCode } from "../i18n/questionTranslator";
import "../styles/level.css";
import "../styles/configure.css";

function formatSec(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function getSubmitHint({
  t,
  isSubmitted,
  isFlash,
  hasFlashSelection,
  flashSelectionChangedSinceSubmit,
}) {
  if (!isSubmitted) {
    return isFlash
      ? t("level.hintFlashChooseSubmit")
      : t("level.hintCodeWriteSubmit");
  }

  if (isFlash && !hasFlashSelection) {
    return t("level.hintFlashChooseSubmit");
  }

  if (isFlash && flashSelectionChangedSinceSubmit) {
    return t("level.hintFlashChanged");
  }

  if (isFlash) {
    return t("level.hintFlashChooseAnother");
  }

  return "";
}

export default function Level({
  level,
  questions = [],
  socketId,
  room = null,
  serverTickRemaining = null,
  onOpenSettings = null,
}) {
  const { t, language } = useLanguage();
  const [remaining, setRemaining] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const answersRef = useRef({});
  const [runByQuestion, setRunByQuestion] = useState({});
  const [, setFeedbackByQuestion] = useState({});
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const autoSubmittedRef = useRef(false);
  const tenSecondWarningPlayedRef = useRef(false);
  const previousRemainingRef = useRef(null);
  const codeEditorRef = useRef(null);
  const codeLinesRef = useRef(null);
  const flashOptionsListRef = useRef(null);
  const latestFlashSelectionRef = useRef({
    questionId: null,
    choice: null,
    choiceIndex: null,
  });

  useEffect(() => {
    setActiveIdx(0);
    setAnswers({});
    answersRef.current = {};
    setRunByQuestion({});
    setFeedbackByQuestion({});
    autoSubmittedRef.current = false;
    tenSecondWarningPlayedRef.current = false;
    previousRemainingRef.current = null;
    latestFlashSelectionRef.current = {
      questionId: null,
      choice: null,
      choiceIndex: null,
    };
  }, [level?.index]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    const onMessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === "RUN_CODE_RESULT" && msg.questionId) {
        setRunByQuestion((prev) => ({
          ...prev,
          [msg.questionId]: {
            loading: false,
            data: msg.ok ? msg : null,
            error: msg.ok ? null : msg.message || t("level.executionErrorTitle"),
            errorType: msg.errorType || null,
            executionOutput: typeof msg.executionOutput === "string" ? msg.executionOutput : "",
            rawStdout: typeof msg.rawStdout === "string" ? msg.rawStdout : "",
            rawStderr: typeof msg.rawStderr === "string" ? msg.rawStderr : "",
          },
        }));
        return;
      }

      if (msg.type === "ANSWER_RECEIVED" && msg.questionId) {
        const isCorrect = msg.isCorrect || false;
        const scorePreview = Number.isFinite(Number(msg.scorePreview)) ? Number(msg.scorePreview) : 0;
        setFeedbackByQuestion((prev) => ({
          ...prev,
          [msg.questionId]: {
            isCorrect,
            scorePreview,
            submissionStatus: msg.submissionStatus || "PENDING",
            passedTests: Number.isFinite(Number(msg.passedTests)) ? Number(msg.passedTests) : 0,
            totalTests: Number.isFinite(Number(msg.totalTests)) ? Number(msg.totalTests) : 0,
            timestamp: Date.now(),
            flashDebug: msg.flashDebug || null,
          },
        }));
        return;
      }
    };

    ws.addEventListener("message", onMessage);
    return () => ws.removeEventListener("message", onMessage);
  }, [t]);

  const endsAt = useMemo(() => level?.endsAt ?? 0, [level]);
  const parsedServerTick = Number.parseInt(serverTickRemaining, 10);
  const hasServerTick = Number.isFinite(parsedServerTick);

  useEffect(() => {
    if (!level || !endsAt || hasServerTick) return;

    const updateRemaining = () => {
      const deltaMs = endsAt - Date.now();
      const nextSec = Math.max(0, Math.ceil(deltaMs / 1000));
      setRemaining(nextSec);
    };

    updateRemaining();
    const timerId = setInterval(updateRemaining, 200);
    return () => clearInterval(timerId);
  }, [level, endsAt, hasServerTick]);

  useEffect(() => {
    if (!level || !hasServerTick) return;
    setRemaining(Math.max(0, parsedServerTick));
  }, [level, hasServerTick, parsedServerTick]);

  useEffect(() => {
    if (!level) return;
    if (!Number.isFinite(remaining)) return;

    const current = Math.max(0, remaining);
    const previous = previousRemainingRef.current;

    const shouldPlayWarning =
      !tenSecondWarningPlayedRef.current &&
      current > 0 &&
      current <= 10 &&
      (previous === null ? current === 10 : previous > 10);

    if (shouldPlayWarning) {
      gameAudioEngine.playTenSecondWarning();
      tenSecondWarningPlayedRef.current = true;
    }

    if (current > 10) {
      tenSecondWarningPlayedRef.current = false;
    }

    previousRemainingRef.current = current;
  }, [remaining, level]);

  useEffect(() => {
    if (!level || !endsAt || remaining !== 0) return;
    if (autoSubmittedRef.current) return;
    if (!hasServerTick && endsAt - Date.now() > 0) return;

    autoSubmittedRef.current = true;

    const snapshotAnswers = answersRef.current || {};
    const nextAnswers = { ...snapshotAnswers };
    let changed = false;

    questions.forEach((question) => {
      const answer = snapshotAnswers[question.id];
      if (answer?.submitted) return;

      let answerToSend = null;
      let answerIndexToSend = null;
      let answerTextToSend = null;
      if (question.type === "FLASH") {
        const idx = Number(answer?.choiceIndex);
        const choiceCount = question.choices?.length || 0;
        if (Number.isInteger(idx) && idx >= 0 && idx < choiceCount) {
          answerToSend = idx.toString();
          answerIndexToSend = idx;
          answerTextToSend = typeof answer?.choice === "string" ? answer.choice : null;
        } else if (answer?.choice) {
          answerToSend = String(answer.choice);
          answerIndexToSend = null;
          answerTextToSend = String(answer.choice);
        } else {
          answerToSend = "";
          answerIndexToSend = null;
          answerTextToSend = null;
        }
      }

      if (question.type === "CODE") {
        answerToSend =
          typeof answer?.code === "string"
            ? answer.code
            : (typeof question?.starterCode === "string"
              ? translateStarterCode(question.starterCode, language)
              : "");
      }

      wsSend({
        type: "SUBMIT_ANSWER",
        questionId: question.id,
        answer: answerToSend,
        answerIndex: answerIndexToSend,
        answerText: answerTextToSend,
        timeRemainingSec: Math.max(0, Number(remaining) || 0),
        levelIndex: level.index,
        auto: true,
        submittedAt: Date.now(),
      });

      nextAnswers[question.id] = {
        ...(nextAnswers[question.id] || {}),
        submitted: true,
        submittedAt: Date.now(),
      };
      changed = true;
    });

    if (changed) {
      answersRef.current = nextAnswers;
      setAnswers(nextAnswers);
    }
  }, [remaining, hasServerTick, level, endsAt, questions, language]);

  const currentQuestionId = questions?.[activeIdx]?.id || null;
  useEffect(() => {
    if (!currentQuestionId) return;
    if (!codeEditorRef.current || !codeLinesRef.current) return;
    codeEditorRef.current.scrollTop = 0;
    codeLinesRef.current.scrollTop = 0;
  }, [currentQuestionId]);

  if (!level) {
    return (
      <div className="cfg-container level-screen">
        <div className="cfg-frame-glow">
          <div className="cfg-frame">
            <div className="cfg-bg"></div>
            <div className="lobby-loading">{t("level.loading")}</div>
          </div>
        </div>
      </div>
    );
  }

  const totalQuestions = questions.length || 0;
  const currentQuestion = questions[activeIdx];
  const showQuestionNav = totalQuestions > 1;
  const shownIndex = activeIdx + 1;
  const canGoTo = (idx) => idx >= 0 && idx < totalQuestions;

  const me = room?.players?.find((player) => player.socketId === socketId) || null;
  const meName = me?.name || t("common.player");
  const isHost = room?.hostSocketId === socketId;
  const storedHostAvatarId =
    typeof window !== "undefined" ? window.sessionStorage.getItem("hostAvatarId") : null;
  let resolvedAvatarId = me?.avatarId ? String(me.avatarId) : null;
  if (isHost && storedHostAvatarId && AVATAR_IMAGES[storedHostAvatarId]) {
    resolvedAvatarId = storedHostAvatarId;
  }
  const meAvatarSrc = resolvedAvatarId && AVATAR_IMAGES[resolvedAvatarId]
    ? AVATAR_IMAGES[resolvedAvatarId]
    : null;
  const configuredLevelCount = Number(room?.config?.levelCount);
  const totalLevels = Number.isFinite(configuredLevelCount) && configuredLevelCount > 0
    ? configuredLevelCount
    : 3;
  const levelDisplay = typeof level.index === "number" ? level.index + 1 : 1;
  const difficultyByKey = {
    SIMPLE: { key: "simple", label: t("level.difficultySimple") },
    MEDIUM: { key: "moyen", label: t("level.difficultyMedium") },
    MOYEN: { key: "moyen", label: t("level.difficultyMedium") },
    HARD: { key: "difficile", label: t("level.difficultyHard") },
  };
  const difficultyBand = Math.min(
    2,
    Math.floor(((Math.max(1, levelDisplay) - 1) * 3) / Math.max(1, totalLevels))
  );
  const fallbackDifficulty = [
    { key: "simple", label: t("level.difficultySimple") },
    { key: "moyen", label: t("level.difficultyMedium") },
    { key: "difficile", label: t("level.difficultyHard") },
  ][difficultyBand];
  const difficultyMeta =
    difficultyByKey[String(level?.difficulty || "").toUpperCase()] || fallbackDifficulty;

  const currentAnswer = currentQuestion ? answers[currentQuestion.id] || {} : {};
  const selectedChoiceIndex = Number(currentAnswer.choiceIndex);
  const selectedChoice = currentAnswer.choice;
  const selectedChoiceTextIndex = currentQuestion?.type === "FLASH" && typeof selectedChoice === "string"
    ? currentQuestion.choices.indexOf(selectedChoice)
    : -1;
  const hasFlashSelection = currentQuestion?.type === "FLASH"
    ? (
      (Number.isInteger(selectedChoiceIndex) &&
        selectedChoiceIndex >= 0 &&
        selectedChoiceIndex < (currentQuestion?.choices?.length || 0))
      || selectedChoiceTextIndex >= 0
    )
    : false;
  const codeDraft = currentQuestion
    ? (
      answers[currentQuestion.id]?.code
      || translateStarterCode(currentQuestion.starterCode || "", language)
      || ""
    )
    : "";
  const currentRunState = currentQuestion
    ? runByQuestion[currentQuestion.id] || {}
    : {};
  const runExecutionOutput = currentRunState.data?.executionOutput ?? currentRunState.executionOutput ?? "";
  const runRawStdout = currentRunState.data?.rawStdout ?? currentRunState.rawStdout ?? "";
  const runRawStderr = currentRunState.data?.rawStderr ?? currentRunState.rawStderr ?? "";
  const runLoading = !!currentRunState.loading;
  const previousChoice = currentAnswer.previousChoice;
  const previousChoiceIndex = Number(currentAnswer.previousChoiceIndex);
  const isSubmitted = !!currentAnswer.submitted;
  const isFlash = currentQuestion?.type === "FLASH";
  const previousChoiceTextIndex = currentQuestion?.type === "FLASH" && typeof previousChoice === "string"
    ? currentQuestion.choices.indexOf(previousChoice)
    : -1;
  const selectedFlashComparableIndex =
    Number.isInteger(selectedChoiceIndex) &&
    selectedChoiceIndex >= 0 &&
    selectedChoiceIndex < (currentQuestion?.choices?.length || 0)
      ? selectedChoiceIndex
      : (selectedChoiceTextIndex >= 0 ? selectedChoiceTextIndex : null);
  const submittedFlashComparableIndex =
    Number.isInteger(previousChoiceIndex) &&
    previousChoiceIndex >= 0 &&
    previousChoiceIndex < (currentQuestion?.choices?.length || 0)
      ? previousChoiceIndex
      : (previousChoiceTextIndex >= 0 ? previousChoiceTextIndex : null);
  const flashSelectionChangedSinceSubmit = isFlash
    ? (() => {
      if (!isSubmitted) return Boolean(hasFlashSelection);
      if (!hasFlashSelection) return false;

      if (Number.isInteger(submittedFlashComparableIndex)) {
        return Number.isInteger(selectedFlashComparableIndex)
          ? selectedFlashComparableIndex !== submittedFlashComparableIndex
          : true;
      }

      if (
        typeof selectedChoice === "string" &&
        typeof previousChoice === "string" &&
        selectedChoice.trim() &&
        previousChoice.trim()
      ) {
        return selectedChoice !== previousChoice;
      }

      return true;
    })()
    : false;
  const flashCanSubmit = isFlash
    ? Boolean(hasFlashSelection && (!isSubmitted || flashSelectionChangedSinceSubmit))
    : false;
  const typeLabel = isFlash ? "FLASH" : "CODE";
  const languageLabels = {
    python: "Python",
    java: "Java",
    c: "C",
    cpp: "C++",
  };
  const rawConfiguredLanguage = String(
    room?.config?.language || currentQuestion?.language || ""
  )
    .trim()
    .toLowerCase();
  const configuredLanguageLabel =
    languageLabels[rawConfiguredLanguage] ||
    (rawConfiguredLanguage ? rawConfiguredLanguage.toUpperCase() : "—");

  const submitHint = getSubmitHint({
    t,
    isSubmitted,
    isFlash,
    hasFlashSelection,
    flashSelectionChangedSinceSubmit,
  });
  const settingsLabel = t("home.settingsTitle");

  const submitDisabled = !currentQuestion
    || (isFlash
      ? !flashCanSubmit
      : !(answers[currentQuestion.id]?.code || "").trim().length);
  const runDisabled = !currentQuestion
    || isFlash
    || !codeDraft.trim().length
    || runLoading;
  const codeLineCount = Math.max(1, codeDraft.split("\n").length);
  const codeLineNumbers = Array.from({ length: codeLineCount }, (_, index) => index + 1);
  const displayPrompt = currentQuestion
    ? translateQuestionText(currentQuestion.prompt, language)
    : "";
  const displayChoices = currentQuestion?.type === "FLASH"
    ? currentQuestion.choices.map((choice) => translateQuestionText(choice, language))
    : [];

  function onPickChoice(choice, index) {
    if (!currentQuestion) return;

    // Met à jour l'état visuel des boutons immédiatement (avant le re-render React).
    if (flashOptionsListRef.current) {
      flashOptionsListRef.current
        .querySelectorAll(".flash-option-btn")
        .forEach((btn) => {
          const btnIndex = Number.parseInt(btn.dataset.choiceIndex || "", 10);
          const isSelected = Number.isInteger(btnIndex) && btnIndex === index;
          btn.dataset.selected = isSelected ? "true" : "false";
          btn.classList.toggle("is-selected", isSelected);
        });
    }

    // Sauvegarde dans une ref pour une lecture de secours immédiate.
    latestFlashSelectionRef.current = {
      questionId: currentQuestion.id,
      choice,
      choiceIndex: index,
    };

    // Mise à jour immédiate pour fiabiliser l'auto-soumission à t=0.
    answersRef.current = {
      ...(answersRef.current || {}),
      [currentQuestion.id]: {
        ...((answersRef.current || {})[currentQuestion.id] || {}),
        choice,
        choiceIndex: index,
      },
    };

    // Met ensuite à jour l'état React en préservant la valeur la plus récente.
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...(prev[currentQuestion.id] || {}),
        choice,
        choiceIndex: index,
      },
    }));

    wsSend({
      type: "ANSWER_DRAFT",
      questionId: currentQuestion.id,
      answer: index.toString(),
      answerIndex: index,
      answerText: choice,
      timeRemainingSec: Math.max(0, Number(remaining) || 0),
      levelIndex: level.index,
    });
  }

  function onFlashOptionsCapture(event) {
    if (!currentQuestion || currentQuestion.type !== "FLASH") return;
    const btn = event.target instanceof Element
      ? event.target.closest(".flash-option-btn")
      : null;
    if (!btn) return;
    const idx = Number.parseInt(btn.dataset.choiceIndex || "", 10);
    if (!Number.isInteger(idx) || idx < 0 || idx >= (currentQuestion.choices?.length || 0)) {
      return;
    }
    const choiceText = currentQuestion.choices[idx];
    onPickChoice(choiceText, idx);
  }

  function onCodeEditorScroll(event) {
    if (!codeLinesRef.current) return;
    codeLinesRef.current.scrollTop = event.target.scrollTop;
  }

  function onCodeEditorKeyDown(event) {
    const isShortcut = event.ctrlKey || event.metaKey;
    if (!isShortcut) return;

    // Force la sélection complète dans l'éditeur uniquement.
    if (event.key.toLowerCase() === "a") {
      event.preventDefault();
      event.currentTarget.select();
    }
    // Ctrl/Cmd+C et Ctrl/Cmd+Z restent gérés nativement par le navigateur.
  }

  function onRunCode() {
    if (!currentQuestion || currentQuestion.type !== "CODE") {
      return;
    }

    const codeToRun = (
      answers[currentQuestion.id]?.code
      || translateStarterCode(currentQuestion.starterCode || "", language)
      || ""
    ).trim();
    if (!codeToRun) {
      return;
    }

    setRunByQuestion((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        loading: true,
        data: null,
        error: null,
        errorType: null,
        executionOutput: "",
        rawStdout: "",
        rawStderr: "",
      },
    }));

    wsSend({
      type: "RUN_CODE",
      questionId: currentQuestion.id,
      levelIndex: level.index,
      code:
        answers[currentQuestion.id]?.code
        || translateStarterCode(currentQuestion.starterCode || "", language)
        || "",
    });
  }

  function onSubmitQuestion() {
    if (!currentQuestion) return;

    if (currentQuestion.type === "FLASH") {
      if (!hasFlashSelection) return;
      if (isSubmitted && !flashSelectionChangedSinceSubmit) return;

      let answerIndex = null;
      let answerText = "";

      // Étape 1 (prioritaire): dernière sélection capturée dans la ref.
      if (latestFlashSelectionRef.current.questionId === currentQuestion.id) {
        const fallbackIndex = Number(latestFlashSelectionRef.current.choiceIndex);
        if (Number.isInteger(fallbackIndex) && fallbackIndex >= 0) {
          answerIndex = fallbackIndex;
        }
        if (typeof latestFlashSelectionRef.current.choice === "string") {
          answerText = latestFlashSelectionRef.current.choice;
        }
      }

      // Étape 2: lecture directe du DOM si la ref est absente.
      if (
        (!Number.isInteger(answerIndex) || answerIndex < 0) &&
        flashOptionsListRef.current
      ) {
        const selectedByClass = flashOptionsListRef.current.querySelector(
          ".flash-option-btn.is-selected"
        );
        if (selectedByClass) {
          const selectedIdx = Number.parseInt(selectedByClass.dataset.choiceIndex || "", 10);
          if (Number.isInteger(selectedIdx) && selectedIdx >= 0) {
            answerIndex = selectedIdx;
          }
          if (!answerText && typeof selectedByClass.dataset.choiceText === "string") {
            answerText = selectedByClass.dataset.choiceText;
          }
        }

        const selectedOption = flashOptionsListRef.current.querySelector(
          ".flash-option-btn[data-selected='true']"
        );
        if (selectedOption) {
          const selectedIdx = Number.parseInt(selectedOption.dataset.choiceIndex || "", 10);
          if (Number.isInteger(selectedIdx) && selectedIdx >= 0) {
            answerIndex = selectedIdx;
          }
          if (!answerText && typeof selectedOption.dataset.choiceText === "string") {
            answerText = selectedOption.dataset.choiceText;
          }
        }

        if (!Number.isInteger(answerIndex) || answerIndex < 0) {
          const focusedOption = flashOptionsListRef.current.querySelector(".flash-option-btn:focus");
          if (focusedOption) {
            const focusedIdx = Number.parseInt(focusedOption.dataset.choiceIndex, 10);
            if (Number.isInteger(focusedIdx) && focusedIdx >= 0) {
              answerIndex = focusedIdx;
            }
            if (!answerText && typeof focusedOption.dataset.choiceText === "string") {
              answerText = focusedOption.dataset.choiceText;
            }
          }
        }
      }

      // Étape 3: valeur de l'état React en repli.
      if (!Number.isInteger(answerIndex) || answerIndex < 0) {
        if (
          hasFlashSelection &&
          Number.isInteger(selectedChoiceIndex) &&
          selectedChoiceIndex >= 0
        ) {
          answerIndex = selectedChoiceIndex;
        }
        if (!answerText && typeof selectedChoice === "string") {
          answerText = selectedChoice;
        }
      }

      // Étape 4: déduire l'index à partir du texte sélectionné.
      if (
        (!Number.isInteger(answerIndex) || answerIndex < 0) &&
        answerText
      ) {
        const byTextIndex = currentQuestion.choices.indexOf(answerText);
        if (byTextIndex >= 0) {
          answerIndex = byTextIndex;
        }
      }

      // Construit la charge utile finale à envoyer au serveur.
      const answerPayload =
        Number.isInteger(answerIndex) && answerIndex >= 0
          ? answerIndex.toString()
          : answerText;

      // Vérifie qu'une réponse exploitable est bien présente.
      if (!String(answerPayload || "").trim()) {
        console.warn("[Level.jsx] No answer selected for submission", {
          currentQuestion: currentQuestion.id,
          hasFlashSelection,
          selectedChoiceIndex,
          selectedChoice,
          answerIndex,
          answerText,
        });
        return;
      }

      wsSend({
        type: "SUBMIT_ANSWER",
        questionId: currentQuestion.id,
        answer: answerPayload,
        answerIndex: Number.isInteger(answerIndex) ? answerIndex : null,
        answerText: answerText || null,
        timeRemainingSec: Math.max(0, Number(remaining) || 0),
        levelIndex: level.index,
        auto: false,
        submittedAt: Date.now(),
      });

      setAnswers((prev) => {
        const next = {
          ...prev,
          [currentQuestion.id]: {
            ...(prev[currentQuestion.id] || {}),
            previousChoice: answerText || selectedChoice,
            previousChoiceIndex: Number.isInteger(answerIndex) ? answerIndex : selectedChoiceIndex,
            submitted: true,
            submittedAt: Date.now(),
          },
        };
        answersRef.current = next;
        return next;
      });
      return;
    }

    const codeAnswer = answers[currentQuestion.id]?.code || "";
    wsSend({
      type: "SUBMIT_ANSWER",
      questionId: currentQuestion.id,
      answer: codeAnswer,
      timeRemainingSec: Math.max(0, Number(remaining) || 0),
      levelIndex: level.index,
      auto: false,
      submittedAt: Date.now(),
    });

    setAnswers((prev) => {
      const next = {
        ...prev,
        [currentQuestion.id]: {
          ...(prev[currentQuestion.id] || {}),
          submitted: true,
          submittedAt: Date.now(),
        },
      };
      answersRef.current = next;
      return next;
    });
  }

  function openQuitConfirm() {
    if (quitting) return;
    setShowQuitConfirm(true);
  }

  function cancelQuitConfirm() {
    if (quitting) return;
    setShowQuitConfirm(false);
  }

  function confirmQuitGame() {
    if (quitting) return;
    setQuitting(true);
    gameAudioEngine.stopAllGameplaySounds();
    wsSend({ type: "LEAVE_ROOM" });
    setShowQuitConfirm(false);
    setTimeout(() => setQuitting(false), 1200);
  }

  function openInGameSettings() {
    if (typeof onOpenSettings === "function") {
      onOpenSettings("level");
    }
  }

  return (
    <div className="cfg-container level-screen">
      <div className="cfg-frame-glow">
        <button
          type="button"
          className="flash-settings-corner-btn"
          onClick={openInGameSettings}
          aria-label={settingsLabel}
          title={settingsLabel}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
            <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.5 1.5 0 0 1-2.1 2.1l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V19a1.5 1.5 0 0 1-3 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.5 1.5 0 1 1-2.1-2.1l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H5a1.5 1.5 0 0 1 0-3h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.5 1.5 0 1 1 2.1-2.1l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V5a1.5 1.5 0 0 1 3 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.5 1.5 0 1 1 2.1 2.1l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H19a1.5 1.5 0 0 1 0 3h-.2a1 1 0 0 0-.9.6Z" />
          </svg>
        </button>
        <div className="cfg-frame">
          <div className="cfg-bg"></div>
          <div className="cfg-card flash-game-shell">
            <div className="flash-level-header">
              <div className="flash-level-pill">
                <span className="flash-level-main">{levelDisplay}/{totalLevels}</span>
                <span className={`flash-difficulty-pill is-${difficultyMeta.key}`}>
                  {difficultyMeta.label}
                </span>
              </div>
            </div>

            <div className="flash-player-row">
              <div className="flash-player-left">
                <div className="flash-player-avatar">
                  {meAvatarSrc ? (
                    <img
                      className="flash-player-avatar-img"
                      src={meAvatarSrc}
                      alt={`Avatar ${meName}`}
                    />
                  ) : (
                    (meName.charAt(0) || "?").toUpperCase()
                  )}
                </div>
                  <div className="flash-player-meta">
                  <div className="flash-player-name">{meName}</div>
                  <div className="flash-player-role">{isHost ? t("common.host") : t("common.player")}</div>
                </div>
              </div>

              <div className={`flash-timer-circle ${remaining <= 10 ? "danger" : ""}`}>
                <div className="flash-timer-seconds">{remaining}</div>
                <div className="flash-timer-mmss">{formatSec(remaining)}</div>
              </div>
            </div>

            <div className="flash-question-row">
              <div className="flash-question-pill">
                <span>
                  {t("level.questionCounter", {
                    current: shownIndex,
                    total: totalQuestions || 0,
                  })}
                </span>
                <span className="flash-badge">{typeLabel}</span>
                <span className="flash-language-badge">{configuredLanguageLabel}</span>
              </div>
            </div>

            {!currentQuestion ? (
              <div className="flash-empty-card">{t("level.noQuestion")}</div>
            ) : (
              <>
                <div className="flash-question-content">
                  <p className="flash-question-label">{t("level.questionPromptLabel")}</p>
                  <pre className="flash-question-text">{displayPrompt}</pre>
                </div>

                {isFlash ? (
                  <div className="flash-actions-card">
                    <div
                      className="flash-options-list"
                      ref={flashOptionsListRef}
                      onClickCapture={onFlashOptionsCapture}
                    >
                      {currentQuestion.choices.map((choice, index) => {
                        const displayedChoice = displayChoices[index] || choice;
                        const colorClass = `flash-option-color-${index % 4}`;
                        const selected = selectedChoice === choice;
                        const submittedCurrent = isSubmitted && previousChoice === choice;

                        return (
                          <button
                            type="button"
                            key={choice}
                            data-choice-index={index}
                            data-choice-text={choice}
                            data-selected={selected ? "true" : "false"}
                            className={[
                              "flash-option-btn",
                              colorClass,
                              selected ? "is-selected" : "",
                              submittedCurrent ? "is-submitted" : "",
                            ].filter(Boolean).join(" ")}
                            onMouseDown={() => onPickChoice(choice, index)}
                            onTouchStart={() => onPickChoice(choice, index)}
                            onPointerDown={() => onPickChoice(choice, index)}
                            onClick={() => onPickChoice(choice, index)}
                          >
                            {displayedChoice}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      className="flash-submit-btn"
                      data-ui-sound="submit"
                      onClick={onSubmitQuestion}
                      disabled={submitDisabled}
                    >
                      {t("level.submit")}
                    </button>
                    <p className="flash-submit-hint">{submitHint}</p>

                    {showQuestionNav ? (
                      <div className="flash-nav-row">
                        {questions.map((question, index) => {
                          const isCurrentQuestion = index === activeIdx;
                          return (
                            <button
                              key={question.id || `flash-nav-${index}`}
                              className={`flash-nav-btn ${isCurrentQuestion ? "is-active" : ""}`}
                              onClick={() => canGoTo(index) && setActiveIdx(index)}
                            >
                              {isCurrentQuestion
                                ? t("level.navQuestionActive", { index: index + 1 })
                                : t("level.navQuestion", { index: index + 1 })}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flash-actions-card flash-actions-card-code">
                    <div className="flash-code-editor-wrap">
                      <div className="flash-code-lines" ref={codeLinesRef} aria-hidden="true">
                        {codeLineNumbers.map((lineNumber) => (
                          <div key={`${currentQuestion.id}-line-${lineNumber}`} className="flash-code-line-number">
                            {lineNumber}
                          </div>
                        ))}
                      </div>
                      <textarea
                        ref={codeEditorRef}
                        value={
                          answers[currentQuestion.id]?.code
                          || translateStarterCode(currentQuestion.starterCode || "", language)
                          || ""
                        }
                        onChange={(event) =>
                          {
                            const nextCode = event.target.value;
                            answersRef.current = {
                              ...(answersRef.current || {}),
                              [currentQuestion.id]: {
                                ...((answersRef.current || {})[currentQuestion.id] || {}),
                                code: nextCode,
                              },
                            };
                            setAnswers((prev) => ({
                              ...prev,
                              [currentQuestion.id]: {
                                ...(prev[currentQuestion.id] || {}),
                                code: nextCode,
                              },
                            }));
                            wsSend({
                              type: "ANSWER_DRAFT",
                              questionId: currentQuestion.id,
                              answer: nextCode,
                              timeRemainingSec: Math.max(0, Number(remaining) || 0),
                              levelIndex: level.index,
                            });
                            setRunByQuestion((prev) => ({
                              ...prev,
                              [currentQuestion.id]: {
                                loading: false,
                                data: null,
                                error: null,
                                errorType: null,
                                executionOutput: "",
                                rawStdout: "",
                                rawStderr: "",
                              },
                            }));
                          }
                        }
                        onScroll={onCodeEditorScroll}
                        onKeyDown={onCodeEditorKeyDown}
                        className="flash-code-editor"
                        placeholder={t("level.codePlaceholder")}
                        spellCheck={false}
                        autoCorrect="off"
                        autoCapitalize="off"
                      />
                    </div>
                    <button
                      className="flash-run-btn"
                      onClick={onRunCode}
                      disabled={runDisabled}
                    >
                      {runLoading ? t("level.running") : t("level.run")}
                    </button>
                    <button
                      className="flash-submit-btn"
                      data-ui-sound="submit"
                      onClick={onSubmitQuestion}
                      disabled={submitDisabled}
                    >
                      {t("level.submit")}
                    </button>
                    <p className="flash-submit-hint">{submitHint}</p>
                    {currentRunState.error ? (
                      <div className="flash-run-status is-error">
                        <div className="flash-run-status-title">
                          {t("level.executionErrorTitle")}
                        </div>
                        <pre className="flash-run-status-pre">{currentRunState.error}</pre>
                      </div>
                    ) : null}
                    {currentRunState.error && (runExecutionOutput || runRawStdout || runRawStderr) ? (
                      <div className="flash-run-console is-error">
                        <div className="flash-run-console-title">{t("level.executionResultTitle")}</div>
                        <pre className="flash-run-console-pre">
                          {runExecutionOutput || runRawStdout || t("level.noStdout")}
                        </pre>
                        {runRawStderr ? (
                          <pre className="flash-run-console-pre is-error">{runRawStderr}</pre>
                        ) : null}
                      </div>
                    ) : null}
                    {currentRunState.data?.ok ? (
                      <div className="flash-run-results">
                        <div className="flash-run-console">
                          <div className="flash-run-console-title">{t("level.executionResultTitle")}</div>
                          <pre className="flash-run-console-pre">
                            {runExecutionOutput || t("level.executionDoneNoOutput")}
                          </pre>
                          {runRawStderr ? (
                            <pre className="flash-run-console-pre is-error">{runRawStderr}</pre>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {showQuestionNav ? (
                      <div className="flash-nav-row">
                        {questions.map((question, index) => {
                          const isCurrentQuestion = index === activeIdx;
                          return (
                            <button
                              key={question.id || `code-nav-${index}`}
                              className={`flash-nav-btn ${isCurrentQuestion ? "is-active" : ""}`}
                              onClick={() => canGoTo(index) && setActiveIdx(index)}
                            >
                              {isCurrentQuestion
                                ? t("level.navQuestionActive", { index: index + 1 })
                                : t("level.navQuestion", { index: index + 1 })}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                )}
              </>
            )}

            <div className="flash-top-actions">
              <button
              className="flash-quit-btn"
              onClick={openQuitConfirm}
              disabled={quitting}
            >
                {quitting ? t("level.leaving") : t("level.quit")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showQuitConfirm ? (
        <div className="flash-quit-overlay">
          <div className="flash-quit-modal">
            <div className="flash-quit-title">{t("level.quitGameTitle")}</div>
            <p className="flash-quit-text">{t("level.quitGameConfirm")}</p>
            <div className="flash-quit-actions">
              <button
                className="flash-quit-cancel"
                onClick={cancelQuitConfirm}
                disabled={quitting}
              >
                {t("common.cancel")}
              </button>
              <button
                className="flash-quit-confirm"
                onClick={confirmQuitGame}
                disabled={quitting}
              >
                {t("level.confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
