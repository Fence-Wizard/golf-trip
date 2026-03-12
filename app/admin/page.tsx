"use client";

import { useState } from "react";
import { AppShell } from "@/components/trip/AppShell";
import { CourseAdminEditor } from "@/components/trip/CourseAdminEditor";
import { RequireAdmin, RequireSession } from "@/components/trip/RequireSession";
import { useTrip } from "@/components/trip/TripProvider";
import { roundTemplates } from "@/lib/trip/config";

export default function AdminPage() {
  const [selectedRoundId, setSelectedRoundId] = useState(1);
  const { tripState, loadDemoScores, clearDemoScores } = useTrip();
  const recentEdits = tripState.scoreEditHistory
    .filter((event) => event.roundId === selectedRoundId)
    .slice(-20)
    .reverse();
  const recentConflicts = tripState.scoreConflicts
    .filter((event) => event.roundId === selectedRoundId)
    .slice(-10)
    .reverse();

  return (
    <RequireSession>
      <RequireAdmin>
        <AppShell>
          <section className="card">
            <h2>Course Data Admin</h2>
            <p className="muted">
              Enter confirmed white-tee scorecard details here. Green and Gold totals are pre-confirmed.
            </p>
            <div className="stack-sm row-wrap">
              <button type="button" className="button ghost" onClick={loadDemoScores}>
                Load Demo Scores
              </button>
              <button type="button" className="button ghost" onClick={clearDemoScores}>
                Clear Demo Scores
              </button>
            </div>
            <p className="muted">
              Demo actions only affect scores/live status and are safe to remove. Course data, locks, and confirmations
              remain untouched.
            </p>
            <label className="label" htmlFor="admin-round-select">
              Round
            </label>
            <select
              id="admin-round-select"
              className="input"
              value={selectedRoundId}
              onChange={(e) => setSelectedRoundId(Number(e.target.value))}
            >
              {roundTemplates.map((round) => (
                <option key={round.id} value={round.id}>
                  {round.name} - {round.course}
                </option>
              ))}
            </select>
          </section>
          <CourseAdminEditor roundId={selectedRoundId} />
          <section className="card">
            <h2>Round Score Edit History</h2>
            <p className="muted">Recent score changes for this round.</p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Target</th>
                    <th>Hole</th>
                    <th>Change</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEdits.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted">
                        No edits yet.
                      </td>
                    </tr>
                  ) : (
                    recentEdits.map((event) => (
                      <tr key={event.id}>
                        <td>{new Date(event.timestamp).toLocaleTimeString()}</td>
                        <td>
                          {event.targetType}: {event.targetId}
                        </td>
                        <td>{event.holeIndex + 1}</td>
                        <td>
                          {event.previousValue || "-"} {"->"} {event.nextValue || "-"}
                        </td>
                        <td>{event.editedBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card">
            <h2>Conflict Alerts</h2>
            <p className="muted">Potential overwrite events from different users within the conflict window.</p>
            <div className="stack-sm">
              {recentConflicts.length === 0 ? (
                <p className="muted">No conflicts detected.</p>
              ) : (
                recentConflicts.map((event) => (
                  <p key={event.id} className="warning">
                    {new Date(event.timestamp).toLocaleTimeString()} - {event.message} Previous by{" "}
                    {event.previousEditedBy}, now by {event.currentEditedBy}.
                  </p>
                ))
              )}
            </div>
          </section>
        </AppShell>
      </RequireAdmin>
    </RequireSession>
  );
}
