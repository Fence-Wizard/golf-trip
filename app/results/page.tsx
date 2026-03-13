"use client";

import Link from "next/link";
import { AppShell } from "@/components/trip/AppShell";
import { RequireSession } from "@/components/trip/RequireSession";
import { useTrip } from "@/components/trip/TripProvider";
import { buildRuntimeRoundTemplates } from "@/lib/trip/config";

export default function ResultsPage() {
  const { teamResults, flightResults, payoutSummary, tripState } = useTrip();
  const runtimeRounds = buildRuntimeRoundTemplates(tripState.roundGroupings);
  const roundPriority = [...runtimeRounds]
    .map((round) => ({ round, live: tripState.roundLive[round.id] }))
    .sort((a, b) => {
      const aLive = a.live?.isStarted ? 1 : 0;
      const bLive = b.live?.isStarted ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive;

      const aUpdate = new Date(a.live?.lastScoreUpdateAt ?? 0).getTime();
      const bUpdate = new Date(b.live?.lastScoreUpdateAt ?? 0).getTime();
      if (aUpdate !== bUpdate) return bUpdate - aUpdate;

      const aStart = new Date(a.live?.startedAt ?? 0).getTime();
      const bStart = new Date(b.live?.startedAt ?? 0).getTime();
      if (aStart !== bStart) return bStart - aStart;

      return a.round.id - b.round.id;
    })[0]?.round;
  const prioritizedTeamResults = [...teamResults].sort((a, b) => {
    if (!roundPriority) return a.round.id - b.round.id;
    if (a.round.id === roundPriority.id) return -1;
    if (b.round.id === roundPriority.id) return 1;
    return a.round.id - b.round.id;
  });
  const currentMatchStatus = roundPriority
    ? tripState.roundLive[roundPriority.id].isStarted
      ? "Live"
      : tripState.roundLive[roundPriority.id].isFinalized
        ? "Final"
        : "Not started"
    : "Not started";
  const biggestWinner = payoutSummary[0];
  const totalPaidOut = payoutSummary.reduce((acc, row) => acc + row.total, 0);
  const closestFlight = flightResults
    .map((flight) => {
      const complete = [...flight.standings].filter((row) => row.round1 > 0 && row.round5 > 0).sort((a, b) => a.combined - b.combined);
      if (complete.length < 2) return null;
      return {
        flight: flight.flight,
        margin: complete[1].combined - complete[0].combined,
      };
    })
    .filter((row): row is { flight: string; margin: number } => Boolean(row))
    .sort((a, b) => a.margin - b.margin)[0];

  return (
    <RequireSession>
      <AppShell>
        {roundPriority ? (
          <section className="card current-match-card">
            <div className="row-between">
              <div>
                <h2>Current Match Focus</h2>
                <p className="muted">
                  Prioritizing {roundPriority.name} - {roundPriority.course}
                </p>
              </div>
              <span className={`status-chip ${currentMatchStatus === "Live" ? "live" : currentMatchStatus === "Final" ? "final" : "not-started"}`}>
                {currentMatchStatus}
              </span>
            </div>
            <div className="row-wrap">
              <Link className="button" href={`/rounds/${roundPriority.id}`}>
                Open current round board
              </Link>
              <span className="badge">Updated {tripState.roundLive[roundPriority.id].lastScoreUpdateAt ? "recently" : "not yet"}</span>
            </div>
          </section>
        ) : null}

        <section className="results-quick-nav row-wrap">
          <a href="#snapshot" className="badge">
            Snapshot
          </a>
          <a href="#round-winners" className="badge">
            Round Winners
          </a>
          <a href="#flight-winners" className="badge">
            Flights
          </a>
          <a href="#payouts" className="badge">
            Payouts
          </a>
        </section>

        <section id="snapshot" className="card summary-banner">
          <h2>Tournament Snapshot</h2>
          <div className="row-wrap">
            <span className="badge">
              Biggest winner: {biggestWinner?.player ?? "-"} ({biggestWinner ? `$${biggestWinner.total}` : "-"})
            </span>
            <span className="badge">
              Closest flight: {closestFlight ? `${closestFlight.flight} (${closestFlight.margin} stroke)` : "Not enough data"}
            </span>
            <span className="badge">Total paid out: ${totalPaidOut}</span>
          </div>
        </section>

        <section id="round-winners" className="card">
          <h2>Round Winners (Rounds 2-4)</h2>
          <p className="muted">Current match appears first when it is a team round.</p>
          <div className="stack-md">
            {prioritizedTeamResults.map((result) => (
              <div key={result.round.id} className="inner-card">
                <div className="row-between">
                  <strong>
                    {result.round.name} - {result.round.course}
                  </strong>
                  <div className="row-wrap">
                    {roundPriority?.id === result.round.id ? <span className="badge">Current match</span> : null}
                    <span className="badge">{result.entryMode === "team" ? "Team mode" : "Individual mode"}</span>
                  </div>
                </div>
                <div className="table-wrap desktop-only">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Team</th>
                        <th>Players</th>
                        <th>Total</th>
                        <th>Payout</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.groups.map((group) => (
                        <tr key={`${result.round.id}-${group.teamName}`}>
                          <td>{group.teamName}</td>
                          <td>{group.players.join(", ")}</td>
                          <td>{group.total || "-"}</td>
                          <td>
                            {group.isWinner ? (
                              <span className="winner-pill">Shared winner - ${tripState.payoutSettings.teamWinPayout}/player</span>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mobile-only stack-sm">
                  {result.groups.map((group) => (
                    <article key={`mobile-${result.round.id}-${group.teamName}`} className="result-mobile-row">
                      <div className="row-between">
                        <strong>{group.teamName}</strong>
                        <span className="badge">Total {group.total || "-"}</span>
                      </div>
                      <p className="muted">{group.players.join(", ")}</p>
                      <p>
                        {group.isWinner ? (
                          <span className="winner-pill">Shared winner - ${tripState.payoutSettings.teamWinPayout}/player</span>
                        ) : (
                          "-"
                        )}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="flight-winners" className="card">
          <h2>Flight Winners (Rounds 1 + 5)</h2>
          <p className="muted">Formatted with per-round context so ties and margins are easier to verify.</p>
          <div className="round-grid">
            {flightResults.map((flight) => (
              <div key={flight.flight} className="inner-card">
                <h3>{flight.flight} Flight</h3>
                <div className="table-wrap desktop-only">
                  <table className="table table-compact">
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>R1</th>
                        <th>R5</th>
                        <th>Combined</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...flight.standings]
                        .sort((a, b) => (a.combined || 999) - (b.combined || 999))
                        .map((row) => (
                          <tr key={row.player}>
                            <td>{row.player}</td>
                            <td>{row.round1 || "-"}</td>
                            <td>{row.round5 || "-"}</td>
                            <td>{row.combined || "-"}</td>
                            <td>
                              {row.isWinner ? <span className="winner-pill">Shared winner ${tripState.payoutSettings.flightWinPayout}</span> : "-"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <div className="mobile-only stack-sm">
                  {[...flight.standings]
                    .sort((a, b) => (a.combined || 999) - (b.combined || 999))
                    .map((row) => (
                      <article key={`flight-mobile-${flight.flight}-${row.player}`} className="result-mobile-row">
                        <div className="row-between">
                          <strong>{row.player}</strong>
                          <span className="badge">{row.combined || "-"} total</span>
                        </div>
                        <p className="muted">
                          R1 {row.round1 || "-"} | R5 {row.round5 || "-"}
                        </p>
                        <p>
                          {row.isWinner ? <span className="winner-pill">Shared winner ${tripState.payoutSettings.flightWinPayout}</span> : "-"}
                        </p>
                      </article>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="payouts" className="card">
          <h2>Who Won What</h2>
          <div className="table-wrap desktop-only">
            <table className="table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Team</th>
                  <th>Flight</th>
                  <th>Total Won</th>
                  <th>{`Net vs $${tripState.payoutSettings.buyIn}`}</th>
                </tr>
              </thead>
              <tbody>
                {payoutSummary.map((row) => (
                  <tr key={row.player}>
                    <td>{row.player}</td>
                    <td>${row.team}</td>
                    <td>${row.flight}</td>
                    <td>${row.total}</td>
                    <td className={row.net >= 0 ? "positive" : "negative"}>
                      {row.net >= 0 ? "+" : ""}${row.net}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-only stack-sm">
            {payoutSummary.map((row) => (
              <article key={`payout-mobile-${row.player}`} className="result-mobile-row">
                <div className="row-between">
                  <strong>{row.player}</strong>
                  <strong className={row.net >= 0 ? "positive" : "negative"}>
                    {row.net >= 0 ? "+" : ""}${row.net}
                  </strong>
                </div>
                <p className="muted">
                  Team ${row.team} | Flight ${row.flight}
                </p>
                <p>Total won: ${row.total}</p>
              </article>
            ))}
          </div>
        </section>
      </AppShell>
    </RequireSession>
  );
}
