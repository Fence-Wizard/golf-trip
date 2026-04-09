import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/session";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT = `You are a golf scorecard reader. You will receive an image of a physical golf scorecard.
Extract the scores for all 18 holes. Return ONLY a JSON object with this exact format:
{
  "holes": [score1, score2, ..., score18],
  "confidence": "high" | "medium" | "low",
  "notes": "any issues or ambiguities"
}
Each score should be an integer (typically 1-15). If a hole score is unreadable, use null.
Do NOT include any other text — respond with only the JSON object.`;

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "OPENAI_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  let imageBase64: string;
  let mimeType: string;
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;
    if (!file || !file.type.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "An image file is required." }, { status: 400 });
    }
    mimeType = file.type;
    const buffer = await file.arrayBuffer();
    imageBase64 = Buffer.from(buffer).toString("base64");
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to read uploaded image." }, { status: 400 });
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                  detail: "high",
                },
              },
              {
                type: "text",
                text: "Read the scores from this golf scorecard. Return the 18 hole scores as JSON.",
              },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");
      return NextResponse.json(
        { ok: false, error: `OpenAI API error: ${response.status}`, detail: errorBody },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content?.trim() ?? "";

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { ok: false, error: "Could not parse scorecard from image.", raw },
        { status: 422 },
      );
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      holes: Array<number | null>;
      confidence?: string;
      notes?: string;
    };

    if (!Array.isArray(parsed.holes) || parsed.holes.length !== 18) {
      return NextResponse.json(
        { ok: false, error: "OCR returned unexpected number of holes.", parsed },
        { status: 422 },
      );
    }

    const scores: Array<number | ""> = parsed.holes.map((h) =>
      typeof h === "number" && h >= 1 && h <= 15 ? h : "",
    );

    return NextResponse.json({
      ok: true,
      scores,
      confidence: parsed.confidence ?? "medium",
      notes: parsed.notes ?? "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: `OCR processing failed: ${message}` }, { status: 500 });
  }
}
