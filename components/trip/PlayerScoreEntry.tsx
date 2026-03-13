"use client";

import { useEffect, useMemo, useState } from "react";
import { useTrip } from "@/components/trip/TripProvider";
import { buildRuntimeRoundTemplates, findFlight } from "@/lib/trip/config";
import { canViewPlayerCard } from "@/lib/auth/session";
import { sumScores } from "@/lib/trip/scoring";

interface PlayerScoreEntryProps {
  roundId: number;
  selectedPlayer: string;
  onPlayerChange: (player: string) => void;
  initialHoleIndex?: number;
  canSelectPlayer?: boolean;
  viewOnly?: boolean;
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

function scoreShapeLabel(shape: ReturnType<typeof scoreShape>) {
  switch (shape) {
    case "eagle":
      return "Eagle or better";
    case "birdie":
      return "Birdie";
    case "par":
      return "Par";
    case "bogey":
      return "Bogey";
    case "double-bogey":
      return "Double bogey max";
    default:
      return "No score yet";
  }
}

export function PlayerScoreEntry({
  roundId,
  selectedPlayer,
  onPlayerChange,
  initialHoleIndex = 0,
  canSelectPlayer = false,
  viewOnly = false,
}: PlayerScoreEntryProps) {
  const [activeHoleIndex, setActiveHoleIndex] = useState(0);
  const [celebration, setCelebration] = useState<{ id: number; type: "birdie" | "eagle" } | null>(null);
  const [skippedHoleNotice, setSkippedHoleNotice] = useState<number | null>(null);
  const [enforceSequential, setEnforceSequential] = useState(true);
  const [sequentialNotice, setSequentialNotice] = useState<number | null>(null);
  const { session, tripState, updateIndividualHoleScore, undoLastScoreEdit, roundSaveStatus, maxStrokesPerHole } =
    useTrip();
  const runtimeRounds = useMemo(() => buildRuntimeRoundTemplates(tripState.roundGroupings), [tripState.roundGroupings]);
  const round = runtimeRounds.find((r) => r.id === roundId) ?? runtimeRounds[0];
  const roundCourse = tripState.courseDataPublished[roundId];
  const canEdit = !viewOnly && canViewPlayerCard(session, selectedPlayer);
  const viewingOtherPlayer = session.player !== selectedPlayer;
  const enforceSequentialLock = canEdit && enforceSequential;
  const roundSave = roundSaveStatus[roundId];
  const playerTime = round.teeTimes.find((g) => g.players.includes(selectedPlayer))?.time ?? "Not assigned";

  const playerTotal = useMemo(
    () => sumScores(tripState.individualScores[roundId][selectedPlayer]),
    [roundId, selectedPlayer, tripState.individualScores],
  );
  const holeScores = tripState.individualScores[roundId][selectedPlayer];
  const frontComplete = holeScores.slice(0, 9).filter((score) => score !== "").length;
  const backComplete = holeScores.slice(9, 18).filter((score) => score !== "").length;
  const scoreToPar = holeScores.reduce<number>((acc, score, idx) => {
    if (score === "") return acc;
    return acc + Number(score) - (roundCourse[idx]?.par ?? 0);
  }, 0);
  const holesCompleted = holeScores.filter((score) => score !== "").length;
  const firstUnscoredIndex = holeScores.findIndex((score) => score === "");
  const activeHole = roundCourse[activeHoleIndex];
  const activeScore = holeScores[activeHoleIndex];
  const activePar = activeHole.par ?? 4;
  const holeMax = Math.min(maxStrokesPerHole, activePar + 2);
  const playerFlight = findFlight(selectedPlayer, tripState.flights);
  const activeShape = scoreShape(activeScore, activePar);
  const scoreToParLabel = scoreToPar > 0 ? `+${scoreToPar}` : `${scoreToPar}`;
  const saveStatusLabel = canEdit
    ? roundSave?.state === "saving"
      ? "Saving..."
      : roundSave?.state === "error"
        ? "Save issue"
        : "Saved"
    : "View only";
  const saveStatusDetail = canEdit
    ? roundSave?.state === "error"
      ? roundSave.message ?? "Please retry."
      : roundSave?.lastSavedAt
        ? `Last saved at ${new Date(roundSave.lastSavedAt).toLocaleTimeString()}`
        : "Changes sync automatically."
    : viewingOtherPlayer
      ? `Viewing ${selectedPlayer}'s scorecard from the leaderboard.`
      : "This scorecard is currently read-only.";
  const quickScoreOptions: ScorePreset[] = [
    { label: "Eagle", value: Math.max(1, activePar - 2), style: "circle", double: true },
    { label: "Birdie", value: Math.max(1, activePar - 1), style: "circle" },
    { label: "Par", value: activePar, style: "plain" },
    { label: "Bogey", value: Math.min(maxStrokesPerHole, activePar + 1), style: "square" },
    { label: "Double", value: holeMax, style: "square", double: true },
  ];
  const renderHoleButton = (hole: (typeof roundCourse)[number], idx: number) => (
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
      disabled={canEdit ? !canNavigateToHole(idx) : false}
      aria-disabled={canEdit ? !canNavigateToHole(idx) : false}
    >
      {hole.hole}
    </button>
  );

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
    if (!enforceSequentialLock) return;
    if (firstUnscoredIndex === -1) return;
    if (activeHoleIndex > firstUnscoredIndex) {
      setActiveHoleIndex(firstUnscoredIndex);
      setSequentialNotice(firstUnscoredIndex + 1);
    }
  }, [activeHoleIndex, enforceSequentialLock, firstUnscoredIndex]);

  const canNavigateToHole = (holeIndex: number) =>
    !enforceSequentialLock || firstUnscoredIndex === -1 || holeIndex <= firstUnscoredIndex;

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
    if (!canEdit) return;
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

    const nextUnscored = nextScores.findIndex((value, idx) => idx > activeHoleIndex && value === "");
    if (nextUnscored !== -1) {
      setActiveHoleIndex(nextUnscored);
    } else if (activeHoleIndex < 17) {
      setActiveHoleIndex(Math.min(17, activeHoleIndex + 1));
    }
  };

  return (
    <section className="card">
      <div className="card-header">
        <div className="row-between">
          <div>
            <p className="eyebrow">{canEdit ? "Live score entry" : "Scorecard view"}</p>
            <h2>{round.name} scorecard</h2>
          </div>
          <span className="badge">{saveStatusLabel}</span>
        </div>
      </div>

      <div className="scorecard-summary-grid">
        {canSelectPlayer ? (
          <label className="metric-tile" htmlFor="player-select">
            <span className="eyebrow">Player</span>
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
            <span className="muted">Choose any player card for admin review.</span>
          </label>
        ) : (
          <article className="metric-tile">
            <p className="eyebrow">{viewingOtherPlayer ? "Viewing scorecard" : "Player"}</p>
            <p className="metric-value">{selectedPlayer}</p>
            <p className="muted">{viewingOtherPlayer ? "Leaderboard-linked read-only card." : "Your live player card."}</p>
          </article>
        )}
        <article className="metric-tile">
          <p className="eyebrow">Tee time</p>
          <p className="metric-value">{playerTime}</p>
          <p className="muted">Flight {playerFlight}</p>
        </article>
        <article className="metric-tile">
          <p className="eyebrow">Progress</p>
          <p className="metric-value">{holesCompleted}/18</p>
          <p className="muted">
            Front {frontComplete}/9 • Back {backComplete}/9
          </p>
        </article>
        <article className="metric-tile">
          <p className="eyebrow">To par</p>
          <p className="metric-value">{scoreToParLabel}</p>
          <p className="muted">{firstUnscoredIndex === -1 ? "Card complete." : `Next open hole: ${firstUnscoredIndex + 1}`}</p>
        </article>
      </div>

      {canEdit ? (
        <div className="inner-card scorecard-settings">
          <div className="row-between">
            <div>
              <p className="eyebrow">Scoring flow</p>
              <p className="metric-value">{enforceSequential ? "Sequential lock on" : "Free hole navigation"}</p>
            </div>
            <label className="label row-wrap" htmlFor="sequential-toggle">
              <input
                id="sequential-toggle"
                type="checkbox"
                checked={enforceSequential}
                onChange={(e) => setEnforceSequential(e.target.checked)}
              />
              Enforce sequential scoring
            </label>
          </div>
          <p className="muted">Scores auto-advance to the next hole so the card feels closer to a live golf app flow.</p>
        </div>
      ) : (
        <p className="warning">{saveStatusDetail}</p>
      )}

      <div className="stack-md">
        <div className="inner-card mobile-scorecard active-hole-card">
          <div className="row-between">
            <div>
              <p className="eyebrow">Active hole</p>
              <h3>
                Hole {activeHole.hole} of 18
              </h3>
            </div>
            <span className="badge">{scoreShapeLabel(activeShape)}</span>
          </div>

          <div className="metric-grid hole-facts-grid">
            <article className="metric-tile">
              <p className="eyebrow">Par</p>
              <p className="metric-value">{activeHole.par ?? "-"}</p>
            </article>
            <article className="metric-tile">
              <p className="eyebrow">Yardage</p>
              <p className="metric-value">{activeHole.yardage ?? "-"}</p>
            </article>
            <article className="metric-tile">
              <p className="eyebrow">Handicap</p>
              <p className="metric-value">{activeHole.handicapIndex ?? "-"}</p>
            </article>
            <article className="metric-tile">
              <p className="eyebrow">Hole max</p>
              <p className="metric-value">{holeMax}</p>
            </article>
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
              disabled={!canEdit}
            />
            <p className="muted center-text">Double bogey max is enforced at {holeMax} on this hole.</p>
            {canEdit ? (
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
            ) : null}
            {canEdit && skippedHoleNotice ? (
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
            {canEdit && enforceSequentialLock && sequentialNotice ? (
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
                (enforceSequentialLock &&
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

        <div className="stack-sm">
          <div className="hole-strip-section">
            <div className="row-between">
              <p className="eyebrow">Front 9</p>
              <span className="badge">{frontComplete}/9 scored</span>
            </div>
            <div className="hole-jump-grid" aria-label="Jump to front nine hole">
              {roundCourse.slice(0, 9).map((hole, idx) => renderHoleButton(hole, idx))}
            </div>
          </div>
          <div className="hole-strip-section">
            <div className="row-between">
              <p className="eyebrow">Back 9</p>
              <span className="badge">{backComplete}/9 scored</span>
            </div>
            <div className="hole-jump-grid" aria-label="Jump to back nine hole">
              {roundCourse.slice(9).map((hole, idx) => renderHoleButton(hole, idx + 9))}
            </div>
          </div>
        </div>
      </div>

      <div className="sticky-round-footer">
        <div className="footer-summary-grid">
          <article className="metric-tile">
            <p className="eyebrow">Total</p>
            <p className="metric-value">{playerTotal || 0}</p>
          </article>
          <article className="metric-tile">
            <p className="eyebrow">Completed</p>
            <p className="metric-value">{holesCompleted}/18</p>
          </article>
          <article className="metric-tile">
            <p className="eyebrow">Status</p>
            <p className="metric-value">{saveStatusLabel}</p>
            <p className="muted">{saveStatusDetail}</p>
          </article>
        </div>
        <div className="row-between">
          {canEdit ? (
            <button type="button" className="button ghost" onClick={() => undoLastScoreEdit(roundId)}>
              Undo last edit
            </button>
          ) : (
            <span className="badge">View only</span>
          )}
        </div>
      </div>
      {canEdit && celebration ? (
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
