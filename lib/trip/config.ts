import {
  CoursePublicationState,
  EntryModeByRound,
  HoleData,
  RoundLiveState,
  RoundTemplate,
  TeamDelegateAssignmentsByRound,
  TeamEntrySubmissionsByRound,
  TeamScoresByRound,
} from "@/lib/trip/types";

export const BUY_IN = 100;
export const TEAM_WIN_PAYOUT = 60;
export const FLIGHT_WIN_PAYOUT = 120;
export const ADMIN_PLAYER = "Sam";
export const TEAM_CAPTAINS = ["Lee", "Sam", "Todd"] as const;

export const players = [
  "Todd",
  "Sam",
  "Zach",
  "Terry",
  "Jared",
  "Brandon",
  "Thomas",
  "Jay",
  "Andrew",
  "Lee",
  "Jamie",
  "Mystery",
];

export const flights: Record<string, string[]> = {
  A: ["Lee", "Sam", "Todd"],
  B: ["Thomas", "Terry", "Jamie"],
  C: ["Jay", "Jared", "Zach"],
  D: ["Mystery", "Andrew", "Brandon"],
};

export const roundTemplates: RoundTemplate[] = [
  {
    id: 1,
    name: "Round 1",
    date: "2026-04-09",
    course: "Golden Horseshoe - Green Course",
    format: "Play Your Own Ball",
    teeWindow: "7:30 AM - 8:00 AM",
    whiteTeeTotalYardage: 6244,
    defaultEntryMode: "individual",
    teeTimes: [
      { time: "7:30 AM", players: ["Todd", "Terry", "Thomas", "Jamie"] },
      { time: "7:40 AM", players: ["Sam", "Jared", "Jay", "Lee"] },
      { time: "7:50 AM", players: ["Zach", "Brandon", "Andrew", "Mystery"] },
    ],
  },
  {
    id: 2,
    name: "Round 2",
    date: "2026-04-09",
    course: "Golden Horseshoe - Gold Course",
    format: "Preferred Drive",
    teeWindow: "2:00 PM - 2:30 PM",
    whiteTeeTotalYardage: 6248,
    defaultEntryMode: "team",
    teeTimes: [
      { time: "2:00 PM", players: ["Lee", "Terry", "Jay", "Mystery"] },
      { time: "2:10 PM", players: ["Sam", "Jamie", "Jared", "Andrew"] },
      { time: "2:20 PM", players: ["Todd", "Thomas", "Zach", "Brandon"] },
    ],
  },
  {
    id: 3,
    name: "Round 3",
    date: "2026-04-10",
    course: "Ford's Colony - Blue Heron",
    format: "Captain's Choice",
    teeWindow: "8:10 AM - 8:40 AM",
    whiteTeeTotalYardage: 5808,
    defaultEntryMode: "team",
    teeTimes: [
      { time: "8:10 AM", players: ["Lee", "Thomas", "Jared", "Andrew"] },
      { time: "8:20 AM", players: ["Sam", "Terry", "Zach", "Brandon"] },
      { time: "8:30 AM", players: ["Todd", "Jamie", "Jay", "Mystery"] },
    ],
  },
  {
    id: 4,
    name: "Round 4",
    date: "2026-04-10",
    course: "Ford's Colony - Blackheath",
    format: "Alternate Shot",
    teeWindow: "1:20 PM - 1:50 PM",
    whiteTeeTotalYardage: 5367,
    defaultEntryMode: "team",
    teeTimes: [
      { time: "1:20 PM", players: ["Lee", "Jamie", "Zach", "Brandon"] },
      { time: "1:30 PM", players: ["Sam", "Thomas", "Jay", "Mystery"] },
      { time: "1:40 PM", players: ["Todd", "Terry", "Jared", "Andrew"] },
    ],
  },
  {
    id: 5,
    name: "Round 5",
    date: "2026-04-11",
    course: "Colonial Heritage Golf Club",
    format: "Play Your Own Ball",
    teeWindow: "10:20 AM Start",
    whiteTeeTotalYardage: 5364,
    defaultEntryMode: "individual",
    teeTimes: [
      { time: "10:20 AM", players: ["Todd", "Terry", "Thomas", "Lee"] },
      { time: "10:30 AM", players: ["Sam", "Jared", "Jay", "Jamie"] },
      { time: "10:40 AM", players: ["Zach", "Brandon", "Andrew", "Mystery"] },
    ],
  },
];

