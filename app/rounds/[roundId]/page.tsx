"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/trip/AppShell";
import { PlayerScoreEntry } from "@/components/trip/PlayerScoreEntry";
import { RequireSession } from "@/components/trip/RequireSession";
import { ScoreCollector } from "@/components/trip/ScoreCollector";
import { TeamScoreEntry } from "@/components/trip/TeamScoreEntry";
import { useTrip } from "@/components/trip/TripProvider";
import { isAdmin } from "@/lib/auth/session";
import { buildRuntimeRoundTemplates } from "@/lib/trip/config";

export default function RoundPage() {
  const params = useParams<{ roundId: string }>();
  const searchParams = useSearchParams();
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [pendingMode, setPendingMode] = useState<"individual" | "team" | null>(null);
  const [showModeConfirm, setShowModeConfirm] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const { session, tripState, updateRoundEntryMode, startRoundLive, stopRoundLive, finalizeRound, reopenRound } = useTrip();
  const resolvedRoundId = Number(params.roundId) || 1;
  const requestedHole = Math.max(1, Math.min(18, Number(searchParams.get("hole")) || 1));
  const requestedPlayer = searchParams.get("player");
  const requestedTeam = Number(searchParams.get("team"));
  const isReadOnlyView = searchParams.get("view") === "readonly";
  const runtimeRounds = buildRuntimeRoundTemplates(tripState.roundGroupings);
  const round = runtimeRounds.find((r) => r.id === resolvedRoundId);
  if (!round) {
    return (
      <RequireSession>
        <AppShell>
          <section className="card">
            <h2>Round Not Found</h2>
            <p className="warning">This round does not exist. Please return to dashboard and choose a valid round.</p>
            <Link href="/" className="button">
              Back to Dashboard
            </Link>
          </section>
        </AppShell>
      </RequireSession>
    );
  }
  const adminUser = isAdmin(session);
  const roundPlayers = round.teeTimes.flatMap((group) => group.players);
  const myPlayer = session.player && roundPlayers.includes(session.player) ? session.player : roundPlayers[0];
  const requestedPlayerFromLeaderboard =
    requestedPlayer && roundPlayers.includes(requestedPlayer) ? requestedPlayer : null;
  const effectiveSelectedPlayer = adminUser
    ? roundPlayers.includes(selectedPlayer)
      ? selectedPlayer
      : requestedPlayerFromLeaderboard ?? myPlayer
    : requestedPlayerFromLeaderboard ?? myPlayer;
  const requestedTeamIndex =
    Number.isFinite(requestedTeam) && requestedTeam >= 1 && requestedTeam <= round.teeTimes.length
      ? requestedTeam - 1
      : null;
  const mode = tripState.roundEntryMode[round.id];
  const liveState = tripState.roundLive[round.id];
  const canFinalize = adminUser;
  const allowTeamModeToggle = [2, 3, 4].includes(round.id) && adminUser;
  const shouldShowScorecards =
    liveState.isStarted ||
    Boolean(liveState.startedAt) ||
    liveState.isFinalized ||
    requestedPlayerFromLeaderboard !== null ||
    requestedTeamIndex !== null;
  const hasRoundData =
    roundPlayers.some((player) => {
      const aggregate = tripState.individualAggregateScores[round.id]?.[player];
      if (aggregate && (aggregate.front9 !== "" || aggregate.back9 !== "" || aggregate.total !== "")) return true;
      return tripState.individualScores[round.id][player].some((score) => score !== "");
    }) ||
    tripState.teamScores[round.id].some(
      (team) =>
        team.aggregateScore.front9 !== "" || team.aggregateScore.back9 !== "" || team.aggregateScore.total !== "",
    );
  const incompleteCards =
    [2, 3, 4].includes(round.id) && mode === "team"
      ? tripState.teamScores[round.id].filter(
          (team) =>
            team.aggregateScore.front9 === "" ||
            team.aggregateScore.back9 === "" ||
            team.aggregateScore.total === "",
        ).length
      : roundPlayers.filter((player) => {
          const aggregate = tripState.individualAggregateScores[round.id]?.[player];
          if (aggregate) {
            return aggregate.front9 === "" || aggregate.back9 === "" || aggregate.total === "";
          }
          return tripState.individualScores[round.id][player].some((score) => score === "");
        }).length;
  const finalizeRisks = [
    incompleteCards > 0 ? `${incompleteCards} card(s) still have missing front/back/total scores.` : null,
  ].filter((item): item is string => Boolean(item));

  const handleModeChange = (nextMode: "individual" | "team") => {
    if (nextMode === mode) return;
    if (hasRoundData) {
      setPendingMode(nextMode);
      setShowModeConfirm(true);
      return;
    }
    updateRoundEntryMode(round.id, nextMode);
  };

  return (
    <RequireSession>
      <AppShell>
        <section className="card">
          <div className="row-between">
            <div>
              <h2>{round.name} {adminUser ? "score collection" : "scorecard"}</h2>
              <p className="muted">{round.course}</p>
            </div>
            <div className="row-wrap">
              <Link href={`/rounds/${round.id}/leaderboard`} className="button ghost">
                Leaderboard
              </Link>
              <Link href="/results" className="button ghost">
                Results
              </Link>
            </div>
          </div>
          <div className="row-wrap">
            <span className={`status-chip ${liveState.isFinalized ? "final" : liveState.isStarted ? "live" : "not-started"}`}>
              {liveState.isFinalized ? "Final" : liveState.isStarted ? "Live" : "Not started"}
            </span>
            <span className="badge">{round.format}</span>
            <span className="badge">{round.teeWindow}</span>
          </div>
        </section>

        {allowTeamModeToggle ? (
          <section id="entry-mode" className="card">
            <div className="row-between">
              <h3>Entry Mode</h3>
              <select
                className="input mode-select"
                value={mode}
                onChange={(e) => handleModeChange(e.target.value as "individual" | "team")}
              >
                <option value="team">Team scorecard</option>
                <option value="individual">Individual cards</option>
              </select>
            </div>
          </section>
        ) : null}

        {adminUser ? (
          <section id="round-control" className="card masters-start">
            {canFinalize && finalizeRisks.length > 0 ? (
              <div className="warning">
                <strong>Round closing checklist</strong>
                {finalizeRisks.map((risk) => (
                  <p key={risk}>{risk}</p>
                ))}
              </div>
            ) : null}
            <div className="row-between">
              <div>
                <h3>Round status</h3>
                <p className="muted">
                  {liveState.isFinalized
                    ? "Round is finalized. Reopen if score edits are needed."
                    : liveState.isStarted
                      ? "Scoring is open. Finalize here when all scores are entered."
                      : "Start round to open scoring."}
                </p>
              </div>
              <div className="row-wrap">
                {liveState.isStarted ? (
                  <button className="button ghost" onClick={() => stopRoundLive(round.id)}>
                    Pause Round
                  </button>
                ) : (
                  <button className="button" onClick={() => startRoundLive(round.id)} disabled={liveState.isFinalized}>
                    Start Round Live
                  </button>
                )}
                <Link href={`/rounds/${round.id}/leaderboard`} className="button ghost">
                  Open Leaderboard
                </Link>
                {canFinalize && !liveState.isFinalized ? (
                  <button
                    className="button"
                    onClick={() => {
                      if (finalizeRisks.length > 0 && !confirmFinalize) {
                        setConfirmFinalize(true);
                        return;
                      }
                      finalizeRound(round.id);
                      setConfirmFinalize(false);
                    }}
                  >
                    {finalizeRisks.length > 0 && !confirmFinalize ? "Review close-round risks" : "Finalize Round"}
                  </button>
                ) : null}
                {canFinalize && liveState.isFinalized ? (
                  <button className="button ghost" onClick={() => reopenRound(round.id)}>
                    Reopen Round
                  </button>
                ) : null}
              </div>
            </div>
            {confirmFinalize && finalizeRisks.length > 0 ? (
              <div className="warning">
                <p>Finalize anyway? This will lock the round with outstanding checklist items.</p>
                <div className="row-wrap">
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      finalizeRound(round.id);
                      setConfirmFinalize(false);
                    }}
                  >
                    Finalize anyway
                  </button>
                  <button type="button" className="button ghost" onClick={() => setConfirmFinalize(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {shouldShowScorecards ? (
          <>
            {mode === "team" && [2, 3, 4].includes(round.id) ? (
              <div id="score-entry">
                <TeamScoreEntry
                  roundId={round.id}
                  focusTeamIndex={requestedTeamIndex}
                  forceViewOnly={!adminUser || isReadOnlyView}
                />
              </div>
            ) : adminUser ? (
              <div id="score-entry">
                <ScoreCollector roundId={round.id} />
              </div>
            ) : (
              <div id="score-entry">
                <PlayerScoreEntry
                  roundId={round.id}
                  selectedPlayer={effectiveSelectedPlayer}
                  onPlayerChange={setSelectedPlayer}
                  initialHoleIndex={requestedHole - 1}
                  canSelectPlayer={false}
                  viewOnly
                />
              </div>
            )}
          </>
        ) : (
          <section className="card">
            <p className="muted">
              {adminUser ? "Start the round to begin collecting scores." : "Round is not live yet."}
            </p>
            <Link href={`/rounds/${round.id}/leaderboard`} className="button ghost">
              Open leaderboard
            </Link>
          </section>
        )}

        {showModeConfirm && pendingMode ? (
          <section className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm entry mode switch">
            <div className="modal-card">
              <h3>Switch entry mode?</h3>
              <p className="muted">
                Existing scores are already logged. Switching mode may change how winners are calculated.
              </p>
              <div className="row-wrap">
                <button
                  className="button"
                  onClick={() => {
                    updateRoundEntryMode(round.id, pendingMode, true);
                    setShowModeConfirm(false);
                    setPendingMode(null);
                  }}
                >
                  Yes, switch mode
                </button>
                <button
                  className="button ghost"
                  onClick={() => {
                    setShowModeConfirm(false);
                    setPendingMode(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </section>
        ) : null}
      </AppShell>
    </RequireSession>
  );
}
