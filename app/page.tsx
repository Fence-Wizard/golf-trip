"use client";

import Link from "next/link";
import { AppShell } from "@/components/trip/AppShell";
import { RequireSession } from "@/components/trip/RequireSession";
import { useTrip } from "@/components/trip/TripProvider";
import { evaluateCourseIntegrity } from "@/lib/trip/courseIntegrity";
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
  const myTeeTime =
    activeRound.teeTimes.find((group) => group.players.includes(session.player ?? ""))?.time ?? "Not assigned";
  const integrity = evaluateCourseIntegrity(tripState.courseDataPublished[activeRound.id], activeRound);
  const publication = tripState.coursePublication[activeRound.id];
  const liveState = tripState.roundLive[activeRound.id];
  const myGroup = activeRound.teeTimes.find((group) => group.players.includes(session.player ?? ""));
  const roundStatus = (roundId: number) => {
    const state = tripState.roundLive[roundId];
    if (state.isFinalized) return "Final";
    if (state.isStarted) return "Live";
    if (state.startedAt) return "Paused";
    return "Not started";
  };

  return (
    <RequireSession>
      <AppShell>
        <section className="grid-cards">
          <article className="card">
            <p className="eyebrow">Today</p>
            <h2>{activeRound.name}</h2>
            <p>{activeRound.course}</p>
            <p className="muted">
              {activeRound.format} | {activeRound.teeWindow}
            </p>
          </article>

          <article className="card">
            <p className="eyebrow">My tee time</p>
            <h2>{myTeeTime}</h2>
            <p className="muted">Role: {session.role}</p>
          </article>

          <article className="card">
            <p className="eyebrow">Quick actions</p>
            <div className="stack-sm">
              <Link href={`/rounds/${activeRound.id}`} className="button">
                Continue my round
              </Link>
              <Link href="/results" className="button ghost">
                View winners and payouts
              </Link>
            </div>
          </article>
        </section>

        <section className="card">
          <p className="eyebrow">Course Data Reliability</p>
          <p>
            {activeRound.name}: {publication.isConfirmed ? "Confirmed" : "Public/unconfirmed"} |{" "}
            {integrity.confirmedHoles}/18 verified holes | yardage {integrity.totalYardage}
            {integrity.expectedTotalYardage ? `/${integrity.expectedTotalYardage}` : ""}
          </p>
          <div className="row-wrap">
            <span
              className={`status-chip ${
                liveState.isFinalized ? "final" : liveState.isStarted ? "live" : liveState.startedAt ? "paused" : "not-started"
              }`}
            >
              {liveState.isFinalized ? "Final" : liveState.isStarted ? "Live" : liveState.startedAt ? "Paused" : "Not started"}
            </span>
            <span className="status-chip confirmed">{publication.isConfirmed ? "Confirmed" : "Unconfirmed"}</span>
          </div>
          {!integrity.yardageMatchesRoundTotal ? (
            <p className="warning">Published yardage does not match expected white-tee total.</p>
          ) : null}
        </section>

        {myGroup ? (
          <section className="card">
            <p className="eyebrow">My Group</p>
            <h3>{myGroup.time}</h3>
            <div className="row-wrap">
              {myGroup.players.map((player) => (
                <span key={player} className="badge">
                  {player}
                </span>
              ))}
            </div>
            <Link href={`/rounds/${activeRound.id}`} className="button">
              Open My Group Round
            </Link>
          </section>
        ) : null}

        <section className="card">
          <h3>All rounds</h3>
          <div className="round-grid">
            {runtimeRounds.map((round) => (
              <Link key={round.id} href={`/rounds/${round.id}`} className="inner-card hoverable">
                <p className="eyebrow">{round.name}</p>
                <p>{round.course}</p>
                <p className="muted">{round.format}</p>
                <span
                  className={`status-chip ${
                    roundStatus(round.id) === "Final"
                      ? "final"
                      : roundStatus(round.id) === "Live"
                        ? "live"
                        : roundStatus(round.id) === "Paused"
                          ? "paused"
                          : "not-started"
                  }`}
                >
                  {roundStatus(round.id)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </AppShell>
    </RequireSession>
  );
}
