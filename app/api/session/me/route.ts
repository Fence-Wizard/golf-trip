import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/session";

export async function GET() {
  const session = await getServerSession();
  return NextResponse.json({ ok: true, session });
}

