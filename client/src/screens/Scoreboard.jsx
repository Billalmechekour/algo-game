import { useEffect, useMemo, useState } from "react";
import cupImg from "../assets/coupe.png";
import { AVATAR_IMAGES } from "../avatarMap";
import { gameAudioEngine } from "../audio/gameAudio";
import { useLanguage } from "../context/LanguageContext";
import "../styles/configure.css";

function buildRows({
  scores,
  levelScores,
  room,
  socketId,
  questionDetails,
  questions,
  fallbackPlayerName,
}) {
  const totalEntries = Object.entries(scores || {});
  const levelMap = levelScores || {};
  const players = room?.players || [];
  const nameById = {};
  const avatarById = {};
  players.forEach((player) => {
    nameById[player.socketId] = player.name;
    avatarById[player.socketId] = player.avatarId || null;
  });

  return totalEntries
    .map(([playerId, totalScore]) => {
      const playerQuestionDetails = questionDetails?.[playerId] || {};
      let questionResults = (questions || [])
        .map((question, index) => {
          const details = playerQuestionDetails?.[question.id] || {};
          const status = String(details?.status || "NO_SUBMISSION");
          return {
            key: question?.id || `q-${index + 1}`,
            label: `Q${index + 1}`,
            score: Number(details?.score || 0),
            status,
            statusClass: `status-${status.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
          };
        });

      if (questionResults.length === 0) {
        questionResults = Object.entries(playerQuestionDetails)
          .map(([questionId, details], index) => {
            const status = String(details?.status || "NO_SUBMISSION");
            return {
              key: questionId,
              label: `Q${index + 1}`,
              score: Number(details?.score || 0),
              status,
              statusClass: `status-${status.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
            };
          });
      }

      return {
        socketId: playerId,
        name: nameById[playerId] || fallbackPlayerName,
        avatarId: avatarById[playerId] || null,
        levelScore: Number(levelMap[playerId] || 0),
        totalScore: Number(totalScore || 0),
        isHost: playerId === room?.hostSocketId,
        isMe: playerId === socketId,
        questionResults,
      };
    })
    .sort((a, b) => {
      if (b.levelScore !== a.levelScore) return b.levelScore - a.levelScore;
      return b.totalScore - a.totalScore;
    });
}

function getRankClass(index) {
  if (index === 0) return "score-level-rank rank-1";
  if (index === 1) return "score-level-rank rank-2";
  if (index === 2) return "score-level-rank rank-3";
  return "score-level-rank";
}

function formatScore(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return "0";
  if (Number.isInteger(parsed)) return String(parsed);
  return parsed.toFixed(2).replace(/\.?0+$/, "");
}

export default function Scoreboard({
  room,
  levelIndex = 0,
  levelScores = {},
  scores = {},
  questionDetails = {},
  questions = [],
  socketId,
}) {
  const { t } = useLanguage();
  const [remaining, setRemaining] = useState(5);
  const configuredLevelCount = Number(room?.config?.levelCount);
  const totalLevels = Number.isFinite(configuredLevelCount) && configuredLevelCount > 0
    ? configuredLevelCount
    : 3;
  const isLastLevel = (levelIndex + 1) >= totalLevels;

  useEffect(() => {
    gameAudioEngine.playLevelScore();
  }, [levelIndex]);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const rows = useMemo(
    () =>
      buildRows({
        scores,
        levelScores,
        room,
        socketId,
        questionDetails,
        questions,
        fallbackPlayerName: t("common.player"),
      }),
    [scores, levelScores, room, socketId, questionDetails, questions, t]
  );

  return (
    <div className="cfg-container">
      <div className="cfg-frame-glow">
        <div className="cfg-frame">
          <div className="cfg-bg"></div>

          <div className="cfg-card score-level-card">
            <div className="score-level-shell">
              <div className="score-level-header">
                <div className="score-level-title-rail" aria-hidden="true"></div>
                <div className="score-level-title-wrap">
                  <div className="score-level-cup-wrap" aria-hidden="true">
                    <img src={cupImg} alt="" className="score-level-cup" />
                    <span className="score-level-cup-sparkle sparkle-a"></span>
                    <span className="score-level-cup-sparkle sparkle-b"></span>
                    <span className="score-level-cup-sparkle sparkle-c"></span>
                  </div>
                  <div className="score-level-title">
                    {t("scoreboard.levelResult", { level: levelIndex + 1 })}
                  </div>
                </div>
              </div>

              <div className="score-level-board">
                <div className="score-level-list">
                  {rows.length === 0 ? (
                    <div className="muted">{t("scoreboard.noScoreYet")}</div>
                  ) : (
                    rows.map((row, index) => (
                      <div
                        key={row.socketId}
                        className={`score-level-row row-${Math.min(index + 1, 4)} ${row.isMe ? "is-me" : ""}`}
                      >
                        <div className="score-level-left">
                          <div className={getRankClass(index)}>{index + 1}</div>
                          <div className="score-level-avatar">
                            {row.avatarId && AVATAR_IMAGES[String(row.avatarId)] ? (
                              <img
                                src={AVATAR_IMAGES[String(row.avatarId)]}
                                alt={`Avatar ${row.name}`}
                              />
                            ) : (
                              <span>{(row.name?.charAt(0) || "?").toUpperCase()}</span>
                            )}
                          </div>
                          <div className="score-level-player">
                            <div className="score-level-name">
                              {row.name}
                              {row.isHost ? (
                                <span className="score-level-host">{t("scoreboard.host")}</span>
                              ) : null}
                            </div>
                            {row.questionResults.length > 0 ? (
                              <div className="score-level-questions">
                                {row.questionResults.map((result) => (
                                  <div
                                    key={`${row.socketId}-${result.key}`}
                                    className={`score-level-qchip ${result.statusClass}`}
                                    title={`${result.label} · ${result.status}`}
                                  >
                                    <span className="score-level-qchip-label">{result.label}</span>
                                    <span className="score-level-qchip-value">{formatScore(result.score)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="score-level-total">
                          <strong>
                            {formatScore(row.levelScore)}
                            <span> {t("scoreboard.points")}</span>
                          </strong>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="score-level-footer">
                {isLastLevel
                  ? (
                    <>
                      {t("scoreboard.totalAfterStart")} <span>{remaining} </span>
                      {t("scoreboard.totalAfterEnd")}
                    </>
                  )
                  : (
                    <>
                      {t("scoreboard.nextStartStart")} <span>{remaining} </span>
                      {t("scoreboard.nextStartEnd")}
                    </>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
