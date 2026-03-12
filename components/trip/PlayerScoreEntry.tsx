"use client";

import { useEffect, useMemo, useState } from "react";
import { useTrip } from "@/components/trip/TripProvider";
import { findFlight, roundTemplates } from "@/lib/trip/config";
import { canViewPlayerCard } from "@/lib/auth/session";
import { sumScores } from "@/lib/trip/scoring";

interface PlayerScoreEntryProps {
  roundId: number;
  selectedPlayer: string;
  onPlayerChange: (player: string) => void;
  initialHoleIndex?: number;
}

type ScorePreset = {
  label: string;
  value: number;
  style: "circle" | "square" | "plain";
  double?: boolean;
};

function scoreShape(
  score: number | "",
  par: number | null,
): "eagle" | "birdie" | "par" | "bogey" | "double-bogey" | "empty" {
  if (score === "" || par === null) return "empty";
  if (score <= par - 2) return "eagle";
  if (score === par - 1) return "birdie";
  if (score === par + 1) return "bogey";
  if (score >= par + 2) return "double-bogey";
  return "par";
}

function firstSkippedHole(values: Array<number | "">): number | null {
  for (let idx = 0; idx < values.length; idx += 1) {
    if (values[idx] !== "") continue;
    if (values.slice(idx + 1).some((value) => value !== "")) return idx + 1;
  }
  return null;
}

