import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { ADMIN_PLAYER } from "@/lib/trip/config";
import { Role, SessionState } from "@/lib/trip/types";

const SESSION_COOKIE_NAME = "wgt_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

type ServerSessionPayload = {
  player: string;
  role: Role;
  issuedAt: number;
};

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET?.trim() || process.env.ADMIN_PIN?.trim() || "local-dev-session-secret";
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function encodeSession(payload: ServerSessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(raw: string | undefined): ServerSessionPayload | null {
  if (!raw) return null;
  const [body, signature] = raw.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ServerSessionPayload;
    if (!payload.player || !payload.role) return null;
    if (payload.role === "admin" && payload.player !== ADMIN_PLAYER) return null;
    return payload;
  } catch {
    return null;
  }
}

export function validateServerLogin(role: Role, player: string, pin: string) {
  if (!player.trim()) return false;
  if (role === "player") return true;
  if (player !== ADMIN_PLAYER) return false;
  const adminPin = process.env.ADMIN_PIN?.trim() ?? "";
  if (!adminPin) return true;
  return pin.trim() === adminPin;
}

export async function createServerSession(player: string, role: Role) {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, encodeSession({ player, role, issuedAt: Date.now() }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearServerSession() {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export async function getServerSession(): Promise<SessionState> {
  const store = await cookies();
  const payload = decodeSession(store.get(SESSION_COOKIE_NAME)?.value);
  if (!payload) return { player: null, role: null };
  return { player: payload.player, role: payload.role };
}