export const defaultHoleTemplate: HoleData[] = Array.from({ length: 18 }, (_, idx) => ({
  hole: idx + 1,
  par: idx % 3 === 0 ? 5 : idx % 2 === 0 ? 3 : 4,
  yardage: null,
  handicapIndex: null,
  sourceName: null,
  sourceUrl: null,
  confidence: "unknown",
  verifiedByAdmin: false,
}));

function buildHoleData(
  pars: number[],
  yardages: number[],
  handicapIndexes: number[] | null,
  sourceName: string,
  sourceUrl: string,
  confidence: "public" | "unknown" = "public",
): HoleData[] {
  return Array.from({ length: 18 }, (_, idx) => ({
    hole: idx + 1,
    par: pars[idx],
    yardage: yardages[idx],
    handicapIndex: handicapIndexes?.[idx] ?? null,
    sourceName,
    sourceUrl,
    confidence,
    verifiedByAdmin: false,
  }));
}

export const seededCourseDataByRound: Record<number, HoleData[]> = {
  1: buildHoleData(
    [4, 4, 4, 4, 5, 4, 3, 5, 3, 4, 3, 4, 4, 4, 5, 4, 3, 5],
    [382, 334, 305, 328, 502, 402, 134, 503, 153, 307, 153, 399, 345, 412, 553, 345, 199, 488],
    [5, 7, 15, 13, 9, 1, 17, 3, 11, 18, 12, 4, 14, 2, 8, 16, 6, 10],
    "GolfLink Green Course White tees",
    "https://www.golflink.com/golf-courses/va/williamsburg/golden-horseshoe-golf-club-11339",
  ),
  2: buildHoleData(
    [4, 5, 3, 4, 4, 5, 3, 4, 4, 4, 4, 3, 4, 4, 5, 3, 4, 4],
    [369, 470, 145, 394, 328, 463, 165, 313, 355, 392, 362, 149, 340, 420, 600, 150, 412, 421],
    [11, 3, 9, 1, 15, 5, 7, 17, 13, 8, 14, 12, 18, 2, 10, 16, 4, 6],
    "Golden Horseshoe members site White tees",
    "https://www.goldenhorseshoemembers.com/gold_course/",
  ),
  3: buildHoleData(
    [4, 4, 4, 5, 4, 3, 4, 3, 5, 4, 4, 5, 4, 3, 4, 5, 3, 4],
    [360, 329, 322, 466, 374, 134, 355, 120, 486, 329, 328, 455, 340, 154, 334, 467, 126, 329],
    [9, 13, 11, 1, 5, 15, 7, 17, 3, 12, 8, 4, 2, 16, 14, 6, 18, 10],
    "BlueGolf Blue Heron White tees",
    "https://course.bluegolf.com/bluegolf/course/course/fordscolonyblueheron/detailedscorecard.htm",
  ),
  4: buildHoleData(
    [5, 4, 3, 5, 4, 4, 4, 3, 4, 4, 4, 3, 4, 3, 5, 4, 4, 4],
    [459, 287, 115, 509, 330, 273, 326, 116, 306, 333, 309, 128, 325, 118, 433, 334, 358, 308],
    [3, 11, 17, 1, 5, 13, 9, 15, 7, 12, 14, 16, 2, 18, 4, 6, 10, 8],
    "BlueGolf Blackheath White tees",
    "https://course.bluegolf.com/bluegolf/course/course/fordscolonyblackheath/detailedscorecard.htm",
  ),
  5: buildHoleData(
    [4, 4, 3, 4, 5, 4, 5, 3, 4, 4, 4, 4, 4, 3, 5, 4, 3, 5],
    [366, 303, 88, 312, 448, 280, 492, 109, 329, 354, 356, 253, 276, 94, 451, 276, 139, 438],
    [3, 13, 17, 5, 1, 7, 9, 15, 11, 4, 8, 16, 14, 18, 12, 2, 6, 10],
    "BlueGolf Colonial Heritage White tees",
    "https://course.bluegolf.com/bluegolf/course/course/colonialheritage/detailedscorecard.htm",
  ),
};

