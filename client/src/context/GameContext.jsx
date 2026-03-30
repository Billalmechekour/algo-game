import React, { createContext, useState } from "react";

export const GameContext = createContext();

export function GameContextProvider({ children }) {
  const [screen, setScreen] = useState("home");
  const [room, setRoom] = useState(null);
  const [socketId, setSocketId] = useState(null);
  const [game, setGame] = useState(null);
  const [currentLevel, setCurrentLevel] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [scores, setScores] = useState({});
  const [lastLevelEnded, setLastLevelEnded] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(0);

  return (
    <GameContext.Provider
      value={{
        screen,
        setScreen,
        room,
        setRoom,
        socketId,
        setSocketId,
        game,
        setGame,
        currentLevel,
        setCurrentLevel,
        questions,
        setQuestions,
        scores,
        setScores,
        lastLevelEnded,
        setLastLevelEnded,
        currentQuestionIndex,
        setCurrentQuestionIndex,
        answers,
        setAnswers,
        timeRemaining,
        setTimeRemaining,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}
