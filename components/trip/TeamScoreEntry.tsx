"use client";

import { useTrip } from "@/components/trip/TripProvider";
import { isAdmin } from "@/lib/auth/session";
import { scoreTeamCards } from "@/lib/trip/scoring";

interface TeamScoreEntryProps {
  roundId: number;
  focusTeamIndex?: number | null;
  forceViewOnly?: boolean;
}

export function TeamScoreEntry({ roundId, focusTeamIndex = null, forceViewOnly = false }: TeamScoreEntryProps) {
  const {
    session,
    tripState,
    updateTeamAggregateScore,
    roundSaveStatus,
  } = useTrip();
  const teams = tripState.teamScores[roundId];
  const scored = scoreTeamCards(teams);
  const visibleTeamIndexes = typeof focusTeamIndex === "number" ? [focusTeamIndex] : teams.map((_, index) => index);
  const save = roundSaveStatus[roundId];
  const adminUser = isAdmin(session);
  const canEdit = adminUser && !forceViewOnly;
  const saveLabel = canEdit
    ? save?.state === "saving"
      ? "Saving..."
      : save?.state === "error"
        ? "Save issue"
        : "Saved"
    : "View only";
  const saveDetail = canEdit
    ? save?.state === "error"
      ? save.message ?? "Please retry."
      : save?.lastSavedAt
        ? `Last saved ${new Date(save.lastSavedAt).toLocaleTimeString()}`
        : "Changes sync automatically."
    : "Viewing team scorecard only.";

  const handleTeamScoreChange = (teamIndex: number, field: "front9" | "back9" | "total", rawValue: string) => {
    if (!canEdit) return;
    updateTeamAggregateScore(roundId, teamIndex, field, rawValue);
  };

  return (
    <section className="card">
      <div className="card-header">
        <div className="row-between">
          <div>
            <p className="eyebrow">Team scoring</p>
            <h2>{focusTeamIndex === null ? "Team Score Entry" : `Team ${focusTeamIndex + 1} scorecard`}</h2>
          </div>
          <span className="badge">{saveLabel}</span>
        </div>
      </div>

      <p className="muted">
        {forceViewOnly
          ? "Viewing a team scorecard in read-only mode."
          : "Enter each team front 9, back 9, and total score directly."}
      </p>
      <div className="row-wrap">
        <span className="badge">{focusTeamIndex === null ? `${visibleTeamIndexes.length} teams` : "Single team view"}</span>
      </div>

      <div className="stack-md">
        {teams.map((team, teamIndex) => {
          if (!visibleTeamIndexes.includes(teamIndex)) return null;
          const teamSummary = scored.find((group) => group.teamName === team.teamName);
          const isComplete =
            team.aggregateScore.front9 !== "" && team.aggregateScore.back9 !== "" && team.aggregateScore.total !== "";

          return (
            <div key={team.teamName} className="inner-card">
              <div className="row-between">
                <div>
                  <p className="eyebrow">Team {teamIndex + 1}</p>
                  <h3>{team.teamName}</h3>
                </div>
                <div className="row-wrap">
                  <span className="badge">Total {teamSummary?.total || "-"}</span>
                  {teamSummary?.isWinner ? <span className="winner-pill">Leader</span> : null}
                  <span className="badge">{canEdit ? "Editable" : "View only"}</span>
                  <span className={`badge ${isComplete ? "badge-complete" : ""}`}>{isComplete ? "Done" : "Pending"}</span>
                </div>
              </div>

              <div className="row-wrap">
                {team.players.map((player) => (
                  <span key={`${team.teamName}-${player}`} className="badge">
                    {player}
                  </span>
                ))}
              </div>

              <div className="team-score-sections">
                <div className="grid-holes">
                  <label className="hole-input">
                    <span>Front 9</span>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={200}
                      value={team.aggregateScore.front9}
                      disabled={!canEdit}
                      aria-label={`Team ${team.teamName} front nine score`}
                      onChange={(e) => handleTeamScoreChange(teamIndex, "front9", e.target.value)}
                    />
                  </label>
                  <label className="hole-input">
                    <span>Back 9</span>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={200}
                      value={team.aggregateScore.back9}
                      disabled={!canEdit}
                      aria-label={`Team ${team.teamName} back nine score`}
                      onChange={(e) => handleTeamScoreChange(teamIndex, "back9", e.target.value)}
                    />
                  </label>
                  <label className="hole-input">
                    <span>Total</span>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={200}
                      value={team.aggregateScore.total}
                      disabled={!canEdit}
                      aria-label={`Team ${team.teamName} total score`}
                      onChange={(e) => handleTeamScoreChange(teamIndex, "total", e.target.value)}
                    />
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {focusTeamIndex === null ? (
        <div className="table-wrap">
          <table className="table table-compact">
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
      ) : null}

      <div className="footer-summary-grid">
        <article className="metric-tile">
          <p className="eyebrow">Visible cards</p>
          <p className="metric-value">{visibleTeamIndexes.length}</p>
        </article>
        <article className="metric-tile">
          <p className="eyebrow">Save status</p>
          <p className="metric-value">{saveLabel}</p>
          <p className="muted">{saveDetail}</p>
        </article>
      </div>

      <div className="row-between">
        <p className="muted">{forceViewOnly ? "Opened from a leaderboard link." : "Admin enters all team scores directly."}</p>
        <span className="badge">{canEdit ? "Aggregate scoring enabled" : "View only"}</span>
      </div>
    </section>
  );
}
