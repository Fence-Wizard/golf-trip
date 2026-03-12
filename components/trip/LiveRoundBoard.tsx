"use client";

import { useEffect, useMemo, useState } from "react";
import { useTrip } from "@/components/trip/TripProvider";
import { roundTemplates } from "@/lib/trip/config";
import { scoreTeamCards } from "@/lib/trip/scoring";

function completedHoles(values: Array<number | "">): number {
  return values.filter((v) => v !== "").length;
}

export function LiveRoundBoard({ roundId }: { roundId: number }) {
  const { tripState, scoreTotals, session } = useTrip();
  const round = roundTemplates.find((r) => r.id === roundId) ?? roundTemplates[0];
  const isTeamEvent = [2, 3, 4].includes(roundId);
  const entryMode = tripState.roundEntryMode[roundId];
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const scoreStamp = tripState.roundLive[roundId].lastScoreUpdateAt;

  const teamRows = useMemo(() => {
    if (!isTeamEvent) return [];
    if (entryMode === "team") {
      return scoreTeamCards(tripState.teamScores[roundId]).map((row, idx) => ({
        name: row.teamName,
        players: row.players.join(", "),
        total: row.total,
        holesLogged: completedHoles(tripState.teamScores[roundId][idx].holeScores),
        mine: row.players.includes(session.player ?? ""),
      }));
    }
    return round.teeTimes
      .map((group, idx) => ({
        name: `Team ${idx + 1}`,
        players: group.players.join(", "),
        total: group.players.reduce((acc, player) => acc + (scoreTotals[roundId][player] || 0), 0),
        holesLogged: Math.min(
          ...group.players.map((player) => completedHoles(tripState.individualScores[roundId][player])),
        ),
        mine: group.players.includes(session.player ?? ""),
      }))
      .sort((a, b) => {
        const aScore = a.total || 999;
        const bScore = b.total || 999;
        return aScore - bScore;
      });
  }, [
    entryMode,
    isTeamEvent,
    round.teeTimes,
    roundId,
    scoreTotals,
    session.player,
    tripState.individualScores,
    tripState.teamScores,
  ]);

  const groupRows = useMemo(() => {
    if (isTeamEvent) return [];
    return round.teeTimes.map((group, idx) => {
      const playerRows = group.players.map((player) => ({
        player,
        total: scoreTotals[roundId][player],
        holesLogged: completedHoles(tripState.individualScores[roundId][player]),
        mine: player === session.player,
      }));
      return {
        groupName: `Group ${idx + 1} (${group.time})`,
        players: playerRows,
        teamTotal: playerRows.reduce((acc, p) => acc + (p.total || 0), 0),
      };
    });
  }, [isTeamEvent, round.teeTimes, roundId, scoreTotals, session.player, tripState.individualScores]);

  useEffect(() => {
    const stampValue = scoreStamp;
    if (!stampValue) return;
    const timer = window.setInterval(tick, 1000);
    function tick() {
      setSecondsSinceUpdate(Math.max(0, Math.floor((Date.now() - new Date(stampValue ?? 0).getTime()) / 1000)));
    }
    return () => window.clearInterval(timer);
  }, [scoreStamp]);
  const displayedSecondsSinceUpdate = scoreStamp ? secondsSinceUpdate : 0;

  const previousRankMap = useMemo(() => {
    if (!isTeamEvent) return {};
    const latest = [...tripState.scoreEditHistory].reverse().find((event) => event.roundId === roundId);
    if (!latest) return {};
    const delta = Number(latest.nextValue || 0) - Number(latest.previousValue || 0);
    if (delta === 0) return {};

    const priorRows = teamRows.map((row) => ({ ...row }));
    if (latest.targetType === "team" && entryMode === "team") {
      const team = priorRows.find((row) => row.name === latest.targetId);
      if (team) team.total = Math.max(0, team.total - delta);
    } else if (latest.targetType === "player") {
      const team = priorRows.find((row) => row.players.includes(latest.targetId));
      if (team) team.total = Math.max(0, team.total - delta);
    }

    const map: Record<string, number> = {};
    priorRows
      .sort((a, b) => (a.total || 999) - (b.total || 999))
      .forEach((row, idx) => {
        map[row.name] = idx + 1;
      });
    return map;
  }, [entryMode, isTeamEvent, roundId, teamRows, tripState.scoreEditHistory]);

  const sortedTeamRows = useMemo(
    () => [...teamRows].sort((a, b) => (a.total || 999) - (b.total || 999)),
    [teamRows],
  );

  const movement = (name: string, currentRank: number) => {
    const previous = previousRankMap[name];
    if (!previous || previous === currentRank) return "same";
    return currentRank < previous ? "up" : "down";
  };

  return (
    <section className="card masters-live">
      <div className="row-between">
        <div>
          <h3>Live Scoring Board</h3>
          <p className="muted">{isTeamEvent ? "Team view" : "Individual groups"}</p>
        </div>
        <span className="badge">Round {roundId}</span>
      </div>
      <p className="muted">
        Updated {displayedSecondsSinceUpdate}s ago
        {displayedSecondsSinceUpdate >= 120 ? " - feed may be stale." : ""}
      </p>
      {displayedSecondsSinceUpdate >= 120 ? (
        <p className="warning">No score updates for 2+ minutes. Refresh if players are actively posting scores.</p>
      ) : null}

      {isTeamEvent ? (
        <>
          <div className="table-wrap desktop-only">
            <table className="table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>Players</th>
                  <th>Total</th>
                  <th>Holes Logged</th>
                </tr>
              </thead>
              <tbody>
                {sortedTeamRows.map((row, idx) => (
                  <tr key={row.name} className={row.mine ? "my-row" : ""}>
                    <td>
                      {idx + 1}
                      <span className="rank-move">
                        {movement(row.name, idx + 1) === "up"
                          ? " ▲"
                          : movement(row.name, idx + 1) === "down"
                            ? " ▼"
                            : " •"}
                      </span>
                    </td>
                    <td>{row.name}</td>
                    <td>{row.players}</td>
                    <td>{row.total || "-"}</td>
                    <td>{row.holesLogged}/18</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-only live-mobile-stack">
            {sortedTeamRows.map((row, idx) => (
              <article key={`mobile-team-${row.name}`} className={`live-mobile-row ${row.mine ? "my-row" : ""}`}>
                <div className="row-between">
                  <strong>
                    #{idx + 1} {row.name}
                    <span className="rank-move">
                      {movement(row.name, idx + 1) === "up" ? " ▲" : movement(row.name, idx + 1) === "down" ? " ▼" : " •"}
                    </span>
                  </strong>
                  <span className="badge">Total {row.total || "-"}</span>
                </div>
                <p className="muted">{row.players}</p>
                <div className="live-mobile-meta">
                  <span className="badge">Holes {row.holesLogged}/18</span>
                  {row.mine ? <span className="badge">Your team</span> : null}
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="stack-md">
          {groupRows.map((group) => (
            <div key={group.groupName} className="inner-card">
              <div className="row-between">
                <strong>{group.groupName}</strong>
                <span className="badge">Group total: {group.teamTotal || "-"}</span>
              </div>
              <div className="table-wrap desktop-only">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Player</th>
                      <th>Total</th>
                      <th>Holes Logged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...group.players]
                      .sort((a, b) => (a.total || 999) - (b.total || 999))
                      .map((player, idx) => (
                        <tr key={`${group.groupName}-${player.player}`} className={player.mine ? "my-row" : ""}>
                          <td>{idx + 1}</td>
                          <td>{player.player}</td>
                          <td>{player.total || "-"}</td>
                          <td>{player.holesLogged}/18</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="mobile-only live-mobile-stack">
                {[...group.players]
                  .sort((a, b) => (a.total || 999) - (b.total || 999))
                  .map((player, idx) => (
                    <article
                      key={`mobile-${group.groupName}-${player.player}`}
                      className={`live-mobile-row ${player.mine ? "my-row" : ""}`}
                    >
                      <div className="row-between">
                        <strong>
                          #{idx + 1} {player.player}
                        </strong>
                        <span className="badge">Total {player.total || "-"}</span>
                      </div>
                      <div className="live-mobile-meta">
                        <span className="badge">Holes {player.holesLogged}/18</span>
                        {player.mine ? <span className="badge">You</span> : null}
                      </div>
                    </article>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
