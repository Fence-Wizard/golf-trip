import {
  buildInitialCoursePublication,
  buildInitialCourseData,
  buildInitialFlights,
  buildInitialPayoutSettings,
  buildInitialRoundGroupings,
  buildInitialRoster,
  buildInitialTeamDelegates,
  getTeamScorers,
  buildInitialTeamEntrySubmissions,
  buildInitialIndividualScoresForRoster,
  buildInitialRoundLiveState,
  buildInitialRoundEntryModes,
  seededCourseDataByRound,
  defaultHoleTemplate,
  buildInitialTeamScores,
  roundTemplates,
} from "@/lib/trip/config";
import { TripState } from "@/lib/trip/types";

const TRIP_STORAGE_KEY = "williamsburg_trip_state_v2";

export function buildInitialTripState(): TripState {
  const roster = buildInitialRoster();
  const roundGroupings = buildInitialRoundGroupings();
  const published = buildInitialCourseData();
  const delegates = buildInitialTeamDelegates(roundGroupings);
  return {
    roster,
    flights: buildInitialFlights(),
    roundGroupings,
    payoutSettings: buildInitialPayoutSettings(),
    individualScores: buildInitialIndividualScoresForRoster(roster, roundGroupings),
    teamScores: buildInitialTeamScores(roundGroupings),
    teamDelegateAssignments: delegates,
    teamEntrySubmissions: buildInitialTeamEntrySubmissions(delegates, roundGroupings),
    teamScoreDiscrepancies: [],
    courseDataDraft: buildInitialCourseData(),
    courseDataPublished: published,
    roundEntryMode: buildInitialRoundEntryModes(),
    coursePublication: buildInitialCoursePublication(),
    roundLive: buildInitialRoundLiveState(),
    scoreEditHistory: [],
    scoreConflicts: [],
  };
}

