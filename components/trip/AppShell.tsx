"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTrip } from "@/components/trip/TripProvider";
import { buildRuntimeRoundTemplates } from "@/lib/trip/config";
import { canUseTeamEntry } from "@/lib/auth/session";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/results", label: "Results" },
  { href: "/demo", label: "Demo" },
  { href: "/admin", label: "Admin" },
];

const DEMO_ROUTES = ["/", "/rounds/1", "/rounds/1/leaderboard", "/results", "/admin", "/login"];
const DEMO_COPY = [
  {
    title: "Step 1: Dashboard",
    text: "Review status chips, quick access to your scorecard, and where to continue your round.",
  },
  {
    title: "Step 2: Scorecard Entry",
    text: "Enter hole scores with presets, sequential lock, and skipped-hole guidance.",
  },
  {
    title: "Step 3: Live Leaderboard",
    text: "See live standings and team/player progress with mobile-friendly cards.",
  },
  {
    title: "Step 4: Results",
    text: "Review payouts, round winners, and flight outcomes.",
  },
  {
    title: "Step 5: Admin Tools",
    text: "As Sam admin, confirm courses, assign delegates, and resolve discrepancies.",
  },
  {
    title: "Step 6: Access & Login",
    text: "Review how players and admin sign in and where to start using the app.",
  },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    session,
    tripState,
    storageMode,
    demoMode,
    demoStep,
    previousDemoStep,
    setDemoStep,
    endDemoMode,
    logout,
  } = useTrip();
  const visibleLinks = LINKS.filter((link) => (link.href === "/admin" ? session.role === "admin" : true));
  const today = new Date().toISOString().slice(0, 10);
  const player = session.player ?? "";
  const runtimeRounds = buildRuntimeRoundTemplates(tripState.roundGroupings);
  const myRounds = runtimeRounds.filter((round) => round.teeTimes.some((group) => group.players.includes(player)));
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
  const quickTeamIndex = quickRound?.teeTimes.findIndex((group) => group.players.includes(player)) ?? -1;
  const canQuickOpenTeamCard =
    Boolean(quickRound) &&
    [2, 3, 4].includes(quickRound.id) &&
    quickTeamIndex >= 0 &&
    canUseTeamEntry(
      session,
      quickRound.id,
      quickTeamIndex,
      tripState.teamDelegateAssignments[quickRound.id]?.[quickTeamIndex],
      tripState.roundGroupings,
    );
  const quickHoleLabel = quickRound
    ? (() => {
        if (canQuickOpenTeamCard) {
          const teamScores = tripState.teamScores[quickRound.id]?.[quickTeamIndex]?.holeScores ?? [];
          const nextHoleIndex = teamScores.findIndex((value) => value === "");
          if (nextHoleIndex === -1) return "Team Complete";
          return `Team Hole ${nextHoleIndex + 1}`;
        }
        const scores = tripState.individualScores[quickRound.id]?.[player] ?? [];
        if (scores.length === 0) return tripState.roundLive[quickRound.id]?.isStarted ? "Open" : "Start";
        const nextHoleIndex = scores.findIndex((value) => value === "");
        if (nextHoleIndex === -1) return "Complete";
        return `Hole ${nextHoleIndex + 1}`;
      })()
    : "";
  const quickHoleQuery =
    quickRound && quickHoleLabel.startsWith("Hole ") ? `?hole=${quickHoleLabel.replace("Hole ", "")}` : "";
  const quickScoreLabel = quickRound
    ? `${canQuickOpenTeamCard ? "Team scorecard" : "My scorecard"} • ${quickHoleLabel}`
    : "My scorecard";
  const demoInfo = DEMO_COPY[Math.max(0, Math.min(DEMO_COPY.length - 1, demoStep))];
  const demoTarget = DEMO_ROUTES[Math.max(0, Math.min(DEMO_ROUTES.length - 1, demoStep))];
  const isOnDemoStepRoute = pathname === demoTarget;

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
          <div className="row-wrap">
            <span className="muted">
              {session.player ?? "Guest"} {session.role ? `(${session.role})` : ""}
            </span>
            <span className="badge">{storageMode === "server" ? "Cloud sync" : "Local mode"}</span>
          </div>
          <div className="row-wrap">
            {quickRound ? (
              <Link href={`${quickScoreHref}${quickHoleQuery}`} className="button ghost">
                {quickScoreLabel}
              </Link>
            ) : null}
            <button
              type="button"
              className="button ghost"
              onClick={() => {
                void logout();
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      {demoMode ? (
        <section className="demo-coach card" aria-label="Guided demo instructions">
          <div className="row-between">
            <div>
              <p className="eyebrow">Guided Demo</p>
              <h3>{demoInfo.title}</h3>
              <p className="muted">{demoInfo.text}</p>
            </div>
            <span className="badge">
              {demoStep + 1}/{DEMO_COPY.length}
            </span>
          </div>
          <div className="row-wrap">
            <button type="button" className="button ghost" onClick={previousDemoStep} disabled={demoStep === 0}>
              Previous
            </button>
            {isOnDemoStepRoute ? (
              <button
                type="button"
                className="button"
                onClick={() => {
                  const nextStep = Math.min(DEMO_COPY.length - 1, demoStep + 1);
                  setDemoStep(nextStep);
                  router.push(DEMO_ROUTES[nextStep]);
                }}
              >
                {demoStep === DEMO_COPY.length - 1 ? "Stay on final step" : "Next step"}
              </button>
            ) : (
              <button type="button" className="button" onClick={() => router.push(demoTarget)}>
                Go to this step
              </button>
            )}
            <button type="button" className="button ghost" onClick={endDemoMode}>
              Exit demo
            </button>
          </div>
        </section>
      ) : null}
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
