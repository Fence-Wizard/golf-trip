"use client";

import Link from "next/link";
import { AppShell } from "@/components/trip/AppShell";
import { RequireSession } from "@/components/trip/RequireSession";
import { useTrip } from "@/components/trip/TripProvider";
import { canUseTeamEntry } from "@/lib/auth/session";
import { evaluateCourseIntegrity } from "@/lib/trip/courseIntegrity";
import { buildRuntimeRoundTemplates } from "@/lib/trip/config";

function currentRoundId(rounds: ReturnType<typeof buildRuntimeRoundTemplates>) {
  const now = new Date().toISOString().slice(0, 10);
  return rounds.find((round) => round.date >= now)?.id ?? rounds[0].id;
}

export default function Home() {
  const { session, tripState, storageMode } = useTrip();
  const runtimeRounds = buildRuntimeRoundTemplates(tripState.roundGroupings);
  const activeRoundId = currentRoundId(runtimeRounds);
  const activeRound = runtimeRounds.find((round) => round.id === activeRoundId) ?? runtimeRounds[0];
  const myTeeTime =
    activeRound.teeTimes.find((group) => group.players.includes(session.player ?? ""))?.time ?? "Not assigned";
  const integrity = evaluateCourseIntegrity(tripState.courseDataPublished[activeRound.id], activeRound);
  const publication = tripState.coursePublication[activeRound.id];
  const liveState = tripState.roundLive[activeRound.id];
  const myGroup = activeRound.teeTimes.find((group) => group.players.includes(session.player ?? ""));
  const myGroupIndex = activeRound.teeTimes.findIndex((group) => group.players.includes(session.player ?? ""));
  const myScores = session.player ? tripState.individualScores[activeRound.id]?.[session.player] ?? [] : [];
  const nextHoleIndex = myScores.findIndex((score) => score === "");
  const commandHole = nextHoleIndex === -1 ? 18 : nextHoleIndex + 1;
  const commandLabel =
    nextHoleIndex === -1 ? "View completed card" : liveState.isStarted ? `Resume Hole ${commandHole}` : "Start scoring";
  const teamScoringAccess =
    myGroupIndex >= 0 &&
    [2, 3, 4].includes(activeRound.id) &&
    canUseTeamEntry(
      session,
      activeRound.id,
      myGroupIndex,
      tripState.teamDelegateAssignments[activeRound.id]?.[myGroupIndex],
      tripState.roundGroupings,
    );
  const openDiscrepancies = tripState.teamScoreDiscrepancies.filter(
    (item) => item.roundId === activeRound.id && item.status === "open",
  ).length;
  const recentActivity = tripState.scoreEditHistory.filter((item) => item.roundId === activeRound.id).slice(-4).reverse();
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
          <div className="row-between">
            <div>
              <p className="eyebrow">Command Center</p>
              <h3>{activeRound.name} next actions</h3>
            </div>
            <span className="badge">{storageMode === "server" ? "Cloud updates on" : "Local-only mode"}</span>
          </div>
          <div className="round-grid">
            <article className="inner-card">
              <p className="eyebrow">Your next move</p>
              <strong>{commandLabel}</strong>
              <p className="muted">
                {liveState.isStarted
                  ? "Jump straight back into scoring where you left off."
                  : "Open the round and start posting scores live."}
              </p>
              <Link href={`/rounds/${activeRound.id}${nextHoleIndex >= 0 ? `?hole=${nextHoleIndex + 1}` : ""}`} className="button">
                Open score entry
              </Link>
            </article>
            <article className="inner-card">
              <p className="eyebrow">Live round status</p>
              <strong>{roundStatus(activeRound.id)}</strong>
              <p className="muted">
                {teamScoringAccess
                  ? "You are assigned to post team scores for this round."
                  : [2, 3, 4].includes(activeRound.id)
                    ? "Leaderboard viewing is available while assigned scorers post team scores."
                    : "You can post your own card and follow the live board."}
              </p>
              <Link href={`/rounds/${activeRound.id}/leaderboard`} className="button ghost">
                Open leaderboard
              </Link>
            </article>
            <article className="inner-card">
              <p className="eyebrow">Attention items</p>
              <strong>{openDiscrepancies > 0 ? `${openDiscrepancies} discrepancy alerts` : "No active alerts"}</strong>
              <p className="muted">
                {openDiscrepancies > 0
                  ? "Review mismatched team submissions before finalizing the round."
                  : "Course data, delegates, and scoring are currently clear."}
              </p>
              <Link href={session.role === "admin" ? "/admin" : `/rounds/${activeRound.id}/leaderboard`} className="button ghost">
                {session.role === "admin" ? "Review in admin" : "View live updates"}
              </Link>
            </article>
          </div>
          {recentActivity.length > 0 ? (
            <div className="stack-sm">
              <p className="eyebrow">Recent Activity</p>
              {recentActivity.map((event) => (
                <p key={event.id} className="muted">
                  {event.editedBy} updated {event.targetId} on Hole {event.holeIndex + 1} at{" "}
                  {new Date(event.timestamp).toLocaleTimeString()}.
                </p>
              ))}
            </div>
          ) : (
            <p className="muted">No scores posted yet for the active round.</p>
          )}
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
