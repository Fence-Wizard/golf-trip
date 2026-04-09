import { Role, SessionState } from "@/lib/trip/types";
import { ADMIN_PLAYER } from "@/lib/trip/config";

const SESSION_STORAGE_KEY = "williamsburg_session_v1";

export function getEmptySession(): SessionState {
  return { player: null, role: null };
}

export function isAdmin(session: SessionState): boolean {
  return session.role === "admin" && session.player === ADMIN_PLAYER;
}

export function canAccessAdmin(session: SessionState): boolean {
  return session.role === "admin";
}

export function saveSession(session: SessionState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function loadSession(): SessionState {
  if (typeof window === "undefined") return getEmptySession();
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return getEmptySession();
  try {
    const parsed = JSON.parse(raw) as SessionState;
    if (!parsed.player || !parsed.role) return getEmptySession();
    const normalizedRole = buildRoleFromSelection(String(parsed.role));
    return {
      player: parsed.player,
      role: normalizedRole === "admin" && parsed.player !== ADMIN_PLAYER ? "player" : normalizedRole,
    };
  } catch {
    return getEmptySession();
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function buildRoleFromSelection(role: string): Role {
  if (role === "admin" || role === "player") return role;
  return "player";
}

export function validateRolePin(role: Role, pin: string, player?: string): boolean {
  if (role === "player") return true;
  if (player !== ADMIN_PLAYER) return false;
  const envPin = process.env.NEXT_PUBLIC_ADMIN_PIN ?? "";
  if (!envPin) return true;
  return pin.trim() === envPin.trim();
}
