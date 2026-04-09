"use client";

import { useMemo, useState } from "react";
import { useTrip } from "@/components/trip/TripProvider";
import { PlayerScoreEntry } from "@/components/trip/PlayerScoreEntry";
import { ScorecardCapture } from "@/components/trip/ScorecardCapture";
import { buildRuntimeRoundTemplates } from "@/lib/trip/config";
import { sumScores } from "@/lib/trip/scoring";

interface ScoreCollectorProps {
  roundId: number;
}

export function ScoreCollector({ roundId }: ScoreCollectorProps) {
  const { tripState } = useTrip();
  const [activePlayer, setActivePlayer] = useState<string | null>(null);
  const [scanningPlayer, setScanningPlayer] = useState<string | null>(null);

  const runtimeRounds = useMemo(
    () => buildRuntimeRoundTemplates(tripState.roundGroupings),
    [tripState.roundGroupings],
  );
  const round = runtimeRounds.find((r) => r.id === roundId) ?? runtimeRounds[0];
  const roundPlayers = round.teeTimes.flatMap((group) => group.players);
  const courseHoles = tripState.courseDataPublished[roundId];
  const totalPar = courseHoles.reduce((acc, h) => acc + (h.par ?? 0), 0);

  const playerStats = useMemo(() => {
    return roundPlayers.map((player) => {
      const scores = tripState.individualScores[roundId]?.[player] ?? [];
      const filled = scores.filter((s) => s !== "").length;
      const total = sumScores(scores);
      return { player, scores, filled, total };
    });
  }, [roundPlayers, tripState.individualScores, roundId]);

  if (scanningPlayer) {
    return (
      <ScorecardCapture
        roundId={roundId}
        playerName={scanningPlayer}
        onComplete={() => setScanningPlayer(null)}
        onCancel={() => setScanningPlayer(null)}
      />
    );
  }

  if (activePlayer) {
    return (
      <div className="stack-md">
        <section className="card">
          <div className="row-between">
            <div>
              <p className="eyebrow">Entering scores for</p>
              <h3>{activePlayer}</h3>
            </div>
            <button className="button ghost" onClick={() => setActivePlayer(null)}>
              Back to grid
            </button>
          </div>
        </section>
        <PlayerScoreEntry
          roundId={roundId}
          selectedPlayer={activePlayer}
          onPlayerChange={(p) => setActivePlayer(p)}
          canSelectPlayer
          viewOnly={false}
        />
      </div>
    );
  }

  return (
    <div className="stack-md">
      <section className="card">
        <div className="row-between">
          <div>
            <p className="eyebrow">Score collection</p>
            <h3>{round.name} — All players</h3>
            <p className="muted">
              Tap a player to enter their scorecard, or scan a photo. Par {totalPar}.
            </p>
          </div>
          <div className="stack-sm" style={{ textAlign: "right" }}>
            <span className="badge">
              {playerStats.filter((p) => p.filled === 18).length}/{playerStats.length} complete
            </span>
          </div>
        </div>
      </section>

      <section className="card" style={{ overflowX: "auto" }}>
        <table className="collector-grid">
          <thead>
            <tr>
              <th className="collector-player-cell">Player</th>
              {Array.from({ length: 9 }, (_, i) => (
                <th key={i} className="collector-hole-cell">{i + 1}</th>
              ))}
              <th className="collector-total-cell">Out</th>
              {Array.from({ length: 9 }, (_, i) => (
                <th key={i + 9} className="collector-hole-cell">{i + 10}</th>
              ))}
              <th className="collector-total-cell">In</th>
              <th className="collector-total-cell">Tot</th>
              <th className="collector-progress-cell">Done</th>
              <th className="collector-progress-cell">Scan</th>
            </tr>
            <tr className="collector-par-row">
              <td className="collector-player-cell muted">Par</td>
              {courseHoles.slice(0, 9).map((h, i) => (
                <td key={i} className="collector-hole-cell muted">{h.par ?? "-"}</td>
              ))}
              <td className="collector-total-cell muted">
                {courseHoles.slice(0, 9).reduce((a, h) => a + (h.par ?? 0), 0)}
              </td>
              {courseHoles.slice(9, 18).map((h, i) => (
                <td key={i + 9} className="collector-hole-cell muted">{h.par ?? "-"}</td>
              ))}
              <td className="collector-total-cell muted">
                {courseHoles.slice(9, 18).reduce((a, h) => a + (h.par ?? 0), 0)}
              </td>
              <td className="collector-total-cell muted">{totalPar}</td>
              <td className="collector-progress-cell"></td>
              <td className="collector-progress-cell"></td>
            </tr>
          </thead>
          <tbody>
            {playerStats.map(({ player, scores, filled, total }) => {
              const frontTotal = sumScores(scores.slice(0, 9));
              const backTotal = sumScores(scores.slice(9, 18));
              const isComplete = filled === 18;
              return (
                <tr
                  key={player}
                  className={`collector-player-row ${isComplete ? "collector-complete" : ""}`}
                  onClick={() => setActivePlayer(player)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setActivePlayer(player);
                  }}
                >
                  <td className="collector-player-cell">
                    <span className="collector-player-name">{player}</span>
                  </td>
                  {scores.slice(0, 9).map((s, i) => {
                    const par = courseHoles[i]?.par ?? null;
                    const cls = scoreCellClass(s, par);
                    return (
                      <td key={i} className={`collector-hole-cell ${cls}`}>
                        {s === "" ? "\u00B7" : s}
                      </td>
                    );
                  })}
                  <td className="collector-total-cell">{frontTotal || ""}</td>
                  {scores.slice(9, 18).map((s, i) => {
                    const par = courseHoles[i + 9]?.par ?? null;
                    const cls = scoreCellClass(s, par);
                    return (
                      <td key={i + 9} className={`collector-hole-cell ${cls}`}>
                        {s === "" ? "\u00B7" : s}
                      </td>
                    );
                  })}
                  <td className="collector-total-cell">{backTotal || ""}</td>
                  <td className="collector-total-cell collector-grand-total">
                    {total || ""}
                  </td>
                  <td className="collector-progress-cell">
                    <span className={`badge ${isComplete ? "badge-complete" : ""}`}>
                      {filled}/18
                    </span>
                  </td>
                  <td className="collector-progress-cell">
                    <button
                      className="button ghost"
                      style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", minHeight: "unset" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setScanningPlayer(player);
                      }}
                    >
                      Scan
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function scoreCellClass(score: number | "", par: number | null): string {
  if (score === "" || par === null) return "";
  const diff = score - par;
  if (diff <= -2) return "score-eagle";
  if (diff === -1) return "score-birdie";
  if (diff === 0) return "score-par";
  if (diff === 1) return "score-bogey";
  return "score-double";
}
