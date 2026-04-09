import { describe, expect, it } from "vitest";
import {
  buildFlightResults,
  buildPayoutSummary,
  buildRoundTotals,
  buildTeamResults,
  scoreTeamCards,
  sumScores,
} from "@/lib/trip/scoring";
import { buildInitialIndividualScores, buildInitialRoundEntryModes, buildInitialTeamScores, players } from "@/lib/trip/config";

describe("sumScores", () => {
  it("adds numeric values and ignores empty strings", () => {
    expect(sumScores([4, 5, "", 3])).toBe(12);
  });
});

describe("team scoring", () => {
  it("marks tied lowest team scores as winners", () => {
    const scored = scoreTeamCards([
      { teamName: "Team 1", players: ["A"], holeScores: [3, 4, 3], aggregateScore: { front9: "", back9: "", total: "" } },
      { teamName: "Team 2", players: ["B"], holeScores: [3, 4, 3], aggregateScore: { front9: "", back9: "", total: "" } },
      { teamName: "Team 3", players: ["C"], holeScores: [4, 4, 4], aggregateScore: { front9: "", back9: "", total: "" } },
    ]);

    expect(scored.filter((s) => s.isWinner)).toHaveLength(2);
    expect(scored[0].isWinner).toBe(true);
    expect(scored[1].isWinner).toBe(true);
    expect(scored[2].isWinner).toBe(false);
  });
});

describe("full payout flow", () => {
  it("produces payouts and net values", () => {
    const scores = buildInitialIndividualScores();
    const roundModes = buildInitialRoundEntryModes();
    const teamScores = buildInitialTeamScores();

    for (const player of players) {
      scores[1][player] = Array.from({ length: 18 }, () => 5);
      scores[5][player] = Array.from({ length: 18 }, () => 5);
    }

    // Force flight A winner to Lee.
    scores[1]["Lee"] = Array.from({ length: 18 }, () => 4);
    scores[5]["Lee"] = Array.from({ length: 18 }, () => 4);

    // Use team scorecards for rounds 2-4 with Team 1 winner each round.
    roundModes[2] = "team";
    roundModes[3] = "team";
    roundModes[4] = "team";
    for (const roundId of [2, 3, 4]) {
      teamScores[roundId][0].holeScores = Array.from({ length: 18 }, () => 4);
      teamScores[roundId][1].holeScores = Array.from({ length: 18 }, () => 5);
      teamScores[roundId][2].holeScores = Array.from({ length: 18 }, () => 6);
    }

    const totals = buildRoundTotals(scores);
    const teamResults = buildTeamResults(totals, teamScores, roundModes);
    const flightResults = buildFlightResults(totals);
    const payout = buildPayoutSummary(teamResults, flightResults);

    const lee = payout.find((p) => p.player === "Lee");
    expect(lee).toBeDefined();
    expect((lee?.total ?? 0) >= 120).toBe(true);

    const leader = payout[0];
    expect(leader.total).toBeGreaterThanOrEqual(leader.net + 100);
  });
});