export function PlayerScoreEntry({
  roundId,
  selectedPlayer,
  onPlayerChange,
  initialHoleIndex = 0,
}: PlayerScoreEntryProps) {
  const [activeHoleIndex, setActiveHoleIndex] = useState(0);
  const [celebration, setCelebration] = useState<{ id: number; type: "birdie" | "eagle" } | null>(null);
  const [skippedHoleNotice, setSkippedHoleNotice] = useState<number | null>(null);
  const [enforceSequential, setEnforceSequential] = useState(true);
  const [sequentialNotice, setSequentialNotice] = useState<number | null>(null);
  const { session, tripState, updateIndividualHoleScore, undoLastScoreEdit, roundSaveStatus, maxStrokesPerHole } =
    useTrip();
  const round = roundTemplates.find((r) => r.id === roundId) ?? roundTemplates[0];
  const roundCourse = tripState.courseDataPublished[roundId];
  const allowed = canViewPlayerCard(session, selectedPlayer);
  const roundSave = roundSaveStatus[roundId];
  const playerTime = round.teeTimes.find((g) => g.players.includes(selectedPlayer))?.time ?? "Not assigned";

  const playerTotal = useMemo(
    () => sumScores(tripState.individualScores[roundId][selectedPlayer]),
    [roundId, selectedPlayer, tripState.individualScores],
  );
  const holeScores = tripState.individualScores[roundId][selectedPlayer];
  const holesCompleted = holeScores.filter((score) => score !== "").length;
  const firstUnscoredIndex = holeScores.findIndex((score) => score === "");
  const activeHole = roundCourse[activeHoleIndex];
  const activeScore = holeScores[activeHoleIndex];
  const activePar = activeHole.par ?? 4;
  const holeMax = Math.min(maxStrokesPerHole, activePar + 2);
  const quickScoreOptions: ScorePreset[] = [
    { label: "Eagle", value: Math.max(1, activePar - 2), style: "circle", double: true },
    { label: "Birdie", value: Math.max(1, activePar - 1), style: "circle" },
    { label: "Par", value: activePar, style: "plain" },
    { label: "Bogey", value: Math.min(maxStrokesPerHole, activePar + 1), style: "square" },
    { label: "Double", value: holeMax, style: "square", double: true },
  ];

  useEffect(() => {
    setActiveHoleIndex(Math.max(0, Math.min(17, initialHoleIndex)));
  }, [initialHoleIndex, roundId, selectedPlayer]);

  useEffect(() => {
    const stored = window.localStorage.getItem("wgt_enforce_sequential_scoring");
    if (stored === null) {
      setEnforceSequential(true);
      return;
    }
    setEnforceSequential(stored === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("wgt_enforce_sequential_scoring", String(enforceSequential));
  }, [enforceSequential]);

  useEffect(() => {
    setSkippedHoleNotice(firstSkippedHole(holeScores));
  }, [holeScores]);

  useEffect(() => {
    if (!enforceSequential) return;
    if (firstUnscoredIndex === -1) return;
    if (activeHoleIndex > firstUnscoredIndex) {
      setActiveHoleIndex(firstUnscoredIndex);
      setSequentialNotice(firstUnscoredIndex + 1);
    }
  }, [activeHoleIndex, enforceSequential, firstUnscoredIndex]);

  const canNavigateToHole = (holeIndex: number) =>
    !enforceSequential || firstUnscoredIndex === -1 || holeIndex <= firstUnscoredIndex;

  const jumpToHole = (holeIndex: number) => {
    if (canNavigateToHole(holeIndex)) {
      setActiveHoleIndex(holeIndex);
      return;
    }
    const target = firstUnscoredIndex === -1 ? 0 : firstUnscoredIndex;
    setActiveHoleIndex(target);
    setSequentialNotice(target + 1);
  };

  const handleScoreEntry = (rawValue: string | number) => {
    const raw = String(rawValue);
    if (raw.trim() === "") {
      updateIndividualHoleScore(roundId, selectedPlayer, activeHoleIndex, "");
      return;
    }

    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.max(1, Math.min(holeMax, Math.trunc(parsed)));
    const changed = updateIndividualHoleScore(roundId, selectedPlayer, activeHoleIndex, String(clamped));
    if (!changed || activePar === null) return;
    const nextScores = [...holeScores];
    nextScores[activeHoleIndex] = clamped;
    setSkippedHoleNotice(firstSkippedHole(nextScores));

    if (clamped <= activePar - 2) {
      const id = Date.now();
      setCelebration({ id, type: "eagle" });
      window.setTimeout(() => setCelebration((prev) => (prev?.id === id ? null : prev)), 2800);
    } else if (clamped === activePar - 1) {
      const id = Date.now();
      setCelebration({ id, type: "birdie" });
      window.setTimeout(() => setCelebration((prev) => (prev?.id === id ? null : prev)), 2200);
    }
  };

  return (
    <section className="card">
      <div className="card-header">
        <h2>{round.name} scorecard</h2>
      </div>

      <div className="stack-sm">
        <label className="label" htmlFor="player-select">
          Player
        </label>
        <select
          id="player-select"
          className="input"
          value={selectedPlayer}
          onChange={(e) => onPlayerChange(e.target.value)}
        >
          {round.teeTimes.flatMap((group) => group.players).map((player) => (
            <option key={player} value={player}>
              {player}
            </option>
          ))}
        </select>
        <p className="muted">
          Tee time: {playerTime} | Flight: {findFlight(selectedPlayer)}
        </p>
        <label className="label row-wrap" htmlFor="sequential-toggle">
          <input
            id="sequential-toggle"
            type="checkbox"
            checked={enforceSequential}
            onChange={(e) => setEnforceSequential(e.target.checked)}
          />
          Enforce sequential scoring
        </label>
        {enforceSequential ? <span className="badge">Sequential lock on</span> : null}
      </div>

      {!allowed ? (
        <p className="warning">You can only enter your own card in player mode.</p>
      ) : (
        <div className="stack-md">
          <div className="inner-card mobile-scorecard">
            <div className="row-between">
              <strong>
                Hole {activeHole.hole} / 18
              </strong>
              <span className="badge">
                Par {activeHole.par ?? "-"} | {activeHole.yardage ?? "-"} yds
              </span>
            </div>

            <div className="score-center">
              <label className="label" htmlFor={`hole-score-${activeHole.hole}`}>
                Score
              </label>
              <input
                id={`hole-score-${activeHole.hole}`}
                className="input score-big-input"
                type="number"
                min={1}
                max={holeMax}
                value={activeScore}
                onChange={(e) => handleScoreEntry(e.target.value)}
                aria-label={`Score for hole ${activeHole.hole}`}
              />
              <div className="quick-score-row" role="group" aria-label="Quick score actions">
                {quickScoreOptions.map((scoreOption) => (
                  <button
                    key={`${activeHole.hole}-${scoreOption.label}-${scoreOption.value}`}
                    type="button"
                    className={`button ghost score-preset ${scoreOption.style}${scoreOption.double ? " double" : ""}`}
                    onClick={() => handleScoreEntry(scoreOption.value)}
                  >
                    <span className="score-preset-label">{scoreOption.label}</span>
                    <strong>{scoreOption.value}</strong>
                  </button>
                ))}
              </div>
              {skippedHoleNotice ? (
                <div className="warning row-between">
                  <span>You missed Hole {skippedHoleNotice}.</span>
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => jumpToHole(skippedHoleNotice - 1)}
                  >
                    Go to Hole {skippedHoleNotice}
                  </button>
                </div>
              ) : null}
              {enforceSequential && sequentialNotice ? (
                <div className="warning row-between">
                  <span>Sequential mode: score Hole {sequentialNotice} first.</span>
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => {
                      jumpToHole(sequentialNotice - 1);
                      setSequentialNotice(null);
                    }}
                  >
                    Go to Hole {sequentialNotice}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="row-between">
              <button
                type="button"
                className="button ghost"
                onClick={() => setActiveHoleIndex((prev) => Math.max(0, prev - 1))}
                disabled={activeHoleIndex === 0}
                aria-label="Previous hole"
              >
                Prev
              </button>
              <button
                type="button"
                className="button"
                onClick={() => jumpToHole(Math.min(17, activeHoleIndex + 1))}
                disabled={
                  activeHoleIndex === 17 ||
                  (enforceSequential &&
                    firstUnscoredIndex !== -1 &&
                    activeScore === "" &&
                    activeHoleIndex >= firstUnscoredIndex)
                }
                aria-label="Next hole"
              >
                Next
              </button>
            </div>
          </div>

          <div className="hole-jump-strip" aria-label="Jump to hole">
            {roundCourse.map((hole, idx) => (
              <button
                key={hole.hole}
                type="button"
                className={
                  idx === activeHoleIndex
                    ? "hole-pill active"
                    : holeScores[idx] !== ""
                      ? `hole-pill completed ${scoreShape(holeScores[idx], hole.par)}`
                      : holeScores.slice(idx + 1).some((value) => value !== "")
                        ? "hole-pill missed"
                      : "hole-pill"
                }
                onClick={() => jumpToHole(idx)}
                disabled={!canNavigateToHole(idx)}
                aria-disabled={!canNavigateToHole(idx)}
              >
                {hole.hole}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sticky-round-footer">
        <div className="row-between">
          <p className="total">Total: {playerTotal || 0}</p>
          <button type="button" className="button ghost" onClick={() => undoLastScoreEdit(roundId)}>
            Undo last edit
          </button>
        </div>
        <p className="muted">
          Holes completed: {holesCompleted}/18 | Save status:{" "}
          {roundSave?.state === "saving"
            ? "Saving..."
            : roundSave?.state === "error"
              ? `Error (${roundSave.message ?? "retry"})`
              : "Saved"}
          {roundSave?.lastSavedAt ? ` | Last saved at ${new Date(roundSave.lastSavedAt).toLocaleTimeString()}` : ""}
        </p>
      </div>
      {celebration ? (
        <div className={`score-celebration-overlay ${celebration.type}`} aria-hidden="true">
          <div className="celebration-banner">{celebration.type === "eagle" ? "EAGLE!" : "BIRDIE!"}</div>
          <div className="celebration-lane">
            <div className="celebration-ball" />
            <div className="celebration-ball-shadow" />
            <div className="celebration-flag">
              <span className="pole" />
              <span className="flag-cloth" />
              <span className="cup" />
            </div>
          </div>
          <div className="celebration-burst">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : null}
    </section>
  );
}
