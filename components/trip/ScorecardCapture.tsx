"use client";

import { useRef, useState } from "react";
import { useTrip } from "@/components/trip/TripProvider";

interface ScorecardCaptureProps {
  roundId: number;
  playerName: string;
  onComplete: () => void;
  onCancel: () => void;
}

type OcrState = "idle" | "uploading" | "reviewing" | "applying" | "error";

export function ScorecardCapture({ roundId, playerName, onComplete, onCancel }: ScorecardCaptureProps) {
  const { tripState, updateIndividualHoleScore } = useTrip();
  const [state, setState] = useState<OcrState>("idle");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrScores, setOcrScores] = useState<Array<number | "">>([]);
  const [confidence, setConfidence] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const courseHoles = tripState.courseDataPublished[roundId];

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);

    setState("uploading");
    setError("");

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("roundId", String(roundId));
      formData.append("playerName", playerName);

      const response = await fetch("/api/ocr", { method: "POST", body: formData });
      const data = (await response.json()) as {
        ok: boolean;
        scores?: Array<number | "">;
        confidence?: string;
        notes?: string;
        error?: string;
      };

      if (!data.ok || !data.scores) {
        setError(data.error ?? "Failed to read scorecard.");
        setState("error");
        return;
      }

      setOcrScores(data.scores);
      setConfidence(data.confidence ?? "medium");
      setNotes(data.notes ?? "");
      setState("reviewing");
    } catch {
      setError("Network error. Please try again.");
      setState("error");
    }
  };

  const handleScoreEdit = (holeIndex: number, value: string) => {
    const next = [...ocrScores];
    if (value.trim() === "") {
      next[holeIndex] = "";
    } else {
      const num = Number(value);
      if (!Number.isNaN(num) && num >= 1 && num <= 15) {
        next[holeIndex] = Math.trunc(num);
      }
    }
    setOcrScores(next);
  };

  const handleApplyScores = () => {
    setState("applying");
    for (let i = 0; i < 18; i++) {
      const score = ocrScores[i];
      if (score !== "" && score !== undefined) {
        updateIndividualHoleScore(roundId, playerName, i, String(score));
      }
    }
    onComplete();
  };

  const filledCount = ocrScores.filter((s) => s !== "").length;

  return (
    <section className="card">
      <div className="row-between">
        <div>
          <p className="eyebrow">Scorecard scanner</p>
          <h3>Scan card for {playerName}</h3>
        </div>
        <button className="button ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>

      {state === "idle" || state === "error" ? (
        <div className="stack-md">
          <p className="muted">
            Take a photo of {playerName}&apos;s physical scorecard or choose an existing image. The AI will read the scores automatically.
          </p>
          <div className="row-wrap">
            <button
              className="button"
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? "Choose different image" : "Capture or choose image"}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          {imagePreview ? (
            <div style={{ maxWidth: 400 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Scorecard preview"
                style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border)" }}
              />
            </div>
          ) : null}
          {error ? <p className="warning">{error}</p> : null}
        </div>
      ) : null}

      {state === "uploading" ? (
        <div className="stack-md" style={{ textAlign: "center", padding: "2rem 0" }}>
          <p className="muted">Reading scorecard...</p>
          <p className="muted" style={{ fontSize: "0.85rem" }}>The AI is extracting scores from the image.</p>
        </div>
      ) : null}

      {state === "reviewing" ? (
        <div className="stack-md">
          <div className="row-wrap">
            <span className={`badge ${confidence === "high" ? "badge-complete" : ""}`}>
              Confidence: {confidence}
            </span>
            <span className="badge">{filledCount}/18 holes read</span>
          </div>
          {notes ? <p className="muted" style={{ fontSize: "0.85rem" }}>{notes}</p> : null}

          <p className="muted">Review and correct any misread scores before applying.</p>

          <div style={{ overflowX: "auto" }}>
            <table className="collector-grid">
              <thead>
                <tr>
                  <th className="collector-hole-cell">Hole</th>
                  <th className="collector-hole-cell">Par</th>
                  <th className="collector-hole-cell">OCR</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 18 }, (_, i) => (
                  <tr key={i}>
                    <td className="collector-hole-cell">{i + 1}</td>
                    <td className="collector-hole-cell muted">{courseHoles[i]?.par ?? "-"}</td>
                    <td className="collector-hole-cell">
                      <input
                        className="input score-input"
                        type="number"
                        min={1}
                        max={15}
                        value={ocrScores[i] ?? ""}
                        onChange={(e) => handleScoreEdit(i, e.target.value)}
                        style={{ width: "4rem", textAlign: "center" }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row-wrap">
            <button className="button" onClick={handleApplyScores}>
              Apply {filledCount} scores for {playerName}
            </button>
            <button className="button ghost" onClick={() => { setState("idle"); setError(""); }}>
              Retake photo
            </button>
          </div>
        </div>
      ) : null}

      {state === "applying" ? (
        <p className="muted">Applying scores...</p>
      ) : null}
    </section>
  );
}
