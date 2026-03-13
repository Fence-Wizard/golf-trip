"use client";

import { useState } from "react";
import { AppShell } from "@/components/trip/AppShell";
import { CourseAdminEditor } from "@/components/trip/CourseAdminEditor";
import { RequireAdmin, RequireSession } from "@/components/trip/RequireSession";
import { useTrip } from "@/components/trip/TripProvider";
import { buildRuntimeRoundTemplates, getTeamScorers } from "@/lib/trip/config";

type AdminTab = "course" | "players" | "groupings" | "flights" | "payouts" | "operations";

const TAB_OPTIONS: Array<{ id: AdminTab; label: string }> = [
  { id: "course", label: "Course Data" },
  { id: "players", label: "Players" },
  { id: "groupings", label: "Groupings" },
  { id: "flights", label: "Flights" },
  { id: "payouts", label: "Payouts" },
  { id: "operations", label: "Operations" },
];

export default function AdminConsoleClient() {
  const [selectedRoundId, setSelectedRoundId] = useState(1);
  const [activeTab, setActiveTab] = useState<AdminTab>("course");
  const {
    tripState,
    storageMode,
    loadDemoScores,
    clearDemoScores,
    setTeamDelegateForRound,
    updatePlayerName,
    updateRoundGrouping,
    updateFlightMembers,
    updatePayoutSetting,
  } = useTrip();
  const runtimeRounds = buildRuntimeRoundTemplates(tripState.roundGroupings);
  const selectedRound = runtimeRounds.find((round) => round.id === selectedRoundId) ?? runtimeRounds[0];
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
            <div className="row-between">
              <div>
                <h2>Admin Console</h2>
                <p className="muted">Manage configuration through tabs for safer, focused edits.</p>
              </div>
              <label className="label" htmlFor="admin-round-select">
                Round
              </label>
            </div>
            <select
              id="admin-round-select"
              className="input"
              value={selectedRoundId}
              onChange={(e) => setSelectedRoundId(Number(e.target.value))}
            >
              {runtimeRounds.map((round) => (
                <option key={round.id} value={round.id}>
                  {round.name} - {round.course}
                </option>
              ))}
            </select>
            <div className="row-wrap">
              {TAB_OPTIONS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`button ${activeTab === tab.id ? "" : "ghost"}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>
          {activeTab === "course" ? <CourseAdminEditor roundId={selectedRoundId} /> : null}

          {activeTab === "players" ? (
            <section className="card">
              <h2>Players</h2>
              <p className="muted">Edit player names directly. Changes propagate to scorecards and assignments.</p>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Current Name</th>
                      <th>New Name</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tripState.roster.map((player) => (
                      <tr key={`player-edit-${player}`}>
                        <td>{player}</td>
                        <td>
                          <input id={`rename-${player}`} className="input" defaultValue={player} />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="button ghost"
                            onClick={() => {
                              const input = document.getElementById(`rename-${player}`) as HTMLInputElement | null;
                              updatePlayerName(player, input?.value ?? player);
                            }}
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {activeTab === "groupings" ? (
            <section className="card">
              <h2>Round Groupings</h2>
              <p className="muted">Update tee times and group players for the selected round.</p>
              <div className="stack-sm">
                {selectedRound.teeTimes.map((group, groupIndex) => (
                  <div className="inner-card" key={`group-${selectedRoundId}-${groupIndex}`}>
                    <div className="row-between">
                      <strong>Group {groupIndex + 1}</strong>
                      <span className="badge">{selectedRound.name}</span>
                    </div>
                    <label className="label" htmlFor={`group-time-${groupIndex}`}>
                      Tee time
                    </label>
                    <input id={`group-time-${groupIndex}`} className="input" defaultValue={group.time} />
                    <div className="grid-holes">
                      {group.players.map((player, playerIndex) => (
                        <label key={`group-player-${groupIndex}-${playerIndex}`} className="hole-input">
                          <span>Player {playerIndex + 1}</span>
                          <select
                            id={`group-player-${groupIndex}-${playerIndex}`}
                            className="input"
                            defaultValue={player}
                          >
                            {tripState.roster.map((rosterPlayer) => (
                              <option key={`${groupIndex}-${playerIndex}-${rosterPlayer}`} value={rosterPlayer}>
                                {rosterPlayer}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="button ghost"
                      onClick={() => {
                        const timeInput = document.getElementById(`group-time-${groupIndex}`) as HTMLInputElement | null;
                        const nextPlayers = group.players.map((_, playerIndex) => {
                          const select = document.getElementById(
                            `group-player-${groupIndex}-${playerIndex}`,
                          ) as HTMLSelectElement | null;
                          return select?.value ?? group.players[playerIndex];
                        });
                        updateRoundGrouping(selectedRoundId, groupIndex, {
                          time: timeInput?.value ?? group.time,
                          players: nextPlayers,
                        });
                      }}
                    >
                      Save Group
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === "flights" ? (
            <section className="card">
              <h2>Flights</h2>
              <p className="muted">Edit flight members as comma-separated player names.</p>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Flight</th>
                      <th>Members</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(tripState.flights).map(([flightName, members]) => (
                      <tr key={`flight-${flightName}`}>
                        <td>{flightName}</td>
                        <td>
                          <input id={`flight-${flightName}`} className="input" defaultValue={members.join(", ")} />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="button ghost"
                            onClick={() => {
                              const input = document.getElementById(`flight-${flightName}`) as HTMLInputElement | null;
                              const nextMembers =
                                input?.value
                                  .split(",")
                                  .map((member) => member.trim())
                                  .filter(Boolean) ?? members;
                              updateFlightMembers(flightName, nextMembers);
                            }}
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {activeTab === "payouts" ? (
            <section className="card">
              <h2>Payout Rules</h2>
              <p className="muted">Adjust buy-in and payout amounts used in the results calculations.</p>
              <div className="table-wrap">
                <table className="table">
                  <tbody>
                    <tr>
                      <th>Buy-in per player</th>
                      <td>
                        <input
                          id="payout-buyin"
                          className="input"
                          type="number"
                          min={0}
                          defaultValue={tripState.payoutSettings.buyIn}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="button ghost"
                          onClick={() => {
                            const input = document.getElementById("payout-buyin") as HTMLInputElement | null;
                            updatePayoutSetting("buyIn", Number(input?.value ?? tripState.payoutSettings.buyIn));
                          }}
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <th>Team win payout (per player)</th>
                      <td>
                        <input
                          id="payout-team"
                          className="input"
                          type="number"
                          min={0}
                          defaultValue={tripState.payoutSettings.teamWinPayout}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="button ghost"
                          onClick={() => {
                            const input = document.getElementById("payout-team") as HTMLInputElement | null;
                            updatePayoutSetting(
                              "teamWinPayout",
                              Number(input?.value ?? tripState.payoutSettings.teamWinPayout),
                            );
                          }}
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <th>Flight win payout</th>
                      <td>
                        <input
                          id="payout-flight"
                          className="input"
                          type="number"
                          min={0}
                          defaultValue={tripState.payoutSettings.flightWinPayout}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="button ghost"
                          onClick={() => {
                            const input = document.getElementById("payout-flight") as HTMLInputElement | null;
                            updatePayoutSetting(
                              "flightWinPayout",
                              Number(input?.value ?? tripState.payoutSettings.flightWinPayout),
                            );
                          }}
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {activeTab === "operations" ? (
            <>
              <section className="card">
                <h2>Demo Data & Delegates</h2>
                <p className="muted">
                  Persistence mode: {storageMode === "server" ? "Cloud sync enabled" : "Local-only mode until DATABASE_URL is configured"}
                </p>
                <div className="row-wrap">
                  <button type="button" className="button ghost" onClick={loadDemoScores}>
                    Load Demo Scores
                  </button>
                  <button type="button" className="button ghost" onClick={clearDemoScores}>
                    Clear Demo Scores
                  </button>
                </div>
                <p className="muted">
                  Demo actions only affect scores/live status and are safe to remove. Course data, locks, and
                  confirmations remain untouched.
                </p>
              </section>
              {[2, 3, 4].includes(selectedRoundId) ? (
                <section className="card">
                  <h2>Team Delegate Assignments</h2>
                  <p className="muted">
                    Set the second scorer per team for this round. Captains remain fixed (Lee/Sam/Todd by team order).
                  </p>
                  <div className="stack-sm">
                    {selectedRound.teeTimes.map((team, teamIndex) => {
                      const delegateOverride = tripState.teamDelegateAssignments[selectedRoundId]?.[teamIndex];
                      const [captain, delegate] = getTeamScorers(
                        selectedRoundId,
                        teamIndex,
                        delegateOverride,
                        tripState.roundGroupings,
                      );
                      return (
                        <div key={`${selectedRoundId}-delegate-${teamIndex}`} className="inner-card">
                          <div className="row-between">
                            <strong>Team {teamIndex + 1}</strong>
                            <span className="badge">{team.players.join(", ")}</span>
                          </div>
                          <p className="muted">Captain: {captain}</p>
                          <label className="label" htmlFor={`delegate-${selectedRoundId}-${teamIndex}`}>
                            Delegate scorer
                          </label>
                          <select
                            id={`delegate-${selectedRoundId}-${teamIndex}`}
                            className="input"
                            value={delegate}
                            onChange={(e) => setTeamDelegateForRound(selectedRoundId, teamIndex, e.target.value)}
                          >
                            {team.players
                              .filter((player) => player !== captain)
                              .map((player) => (
                                <option key={`${selectedRoundId}-${teamIndex}-${player}`} value={player}>
                                  {player}
                                </option>
                              ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}
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
            </>
          ) : null}
        </AppShell>
      </RequireAdmin>
    </RequireSession>
  );
}

