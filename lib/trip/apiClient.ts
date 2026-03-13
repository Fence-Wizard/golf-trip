import { SessionState, TripState } from "@/lib/trip/types";

export interface RemoteTripStatePayload {
  state: TripState;
  version: number;
  updatedAt: string;
}

export async function fetchServerSession(): Promise<SessionState | null> {
  const response = await fetch("/api/session/me", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { session?: SessionState };
  return data.session ?? null;
}

export async function loginViaServer(player: string, role: string, pin: string) {
  const response = await fetch("/api/session/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ player, role, pin }),
  });
  const data = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string; session?: SessionState }
    | null;
  return {
    ok: response.ok && Boolean(data?.ok),
    error: data?.error ?? null,
    session: data?.session ?? null,
  };
}

export async function logoutViaServer() {
  await fetch("/api/session/logout", {
    method: "POST",
    credentials: "include",
  }).catch(() => null);
}

export async function fetchRemoteTripState() {
  const response = await fetch("/api/trip-state", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as
    | ({ ok?: boolean; mode?: string; error?: string } & Partial<RemoteTripStatePayload>)
    | null;
  return {
    ok: response.ok && Boolean(data?.ok) && Boolean(data?.state),
    status: response.status,
    mode: data?.mode ?? null,
    error: data?.error ?? null,
    payload:
      data?.state && typeof data.version === "number" && typeof data.updatedAt === "string"
        ? {
            state: data.state,
            version: data.version,
            updatedAt: data.updatedAt,
          }
        : null,
  };
}

export async function saveRemoteTripState(state: TripState, expectedVersion: number | null) {
  const response = await fetch("/api/trip-state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ state, expectedVersion }),
  });
  const data = (await response.json().catch(() => null)) as
    | ({
        ok?: boolean;
        mode?: string;
        error?: string;
        current?: RemoteTripStatePayload;
      } & Partial<RemoteTripStatePayload>)
    | null;
  return {
    ok: response.ok && Boolean(data?.ok) && Boolean(data?.state),
    status: response.status,
    mode: data?.mode ?? null,
    error: data?.error ?? null,
    payload:
      data?.state && typeof data.version === "number" && typeof data.updatedAt === "string"
        ? {
            state: data.state,
            version: data.version,
            updatedAt: data.updatedAt,
          }
        : null,
    conflict: data?.current ?? null,
  };
}

