"use client";

import { useMemo } from "react";
import { useTrip } from "@/components/trip/TripProvider";
import { buildRuntimeRoundTemplates } from "@/lib/trip/config";

interface ScoreCollectorProps {
  roundId: number;
}

export function ScoreCollector({ roundId }: ScoreCollectorProps) {
  const { tripState, updateIndividualAggregateScore, roundSaveStatus } = useTrip();

  const runtimeRounds = useMemo(
    () => buildRuntimeRoundTemplates(tripState.roundGroupings),
    [tripState.roundGroupings],
  );
  const round = runtimeRounds.find((r) => r.id === roundId) ?? runtimeRounds[0];
  const roundPlayers = round.teeTimes.flatMap((group) => group.players);
  const roundSave = roundSaveStatus[roundId];

  const playerStats = useMemo(() => {
    return roundPlayers.map((player) => {
      const aggregate = tripState.individualAggregateScores[roundId]?.[player] ?? {
        front9: "",
        back9: "",
        total: "",
      };
      const isComplete = aggregate.front9 !== "" && aggregate.back9 !== "" && aggregate.total !== "";
      return { player, aggregate, isComplete };
    });
  }, [roundPlayers, roundId, tripState.individualAggregateScores]);

  return (
    <div className="stack-md">
      <section className="card">
        <div className="row-between">
          <div>
            <p className="eyebrow">Score collection</p>
            <h3>{round.name} — All players</h3>
            <p className="muted">
              Enter front 9, back 9, and total score for each player. Individual hole values are optional.
            </p>
          </div>
          <div className="stack-sm" style={{ textAlign: "right" }}>
            <span className="badge">
              {playerStats.filter((p) => p.isComplete).length}/{playerStats.length} complete
            </span>
            <span className="muted">
              {roundSave?.state === "saving" ? "Saving..." : roundSave?.state === "error" ? "Save issue" : "Saved"}
            </span>
          </div>
        </div>
      </section>

      <section className="card" style={{ overflowX: "auto" }}>
        <table className="collector-grid">
          <thead>
            <tr>
              <th className="collector-player-cell">Player</th>
              <th className="collector-total-cell">Front 9</th>
              <th className="collector-total-cell">Back 9</th>
              <th className="collector-total-cell">Tot</th>
              <th className="collector-progress-cell">Done</th>
            </tr>
          </thead>
          <tbody>
            {playerStats.map(({ player, aggregate, isComplete }) => {
              return (
                <tr key={player} className={`collector-player-row ${isComplete ? "collector-complete" : ""}`}>
                  <td className="collector-player-cell">
                    <span className="collector-player-name">{player}</span>
                  </td>
                  <td className="collector-total-cell">
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={200}
                      value={aggregate.front9}
                      onChange={(e) => {
                        updateIndividualAggregateScore(roundId, player, "front9", e.target.value);
                      }}
                      aria-label={`${player} front nine score`}
                    />
                  </td>
                  <td className="collector-total-cell">
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={200}
                      value={aggregate.back9}
                      onChange={(e) => {
                        updateIndividualAggregateScore(roundId, player, "back9", e.target.value);
                      }}
                      aria-label={`${player} back nine score`}
                    />
                  </td>
                  <td className="collector-total-cell collector-grand-total">
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={200}
                      value={aggregate.total}
                      onChange={(e) => {
                        updateIndividualAggregateScore(roundId, player, "total", e.target.value);
                      }}
                      aria-label={`${player} total score`}
                    />
                  </td>
                  <td className="collector-progress-cell">
                    <span className={`badge ${isComplete ? "badge-complete" : ""}`}>
                      {isComplete ? "Done" : "Pending"}
                    </span>
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
