export type Role = "player" | "admin";

export type ScoreEntryMode = "individual" | "team";

export interface TeeGroup {
  time: string;
  players: string[];
}

export interface PayoutSettings {
  buyIn: number;
  teamWinPayout: number;
  flightWinPayout: number;
}

export interface RoundTemplate {
  id: number;
  name: string;
  date: string;
  course: string;
  format: string;
  teeWindow: string;
  whiteTeeTotalYardage: number | null;
  teeTimes: TeeGroup[];
  defaultEntryMode: ScoreEntryMode;
}

export interface HoleData {
  hole: number;
  par: number | null;
  yardage: number | null;
  handicapIndex: number | null;
  sourceName: string | null;
  sourceUrl: string | null;
  confidence: "unknown" | "public" | "confirmed";
  verifiedByAdmin: boolean;
}

export interface CoursePublicationState {
  roundId: number;
  isLocked: boolean;
  isConfirmed: boolean;
  lastPublishedAt: string | null;
}

export interface RoundLiveState {
  roundId: number;
  isStarted: boolean;
  startedAt: string | null;
  startedBy: string | null;
  isFinalized: boolean;
  finalizedAt: string | null;
  finalizedBy: string | null;
  lastScoreUpdateAt: string | null;
}

export interface ScoreEditEvent {
  id: string;
  timestamp: string;
  roundId: number;
  holeIndex: number;
  targetType: "player" | "team";
  targetId: string;
  previousValue: number | "";
  nextValue: number | "";
  editedBy: string;
}

export interface ScoreConflictEvent {
  id: string;
  timestamp: string;
  roundId: number;
  holeIndex: number;
  targetType: "player" | "team";
  targetId: string;
  previousEditedBy: string;
  currentEditedBy: string;
  previousEditedAt: string;
  message: string;
}

export interface SessionState {
  player: string | null;
  role: Role | null;
}

export interface TeamCard {
  teamName: string;
  players: string[];
  holeScores: Array<number | "">;
}

export type IndividualScoresByRound = Record<number, Record<string, Array<number | "">>>;
export type CourseDataByRound = Record<number, HoleData[]>;
export type TeamScoresByRound = Record<number, TeamCard[]>;
export type EntryModeByRound = Record<number, ScoreEntryMode>;
export type TeamDelegateAssignmentsByRound = Record<number, Record<number, string>>;
export type TeamEntrySubmissionsByRound = Record<
  number,
  Record<number, Record<string, Array<number | "">>>
>;

export interface TeamScoreDiscrepancy {
  id: string;
  roundId: number;
  teamIndex: number;
  holeIndex: number;
  teamName: string;
  scorerA: string;
  scorerB: string;
  scoreA: number | "";
  scoreB: number | "";
  createdAt: string;
  status: "open" | "resolved" | string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  overrideScore: number | null;
}

export interface TripState {
  roster: string[];
  flights: Record<string, string[]>;
  roundGroupings: Record<number, TeeGroup[]>;
  payoutSettings: PayoutSettings;
  individualScores: IndividualScoresByRound;
  teamScores: TeamScoresByRound;
  teamDelegateAssignments: TeamDelegateAssignmentsByRound;
  teamEntrySubmissions: TeamEntrySubmissionsByRound;
  teamScoreDiscrepancies: TeamScoreDiscrepancy[];
  courseDataDraft: CourseDataByRound;
  courseDataPublished: CourseDataByRound;
  roundEntryMode: EntryModeByRound;
  coursePublication: Record<number, CoursePublicationState>;
  roundLive: Record<number, RoundLiveState>;
  scoreEditHistory: ScoreEditEvent[];
  scoreConflicts: ScoreConflictEvent[];
}
