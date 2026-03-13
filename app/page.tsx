"use client";

import Link from "next/link";
import { AppShell } from "@/components/trip/AppShell";
import { RequireSession } from "@/components/trip/RequireSession";
import { useTrip } from "@/components/trip/TripProvider";
import { canUseTeamEntry } from "@/lib/auth/session";
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
  const liveState = tripState.roundLive[activeRound.id];
  const myGroup = activeRound.teeTimes.find((group) => group.players.includes(session.player ?? ""));
  const myGroupIndex = activeRound.teeTimes.findIndex((group) => group.players.includes(session.player ?? ""));
  const myScores = session.player ? tripState.individualScores[activeRound.id]?.[session.player] ?? [] : [];
  const nextHoleIndex = myScores.findIndex((score) => score === "");
  const commandHole = nextHoleIndex === -1 ? 18 : nextHoleIndex + 1;
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
  const playerName = session.player ?? "Player";
  const statusDescription = liveState.isFinalized
    ? "Today's round is complete. You can review the board or check final payouts."
    : liveState.isStarted
      ? teamScoringAccess
        ? "Scoring is live. Open the round to keep the official team card updated."
        : "Scoring is live. Open the round when you are ready to continue."
      : liveState.startedAt
        ? "The round is paused right now, but your card and leaderboard are still available."
        : "Start here when your tee time arrives. Everything else is available as a shortcut below.";
  const primaryActionLabel =
    nextHoleIndex === -1
      ? "Review my card"
      : teamScoringAccess && [2, 3, 4].includes(activeRound.id)
        ? liveState.isStarted
          ? "Open team scorecard"
          : "Start team scoring"
        : liveState.isStarted
          ? `Continue from Hole ${commandHole}`
          : "Start my round";
  const primaryActionDetail =
    nextHoleIndex === -1
      ? "Your current card is complete, but you can still review it anytime."
      : nextHoleIndex >= 0
        ? `Your next open hole is ${commandHole}.`
        : "Open the round whenever you are ready.";
  const shortcuts = [
    {
      label: "Leaderboard",
      href: leaderboardHref,
    },
    {
      label: "Results",
      href: "/results",
    },
    ...(myGroup
      ? [
          {
            label: "My round",
            href: scoreEntryHref,
          },
        ]
      : []),
    ...(session.role === "admin"
      ? [
          {
            label: "Admin",
            href: "/admin",
          },
        ]
      : []),
  ];
  const todayDetails = [
    {
      label: "Tee time",
      value: myTeeTime,
      detail: "Your starting time for today.",
    },
    {
      label: "My group",
      value: myGroup ? myGroup.players.join(" • ") : "Not assigned",
      detail: myGroup ? `${myGroup.time} tee time.` : "We will show your foursome here once assigned.",
    },
    {
      label: "Format",
      value: activeRound.format,
      detail: activeRound.teeWindow,
    },
  ];
  const showRoundBrowser = session.role === "admin";

  return (
    <RequireSession>
      <AppShell>
        <section className="card home-hero">
          <div className="home-hero-grid">
            <div className="stack-md">
              <div className="stack-sm">
                <p className="eyebrow">Start here</p>
                <h2>Welcome back, {playerName}</h2>
                <p className="home-hero-copy">
                  This home page is your starting point for the day. Open your round when you are ready, or use the
                  shortcuts below if you want to jump somewhere specific.
                </p>
              </div>
              <div className="inner-card">
                <div className="row-between">
                  <div>
                    <p className="eyebrow">Today&apos;s round</p>
                    <h3>{activeRound.name}</h3>
                  </div>
                  <span
                    className={`status-chip ${
                      activeStatus === "Final" ? "final" : activeStatus === "Live" ? "live" : activeStatus === "Paused" ? "paused" : "not-started"
                    }`}
                  >
                    {activeStatus}
                  </span>
                </div>
                <p>{activeRound.course}</p>
                <p className="muted">{statusDescription}</p>
                <div className="row-wrap">
                  <span className="badge">Tee time {myTeeTime}</span>
                  <span className="badge">{activeRound.format}</span>
                  <span className="badge">{activeRound.teeWindow}</span>
                </div>
              </div>
            </div>

            <article className="inner-card home-primary-action">
              <p className="eyebrow">Next action</p>
              <h3>{primaryActionLabel}</h3>
              <p className="muted">{primaryActionDetail}</p>
              <div className="stack-sm">
                <Link href={scoreEntryHref} className="button">
                  {primaryActionLabel}
                </Link>
                <Link href={leaderboardHref} className="button ghost">
                  Open leaderboard
                </Link>
                <Link href="/results" className="button ghost">
                  View results
                </Link>
              </div>
            </article>
          </div>
        </section>

        <section className="grid-cards home-summary-grid">
          <article className="card">
            <div className="card-header">
              <p className="eyebrow">Today</p>
              <h3>What you need</h3>
              <p className="muted">Only the essentials are shown here.</p>
            </div>
            <div className="home-detail-list">
              {todayDetails.map((detail) => (
                <article key={detail.label} className="home-detail-row">
                  <div>
                    <p className="eyebrow">{detail.label}</p>
                    <p className="metric-value">{detail.value}</p>
                  </div>
                  <p className="muted">{detail.detail}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="card">
            <div className="card-header">
              <p className="eyebrow">Shortcuts</p>
              <h3>Optional links</h3>
              <p className="muted">Use these only if you want to skip ahead.</p>
            </div>
            <div className="home-shortcut-buttons">
              {shortcuts.map((shortcut) => (
                <Link key={shortcut.label} href={shortcut.href} className="button ghost">
                  {shortcut.label}
                </Link>
              ))}
            </div>
          </article>
        </section>

        {session.role === "admin" && openDiscrepancies > 0 ? (
          <section className="warning">
            {openDiscrepancies} scoring {openDiscrepancies === 1 ? "issue needs" : "issues need"} admin review for{" "}
            {activeRound.name}. <Link href="/admin">Open admin</Link>
          </section>
        ) : null}

        {showRoundBrowser ? (
          <section className="card">
            <div className="card-header">
              <p className="eyebrow">Admin view</p>
              <h3>Round browser</h3>
              <p className="muted">This stays visible for admin users who need faster access across the full trip.</p>
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
        ) : null}
      </AppShell>
    </RequireSession>
  );
}
