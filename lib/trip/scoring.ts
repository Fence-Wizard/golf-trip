import {
  BUY_IN,
  FLIGHT_WIN_PAYOUT,
  flights,
  players,
  roundTemplates,
  TEAM_WIN_PAYOUT,
} from "@/lib/trip/config";
import { PayoutSettings, RoundTemplate, ScoreEntryMode, TeamCard } from "@/lib/trip/types";

export function sumScores(values: Array<number | "">): number {
  return values.reduce<number>((acc, val) => acc + (Number(val) || 0), 0);
}

export function buildRoundTotals(
  individualScores: Record<number, Record<string, Array<number | "">>>,
  roster: string[] = players,
  rounds: RoundTemplate[] = roundTemplates,
) {
  const totals: Record<number, Record<string, number>> = {};
  for (const round of rounds) {
    totals[round.id] = {};
    for (const player of roster) {
      totals[round.id][player] = sumScores(individualScores[round.id]?.[player] ?? []);
    }
  }
  return totals;
}

export function scoreTeamCards(teamCards: TeamCard[]) {
  const groups = teamCards.map((card) => ({
    teamName: card.teamName,
    players: card.players,
    total: sumScores(card.holeScores),
  }));

  const completed = groups.filter((g) => g.total > 0);
  const winningScore = completed.length > 0 ? Math.min(...completed.map((g) => g.total)) : null;

  return groups.map((g) => ({
    ...g,
    isWinner: winningScore !== null && g.total === winningScore,
  }));
}

export function buildTeamResults(
  roundTotals: Record<number, Record<string, number>>,
  teamScores: Record<number, TeamCard[]>,
  roundEntryMode: Record<number, ScoreEntryMode>,
  rounds: RoundTemplate[] = roundTemplates,
) {
  return rounds
    .filter((r) => [2, 3, 4].includes(r.id))
    .map((round) => {
      const useTeamCards = roundEntryMode[round.id] === "team";
      if (useTeamCards) {
        return {
          round,
          entryMode: "team" as const,
          groups: scoreTeamCards(teamScores[round.id]),
        };
      }

      const groups = round.teeTimes.map((group, idx) => ({
        teamName: `Team ${idx + 1}`,
        players: group.players,
        total: group.players.reduce((acc, p) => acc + (roundTotals[round.id][p] || 0), 0),
      }));
      const validGroups = groups.filter((g) => g.players.every((p) => roundTotals[round.id][p] > 0));
      const winningScore = validGroups.length > 0 ? Math.min(...validGroups.map((g) => g.total)) : null;

      return {
        round,
        entryMode: "individual" as const,
        groups: groups.map((g) => ({
          ...g,
          isWinner: winningScore !== null && g.total === winningScore,
        })),
      };
    });
}

export function buildFlightResults(roundTotals: Record<number, Record<string, number>>, flightMap: Record<string, string[]> = flights) {
  return Object.entries(flightMap).map(([flight, members]) => {
    const standings = members.map((player) => ({
      player,
      round1: roundTotals[1][player],
      round5: roundTotals[5][player],
      combined: (roundTotals[1][player] || 0) + (roundTotals[5][player] || 0),
    }));
    const complete = standings.filter((s) => s.round1 > 0 && s.round5 > 0);
    const winningScore = complete.length > 0 ? Math.min(...complete.map((s) => s.combined)) : null;
    return {
      flight,
      standings: standings.map((s) => ({
        ...s,
        isWinner: winningScore !== null && s.combined === winningScore,
      })),
    };
  });
}

export function buildPayoutSummary(
  teamResults: ReturnType<typeof buildTeamResults>,
  flightResults: ReturnType<typeof buildFlightResults>,
  roster: string[] = players,
  payoutSettings: PayoutSettings = {
    buyIn: BUY_IN,
    teamWinPayout: TEAM_WIN_PAYOUT,
    flightWinPayout: FLIGHT_WIN_PAYOUT,
  },
) {
  const teamPayouts: Record<string, number> = {};
  const flightPayouts: Record<string, number> = {};
  for (const player of roster) {
    teamPayouts[player] = 0;
    flightPayouts[player] = 0;
  }

  for (const result of teamResults) {
    for (const group of result.groups.filter((g) => g.isWinner)) {
      for (const player of group.players) {
        teamPayouts[player] += payoutSettings.teamWinPayout;
      }
    }
  }

  for (const flight of flightResults) {
    for (const row of flight.standings.filter((s) => s.isWinner)) {
      flightPayouts[row.player] += payoutSettings.flightWinPayout;
    }
  }

  return roster
    .map((player) => {
      const total = teamPayouts[player] + flightPayouts[player];
      return {
        player,
        team: teamPayouts[player],
        flight: flightPayouts[player],
        total,
        net: total - payoutSettings.buyIn,
      };
    })
    .sort((a, b) => b.total - a.total || a.player.localeCompare(b.player));
}

export function splitFrontBack(courseHoles: Array<{ par: number | null; yardage: number | null }>) {
  const front = courseHoles.slice(0, 9);
  const back = courseHoles.slice(9, 18);
  const sum = (list: Array<{ par: number | null; yardage: number | null }>): { par: number; yardage: number } =>
    list.reduce<{ par: number; yardage: number }>(
      (acc, hole) => {
        acc.par += hole.par ?? 0;
        acc.yardage += hole.yardage ?? 0;
        return acc;
      },
      { par: 0, yardage: 0 },
    );
  return {
    front: sum(front),
    back: sum(back),
  };
}