function normalizeTripState(raw: Partial<TripState>): TripState {
  const base = buildInitialTripState();
  const normalized: TripState = {
    ...base,
    ...raw,
    coursePublication: {
      ...base.coursePublication,
      ...(raw.coursePublication ?? {}),
    },
    roundLive: {
      ...base.roundLive,
      ...(raw.roundLive ?? {}),
    },
    scoreEditHistory: raw.scoreEditHistory ?? [],
    scoreConflicts: raw.scoreConflicts ?? [],
    roster: raw.roster ?? base.roster,
    flights: raw.flights ?? base.flights,
    roundGroupings: raw.roundGroupings ?? base.roundGroupings,
    payoutSettings: {
      ...base.payoutSettings,
      ...(raw.payoutSettings ?? {}),
    },
    teamDelegateAssignments: raw.teamDelegateAssignments ?? base.teamDelegateAssignments,
    teamEntrySubmissions: raw.teamEntrySubmissions ?? base.teamEntrySubmissions,
    teamScoreDiscrepancies: raw.teamScoreDiscrepancies ?? [],
  };

  const shouldReseedParsFromSeed = (holes: typeof defaultHoleTemplate, seed: typeof defaultHoleTemplate): boolean => {
    if (holes.length !== 18 || seed.length !== 18) return false;
    let mismatchCount = 0;
    const seenPars = new Set<number>();
    for (let idx = 0; idx < 18; idx += 1) {
      const existingPar = holes[idx]?.par;
      const seedPar = seed[idx].par;
      if (typeof existingPar === "number") {
        seenPars.add(existingPar);
        if (existingPar !== seedPar) mismatchCount += 1;
      } else {
        mismatchCount += 1;
      }
    }
    return mismatchCount >= 12 || (seenPars.size <= 2 && mismatchCount >= 8);
  };

  // Ensure hole objects contain new metadata fields after schema upgrades.
  for (const round of roundTemplates) {
    const roundId = round.id;
    normalized.roundGroupings[roundId] =
      normalized.roundGroupings[roundId]?.map((group, idx) => ({
        time: group.time ?? base.roundGroupings[roundId]?.[idx]?.time ?? "TBD",
        players:
          group.players?.length > 0
            ? group.players.map((player) => String(player))
            : base.roundGroupings[roundId]?.[idx]?.players ?? [],
      })) ?? base.roundGroupings[roundId];

    for (const player of normalized.roster) {
      if (!normalized.individualScores[roundId][player]) {
        normalized.individualScores[roundId][player] = Array.from({ length: 18 }, () => "");
      }
    }

    const template = defaultHoleTemplate;
    const seed = seededCourseDataByRound[roundId];
    const reseedDraftPars = seed ? shouldReseedParsFromSeed(normalized.courseDataDraft[roundId] ?? template, seed) : false;
    const reseedPublishedPars = seed
      ? shouldReseedParsFromSeed(normalized.courseDataPublished[roundId] ?? template, seed)
      : false;
    const patchHoles = (holes = template, reseedPars = false) =>
      holes.map((hole, idx) => {
        if (!seed?.[idx]) {
          return {
            ...template[idx],
            ...hole,
          };
        }
        const seedHole = seed[idx];
        const alignsWithSeedCard =
          hole.yardage === seedHole.yardage && hole.handicapIndex === seedHole.handicapIndex;
        const shouldRepairPar = alignsWithSeedCard && hole.par !== null && hole.par !== seedHole.par;
        return {
          ...template[idx],
          ...hole,
          // Migrate older localStorage payloads to include seeded scorecard metadata/hcp
          // while preserving explicit admin edits that are already present.
          par: reseedPars || shouldRepairPar ? seedHole.par : hole.par ?? seedHole.par,
          yardage: hole.yardage ?? seedHole.yardage,
          handicapIndex: hole.handicapIndex ?? seedHole.handicapIndex,
          sourceName: hole.sourceName ?? seedHole.sourceName,
          sourceUrl: hole.sourceUrl ?? seedHole.sourceUrl,
          confidence: hole.confidence === "unknown" ? seedHole.confidence : hole.confidence,
        };
      });
    normalized.courseDataDraft[roundId] = patchHoles(normalized.courseDataDraft[roundId], reseedDraftPars);
    normalized.courseDataPublished[roundId] = patchHoles(normalized.courseDataPublished[roundId], reseedPublishedPars);
    const baseRoundSubs = base.teamEntrySubmissions[roundId] ?? {};
    const currentRoundSubs = normalized.teamEntrySubmissions[roundId] ?? {};
    normalized.teamEntrySubmissions[roundId] = { ...baseRoundSubs, ...currentRoundSubs };
    normalized.teamDelegateAssignments[roundId] = {
      ...(base.teamDelegateAssignments[roundId] ?? {}),
      ...(normalized.teamDelegateAssignments[roundId] ?? {}),
    };
    for (const [teamIndex] of round.teeTimes.entries()) {
      const [scorerA, scorerB] = getTeamScorers(
        roundId,
        teamIndex,
        normalized.teamDelegateAssignments[roundId]?.[teamIndex],
        normalized.roundGroupings,
      );
      const baseTeamSubs = baseRoundSubs[teamIndex] ?? {};
      const currentTeamSubs = normalized.teamEntrySubmissions[roundId][teamIndex] ?? {};
      normalized.teamEntrySubmissions[roundId][teamIndex] = {
        ...baseTeamSubs,
        ...currentTeamSubs,
        [scorerA]: currentTeamSubs[scorerA] ?? baseTeamSubs[scorerA] ?? Array.from({ length: 18 }, () => ""),
        [scorerB]: currentTeamSubs[scorerB] ?? baseTeamSubs[scorerB] ?? Array.from({ length: 18 }, () => ""),
      };
    }
  }

  return normalized;
}

export function loadTripState(): TripState {
  if (typeof window === "undefined") return buildInitialTripState();
  const raw = window.localStorage.getItem(TRIP_STORAGE_KEY);
  if (!raw) return buildInitialTripState();
  try {
    return normalizeTripState(JSON.parse(raw) as TripState);
  } catch {
    return buildInitialTripState();
  }
}

export function saveTripState(state: TripState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(state));
}
