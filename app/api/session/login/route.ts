import { NextRequest, NextResponse } from "next/server";
import { buildRoleFromSelection } from "@/lib/auth/session";
import { createServerSession, validateServerLogin } from "@/lib/server/session";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { player?: string; role?: string; pin?: string }
    | null;

  const player = body?.player?.trim() ?? "";
  const role = buildRoleFromSelection(body?.role ?? "player");
  const pin = body?.pin ?? "";

  if (!player) {
    return NextResponse.json({ ok: false, error: "Player is required." }, { status: 400 });
  }

  if (!validateServerLogin(role, player, pin)) {
    return NextResponse.json({ ok: false, error: "Invalid credentials." }, { status: 401 });
  }

  await createServerSession(player, role);
  return NextResponse.json({ ok: true, session: { player, role } });
}

