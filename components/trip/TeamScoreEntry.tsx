"use client";

import { useTrip } from "@/components/trip/TripProvider";
import { canUseTeamEntry } from "@/lib/auth/session";
import { getTeamScorers } from "@/lib/trip/config";
import { scoreTeamCards } from "@/lib/trip/scoring";

export function TeamScoreEntry({ roundId }: { roundId: number }) {
  const {
    session,
    tripState,
    updateTeamHoleScore,
    maxStrokesPerHole,
    roundSaveStatus,
    undoLastScoreEdit,
    resolveTeamScoreDiscrepancy,
  } = useTrip();
  const teams = tripState.teamScores[roundId];
  const roundCourse = tripState.courseDataPublished[roundId];
  const scored = scoreTeamCards(teams);
  const save = roundSaveStatus[roundId];
  const openDiscrepancies = tripState.teamScoreDiscrepancies.filter(
    (item) => item.roundId === roundId && item.status === "open",
  );

  return (
    <section className="card">
      <div className="card-header">
        <h2>Team Score Entry</h2>
      </div>

      <p className="muted">Each team uses two scorers (captain + delegate). Mismatches require review.</p>

      <div className="stack-md">
        {teams.map((team, teamIndex) => {
          const delegateOverride = tripState.teamDelegateAssignments[roundId]?.[teamIndex];
          const [scorerA, scorerB] = getTeamScorers(roundId, teamIndex, delegateOverride);
          const canEditThisTeam = canUseTeamEntry(session, roundId, teamIndex, delegateOverride);
          return (
            <div key={team.teamName} className="inner-card">
            <div className="row-between">
              <h3>{team.teamName}</h3>
              <div className="row-wrap">
                <span className="badge">{team.players.join(", ")}</span>
                <span className="badge">Scorers: {[scorerA, scorerB].join(" + ")}</span>
              </div>
            </div>
            {!canEditThisTeam ? (
              <p className="warning">Only assigned scorers for this team can enter this card.</p>
            ) : null}
            <div className="grid-holes">
              {team.holeScores.map((score, holeIndex) => (
                <label key={`${team.teamName}-${holeIndex}`} className="hole-input">
                  <span>H{holeIndex + 1}</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={Math.min(maxStrokesPerHole, (roundCourse[holeIndex]?.par ?? 4) + 2)}
                    value={score}
                    disabled={!canEditThisTeam}
                    aria-label={`Team ${team.teamName} hole ${holeIndex + 1} score`}
                    onChange={(e) => {
                      if (e.target.value.trim() === "") {
                        updateTeamHoleScore(roundId, teamIndex, holeIndex, "");
                        return;
                      }
                      const numeric = Number(e.target.value);
                      if (Number.isNaN(numeric)) return;
                      const holeMax = Math.min(maxStrokesPerHole, (roundCourse[holeIndex]?.par ?? 4) + 2);
                      const clamped = Math.max(1, Math.min(holeMax, Math.trunc(numeric)));
                      updateTeamHoleScore(roundId, teamIndex, holeIndex, String(clamped));
                    }}
                  />
                </label>
              ))}
            </div>
            </div>
          );
        })}
      </div>

      {openDiscrepancies.length > 0 ? (
        <section className="warning">
          <p>
            Open discrepancies: {openDiscrepancies.length}. Review with both scorers and resolve before finalizing.
          </p>
          <div className="stack-sm">
            {openDiscrepancies.map((item) => (
              <div key={item.id} className="inner-card">
                <p>
                  {item.teamName} - Hole {item.holeIndex + 1}: {item.scorerA}={item.scoreA || "-"} vs {item.scorerB}=
                  {item.scoreB || "-"}
                </p>
                {session.role === "admin" ? (
                  <div className="row-wrap">
                    <button
                      type="button"
                      className="button ghost"
                      onClick={() => resolveTeamScoreDiscrepancy(item.roundId, item.teamIndex, item.holeIndex, "A")}
                    >
                      Override with {item.scorerA}
                    </button>
                    <button
                      type="button"
                      className="button ghost"
                      onClick={() => resolveTeamScoreDiscrepancy(item.roundId, item.teamIndex, item.holeIndex, "B")}
                    >
                      Override with {item.scorerB}
                    </button>
                  </div>
                ) : (
                  <p className="muted">Admin override required if scorers cannot resolve.</p>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Total</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {scored.map((group) => (
              <tr key={group.teamName}>
                <td>{group.teamName}</td>
                <td>{group.total || "-"}</td>
                <td>{group.isWinner ? "Winner" : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row-between">
        <p className="muted">
          Save status:{" "}
          {save?.state === "saving"
            ? "Saving..."
            : save?.state === "error"
              ? `Error (${save.message ?? "retry"})`
              : "Saved"}
          {save?.lastSavedAt ? ` | Last saved ${new Date(save.lastSavedAt).toLocaleTimeString()}` : ""}
        </p>
        <button type="button" className="button ghost" onClick={() => undoLastScoreEdit(roundId)}>
          Undo last edit
        </button>
      </div>
    </section>
  );
}