export function buildInitialIndividualScores() {
  const scoreState: Record<number, Record<string, Array<number | "">>> = {};
  for (const round of roundTemplates) {
    scoreState[round.id] = {};
    for (const player of players) {
      scoreState[round.id][player] = Array.from({ length: 18 }, () => "");
    }
  }
  return scoreState;
}

export function buildInitialCourseData() {
  const data: Record<number, HoleData[]> = {};
  for (const round of roundTemplates) {
    data[round.id] = seededCourseDataByRound[round.id]
      ? seededCourseDataByRound[round.id].map((h) => ({ ...h }))
      : defaultHoleTemplate.map((h) => ({ ...h }));
  }
  return data;
}

export function buildInitialTeamScores(): TeamScoresByRound {
  const data: TeamScoresByRound = {};
  for (const round of roundTemplates) {
    data[round.id] = round.teeTimes.map((group, idx) => ({
      teamName: `Team ${idx + 1}`,
      players: group.players,
      holeScores: Array.from({ length: 18 }, () => ""),
    }));
  }
  return data;
}

function getCaptainForTeam(roundId: number, teamIndex: number): string {
  const round = roundTemplates.find((item) => item.id === roundId) ?? roundTemplates[0];
  const group = round.teeTimes[teamIndex];
  if (!group) return TEAM_CAPTAINS[0];
  const preferredCaptain = TEAM_CAPTAINS[teamIndex] ?? group.players[0];
  return group.players.includes(preferredCaptain) ? preferredCaptain : group.players[0];
}

export function getTeamScorers(roundId: number, teamIndex: number, delegateOverride?: string | null): [string, string] {
  const round = roundTemplates.find((item) => item.id === roundId) ?? roundTemplates[0];
  const group = round.teeTimes[teamIndex];
  const captain = getCaptainForTeam(roundId, teamIndex);
  if (!group) return [captain, captain];
  const candidate = delegateOverride && group.players.includes(delegateOverride) ? delegateOverride : null;
  const delegate = candidate && candidate !== captain ? candidate : group.players.find((player) => player !== captain) ?? captain;
  return [captain, delegate];
}

export function buildInitialTeamDelegates(): TeamDelegateAssignmentsByRound {
  const data: TeamDelegateAssignmentsByRound = {};
  for (const round of roundTemplates) {
    data[round.id] = {};
    for (const [teamIndex] of round.teeTimes.entries()) {
      const [, delegate] = getTeamScorers(round.id, teamIndex);
      data[round.id][teamIndex] = delegate;
    }
  }
  return data;
}

export function buildInitialTeamEntrySubmissions(
  delegateAssignments: TeamDelegateAssignmentsByRound = buildInitialTeamDelegates(),
): TeamEntrySubmissionsByRound {
  const data: TeamEntrySubmissionsByRound = {};
  for (const round of roundTemplates) {
    data[round.id] = {};
    for (const [teamIndex] of round.teeTimes.entries()) {
      const [scorerA, scorerB] = getTeamScorers(round.id, teamIndex, delegateAssignments[round.id]?.[teamIndex]);
      data[round.id][teamIndex] = {
        [scorerA]: Array.from({ length: 18 }, () => ""),
        [scorerB]: Array.from({ length: 18 }, () => ""),
      };
    }
  }
  return data;
}

export function buildInitialRoundEntryModes(): EntryModeByRound {
  const state: EntryModeByRound = {};
  for (const round of roundTemplates) {
    state[round.id] = round.defaultEntryMode;
  }
  return state;
}

export function buildInitialCoursePublication(): Record<number, CoursePublicationState> {
  const publication: Record<number, CoursePublicationState> = {};
  for (const round of roundTemplates) {
    publication[round.id] = {
      roundId: round.id,
      isLocked: false,
      isConfirmed: false,
      lastPublishedAt: null,
    };
  }
  return publication;
}

export function buildInitialRoundLiveState(): Record<number, RoundLiveState> {
  const state: Record<number, RoundLiveState> = {};
  for (const round of roundTemplates) {
    state[round.id] = {
      roundId: round.id,
      isStarted: false,
      startedAt: null,
      startedBy: null,
      isFinalized: false,
      finalizedAt: null,
      finalizedBy: null,
      lastScoreUpdateAt: null,
    };
  }
  return state;
}

export function findFlight(player: string): string {
  return Object.entries(flights).find(([, names]) => names.includes(player))?.[0] ?? "-";
}
