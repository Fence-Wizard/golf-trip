"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/trip/AppShell";
import { CourseAdminEditor } from "@/components/trip/CourseAdminEditor";
import { RequireAdmin, RequireSession } from "@/components/trip/RequireSession";
import { useTrip } from "@/components/trip/TripProvider";
import { buildRuntimeRoundTemplates, getTeamScorers } from "@/lib/trip/config";
import { TeeGroup } from "@/lib/trip/types";

type AdminTab = "course" | "players" | "groupings" | "flights" | "payouts" | "operations";

const TAB_OPTIONS: Array<{ id: AdminTab; label: string }> = [
  { id: "course", label: "Course Data" },
  { id: "players", label: "Players" },
  { id: "groupings", label: "Groupings" },
  { id: "flights", label: "Flights" },
  { id: "payouts", label: "Payouts" },
  { id: "operations", label: "Operations" },
];

function suggestBalancedGroups(players: string[], groupCount: number, averages: Record<string, number>): string[][] {
  const sorted = [...players].sort((a, b) => (averages[a] ?? 99) - (averages[b] ?? 99) || a.localeCompare(b));
  const groups = Array.from({ length: groupCount }, () => [] as string[]);
  const snakeOrder = [...Array.from({ length: groupCount }, (_, idx) => idx), ...Array.from({ length: groupCount }, (_, idx) => groupCount - idx - 1)];
  let pickIndex = 0;
  for (const player of sorted) {
    const targetGroup = snakeOrder[pickIndex % snakeOrder.length];
    groups[targetGroup].push(player);
    pickIndex += 1;
  }
  return groups;
}

export default function AdminConsoleClient() {
  const [selectedRoundId, setSelectedRoundId] = useState(1);
  const [activeTab, setActiveTab] = useState<AdminTab>("course");
  const [suggestedGroups, setSuggestedGroups] = useState<TeeGroup[] | null>(null);
  const [swapPlayerA, setSwapPlayerA] = useState("");
  const [swapPlayerB, setSwapPlayerB] = useState("");
  const {
    tripState,
    scoreTotals,
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
  const selectedRoundPlayers = useMemo(
    () => Array.from(new Set(selectedRound.teeTimes.flatMap((group) => group.players))),
    [selectedRound],
  );
  const tournamentAverages = useMemo(() => {
    return Object.fromEntries(
      tripState.roster.map((player) => {
        const entries = runtimeRounds
          .map((round) => scoreTotals[round.id]?.[player] ?? 0)
          .filter((total) => total > 0);
        const average = entries.length > 0 ? entries.reduce((sum, value) => sum + value, 0) / entries.length : 99;
        return [player, average];
      }),
    ) as Record<string, number>;
  }, [runtimeRounds, scoreTotals, tripState.roster]);
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
              onChange={(e) => {
                setSelectedRoundId(Number(e.target.value));
                setSuggestedGroups(null);
              }}
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
              <p className="muted">
                Realign teams manually, suggest balanced teams from tournament averages, and edit round-only player names.
              </p>
              <div className="row-wrap">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => {
                    const currentPlayers = selectedRound.teeTimes.flatMap((group) => group.players);
                    const suggestedPlayers = suggestBalancedGroups(
                      currentPlayers,
                      selectedRound.teeTimes.length,
                      tournamentAverages,
                    );
                    const nextSuggestions = selectedRound.teeTimes.map((group, index) => ({
                      time: group.time,
                      players: suggestedPlayers[index] ?? group.players,
                    }));
                    setSuggestedGroups(nextSuggestions);
                  }}
                >
                  Suggest balanced teams
                </button>
                {suggestedGroups ? (
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      for (const [groupIndex, group] of suggestedGroups.entries()) {
                        updateRoundGrouping(selectedRoundId, groupIndex, group);
                      }
                      setSuggestedGroups(null);
                    }}
                  >
                    Apply suggested teams
                  </button>
                ) : null}
                {suggestedGroups ? (
                  <button type="button" className="button ghost" onClick={() => setSuggestedGroups(null)}>
                    Clear suggestions
                  </button>
                ) : null}
              </div>
              <div className="inner-card">
                <h3>Swap two players</h3>
                <p className="muted">Quickly swap player slots across this round's teams.</p>
                <div className="grid-holes">
                  <label className="hole-input">
                    <span>Player A</span>
                    <select
                      className="input"
                      value={swapPlayerA}
                      onChange={(e) => setSwapPlayerA(e.target.value)}
                    >
                      <option value="">Select player</option>
                      {selectedRoundPlayers.map((player) => (
                        <option key={`swap-a-${player}`} value={player}>
                          {player}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="hole-input">
                    <span>Player B</span>
                    <select
                      className="input"
                      value={swapPlayerB}
                      onChange={(e) => setSwapPlayerB(e.target.value)}
                    >
                      <option value="">Select player</option>
                      {selectedRoundPlayers.map((player) => (
                        <option key={`swap-b-${player}`} value={player}>
                          {player}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="row-wrap">
                  <button
                    type="button"
                    className="button"
                    disabled={!swapPlayerA || !swapPlayerB || swapPlayerA === swapPlayerB}
                    onClick={() => {
                      if (!swapPlayerA || !swapPlayerB || swapPlayerA === swapPlayerB) return;
                      const nextGroups = selectedRound.teeTimes.map((group) => ({
                        ...group,
                        players: group.players.map((player) => {
                          if (player === swapPlayerA) return swapPlayerB;
                          if (player === swapPlayerB) return swapPlayerA;
                          return player;
                        }),
                      }));
                      for (const [groupIndex, group] of nextGroups.entries()) {
                        updateRoundGrouping(selectedRoundId, groupIndex, group);
                      }
                    }}
                  >
                    Swap players in this round
                  </button>
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => {
                      setSwapPlayerA("");
                      setSwapPlayerB("");
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
              {suggestedGroups ? (
                <div className="warning">
                  <p>Suggested teams (lower average = stronger golfer):</p>
                  {suggestedGroups.map((group, index) => (
                    <p key={`suggested-${index}`}>
                      Team {index + 1}: {group.players.join(", ")}
                    </p>
                  ))}
                </div>
              ) : null}
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
                          <input
                            id={`group-player-${groupIndex}-${playerIndex}`}
                            className="input"
                            defaultValue={player}
                            placeholder="Name for this round slot"
                          />
                          <span className="muted">
                            Avg:{" "}
                            {Number.isFinite(tournamentAverages[player]) && tournamentAverages[player] < 99
                              ? tournamentAverages[player].toFixed(1)
                              : "N/A"}
                          </span>
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
                          ) as HTMLInputElement | null;
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

