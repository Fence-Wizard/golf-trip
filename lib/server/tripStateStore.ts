import { canUseTeamEntry } from "@/lib/auth/session";
import { ADMIN_PLAYER } from "@/lib/trip/config";
import { buildInitialTripState } from "@/lib/trip/storage";
import { Role, SessionState, TripState } from "@/lib/trip/types";
import { hasDatabaseUrl, sql } from "@/lib/server/neon";

const TRIP_STATE_ROW_ID = "primary";

export interface TripStateRecord {
  state: TripState;
  version: number;
  updatedAt: string;
}

function normalizeIncomingState(state: unknown): TripState | null {
  if (!state || typeof state !== "object") return null;
  return state as TripState;
}

async function ensureTable() {
  if (!sql) return;
  await sql`
    CREATE TABLE IF NOT EXISTS trip_state_snapshots (
      id text PRIMARY KEY,
      state jsonb NOT NULL,
      version integer NOT NULL DEFAULT 1,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
}

export async function getTripStateRecord(): Promise<TripStateRecord | null> {
  if (!sql) return null;
  await ensureTable();
  const rows = (await sql`
    SELECT state, version, updated_at
    FROM trip_state_snapshots
    WHERE id = ${TRIP_STATE_ROW_ID}
    LIMIT 1
  `) as {
    state: TripState;
    version: number;
    updated_at: string;
  }[];

  const row = rows[0];
  if (row) {
    return {
      state: normalizeIncomingState(row.state) ?? buildInitialTripState(),
      version: row.version,
      updatedAt: row.updated_at,
    };
  }

  const initial = buildInitialTripState();
  const inserted = (await sql`
    INSERT INTO trip_state_snapshots (id, state, version)
    VALUES (${TRIP_STATE_ROW_ID}, ${JSON.stringify(initial)}::jsonb, 1)
    RETURNING version, updated_at
  `) as { version: number; updated_at: string }[];

  return {
    state: initial,
    version: inserted[0]?.version ?? 1,
    updatedAt: inserted[0]?.updated_at ?? new Date().toISOString(),
  };
}

function jsonEqual(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function canWriteTeamCard(session: SessionState, state: TripState, roundId: number, teamIndex: number) {
  if (session.role === "admin") return true;
  return canUseTeamEntry(session, roundId, teamIndex, state.teamDelegateAssignments[roundId]?.[teamIndex], state.roundGroupings);
}

function assertRoundLiveAllowed(previous: TripState, next: TripState, session: SessionState) {
  if (session.role === "admin") return true;
  return Object.keys(previous.roundLive).every((roundIdKey) => {
    const roundId = Number(roundIdKey);
    const before = previous.roundLive[roundId];
    const after = next.roundLive[roundId];
    if (!after) return false;
    return (
      before.isFinalized === after.isFinalized &&
      before.finalizedAt === after.finalizedAt &&
      before.finalizedBy === after.finalizedBy
    );
  });
}

export function canSessionMutateTripState(previous: TripState, next: TripState, session: SessionState) {
  if (!session.player || !session.role) return false;
  if (session.role === "admin") return session.player === ADMIN_PLAYER;

  if (
    !jsonEqual(previous.roster, next.roster) ||
    !jsonEqual(previous.flights, next.flights) ||
    !jsonEqual(previous.roundGroupings, next.roundGroupings) ||
    !jsonEqual(previous.payoutSettings, next.payoutSettings) ||
    !jsonEqual(previous.teamDelegateAssignments, next.teamDelegateAssignments) ||
    !jsonEqual(previous.courseDataDraft, next.courseDataDraft) ||
    !jsonEqual(previous.courseDataPublished, next.courseDataPublished) ||
    !jsonEqual(previous.coursePublication, next.coursePublication) ||
    !jsonEqual(previous.roundEntryMode, next.roundEntryMode)
  ) {
    return false;
  }

  if (!assertRoundLiveAllowed(previous, next, session)) {
    return false;
  }

  for (const [roundIdKey, scoresByPlayer] of Object.entries(previous.individualScores)) {
    const roundId = Number(roundIdKey);
    const nextScoresByPlayer = next.individualScores[roundId];
    if (!nextScoresByPlayer) return false;
    for (const [player, scores] of Object.entries(scoresByPlayer)) {
      if (player === session.player) continue;
      if (!jsonEqual(scores, nextScoresByPlayer[player])) return false;
    }
  }

  for (const [roundIdKey, teamCards] of Object.entries(previous.teamScores)) {
    const roundId = Number(roundIdKey);
    const nextCards = next.teamScores[roundId];
    if (!nextCards) return false;
    for (const [teamIndex, teamCard] of teamCards.entries()) {
      if (canWriteTeamCard(session, next, roundId, teamIndex)) continue;
      if (!jsonEqual(teamCard, nextCards[teamIndex])) return false;
    }
  }

  return true;
}

export async function saveTripStateRecord(
  nextState: TripState,
  expectedVersion: number | null,
  session: SessionState,
): Promise<{ conflict: false; record: TripStateRecord } | { conflict: true; record: TripStateRecord } | null> {
  if (!sql) return null;
  const current = await getTripStateRecord();
  if (!current) return null;
  if (!canSessionMutateTripState(current.state, nextState, session)) {
    throw new Error("Not allowed to persist this trip-state change.");
  }
  if (expectedVersion !== null && current.version !== expectedVersion) {
    return { conflict: true, record: current };
  }

  const rows = (await sql`
    UPDATE trip_state_snapshots
    SET state = ${JSON.stringify(nextState)}::jsonb,
        version = version + 1,
        updated_at = now()
    WHERE id = ${TRIP_STATE_ROW_ID}
    RETURNING version, updated_at
  `) as { version: number; updated_at: string }[];

  return {
    conflict: false,
    record: {
      state: nextState,
      version: rows[0]?.version ?? current.version + 1,
      updatedAt: rows[0]?.updated_at ?? new Date().toISOString(),
    },
  };
}

export function getTripStateMode() {
  return hasDatabaseUrl ? "server" : "local";
}

