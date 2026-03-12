"use client";

import { players, roundTemplates } from "@/lib/trip/config";
import { useTrip } from "@/components/trip/TripProvider";

export function RoundLeaderboard({ roundId }: { roundId: number }) {
  const { scoreTotals } = useTrip();
  const round = roundTemplates.find((r) => r.id === roundId) ?? roundTemplates[0];
  const rows = players
    .map((player) => ({
      player,
      total: scoreTotals[roundId][player],
      teeTime: round.teeTimes.find((g) => g.players.includes(player))?.time ?? "-",
    }))
    .sort((a, b) => {
      const aTotal = a.total || 999;
      const bTotal = b.total || 999;
      return aTotal - bTotal || a.player.localeCompare(b.player);
    });

  return (
    <section className="card">
      <div className="card-header">
        <h3>{round.name} leaderboard</h3>
        <p className="muted">
          {round.course} | {round.format}
        </p>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Tee Time</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${roundId}-${row.player}`}>
                <td>{row.player}</td>
                <td>{row.teeTime}</td>
                <td>{row.total || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
