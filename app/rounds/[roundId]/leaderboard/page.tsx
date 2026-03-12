"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/trip/AppShell";
import { LiveRoundBoard } from "@/components/trip/LiveRoundBoard";
import { RequireSession } from "@/components/trip/RequireSession";
import { useTrip } from "@/components/trip/TripProvider";
import { roundTemplates } from "@/lib/trip/config";

export default function RoundLeaderboardPage() {
  const params = useParams<{ roundId: string }>();
  const { session, tripState, startRoundLive, stopRoundLive, finalizeRound, reopenRound } = useTrip();
  const resolvedRoundId = Number(params.roundId) || 1;
  const round = roundTemplates.find((r) => r.id === resolvedRoundId);

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
              <button className="button ghost" onClick={() => finalizeRound(round.id)}>
                Finalize Round
              </button>
            ) : null}
            {session.role === "admin" && liveState.isFinalized ? (
              <button className="button ghost" onClick={() => reopenRound(round.id)}>
                Reopen Round
              </button>
            ) : null}
          </div>
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

