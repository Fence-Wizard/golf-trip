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
  const activeStatus = roundStatus(activeRound.id);
  const scoreEntryHref = `/rounds/${activeRound.id}${nextHoleIndex >= 0 ? `?hole=${nextHoleIndex + 1}` : ""}`;
  const leaderboardHref = `/rounds/${activeRound.id}/leaderboard`;
  const commandDescription = liveState.isStarted
    ? "Pick up right where you left off and keep scores moving."
    : "Open the round when your group is ready to start posting scores.";
  const roundStatusDescription = teamScoringAccess
    ? "You are one of the assigned scorers for this team round."
    : [2, 3, 4].includes(activeRound.id)
      ? "Follow live team updates while the assigned scorers post the official card."
      : "Post your own card and watch the board update hole by hole.";
  const alertDescription =
    openDiscrepancies > 0
      ? "Review mismatched submissions before the round is finalized."
      : "No scoring conflicts or delegate issues are blocking play.";

  return (
    <RequireSession>
      <AppShell>
        <section className="grid-cards dashboard-top-grid">
          <article className="card dashboard-hero">
            <div className="row-between">
              <div className="stack-sm">
                <p className="eyebrow">Today</p>
                <h2>{activeRound.name}</h2>
                <p>{activeRound.course}</p>
                <p className="muted">
                  {activeRound.format} | {activeRound.teeWindow}
                </p>
              </div>
              <span
                className={`status-chip ${
                  activeStatus === "Final" ? "final" : activeStatus === "Live" ? "live" : activeStatus === "Paused" ? "paused" : "not-started"
                }`}
              >
                {activeStatus}
              </span>
            </div>
            <div className="metric-grid">
              <article className="metric-tile">
                <p className="eyebrow">Tee time</p>
                <p className="metric-value">{myTeeTime}</p>
                <p className="muted">Your first checkpoint for the round.</p>
              </article>
              <article className="metric-tile">
                <p className="eyebrow">Role</p>
                <p className="metric-value">{session.role === "admin" ? "Admin" : "Player"}</p>
                <p className="muted">{teamScoringAccess ? "Assigned team scorer today." : "Focused on live viewing and score updates."}</p>
              </article>
              <article className="metric-tile">
                <p className="eyebrow">My group</p>
                <p className="metric-value">{myGroup?.time ?? "Not assigned"}</p>
                <p className="muted">{myGroup ? myGroup.players.join(" • ") : "No foursome assigned for this round yet."}</p>
              </article>
              <article className="metric-tile">
                <p className="eyebrow">Course status</p>
                <p className="metric-value">{publication.isConfirmed ? "Confirmed" : "Needs review"}</p>
                <p className="muted">
                  {integrity.confirmedHoles}/18 verified holes • Yardage {integrity.totalYardage}
                  {integrity.expectedTotalYardage ? `/${integrity.expectedTotalYardage}` : ""}
                </p>
              </article>
            </div>
          </article>

          <article className="card dashboard-actions">
            <p className="eyebrow">Next up</p>
            <h3>{commandLabel}</h3>
            <p className="muted">{commandDescription}</p>
            <div className="stack-sm">
              <Link href={scoreEntryHref} className="button">
                Open score entry
              </Link>
              <Link href={leaderboardHref} className="button ghost">
                Open leaderboard
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
              <p className="metric-value">{commandLabel}</p>
              <p className="muted">{commandDescription}</p>
              <Link href={scoreEntryHref} className="button">
                Open score entry
              </Link>
            </article>
            <article className="inner-card">
              <p className="eyebrow">Live round status</p>
              <p className="metric-value">{activeStatus}</p>
              <p className="muted">{roundStatusDescription}</p>
              <Link href={leaderboardHref} className="button ghost">
                Open leaderboard
              </Link>
            </article>
            <article className="inner-card">
              <p className="eyebrow">Attention items</p>
              <p className="metric-value">{openDiscrepancies > 0 ? `${openDiscrepancies} alerts` : "All clear"}</p>
              <p className="muted">{alertDescription}</p>
              <Link href={session.role === "admin" ? "/admin" : leaderboardHref} className="button ghost">
                {session.role === "admin" ? "Review in admin" : "View live updates"}
              </Link>
            </article>
          </div>
          {recentActivity.length > 0 ? (
            <div className="stack-sm">
              <p className="eyebrow">Recent Activity</p>
              <div className="activity-list">
                {recentActivity.map((event) => (
                  <article key={event.id} className="activity-item">
                    <strong>
                      {event.targetId} • Hole {event.holeIndex + 1}
                    </strong>
                    <p className="muted">
                      {event.editedBy} updated this card at {new Date(event.timestamp).toLocaleTimeString()}.
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <p className="muted">No scores posted yet for the active round.</p>
          )}
        </section>

        <section className="card">
          <div className="row-between">
            <div>
              <p className="eyebrow">Course data</p>
              <h3>Reliability snapshot</h3>
            </div>
            <span className="status-chip confirmed">{publication.isConfirmed ? "Confirmed" : "Unconfirmed"}</span>
          </div>
          <div className="metric-grid">
            <article className="metric-tile">
              <p className="eyebrow">Verified holes</p>
              <p className="metric-value">
                {integrity.confirmedHoles}/18
              </p>
              <p className="muted">Holes with verified par, yardage, and handicap data.</p>
            </article>
            <article className="metric-tile">
              <p className="eyebrow">Published yardage</p>
              <p className="metric-value">
                {integrity.totalYardage}
                {integrity.expectedTotalYardage ? ` / ${integrity.expectedTotalYardage}` : ""}
              </p>
              <p className="muted">Checks the live card against the expected white-tee total.</p>
            </article>
            <article className="metric-tile">
              <p className="eyebrow">Round status</p>
              <p className="metric-value">{activeStatus}</p>
              <p className="muted">Useful when checking if scoring and course confirmation are aligned.</p>
            </article>
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
            <Link href={scoreEntryHref} className="button">
              Open my group round
            </Link>
          </section>
        ) : null}

        <section className="card">
          <div className="card-header">
            <p className="eyebrow">Tournament view</p>
            <h3>All rounds</h3>
            <p className="muted">Open any round to jump into its scorecard or follow the leaderboard.</p>
          </div>
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
