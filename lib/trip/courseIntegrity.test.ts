import { describe, expect, it } from "vitest";
import { evaluateCourseIntegrity } from "@/lib/trip/courseIntegrity";
import { roundTemplates, seededCourseDataByRound } from "@/lib/trip/config";

describe("course integrity", () => {
  it("keeps public seeded totals aligned for rounds with known white totals", () => {
    for (const round of roundTemplates.filter((r) => r.whiteTeeTotalYardage != null)) {
      const report = evaluateCourseIntegrity(seededCourseDataByRound[round.id], round);
      expect(report.completeHoles).toBe(18);
      expect(report.yardageMatchesRoundTotal).toBe(true);
    }
  });

  it("tracks unconfirmed data separately from confirmed data", () => {
    const round = roundTemplates[0];
    const report = evaluateCourseIntegrity(seededCourseDataByRound[round.id], round);
    expect(report.confirmedHoles).toBe(0);
    expect(report.confidenceCounts.public).toBeGreaterThan(0);
  });
});
