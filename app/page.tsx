"use client";

import Link from "next/link";
import { AppShell } from "@/components/trip/AppShell";
import { RequireSession } from "@/components/trip/RequireSession";
import { useTrip } from "@/components/trip/TripProvider";
import { isAdmin } from "@/lib/auth/session";
import { buildRuntimeRoundTemplates } from "@/lib/trip/config";

function currentRoundId(rounds: ReturnType<typeof buildRuntimeRoundTemplates>) {
  const now = new Date().toISOString().slice(0, 10);
  return rounds.find((round) => round.date >= now)?.id ?? rounds[0].id;
}

export default function Home() {
  const { session, tripState } = useTrip();
  const runtimeRounds = buildRuntimeRoundTemplates(tripState.roundGroupings);
  const activeRoundId = currentRoundId(runtimeRounds);
  const activeRound = runtimeRounds.find((round) => round.id === activeRoundId) ?? runtimeRounds[0];
  const liveState = tripState.roundLive[activeRound.id];
  const adminUser = isAdmin(session);
  const playerName = session.player ?? "Player";

  const roundStatus = (roundId: number) => {
    const state = tripState.roundLive[roundId];
    if (state.isFinalized) return "Final";
    if (state.isStarted) return "Live";
    if (state.startedAt) return "Paused";
    return "Not started";
  };
  const activeStatus = roundStatus(activeRound.id);
  const statusClass = (status: string) =>
    status === "Final" ? "final" : status === "Live" ? "live" : status === "Paused" ? "paused" : "not-started";

  const roundCollectionStats = runtimeRounds.map((round) => {
    const players = round.teeTimes.flatMap((g) => g.players);
    const complete = players.filter((p) => {
      const aggregate = tripState.individualAggregateScores[round.id]?.[p];
      if (aggregate) {
        return aggregate.front9 !== "" && aggregate.back9 !== "" && aggregate.total !== "";
      }
      const scores = tripState.individualScores[round.id]?.[p] ?? [];
      return scores.every((s) => s !== "");
    }).length;
    const totalScored = players.reduce((acc, p) => {
      const aggregateTotal = tripState.individualAggregateScores[round.id]?.[p]?.total;
      if (typeof aggregateTotal === "number" && aggregateTotal > 0) {
        return acc + aggregateTotal;
      }
      const scores = tripState.individualScores[round.id]?.[p] ?? [];
      const holeTotal = scores.reduce<number>((sum, value) => sum + (Number(value) || 0), 0);
      return acc + holeTotal;
    }, 0);
    return { round, players: players.length, complete, totalScored, status: roundStatus(round.id) };
  });

  if (adminUser) {
    return (
      <RequireSession>
        <AppShell>
          <section className="card home-hero">
            <div className="home-hero-grid">
              <div className="stack-md">
                <div className="stack-sm">
                  <p className="eyebrow">Score collector</p>
                  <h2>Welcome back, {playerName}</h2>
                  <p className="home-hero-copy">
                    Collect player scorecards and enter scores round by round. Use the grid view for rapid entry or scan
                    physical cards with the camera.
                  </p>
                </div>
                <div className="inner-card">
                  <div className="row-between">
                    <div>
                      <p className="eyebrow">Active round</p>
                      <h3>{activeRound.name}</h3>
                    </div>
                    <span className={`status-chip ${statusClass(activeStatus)}`}>
                      {activeStatus}
                    </span>
                  </div>
                  <p>{activeRound.course}</p>
                  <p className="muted">
                    {liveState.isFinalized
                      ? "This round is finalized. Review results or adjust scores if needed."
                      : liveState.isStarted
                        ? "Scoring is live. Collect scorecards and enter scores."
                        : "Start the round when players are ready."}
                  </p>
                  <div className="row-wrap">
                    <span className="badge">{activeRound.format}</span>
                    <span className="badge">{activeRound.teeWindow}</span>
                    <span className="badge">
                      {roundCollectionStats.find((s) => s.round.id === activeRound.id)?.complete ?? 0}/
                      {roundCollectionStats.find((s) => s.round.id === activeRound.id)?.players ?? 0} complete
                    </span>
                  </div>
                </div>
              </div>

              <article className="inner-card home-primary-action">
                <p className="eyebrow">Quick actions</p>
                <h3>{liveState.isStarted ? "Collect scores" : "Start round"}</h3>
                <p className="muted">
                  {liveState.isStarted
                    ? "Open the score collector to enter player cards."
                    : "Begin the round to start collecting."}
                </p>
                <div className="stack-sm">
                  <Link href={`/rounds/${activeRound.id}`} className="button">
                    {liveState.isStarted ? "Collect scores" : "Open round"}
                  </Link>
                  <Link href={`/rounds/${activeRound.id}/leaderboard`} className="button ghost">
                    Leaderboard
                  </Link>
                  <Link href="/results" className="button ghost">
                    Results &amp; payouts
                  </Link>
                  <Link href="/admin" className="button ghost">
                    Admin console
                  </Link>
                </div>
              </article>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <p className="eyebrow">Collection dashboard</p>
              <h3>All rounds</h3>
              <p className="muted">Track scorecard collection progress across the trip.</p>
            </div>
            <div className="round-grid">
              {roundCollectionStats.map(({ round, players, complete, status }) => (
                <Link key={round.id} href={`/rounds/${round.id}`} className="inner-card hoverable">
                  <div className="row-between">
                    <p className="eyebrow">{round.name}</p>
                    <span className={`status-chip ${statusClass(status)}`}>{status}</span>
                  </div>
                  <p>{round.course}</p>
                  <p className="muted">{round.format}</p>
                  <div className="row-wrap">
                    <span className={`badge ${complete === players ? "badge-complete" : ""}`}>
                      {complete}/{players} cards
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </AppShell>
      </RequireSession>
    );
  }

  const myGroup = activeRound.teeTimes.find((group) => group.players.includes(session.player ?? ""));
  const myTeeTime = myGroup?.time ?? "Not assigned";

  return (
    <RequireSession>
      <AppShell>
        <section className="card home-hero">
          <div className="home-hero-grid">
            <div className="stack-md">
              <div className="stack-sm">
                <p className="eyebrow">Williamsburg Golf Trip</p>
                <h2>Welcome, {playerName}</h2>
                <p className="home-hero-copy">
                  Scores are being collected by the trip organizer. Check the leaderboard and results anytime to see
                  where you stand.
                </p>
              </div>
              <div className="inner-card">
                <div className="row-between">
                  <div>
                    <p className="eyebrow">Today&apos;s round</p>
                    <h3>{activeRound.name}</h3>
                  </div>
                  <span className={`status-chip ${statusClass(activeStatus)}`}>
                    {activeStatus}
                  </span>
                </div>
                <p>{activeRound.course}</p>
                <div className="row-wrap">
                  <span className="badge">Tee time {myTeeTime}</span>
                  <span className="badge">{activeRound.format}</span>
                  <span className="badge">{activeRound.teeWindow}</span>
                </div>
              </div>
            </div>

            <article className="inner-card home-primary-action">
              <p className="eyebrow">Your view</p>
              <h3>Leaderboard &amp; results</h3>
              <p className="muted">View live standings and final payouts.</p>
              <div className="stack-sm">
                <Link href={`/rounds/${activeRound.id}/leaderboard`} className="button">
                  View leaderboard
                </Link>
                <Link href="/results" className="button ghost">
                  Results &amp; payouts
                </Link>
              </div>
            </article>
          </div>
        </section>

        <section className="grid-cards home-summary-grid">
          <article className="card">
            <div className="card-header">
              <p className="eyebrow">Today</p>
              <h3>Round details</h3>
            </div>
            <div className="home-detail-list">
              <article className="home-detail-row">
                <div>
                  <p className="eyebrow">Tee time</p>
                  <p className="metric-value">{myTeeTime}</p>
                </div>
              </article>
              <article className="home-detail-row">
                <div>
                  <p className="eyebrow">Group</p>
                  <p className="metric-value">{myGroup ? myGroup.players.join(" \u2022 ") : "Not assigned"}</p>
                </div>
              </article>
              <article className="home-detail-row">
                <div>
                  <p className="eyebrow">Format</p>
                  <p className="metric-value">{activeRound.format}</p>
                </div>
              </article>
            </div>
          </article>

          <article className="card">
            <div className="card-header">
              <p className="eyebrow">Quick links</p>
              <h3>Navigate</h3>
            </div>
            <div className="home-shortcut-buttons">
              <Link href={`/rounds/${activeRound.id}/leaderboard`} className="button ghost">
                Leaderboard
              </Link>
              <Link href="/results" className="button ghost">
                Results
              </Link>
            </div>
          </article>
        </section>
      </AppShell>
    </RequireSession>
  );
}
