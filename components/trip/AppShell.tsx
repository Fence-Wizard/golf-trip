"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTrip } from "@/components/trip/TripProvider";
import { roundTemplates } from "@/lib/trip/config";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/results", label: "Results" },
  { href: "/admin", label: "Admin" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, tripState, logout } = useTrip();
  const visibleLinks = LINKS.filter((link) => (link.href === "/admin" ? session.role === "admin" : true));
  const today = new Date().toISOString().slice(0, 10);
  const player = session.player ?? "";
  const myRounds = roundTemplates.filter((round) => round.teeTimes.some((group) => group.players.includes(player)));
  const liveMyRound = myRounds
    .filter((round) => tripState.roundLive[round.id]?.isStarted)
    .sort(
      (a, b) =>
        new Date(tripState.roundLive[b.id]?.lastScoreUpdateAt ?? 0).getTime() -
        new Date(tripState.roundLive[a.id]?.lastScoreUpdateAt ?? 0).getTime(),
    )[0];
  const upcomingMyRound =
    myRounds
      .filter((round) => round.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)[0] ?? myRounds[0];
  const quickRound = liveMyRound ?? upcomingMyRound;
  const quickScoreHref = quickRound ? `/rounds/${quickRound.id}` : "/";
  const quickHoleLabel = quickRound
    ? (() => {
        const scores = tripState.individualScores[quickRound.id]?.[player] ?? [];
        if (scores.length === 0) return tripState.roundLive[quickRound.id]?.isStarted ? "Open" : "Start";
        const nextHoleIndex = scores.findIndex((value) => value === "");
        if (nextHoleIndex === -1) return "Complete";
        return `Hole ${nextHoleIndex + 1}`;
      })()
    : "";
  const quickHoleQuery =
    quickRound && quickHoleLabel.startsWith("Hole ") ? `?hole=${quickHoleLabel.replace("Hole ", "")}` : "";
  const quickScoreLabel = quickRound ? `My scorecard • ${quickHoleLabel}` : "My scorecard";

  return (
    <div className="app-page">
      <header className="top-nav">
        <div>
          <p className="eyebrow">Williamsburg Invitational</p>
          <h1 className="app-title">Williamsburg Golf Trip Championship</h1>
        </div>
        <nav className="nav-links">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? "nav-link active" : "nav-link"}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="session-box">
          <span className="muted">
            {session.player ?? "Guest"} {session.role ? `(${session.role})` : ""}
          </span>
          <div className="row-wrap">
            {quickRound ? (
              <Link href={`${quickScoreHref}${quickHoleQuery}`} className="button ghost">
                {quickScoreLabel}
              </Link>
            ) : null}
            <button type="button" className="button ghost" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="content">{children}</main>
      {quickRound ? (
        <nav className="mobile-score-dock" aria-label="Quick scoring actions">
          <Link href={`${quickScoreHref}${quickHoleQuery}`} className="button">
            {quickScoreLabel}
          </Link>
          <Link href="/results" className="button ghost">
            Results
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
