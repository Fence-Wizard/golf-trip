"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/trip/AppShell";
import { LiveRoundBoard } from "@/components/trip/LiveRoundBoard";
import { RequireSession } from "@/components/trip/RequireSession";
import { useTrip } from "@/components/trip/TripProvider";
import { buildRuntimeRoundTemplates } from "@/lib/trip/config";

export default function RoundLeaderboardPage() {
  const params = useParams<{ roundId: string }>();
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const { session, tripState, startRoundLive, stopRoundLive, finalizeRound, reopenRound } = useTrip();
  const resolvedRoundId = Number(params.roundId) || 1;
  const runtimeRounds = buildRuntimeRoundTemplates(tripState.roundGroupings);
  const round = runtimeRounds.find((r) => r.id === resolvedRoundId);

  if (!round) {
    return (
      <RequireSession>
        <AppShell>
          <section className="card">
            <h2>Round Not Found</h2>
            <p className="warning">This round does not exist.</p>
            <Link href="/" className="button">
              Back to Dashboard
            </Link>
          </section>
        </AppShell>
      </RequireSession>
    );
  }

  const liveState = tripState.roundLive[round.id];
  const canFinalize = session.role === "admin";
  const roundPlayers = round.teeTimes.flatMap((group) => group.players);
  const incompleteCards =
    [2, 3, 4].includes(round.id) && tripState.roundEntryMode[round.id] === "team"
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
  const openDiscrepancies = tripState.teamScoreDiscrepancies.filter(
    (item) => item.roundId === round.id && item.status === "open",
  ).length;
  const finalizeRisks = [
    incompleteCards > 0 ? `${incompleteCards} card(s) still have missing front/back/total scores.` : null,
    openDiscrepancies > 0 ? `${openDiscrepancies} team discrepancy alert(s) are still unresolved.` : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <RequireSession>
      <AppShell>
        <section className="card">
          <div className="row-between">
            <div>
              <h2>{round.name} leaderboard</h2>
              <p className="muted">{round.course}</p>
            </div>
            <div className="row-wrap">
              <Link href={`/rounds/${round.id}`} className="button">
                Scorecard
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

        <section className="card masters-start">
          {canFinalize && finalizeRisks.length > 0 ? (
            <div className="warning">
              <strong>Finalize checklist</strong>
              {finalizeRisks.map((risk) => (
                <p key={risk}>{risk}</p>
              ))}
            </div>
          ) : null}
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
            {canFinalize && !liveState.isFinalized ? (
              <button
                className="button ghost"
                onClick={() => {
                  if (finalizeRisks.length > 0 && !confirmFinalize) {
                    setConfirmFinalize(true);
                    return;
                  }
                  finalizeRound(round.id);
                  setConfirmFinalize(false);
                }}
              >
                {finalizeRisks.length > 0 && !confirmFinalize ? "Review finalize risks" : "Finalize Round"}
              </button>
            ) : null}
            {session.role === "admin" && liveState.isFinalized ? (
              <button className="button ghost" onClick={() => reopenRound(round.id)}>
                Reopen Round
              </button>
            ) : null}
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

        {liveState.isStarted ? (
          <LiveRoundBoard roundId={round.id} />
        ) : (
          <section className="card">
            <p className="muted">Start round live to display updates.</p>
          </section>
        )}
      </AppShell>
    </RequireSession>
  );
}

