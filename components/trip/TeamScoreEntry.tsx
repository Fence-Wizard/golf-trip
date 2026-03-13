"use client";

import { useTrip } from "@/components/trip/TripProvider";
import { canUseTeamEntry } from "@/lib/auth/session";
import { getTeamScorers } from "@/lib/trip/config";
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
    updateTeamHoleScore,
    maxStrokesPerHole,
    roundSaveStatus,
    undoLastScoreEdit,
    resolveTeamScoreDiscrepancy,
  } = useTrip();
  const teams = tripState.teamScores[roundId];
  const roundCourse = tripState.courseDataPublished[roundId];
  const scored = scoreTeamCards(teams);
  const visibleTeamIndexes = typeof focusTeamIndex === "number" ? [focusTeamIndex] : teams.map((_, index) => index);
  const save = roundSaveStatus[roundId];
  const openDiscrepancies = tripState.teamScoreDiscrepancies.filter(
    (item) =>
      item.roundId === roundId &&
      item.status === "open" &&
      (focusTeamIndex === null || item.teamIndex === focusTeamIndex),
  );
  const canEditVisibleTeams = visibleTeamIndexes.some((teamIndex) =>
    !forceViewOnly &&
    canUseTeamEntry(
      session,
      roundId,
      teamIndex,
      tripState.teamDelegateAssignments[roundId]?.[teamIndex],
      tripState.roundGroupings,
    ),
  );
  const saveLabel = canEditVisibleTeams
    ? save?.state === "saving"
      ? "Saving..."
      : save?.state === "error"
        ? "Save issue"
        : "Saved"
    : "View only";
  const saveDetail = canEditVisibleTeams
    ? save?.state === "error"
      ? save.message ?? "Please retry."
      : save?.lastSavedAt
        ? `Last saved ${new Date(save.lastSavedAt).toLocaleTimeString()}`
        : "Changes sync automatically."
    : "Viewing team scorecard only.";

  const handleTeamScoreChange = (teamIndex: number, holeIndex: number, rawValue: string, canEditThisTeam: boolean) => {
    if (!canEditThisTeam) return;
    if (rawValue.trim() === "") {
      updateTeamHoleScore(roundId, teamIndex, holeIndex, "");
      return;
    }
    const numeric = Number(rawValue);
    if (Number.isNaN(numeric)) return;
    const holeMax = Math.min(maxStrokesPerHole, (roundCourse[holeIndex]?.par ?? 4) + 2);
    const clamped = Math.max(1, Math.min(holeMax, Math.trunc(numeric)));
    updateTeamHoleScore(roundId, teamIndex, holeIndex, String(clamped));
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
          : "Each team uses two scorers (captain + delegate). Mismatches require review."}
      </p>
      <div className="row-wrap">
        <span className="badge">{focusTeamIndex === null ? `${visibleTeamIndexes.length} teams` : "Single team view"}</span>
        <span className="badge">
          {openDiscrepancies.length} open {openDiscrepancies.length === 1 ? "discrepancy" : "discrepancies"}
        </span>
      </div>

      <div className="stack-md">
        {teams.map((team, teamIndex) => {
          if (!visibleTeamIndexes.includes(teamIndex)) return null;
          const delegateOverride = tripState.teamDelegateAssignments[roundId]?.[teamIndex];
          const [scorerA, scorerB] = getTeamScorers(roundId, teamIndex, delegateOverride, tripState.roundGroupings);
          const canEditThisTeam =
            !forceViewOnly &&
            canUseTeamEntry(session, roundId, teamIndex, delegateOverride, tripState.roundGroupings);
          const teamSummary = scored.find((group) => group.teamName === team.teamName);
          const frontScores = team.holeScores.slice(0, 9);
          const backScores = team.holeScores.slice(9);
          const frontTotal = frontScores.reduce<number>((sum, value) => (value === "" ? sum : sum + Number(value)), 0);
          const backTotal = backScores.reduce<number>((sum, value) => (value === "" ? sum : sum + Number(value)), 0);

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
                  <span className="badge">{canEditThisTeam ? "Editable" : "View only"}</span>
                </div>
              </div>

              <div className="row-wrap">
                {team.players.map((player) => (
                  <span key={`${team.teamName}-${player}`} className="badge">
                    {player}
                  </span>
                ))}
              </div>

              <div className="row-wrap">
                <span className="badge">Captain {scorerA}</span>
                <span className="badge">Delegate {scorerB}</span>
              </div>

              {!canEditThisTeam ? (
                <p className={forceViewOnly ? "muted" : "warning"}>
                  {forceViewOnly ? "Opened from the leaderboard in view-only mode." : "Only assigned scorers for this team can enter this card."}
                </p>
              ) : null}

              <div className="team-score-sections">
                <div className="stack-sm">
                  <div className="row-between">
                    <p className="eyebrow">Front 9</p>
                    <span className="badge">Total {frontTotal || "-"}</span>
                  </div>
                  <div className="grid-holes team-hole-grid">
                    {frontScores.map((score, holeIndex) => (
                      <label key={`${team.teamName}-${holeIndex}`} className="hole-input team-hole-input">
                        <span>
                          H{holeIndex + 1} • Par {roundCourse[holeIndex]?.par ?? "-"}
                        </span>
                        <input
                          className="input"
                          type="number"
                          min={1}
                          max={Math.min(maxStrokesPerHole, (roundCourse[holeIndex]?.par ?? 4) + 2)}
                          value={score}
                          disabled={!canEditThisTeam}
                          aria-label={`Team ${team.teamName} hole ${holeIndex + 1} score`}
                          onChange={(e) => handleTeamScoreChange(teamIndex, holeIndex, e.target.value, canEditThisTeam)}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="stack-sm">
                  <div className="row-between">
                    <p className="eyebrow">Back 9</p>
                    <span className="badge">Total {backTotal || "-"}</span>
                  </div>
                  <div className="grid-holes team-hole-grid">
                    {backScores.map((score, idx) => {
                      const holeIndex = idx + 9;
                      return (
                        <label key={`${team.teamName}-${holeIndex}`} className="hole-input team-hole-input">
                          <span>
                            H{holeIndex + 1} • Par {roundCourse[holeIndex]?.par ?? "-"}
                          </span>
                          <input
                            className="input"
                            type="number"
                            min={1}
                            max={Math.min(maxStrokesPerHole, (roundCourse[holeIndex]?.par ?? 4) + 2)}
                            value={score}
                            disabled={!canEditThisTeam}
                            aria-label={`Team ${team.teamName} hole ${holeIndex + 1} score`}
                            onChange={(e) => handleTeamScoreChange(teamIndex, holeIndex, e.target.value, canEditThisTeam)}
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
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
          <p className="eyebrow">Open discrepancies</p>
          <p className="metric-value">{openDiscrepancies.length}</p>
        </article>
        <article className="metric-tile">
          <p className="eyebrow">Save status</p>
          <p className="metric-value">{saveLabel}</p>
          <p className="muted">{saveDetail}</p>
        </article>
      </div>

      <div className="row-between">
        <p className="muted">{forceViewOnly ? "Opened from a leaderboard link." : "Assigned scorers can post the official team card."}</p>
        {canEditVisibleTeams ? (
          <button type="button" className="button ghost" onClick={() => undoLastScoreEdit(roundId)}>
            Undo last edit
          </button>
        ) : (
          <span className="badge">View only</span>
        )}
      </div>
    </section>
  );
}
