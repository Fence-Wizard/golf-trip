import { HoleData, RoundTemplate } from "@/lib/trip/types";

export interface CourseIntegrityReport {
  completeHoles: number;
  missingPars: number;
  missingYardages: number;
  duplicateHandicapIndexes: number;
  totalYardage: number;
  expectedTotalYardage: number | null;
  yardageMatchesRoundTotal: boolean;
  confirmedHoles: number;
  confidenceCounts: Record<"unknown" | "public" | "confirmed", number>;
}

export function evaluateCourseIntegrity(holes: HoleData[], round: RoundTemplate): CourseIntegrityReport {
  const handicapCounts = new Map<number, number>();
  let totalYardage = 0;
  let completeHoles = 0;
  let missingPars = 0;
  let missingYardages = 0;
  let confirmedHoles = 0;
  const confidenceCounts = { unknown: 0, public: 0, confirmed: 0 };

  for (const hole of holes) {
    if (hole.par == null) missingPars += 1;
    if (hole.yardage == null) missingYardages += 1;
    if (hole.par != null && hole.yardage != null) completeHoles += 1;
    if (hole.yardage != null) totalYardage += hole.yardage;
    if (hole.handicapIndex != null) {
      handicapCounts.set(hole.handicapIndex, (handicapCounts.get(hole.handicapIndex) ?? 0) + 1);
    }
    if (hole.verifiedByAdmin) confirmedHoles += 1;
    confidenceCounts[hole.confidence] += 1;
  }

  const duplicateHandicapIndexes = Array.from(handicapCounts.values()).filter((count) => count > 1).length;
  const expectedTotalYardage = round.whiteTeeTotalYardage;
  const yardageMatchesRoundTotal =
    expectedTotalYardage == null ? true : totalYardage === expectedTotalYardage;

  return {
    completeHoles,
    missingPars,
    missingYardages,
    duplicateHandicapIndexes,
    totalYardage,
    expectedTotalYardage,
    yardageMatchesRoundTotal,
    confirmedHoles,
    confidenceCounts,
  };
}
