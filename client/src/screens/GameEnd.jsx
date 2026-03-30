import { useEffect } from "react";
import { AVATAR_IMAGES } from "../avatarMap";
import medalGold from "../assets/Avatar joueurs/medaille/medaille-dor.png";
import medalSilver from "../assets/Avatar joueurs/medaille/medaille-dargent.png";
import medalBronze from "../assets/Avatar joueurs/medaille/medaille-de-bronze.png";
import { gameAudioEngine } from "../audio/gameAudio";
import { useLanguage } from "../context/LanguageContext";
import "../styles/configure.css";

function sortScores(scores, room, playerNames = {}, socketId = null, fallbackPlayerName = "Joueur") {
  const entries = Object.entries(scores || {});
  const nameById = { ...(playerNames || {}) };
  const avatarById = {};
  (room?.players || []).forEach((player) => {
    nameById[player.socketId] = player.name;
    avatarById[player.socketId] = player.avatarId;
  });

  return entries
    .map(([playerId, score]) => ({
      socketId: playerId,
      name: nameById[playerId] || fallbackPlayerName,
      avatarId: avatarById[playerId] || null,
      score: Number(score || 0),
      isHost: playerId === room?.hostSocketId,
      isMe: playerId === socketId,
    }))
    .sort((a, b) => b.score - a.score);
}

function buildPodiumItems(rows) {
  if (!rows.length) return [];
  if (rows.length === 1) return [{ place: 1, player: rows[0] }];
  if (rows.length === 2) {
    return [
      { place: 2, player: rows[1] },
      { place: 1, player: rows[0] },
    ];
  }

  return [
    { place: 2, player: rows[1] },
    { place: 1, player: rows[0] },
    { place: 3, player: rows[2] },
  ];
}

function rowClass(index, isMe) {
  const rankClass = `rank-${Math.min(index + 1, 4)}`;
  return `final-score-row ${rankClass} ${isMe ? "is-me" : ""}`.trim();
}

function formatScore(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return "0";
  if (Number.isInteger(parsed)) return String(parsed);
  return parsed.toFixed(2).replace(/\.?0+$/, "");
}

const MEDALS_BY_PLACE = {
  1: medalGold,
  2: medalSilver,
  3: medalBronze,
};

function PodiumPlayer({ player, place, hostLabel }) {
  if (!player) return null;

  return (
    <div className={`final-score-podium-slot place-${place}`}>
      <div className="final-score-podium-avatar">
        {player.avatarId && AVATAR_IMAGES[String(player.avatarId)] ? (
          <img
            src={AVATAR_IMAGES[String(player.avatarId)]}
            alt={`Avatar ${player.name}`}
          />
        ) : (
          <span>{(player.name?.charAt(0) || "?").toUpperCase()}</span>
        )}
      </div>
      <div className="final-score-podium-name">
        {player.name}
        {player.isHost ? <span className="final-score-host">{hostLabel}</span> : null}
      </div>
    </div>
  );
}

export default function GameEnd({ room, scores, playerNames = {}, socketId, setScreen }) {
  const { t } = useLanguage();
  const rows = sortScores(scores, room, playerNames, socketId, t("common.player"));
  const podiumItems = buildPodiumItems(rows);
  const podiumCount = Math.min(3, Math.max(1, podiumItems.length));
  const topRows = rows.slice(0, 4);
  const hasRows = topRows.length > 0;

  useEffect(() => {
    gameAudioEngine.unlock();
    gameAudioEngine.playFinalWinner();
    gameAudioEngine.startFinalFireworks({
      intervalMs: 1020,
    });

    return () => {
      gameAudioEngine.stopFinalFireworks();
    };
  }, []);

  return (
    <div className="cfg-container">
      <div className="cfg-frame-glow">
        <div className="cfg-frame">
          <div className="cfg-bg"></div>

          <div className="cfg-card final-score-card">
            <div className="final-score-shell">
              <div className="final-score-header">
                <div className="final-score-header-rail" aria-hidden="true"></div>
                <div className="final-score-header-pill">{t("gameEnd.finalRanking")}</div>
              </div>

              <div className="final-score-fireworks" aria-hidden="true">
                <span className="final-firework burst-a"></span>
                <span className="final-firework burst-b"></span>
                <span className="final-firework burst-c"></span>
                <span className="final-firework burst-d"></span>
              </div>

              <div className="final-score-podium">
                <div className={`final-score-podium-top final-count-${podiumCount}`}>
                  {podiumItems.map((item) => (
                    <PodiumPlayer
                      key={`podium-top-${item.place}-${item.player.socketId}`}
                      player={item.player}
                      place={item.place}
                      hostLabel={t("gameEnd.host")}
                    />
                  ))}
                </div>

                <div className={`final-score-podium-base final-count-${podiumCount}`}>
                  {podiumItems.map((item) => (
                    <div
                      key={`podium-col-${item.place}-${item.player.socketId}`}
                      className={`podium-col place-${item.place}`}
                    >
                      {MEDALS_BY_PLACE[item.place] ? (
                        <img
                          src={MEDALS_BY_PLACE[item.place]}
                          alt={t("gameEnd.medalAlt", { place: item.place })}
                          className="podium-medal"
                        />
                      ) : null}
                      <span className="podium-place">{item.place}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="final-score-board">
                {hasRows ? (
                  topRows.map((row, index) => (
                    <div key={row.socketId} className={rowClass(index, row.isMe)}>
                      <div className="final-score-row-left">
                        <div className="final-score-row-rank">{index + 1}</div>
                        <div className="final-score-row-avatar">
                          {row.avatarId && AVATAR_IMAGES[String(row.avatarId)] ? (
                            <img
                              src={AVATAR_IMAGES[String(row.avatarId)]}
                              alt={`Avatar ${row.name}`}
                            />
                          ) : (
                            <span>{(row.name?.charAt(0) || "?").toUpperCase()}</span>
                          )}
                        </div>
                        <div className="final-score-row-name">
                          {row.name}
                          {row.isHost ? <span className="final-score-host">{t("gameEnd.host")}</span> : null}
                        </div>
                      </div>
                      <div className="final-score-row-points">
                        {formatScore(row.score)} {t("gameEnd.point")}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="final-score-empty">{t("gameEnd.noScore")}</div>
                )}
              </div>

              <div className="final-score-actions">
                <button
                  type="button"
                  className="final-score-home-btn"
                  onClick={() => {
                    gameAudioEngine.stopFinalFireworks();
                    setScreen("home");
                  }}
                >
                  {t("gameEnd.backHome")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
