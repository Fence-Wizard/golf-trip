import { ADMIN_PLAYER } from "@/lib/trip/config";
import { buildInitialTripState } from "@/lib/trip/storage";
import { SessionState, TripState } from "@/lib/trip/types";
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

export function canSessionMutateTripState(_previous: TripState, _next: TripState, session: SessionState) {
  if (!session.player || !session.role) return false;
  return session.role === "admin" && session.player === ADMIN_PLAYER;
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

