import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/session";
import { getTripStateMode, getTripStateRecord, saveTripStateRecord } from "@/lib/server/tripStateStore";
import { TripState } from "@/lib/trip/types";

export async function GET() {
  const session = await getServerSession();
  if (!session.player || !session.role) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const mode = getTripStateMode();
  if (mode !== "server") {
    return NextResponse.json({ ok: false, mode, error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const record = await getTripStateRecord();
  if (!record) {
    return NextResponse.json({ ok: false, mode, error: "Trip state unavailable." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, mode, ...record });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession();
  if (!session.player || !session.role) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const mode = getTripStateMode();
  if (mode !== "server") {
    return NextResponse.json({ ok: false, mode, error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        state?: TripState;
        expectedVersion?: number | null;
      }
    | null;

  if (!body?.state) {
    return NextResponse.json({ ok: false, error: "Trip state is required." }, { status: 400 });
  }

  try {
    const result = await saveTripStateRecord(body.state, body.expectedVersion ?? null, session);
    if (!result) {
      return NextResponse.json({ ok: false, error: "Trip state unavailable." }, { status: 500 });
    }
    if (result.conflict) {
      return NextResponse.json(
        {
          ok: false,
          error: "Trip state conflict.",
          current: result.record,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true, mode, ...result.record });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Save failed.",
      },
      { status: 403 },
    );
  }
}

