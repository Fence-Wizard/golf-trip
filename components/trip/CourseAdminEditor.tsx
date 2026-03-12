"use client";

import { useMemo } from "react";
import { useTrip } from "@/components/trip/TripProvider";
import { roundTemplates } from "@/lib/trip/config";
import { evaluateCourseIntegrity } from "@/lib/trip/courseIntegrity";
import { splitFrontBack } from "@/lib/trip/scoring";

interface CourseAdminEditorProps {
  roundId: number;
}

export function CourseAdminEditor({ roundId }: CourseAdminEditorProps) {
  const {
    tripState,
    updateCourseHole,
    publishCourseData,
    setCourseConfirmed,
    setCourseLock,
    setHoleVerification,
    resetCourseDraftFromSeed,
  } = useTrip();
  const round = roundTemplates.find((r) => r.id === roundId) ?? roundTemplates[0];
  const holes = tripState.courseDataDraft[roundId];
  const publication = tripState.coursePublication[roundId];

  const totals = useMemo(() => splitFrontBack(holes), [holes]);
  const integrity = useMemo(() => evaluateCourseIntegrity(holes, round), [holes, round]);
  const isReadOnly = publication.isLocked;

  return (
    <section className="card">
      <div className="card-header">
        <h2>{round.name} course data</h2>
        <p className="muted">{round.course}</p>
      </div>

      <div className="stack-sm">
        <p className="muted">
          Enter white-tee par, yardage, and handicap index. Holes can be verified and source-attributed before
          publishing.
        </p>
        <p className="muted">
          Round seeds already include the uploaded scorecard values; use this editor only when an admin adjustment is
          needed.
        </p>
        <div className="stack-sm row-wrap">
          <button type="button" className="button" onClick={() => publishCourseData(roundId)}>
            Publish Round Course Data
          </button>
          <button type="button" className="button ghost" disabled={isReadOnly} onClick={() => resetCourseDraftFromSeed(roundId)}>
            Reload Public Source Seed
          </button>
          <button
            type="button"
            className="button ghost"
            onClick={() => setCourseLock(roundId, !publication.isLocked)}
          >
            {publication.isLocked ? "Unlock Round Data" : "Lock Round Data"}
          </button>
          <button
            type="button"
            className="button ghost"
            onClick={() => setCourseConfirmed(roundId, !publication.isConfirmed)}
          >
            {publication.isConfirmed ? "Mark Unconfirmed" : "Mark Confirmed"}
          </button>
        </div>
        <p className="muted">
          Status: {publication.isConfirmed ? "Confirmed" : "Unconfirmed"} |{" "}
          {publication.isLocked ? "Locked" : "Unlocked"} | Last publish:{" "}
          {publication.lastPublishedAt ? new Date(publication.lastPublishedAt).toLocaleString() : "Never"}
        </p>
        <p className={integrity.yardageMatchesRoundTotal ? "muted" : "warning"}>
          Integrity: {integrity.completeHoles}/18 complete, {integrity.confirmedHoles}/18 admin-verified, total{" "}
          {integrity.totalYardage} yds
          {integrity.expectedTotalYardage ? ` (target ${integrity.expectedTotalYardage})` : ""}.
          {!integrity.yardageMatchesRoundTotal && " Total does not match expected white-tee yardage."}
        </p>
        <p className={integrity.duplicateHandicapIndexes > 0 ? "warning" : "muted"}>
          Handicap indexes duplicates: {integrity.duplicateHandicapIndexes}
        </p>
      </div>

      <div className="totals-grid">
        <div className="inner-card">
          <p className="eyebrow">Front 9</p>
          <p>Par {totals.front.par}</p>
          <p>Yardage {totals.front.yardage || "-"}</p>
        </div>
        <div className="inner-card">
          <p className="eyebrow">Back 9</p>
          <p>Par {totals.back.par}</p>
          <p>Yardage {totals.back.yardage || "-"}</p>
        </div>
        <div className="inner-card">
          <p className="eyebrow">Course Total</p>
          <p>Par {totals.front.par + totals.back.par}</p>
          <p>Yardage {(totals.front.yardage || 0) + (totals.back.yardage || 0) || "-"}</p>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Hole</th>
              <th>Par</th>
              <th>Yardage</th>
              <th>Hdcp</th>
              <th>Verified</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {holes.map((hole, idx) => (
              <tr key={`hole-${hole.hole}`}>
                <td>{hole.hole}</td>
                <td>
                  <input
                    className="input score-input"
                    type="number"
                    min={1}
                    value={hole.par ?? ""}
                    disabled={isReadOnly}
                    onChange={(e) => updateCourseHole(roundId, idx, "par", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="input score-input"
                    type="number"
                    min={1}
                    value={hole.yardage ?? ""}
                    disabled={isReadOnly}
                    onChange={(e) => updateCourseHole(roundId, idx, "yardage", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="input score-input"
                    type="number"
                    min={1}
                    max={18}
                    value={hole.handicapIndex ?? ""}
                    disabled={isReadOnly}
                    onChange={(e) => updateCourseHole(roundId, idx, "handicapIndex", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={hole.verifiedByAdmin}
                    disabled={isReadOnly}
                    onChange={(e) => setHoleVerification(roundId, idx, e.target.checked)}
                  />
                </td>
                <td>
                  {hole.sourceUrl ? (
                    <a href={hole.sourceUrl} target="_blank" rel="noreferrer" className="muted">
                      {hole.sourceName ?? "Source"}
                    </a>
                  ) : (
                    <span className="muted">Manual</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
