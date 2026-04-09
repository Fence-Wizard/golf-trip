"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  buildRoleFromSelection,
  clearSession,
  getEmptySession,
  loadSession,
  saveSession,
} from "@/lib/auth/session";
import {
  ADMIN_PLAYER,
  buildInitialIndividualScoresForRoster,
  buildInitialRoundLiveState,
  buildInitialTeamEntrySubmissions,
  buildInitialTeamScores,
  buildRuntimeRoundTemplates,
  getTeamScorers,
  roundTemplates,
  seededCourseDataByRound,
} from "@/lib/trip/config";
import { buildFlightResults, buildPayoutSummary, buildRoundTotals, buildTeamResults } from "@/lib/trip/scoring";
import {
  fetchRemoteTripState,
  fetchServerSession,
  loginViaServer,
  logoutViaServer,
  saveRemoteTripState,
} from "@/lib/trip/apiClient";
import { buildInitialTripState, loadTripState, saveTripState } from "@/lib/trip/storage";
import { trackEvent } from "@/lib/observability";
import {
  HoleData,
  Role,
  ScoreConflictEvent,
  ScoreEntryMode,
  ScoreEditEvent,
  SessionState,
  TeeGroup,
  TripState,
} from "@/lib/trip/types";

interface TripContextValue {
  session: SessionState;
  tripState: TripState;
  isHydrated: boolean;
  storageMode: "local" | "server";
  demoMode: boolean;
  demoStep: number;
  maxStrokesPerHole: number;
  roundSaveStatus: Record<
    number,
    {
      state: "saved" | "saving" | "error";
      message: string | null;
      unsavedChanges: boolean;
      lastSavedAt: string | null;
    }
  >;
  login: (player: string, role: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateIndividualHoleScore: (roundId: number, player: string, holeIndex: number, value: string) => boolean;
  updateTeamHoleScore: (roundId: number, teamIndex: number, holeIndex: number, value: string) => boolean;
  updateRoundEntryMode: (roundId: number, mode: ScoreEntryMode, force?: boolean) => void;
  updateCourseHole: (roundId: number, holeIndex: number, field: keyof HoleData, value: string) => void;
  setHoleVerification: (roundId: number, holeIndex: number, verified: boolean) => void;
  setCourseLock: (roundId: number, locked: boolean) => void;
  setCourseConfirmed: (roundId: number, confirmed: boolean) => void;
  resetCourseDraftFromSeed: (roundId: number) => void;
  publishCourseData: (roundId: number) => void;
  startRoundLive: (roundId: number) => void;
  stopRoundLive: (roundId: number) => void;
  finalizeRound: (roundId: number) => void;
  reopenRound: (roundId: number) => void;
  undoLastScoreEdit: (roundId: number) => void;
  loadDemoScores: () => void;
  clearDemoScores: () => void;
  startDemoMode: () => void;
  endDemoMode: () => void;
  nextDemoStep: () => void;
  previousDemoStep: () => void;
  setDemoStep: (step: number) => void;
  resolveTeamScoreDiscrepancy: (roundId: number, teamIndex: number, holeIndex: number, preferredScorer: "A" | "B") => void;
  setTeamDelegateForRound: (roundId: number, teamIndex: number, delegatePlayer: string) => void;
  updatePlayerName: (existingName: string, nextName: string) => void;
  updateRoundGrouping: (roundId: number, groupIndex: number, nextGroup: TeeGroup) => void;
  updateFlightMembers: (flightName: string, members: string[]) => void;
  updatePayoutSetting: (field: "buyIn" | "teamWinPayout" | "flightWinPayout", value: number) => void;
  scoreTotals: Record<number, Record<string, number>>;
  teamResults: ReturnType<typeof buildTeamResults>;
  flightResults: ReturnType<typeof buildFlightResults>;
  payoutSummary: ReturnType<typeof buildPayoutSummary>;
}

const TripContext = createContext<TripContextValue | null>(null);

const MAX_STROKES_PER_HOLE = 15;
const CONFLICT_WINDOW_MS = 45_000;
const DEMO_DEFAULT_USER = "Todd";
const DEMO_MAX_STEP = 5;

function toHoleNumber(value: string): number | "" {
  if (value === "") return "";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "";
  return Math.max(1, Math.min(MAX_STROKES_PER_HOLE, Math.trunc(numeric)));
}

function sanitizeRole(role: string): Role {
  return buildRoleFromSelection(role);
}

function cloneTripState(state: TripState): TripState {
  return JSON.parse(JSON.stringify(state)) as TripState;
}

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionState>(getEmptySession);
  const [tripState, setTripState] = useState<TripState>(buildInitialTripState);
  const [isHydrated, setIsHydrated] = useState(false);
  const [storageMode, setStorageMode] = useState<"local" | "server">("local");
  const [serverVersion, setServerVersion] = useState<number | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const [demoSnapshot, setDemoSnapshot] = useState<{ session: SessionState; tripState: TripState } | null>(null);
  const [dirtyRoundIds, setDirtyRoundIds] = useState<number[]>([]);
  const [roundSaveStatus, setRoundSaveStatus] = useState<
    Record<
      number,
      { state: "saved" | "saving" | "error"; message: string | null; unsavedChanges: boolean; lastSavedAt: string | null }
    >
  >(() =>
    Object.fromEntries(
      roundTemplates.map((round) => [
        round.id,
        { state: "saved", message: null, unsavedChanges: false, lastSavedAt: null },
      ]),
    ),
  );
  const [undoByRound, setUndoByRound] = useState<
    Record<
      number,
      | {
          targetType: "player" | "team";
          targetIndex: string;
          holeIndex: number;
          previousValue: number | "";
          nextValue: number | "";
        }
      | null
    >
  >(() => Object.fromEntries(roundTemplates.map((round) => [round.id, null])));
  const runtimeRounds = useMemo(() => buildRuntimeRoundTemplates(tripState.roundGroupings), [tripState.roundGroupings]);

  const markRoundsSaved = (roundIds: number[]) => {
    const nowIso = new Date().toISOString();
    setRoundSaveStatus((prev) => {
      const next = { ...prev };
      for (const roundId of roundIds) {
        next[roundId] = {
          state: "saved",
          message: null,
          unsavedChanges: false,
          lastSavedAt: nowIso,
        };
      }
      return next;
    });
    setDirtyRoundIds((prev) => prev.filter((roundId) => !roundIds.includes(roundId)));
  };

  const markRoundsError = (roundIds: number[], message: string) => {
    setRoundSaveStatus((prev) => {
      const next = { ...prev };
      for (const roundId of roundIds) {
        next[roundId] = {
          ...next[roundId],
          state: "error",
          message,
          unsavedChanges: true,
        };
      }
      return next;
    });
  };

  useEffect(() => {
    const localSession = loadSession();
    const localState = loadTripState();
    // Hydrate from browser storage after mount to keep SSR and first client render consistent.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(localSession);
    setTripState(localState);

    let cancelled = false;
    async function hydrateFromServer() {
      try {
        const remoteSession = await fetchServerSession();
        if (cancelled) return;
        if (!remoteSession?.player || !remoteSession?.role) {
          clearSession();
          setSession(getEmptySession());
          setStorageMode("local");
          setServerVersion(null);
          setIsHydrated(true);
          return;
        }

        setSession(remoteSession);
        saveSession(remoteSession);
        const remoteState = await fetchRemoteTripState();
        if (cancelled) return;
        if (remoteState.ok && remoteState.payload) {
          setTripState(remoteState.payload.state);
          saveTripState(remoteState.payload.state);
          setStorageMode("server");
          setServerVersion(remoteState.payload.version);
          setIsHydrated(true);
          return;
        }

        setStorageMode("local");
        setServerVersion(null);
        setIsHydrated(true);
      } catch {
        if (cancelled) return;
        setStorageMode("local");
        setServerVersion(null);
        setIsHydrated(true);
      }
    }

    void hydrateFromServer();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    saveSession(session);
  }, [session, isHydrated]);

  useEffect(() => {
    if (!isHydrated || dirtyRoundIds.length === 0) return;
    const pendingRoundIds = [...dirtyRoundIds];
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          saveTripState(tripState);
          if (storageMode === "server" && session.player && session.role && !demoMode) {
            const remoteSave = await saveRemoteTripState(tripState, serverVersion);
            if (!remoteSave.ok || !remoteSave.payload) {
              if (remoteSave.status === 409) {
                setServerVersion(remoteSave.conflict?.version ?? serverVersion);
                markRoundsError(pendingRoundIds, "Another device updated the trip. Refresh or reopen to sync.");
                setDirtyRoundIds((prev) => prev.filter((roundId) => !pendingRoundIds.includes(roundId)));
                return;
              }
              markRoundsError(pendingRoundIds, remoteSave.error ?? "Cloud save failed. Using local draft only.");
              setDirtyRoundIds((prev) => prev.filter((roundId) => !pendingRoundIds.includes(roundId)));
              return;
            }

            saveTripState(remoteSave.payload.state);
            setServerVersion(remoteSave.payload.version);
          }

          markRoundsSaved(pendingRoundIds);
        } catch {
          markRoundsError(pendingRoundIds, "Save failed. Check connection and retry.");
        }
      })();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [demoMode, dirtyRoundIds, isHydrated, serverVersion, session.player, session.role, storageMode, tripState]);

  useEffect(() => {
    if (!isHydrated || storageMode !== "server" || !session.player || !session.role || dirtyRoundIds.length > 0 || demoMode) {
      return;
    }

    let cancelled = false;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const remote = await fetchRemoteTripState();
          if (!remote.ok || !remote.payload || cancelled) return;
          if (serverVersion !== null && remote.payload.version <= serverVersion) return;
          saveTripState(remote.payload.state);
          setTripState(remote.payload.state);
          setServerVersion(remote.payload.version);
        } catch {
          // Silent fallback keeps local experience smooth when connectivity drops.
        }
      })();
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [demoMode, dirtyRoundIds.length, isHydrated, serverVersion, session.player, session.role, storageMode]);

  const scoreTotals = useMemo(
    () => buildRoundTotals(tripState.individualScores, tripState.roster, runtimeRounds),
    [runtimeRounds, tripState.individualScores, tripState.roster],
  );
  const teamResults = useMemo(
    () => buildTeamResults(scoreTotals, tripState.teamScores, tripState.roundEntryMode, runtimeRounds),
    [runtimeRounds, scoreTotals, tripState.teamScores, tripState.roundEntryMode],
  );
  const flightResults = useMemo(() => buildFlightResults(scoreTotals, tripState.flights), [scoreTotals, tripState.flights]);
  const payoutSummary = useMemo(
    () => buildPayoutSummary(teamResults, flightResults, tripState.roster, tripState.payoutSettings),
    [flightResults, teamResults, tripState.payoutSettings, tripState.roster],
  );

  const markRoundDirty = (roundId: number, message: string | null = null) => {
    setRoundSaveStatus((prev) => ({
      ...prev,
      [roundId]: {
        ...prev[roundId],
        state: "saving",
        message,
        unsavedChanges: true,
      },
    }));
    setDirtyRoundIds((prev) => (prev.includes(roundId) ? prev : [...prev, roundId]));
  };

  const canEditRoundScores = (roundId: number): boolean => {
    const roundState = tripState.roundLive[roundId];
    if (!roundState) return false;
    if (roundState.isFinalized && session.role !== "admin") return false;
    return true;
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const canEditTeamCard = (_roundId: number, _teamIndex: number): boolean => {
    return session.role === "admin";
  };

  const addConflictIfNeeded = (
    prevState: TripState,
    roundId: number,
    holeIndex: number,
    targetType: "player" | "team",
    targetId: string,
    editedBy: string,
  ): ScoreConflictEvent | null => {
    const now = Date.now();
    const latest = [...prevState.scoreEditHistory]
      .reverse()
      .find((entry) => entry.roundId === roundId && entry.holeIndex === holeIndex && entry.targetId === targetId);
    if (!latest) return null;
    const previousTime = new Date(latest.timestamp).getTime();
    if (latest.editedBy !== editedBy && now - previousTime <= CONFLICT_WINDOW_MS) {
      return {
        id: `${roundId}-${holeIndex}-${targetType}-${targetId}-${now}`,
        timestamp: new Date(now).toISOString(),
        roundId,
        holeIndex,
        targetType,
        targetId,
        previousEditedBy: latest.editedBy,
        currentEditedBy: editedBy,
        previousEditedAt: latest.timestamp,
        message: `Recent overwrite on ${targetId} hole ${holeIndex + 1}.`,
      };
    }
    return null;
  };

  const isRoundComplete = (roundId: number, currentState: TripState) => {
    const mode = currentState.roundEntryMode[roundId];
    if ([2, 3, 4].includes(roundId) && mode === "team") {
      return currentState.teamScores[roundId].every((team) => team.holeScores.every((score) => score !== ""));
    }
    const round = runtimeRounds.find((item) => item.id === roundId);
    if (!round) return false;
    return round.teeTimes
      .flatMap((group) => group.players)
      .every((player) => currentState.individualScores[roundId][player].every((score) => score !== ""));
  };

  const updateRoundStatusMessage = (roundId: number, message: string) => {
    setRoundSaveStatus((prev) => ({
      ...prev,
      [roundId]: {
        ...prev[roundId],
        state: "error",
        message,
      },
    }));
  };

  const updateIndividualHoleScore = (
    roundId: number,
    player: string,
    holeIndex: number,
    rawValue: string,
    recordUndo = true,
  ): boolean => {
    if (!canEditRoundScores(roundId)) {
      updateRoundStatusMessage(roundId, "Round is finalized. Admin override is required to edit.");
      return false;
    }
    if (!tripState.individualScores[roundId]?.[player] || holeIndex < 0 || holeIndex > 17) return false;
    const editedBy = session.player ?? "unknown";
    let changed = false;
    let firstScoreInRound = false;

    setTripState((prev) => {
      const previousValue = prev.individualScores[roundId][player][holeIndex];
      const nextValue = toHoleNumber(rawValue);
      if (previousValue === nextValue) return prev;
      changed = true;
      firstScoreInRound = prev.individualScores[roundId][player].every((value) => value === "");

      const scoreEditEvent: ScoreEditEvent = {
        id: `${roundId}-${player}-${holeIndex}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        roundId,
        holeIndex,
        targetType: "player",
        targetId: player,
        previousValue,
        nextValue,
        editedBy,
      };

      const conflict = addConflictIfNeeded(prev, roundId, holeIndex, "player", player, editedBy);
      const nextConflicts = conflict ? [...prev.scoreConflicts.slice(-199), conflict] : prev.scoreConflicts;
      if (conflict) {
        updateRoundStatusMessage(roundId, conflict.message);
      }

      if (recordUndo) {
        setUndoByRound((undoPrev) => ({
          ...undoPrev,
          [roundId]: {
            targetType: "player",
            targetIndex: player,
            holeIndex,
            previousValue,
            nextValue,
          },
        }));
      }

      return {
        ...prev,
        scoreEditHistory: [...prev.scoreEditHistory.slice(-399), scoreEditEvent],
        scoreConflicts: nextConflicts,
        individualScores: {
          ...prev.individualScores,
          [roundId]: {
            ...prev.individualScores[roundId],
            [player]: prev.individualScores[roundId][player].map((existing, idx) =>
              idx === holeIndex ? nextValue : existing,
            ),
          },
        },
        roundLive: {
          ...prev.roundLive,
          [roundId]: {
            ...prev.roundLive[roundId],
            lastScoreUpdateAt: new Date().toISOString(),
          },
        },
      };
    });

    if (changed) {
      markRoundDirty(roundId);
      trackEvent("score_updated", { roundId, targetType: "player", hole: holeIndex + 1, player });
      if (firstScoreInRound) {
        trackEvent("first_score_entered", { roundId, player });
      }
      if (isRoundComplete(roundId, tripState)) {
        trackEvent("round_completed", { roundId, by: editedBy, source: "score_completion" });
      }
    }
    return changed;
  };

  const updateTeamHoleScore = (
    roundId: number,
    teamIndex: number,
    holeIndex: number,
    rawValue: string,
    recordUndo = true,
  ): boolean => {
    if (!canEditRoundScores(roundId)) {
      updateRoundStatusMessage(roundId, "Round is finalized. Admin override is required to edit.");
      return false;
    }
    if (!canEditTeamCard(roundId, teamIndex)) {
      updateRoundStatusMessage(roundId, "Only admin can edit team scores.");
      return false;
    }
    if (!tripState.teamScores[roundId]?.[teamIndex] || holeIndex < 0 || holeIndex > 17) return false;
    const editedBy = session.player ?? "unknown";
    const teamName = tripState.teamScores[roundId][teamIndex].teamName;
    let changed = false;

    setTripState((prev) => {
      const previousValue = prev.teamScores[roundId][teamIndex].holeScores[holeIndex];
      const nextValue = toHoleNumber(rawValue);
      if (previousValue === nextValue) return prev;
      changed = true;

      const scoreEditEvent: ScoreEditEvent = {
        id: `${roundId}-${teamName}-${holeIndex}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        roundId,
        holeIndex,
        targetType: "team",
        targetId: teamName,
        previousValue,
        nextValue,
        editedBy,
      };

      if (recordUndo) {
        setUndoByRound((undoPrev) => ({
          ...undoPrev,
          [roundId]: {
            targetType: "team",
            targetIndex: String(teamIndex),
            holeIndex,
            previousValue,
            nextValue,
          },
        }));
      }

      return {
        ...prev,
        scoreEditHistory: [...prev.scoreEditHistory.slice(-399), scoreEditEvent],
        teamScores: {
          ...prev.teamScores,
          [roundId]: prev.teamScores[roundId].map((team, idx) => {
            if (idx !== teamIndex) return team;
            return {
              ...team,
              holeScores: team.holeScores.map((existing, hIdx) => (hIdx === holeIndex ? nextValue : existing)),
            };
          }),
        },
        roundLive: {
          ...prev.roundLive,
          [roundId]: {
            ...prev.roundLive[roundId],
            lastScoreUpdateAt: new Date().toISOString(),
          },
        },
      };
    });

    if (changed) {
      markRoundDirty(roundId);
      trackEvent("score_updated", { roundId, targetType: "team", hole: holeIndex + 1, team: teamName });
      if (isRoundComplete(roundId, tripState)) {
        trackEvent("round_completed", { roundId, by: editedBy, source: "score_completion" });
      }
    }
    return changed;
  };

  const undoLastScoreEdit = (roundId: number) => {
    const undo = undoByRound[roundId];
    if (!undo) return;
    if (undo.targetType === "player") {
      void updateIndividualHoleScore(roundId, undo.targetIndex, undo.holeIndex, String(undo.previousValue), false);
    } else {
      void updateTeamHoleScore(roundId, Number(undo.targetIndex), undo.holeIndex, String(undo.previousValue), false);
    }
    setUndoByRound((prev) => ({ ...prev, [roundId]: null }));
  };

  const resolveTeamScoreDiscrepancy = (
    roundId: number,
    teamIndex: number,
    holeIndex: number,
    preferredScorer: "A" | "B",
  ) => {
    if (session.role !== "admin") return;
    setTripState((prev) => {
      const discrepancy = [...prev.teamScoreDiscrepancies]
        .reverse()
        .find(
          (item) =>
            item.roundId === roundId &&
            item.teamIndex === teamIndex &&
            item.holeIndex === holeIndex &&
            item.status === "open",
        );
      if (!discrepancy) return prev;
      const selectedScorer = preferredScorer === "A" ? discrepancy.scorerA : discrepancy.scorerB;
      const selectedScore = prev.teamEntrySubmissions[roundId]?.[teamIndex]?.[selectedScorer]?.[holeIndex] ?? "";
      return {
        ...prev,
        teamScores: {
          ...prev.teamScores,
          [roundId]: prev.teamScores[roundId].map((team, idx) =>
            idx !== teamIndex
              ? team
              : {
                  ...team,
                  holeScores: team.holeScores.map((score, hIdx) => (hIdx === holeIndex ? selectedScore : score)),
                },
          ),
        },
        teamScoreDiscrepancies: prev.teamScoreDiscrepancies.map((item) =>
          item.id === discrepancy.id
            ? {
                ...item,
                status: "resolved",
                resolvedAt: new Date().toISOString(),
                resolvedBy: session.player,
                overrideScore: typeof selectedScore === "number" ? selectedScore : null,
              }
            : item,
        ),
      };
    });
    markRoundDirty(roundId, "Admin override applied for score discrepancy.");
  };

  const setTeamDelegateForRound = (roundId: number, teamIndex: number, delegatePlayer: string) => {
    if (session.role !== "admin") return;
    const [captain] = getTeamScorers(roundId, teamIndex, null, tripState.roundGroupings);
    const normalizedDelegate = delegatePlayer === captain ? captain : delegatePlayer;
    setTripState((prev) => {
      const nextDelegates = {
        ...prev.teamDelegateAssignments,
        [roundId]: {
          ...(prev.teamDelegateAssignments[roundId] ?? {}),
          [teamIndex]: normalizedDelegate,
        },
      };
      const [scorerA, scorerB] = getTeamScorers(roundId, teamIndex, normalizedDelegate, prev.roundGroupings);
      const existingTeamSubs = prev.teamEntrySubmissions[roundId]?.[teamIndex] ?? {};
      const scorerAScores = existingTeamSubs[scorerA] ?? prev.teamScores[roundId][teamIndex].holeScores.map((v) => v);
      const scorerBScores = existingTeamSubs[scorerB] ?? prev.teamScores[roundId][teamIndex].holeScores.map((v) => v);
      return {
        ...prev,
        teamDelegateAssignments: nextDelegates,
        teamEntrySubmissions: {
          ...prev.teamEntrySubmissions,
          [roundId]: {
            ...(prev.teamEntrySubmissions[roundId] ?? {}),
            [teamIndex]: {
              ...existingTeamSubs,
              [scorerA]: scorerAScores,
              [scorerB]: scorerBScores,
            },
          },
        },
      };
    });
    markRoundDirty(roundId, "Team delegate assignment updated.");
  };

  const updatePlayerName = (existingName: string, nextName: string) => {
    if (session.role !== "admin") return;
    const trimmed = nextName.trim();
    if (!existingName || !trimmed || existingName === trimmed) return;
    if (existingName === ADMIN_PLAYER && trimmed !== ADMIN_PLAYER) return;

    setTripState((prev) => {
      if (prev.roster.includes(trimmed)) return prev;
      const renameKey = (map: Record<string, Array<number | "">>) => {
        if (!map[existingName]) return map;
        const nextMap = { ...map, [trimmed]: [...map[existingName]] };
        delete nextMap[existingName];
        return nextMap;
      };

      const nextIndividualScores: TripState["individualScores"] = Object.fromEntries(
        Object.entries(prev.individualScores).map(([roundId, roundScores]) => [Number(roundId), renameKey(roundScores)]),
      );

      const nextRoundGroupings = Object.fromEntries(
        Object.entries(prev.roundGroupings).map(([roundId, groups]) => [
          Number(roundId),
          groups.map((group) => ({
            ...group,
            players: group.players.map((player) => (player === existingName ? trimmed : player)),
          })),
        ]),
      ) as TripState["roundGroupings"];

      const nextTeamScores = Object.fromEntries(
        Object.entries(prev.teamScores).map(([roundId, teams]) => [
          Number(roundId),
          teams.map((team) => ({
            ...team,
            players: team.players.map((player) => (player === existingName ? trimmed : player)),
          })),
        ]),
      ) as TripState["teamScores"];

      const nextFlights = Object.fromEntries(
        Object.entries(prev.flights).map(([flight, members]) => [
          flight,
          members.map((member) => (member === existingName ? trimmed : member)),
        ]),
      ) as TripState["flights"];

      const nextDelegates = Object.fromEntries(
        Object.entries(prev.teamDelegateAssignments).map(([roundId, byTeam]) => [
          Number(roundId),
          Object.fromEntries(
            Object.entries(byTeam).map(([teamIndex, delegate]) => [Number(teamIndex), delegate === existingName ? trimmed : delegate]),
          ),
        ]),
      ) as TripState["teamDelegateAssignments"];

      const nextSubmissions = Object.fromEntries(
        Object.entries(prev.teamEntrySubmissions).map(([roundId, byTeam]) => [
          Number(roundId),
          Object.fromEntries(
            Object.entries(byTeam).map(([teamIndex, byScorer]) => {
              const copied = { ...byScorer };
              if (copied[existingName]) {
                copied[trimmed] = [...copied[existingName]];
                delete copied[existingName];
              }
              return [Number(teamIndex), copied];
            }),
          ),
        ]),
      ) as TripState["teamEntrySubmissions"];

      return {
        ...prev,
        roster: prev.roster.map((player) => (player === existingName ? trimmed : player)),
        individualScores: nextIndividualScores,
        roundGroupings: nextRoundGroupings,
        teamScores: nextTeamScores,
        flights: nextFlights,
        teamDelegateAssignments: nextDelegates,
        teamEntrySubmissions: nextSubmissions,
        scoreEditHistory: prev.scoreEditHistory.map((event) => ({
          ...event,
          targetId: event.targetId === existingName ? trimmed : event.targetId,
          editedBy: event.editedBy === existingName ? trimmed : event.editedBy,
        })),
        scoreConflicts: prev.scoreConflicts.map((event) => ({
          ...event,
          targetId: event.targetId === existingName ? trimmed : event.targetId,
          previousEditedBy: event.previousEditedBy === existingName ? trimmed : event.previousEditedBy,
          currentEditedBy: event.currentEditedBy === existingName ? trimmed : event.currentEditedBy,
        })),
        teamScoreDiscrepancies: prev.teamScoreDiscrepancies.map((item) => ({
          ...item,
          scorerA: item.scorerA === existingName ? trimmed : item.scorerA,
          scorerB: item.scorerB === existingName ? trimmed : item.scorerB,
          resolvedBy: item.resolvedBy === existingName ? trimmed : item.resolvedBy,
        })),
      };
    });

    setSession((prev) => (prev.player === existingName ? { ...prev, player: trimmed } : prev));
    markAllRoundsDirty(`Player updated: ${existingName} -> ${trimmed}`);
  };

  const updateRoundGrouping = (roundId: number, groupIndex: number, nextGroup: TeeGroup) => {
    if (session.role !== "admin") return;
    setTripState((prev) => {
      const currentGroups = prev.roundGroupings[roundId] ?? [];
      if (!currentGroups[groupIndex]) return prev;
      const normalized: TeeGroup = {
        time: nextGroup.time.trim() || currentGroups[groupIndex].time,
        players: nextGroup.players.map((player) => player.trim()).filter(Boolean),
      };
      const nextGroups = currentGroups.map((group, idx) => (idx === groupIndex ? normalized : group));
      const nextRoundGroupings = { ...prev.roundGroupings, [roundId]: nextGroups };
      const nextTeamScoresForRound = (prev.teamScores[roundId] ?? []).map((team, idx) =>
        idx === groupIndex ? { ...team, players: [...normalized.players] } : team,
      );
      const delegateOverride = prev.teamDelegateAssignments[roundId]?.[groupIndex];
      const [scorerA, scorerB] = getTeamScorers(roundId, groupIndex, delegateOverride, nextRoundGroupings);
      const existingByScorer = prev.teamEntrySubmissions[roundId]?.[groupIndex] ?? {};
      return {
        ...prev,
        roundGroupings: nextRoundGroupings,
        teamScores: {
          ...prev.teamScores,
          [roundId]: nextTeamScoresForRound,
        },
        teamEntrySubmissions: {
          ...prev.teamEntrySubmissions,
          [roundId]: {
            ...(prev.teamEntrySubmissions[roundId] ?? {}),
            [groupIndex]: {
              ...existingByScorer,
              [scorerA]: existingByScorer[scorerA] ?? Array.from({ length: 18 }, () => ""),
              [scorerB]: existingByScorer[scorerB] ?? Array.from({ length: 18 }, () => ""),
            },
          },
        },
      };
    });
    markRoundDirty(roundId, "Round grouping updated.");
  };

  const updateFlightMembers = (flightName: string, members: string[]) => {
    if (session.role !== "admin") return;
    setTripState((prev) => ({
      ...prev,
      flights: {
        ...prev.flights,
        [flightName]: members.map((member) => member.trim()).filter(Boolean),
      },
    }));
    markAllRoundsDirty(`Flight ${flightName} updated.`);
  };

  const updatePayoutSetting = (field: "buyIn" | "teamWinPayout" | "flightWinPayout", value: number) => {
    if (session.role !== "admin") return;
    const normalized = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
    setTripState((prev) => ({
      ...prev,
      payoutSettings: {
        ...prev.payoutSettings,
        [field]: normalized,
      },
    }));
    markAllRoundsDirty("Payout settings updated.");
  };

  const markAllRoundsDirty = (message: string | null = null) => {
    setRoundSaveStatus((prev) => {
      const next = { ...prev };
      for (const round of roundTemplates) {
        next[round.id] = {
          ...next[round.id],
          state: "saving",
          message,
          unsavedChanges: true,
        };
      }
      return next;
    });
    setDirtyRoundIds((prev) => {
      const all = new Set(prev);
      for (const round of roundTemplates) {
        all.add(round.id);
      }
      return Array.from(all);
    });
  };

  const loadDemoScores = () => {
    const nextIndividual = buildInitialIndividualScoresForRoster(tripState.roster, tripState.roundGroupings);
    const nextTeam = buildInitialTeamScores(tripState.roundGroupings);
    const nextTeamSubmissions = buildInitialTeamEntrySubmissions(
      tripState.teamDelegateAssignments,
      tripState.roundGroupings,
    );
    const nowIso = new Date().toISOString();

    for (const round of runtimeRounds) {
      if ([2, 3, 4].includes(round.id)) {
        nextTeam[round.id] = nextTeam[round.id].map((team, teamIdx) => ({
          ...team,
          holeScores: team.holeScores.map((_, holeIdx) => {
            if (holeIdx > 8) return "";
            const par = tripState.courseDataPublished[round.id]?.[holeIdx]?.par ?? 4;
            const delta = (teamIdx + holeIdx) % 3 === 0 ? -1 : 0;
            return Math.max(1, Math.min(MAX_STROKES_PER_HOLE, par + delta));
          }),
        }));
        for (const [teamIdx, team] of nextTeam[round.id].entries()) {
          const [scorerA, scorerB] = getTeamScorers(
            round.id,
            teamIdx,
            tripState.teamDelegateAssignments[round.id]?.[teamIdx],
            tripState.roundGroupings,
          );
          nextTeamSubmissions[round.id][teamIdx][scorerA] = [...team.holeScores];
          nextTeamSubmissions[round.id][teamIdx][scorerB] = [...team.holeScores];
        }
      } else {
        for (const [groupIdx, group] of round.teeTimes.entries()) {
          for (const [playerIdx, player] of group.players.entries()) {
            nextIndividual[round.id][player] = nextIndividual[round.id][player].map((_, holeIdx) => {
              const playerCap = 6 + ((groupIdx + playerIdx) % 3);
              if (holeIdx >= playerCap) return "";
              const par = tripState.courseDataPublished[round.id]?.[holeIdx]?.par ?? 4;
              const delta = (playerIdx + holeIdx) % 4 === 0 ? -1 : (playerIdx + holeIdx) % 4 === 1 ? 1 : 0;
              return Math.max(1, Math.min(MAX_STROKES_PER_HOLE, par + delta));
            });
          }
        }
      }
    }

    setTripState((prev) => ({
      ...prev,
      individualScores: nextIndividual,
      teamScores: nextTeam,
      teamEntrySubmissions: nextTeamSubmissions,
      teamScoreDiscrepancies: [],
      roundLive: Object.fromEntries(
        roundTemplates.map((round) => [
          round.id,
          {
            ...prev.roundLive[round.id],
            isStarted: true,
            startedAt: nowIso,
            startedBy: session.player ?? "admin-seed",
            isFinalized: false,
            finalizedAt: null,
            finalizedBy: null,
            lastScoreUpdateAt: nowIso,
          },
        ]),
      ),
      scoreEditHistory: [],
      scoreConflicts: [],
    }));
    setUndoByRound(Object.fromEntries(roundTemplates.map((round) => [round.id, null])));
    markAllRoundsDirty("Demo scores loaded.");
    trackEvent("demo_scores_loaded", { by: session.player ?? "unknown" });
  };

  const clearDemoScores = () => {
    setTripState((prev) => ({
      ...prev,
      individualScores: buildInitialIndividualScoresForRoster(prev.roster, prev.roundGroupings),
      teamScores: buildInitialTeamScores(prev.roundGroupings),
      teamEntrySubmissions: buildInitialTeamEntrySubmissions(prev.teamDelegateAssignments, prev.roundGroupings),
      teamScoreDiscrepancies: [],
      roundLive: buildInitialRoundLiveState(),
      scoreEditHistory: [],
      scoreConflicts: [],
    }));
    setUndoByRound(Object.fromEntries(roundTemplates.map((round) => [round.id, null])));
    markAllRoundsDirty("Demo scores cleared.");
    trackEvent("demo_scores_cleared", { by: session.player ?? "unknown" });
  };

  const startDemoMode = () => {
    setDemoSnapshot((prev) => prev ?? { session: { ...session }, tripState: cloneTripState(tripState) });
    if (!session.player) {
      setSession({ player: DEMO_DEFAULT_USER, role: "player" });
    }
    loadDemoScores();
    setDemoStep(0);
    setDemoMode(true);
    trackEvent("demo_mode_started", { by: session.player ?? DEMO_DEFAULT_USER });
  };

  const endDemoMode = () => {
    if (demoSnapshot) {
      setTripState(cloneTripState(demoSnapshot.tripState));
      setSession({ ...demoSnapshot.session });
      setDemoSnapshot(null);
      markAllRoundsDirty("Demo mode ended. Restored previous app state.");
    } else {
      clearDemoScores();
    }
    setDemoStep(0);
    setDemoMode(false);
    trackEvent("demo_mode_ended", { by: session.player ?? "unknown" });
  };

  const nextDemoStep = () => {
    setDemoStep((prev) => Math.min(DEMO_MAX_STEP, prev + 1));
  };

  const previousDemoStep = () => {
    setDemoStep((prev) => Math.max(0, prev - 1));
  };

  const value: TripContextValue = {
    session,
    tripState,
    isHydrated,
    storageMode,
    demoMode,
    demoStep,
    maxStrokesPerHole: MAX_STROKES_PER_HOLE,
    roundSaveStatus,
    login: async (player: string, role: string, pin: string) => {
      if (!tripState.roster.includes(player)) return false;
      const normalizedRole = sanitizeRole(role);
      const remoteLogin = await loginViaServer(player, normalizedRole, pin);
      if (!remoteLogin.ok || !remoteLogin.session) return false;

      setSession(remoteLogin.session);
      saveSession(remoteLogin.session);

      const remoteState = await fetchRemoteTripState().catch(() => null);
      if (remoteState?.ok && remoteState.payload) {
        setTripState(remoteState.payload.state);
        saveTripState(remoteState.payload.state);
        setStorageMode("server");
        setServerVersion(remoteState.payload.version);
      } else {
        setStorageMode("local");
        setServerVersion(null);
      }

      trackEvent("login", { player, role: normalizedRole, storageMode: remoteState?.mode ?? "local" });
      return true;
    },
    logout: async () => {
      await logoutViaServer();
      clearSession();
      setSession(getEmptySession());
      setStorageMode("local");
      setServerVersion(null);
    },
    updateIndividualHoleScore,
    updateTeamHoleScore,
    updateRoundEntryMode: (roundId: number, mode: ScoreEntryMode, force = false) => {
      if (tripState.roundLive[roundId]?.isFinalized && session.role !== "admin") return;
      if (!force && session.role !== "admin") return;
      setTripState((prev) => ({
        ...prev,
        roundEntryMode: {
          ...prev.roundEntryMode,
          [roundId]: mode,
        },
      }));
      markRoundDirty(roundId);
    },
    updateCourseHole: (roundId: number, holeIndex: number, field: keyof HoleData, value: string) => {
      if (!["par", "yardage", "handicapIndex"].includes(field)) return;
      if (tripState.coursePublication[roundId]?.isLocked) return;
      const parsed = value === "" ? null : Math.max(1, Math.trunc(Number(value)));
      setTripState((prev) => ({
        ...prev,
        courseDataDraft: {
          ...prev.courseDataDraft,
          [roundId]: prev.courseDataDraft[roundId].map((hole, idx) =>
            idx === holeIndex ? { ...hole, [field]: Number.isNaN(parsed) ? null : parsed } : hole,
          ),
        },
      }));
    },
    setHoleVerification: (roundId: number, holeIndex: number, verified: boolean) => {
      if (tripState.coursePublication[roundId]?.isLocked) return;
      setTripState((prev) => ({
        ...prev,
        courseDataDraft: {
          ...prev.courseDataDraft,
          [roundId]: prev.courseDataDraft[roundId].map((hole, idx) =>
            idx === holeIndex
              ? {
                  ...hole,
                  verifiedByAdmin: verified,
                  confidence: verified ? "confirmed" : hole.sourceName ? "public" : "unknown",
                }
              : hole,
          ),
        },
      }));
    },
    setCourseLock: (roundId: number, locked: boolean) => {
      setTripState((prev) => ({
        ...prev,
        coursePublication: {
          ...prev.coursePublication,
          [roundId]: {
            ...prev.coursePublication[roundId],
            isLocked: locked,
          },
        },
      }));
    },
    setCourseConfirmed: (roundId: number, confirmed: boolean) => {
      setTripState((prev) => ({
        ...prev,
        coursePublication: {
          ...prev.coursePublication,
          [roundId]: {
            ...prev.coursePublication[roundId],
            isConfirmed: confirmed,
          },
        },
      }));
    },
    resetCourseDraftFromSeed: (roundId: number) => {
      if (!seededCourseDataByRound[roundId]) return;
      if (tripState.coursePublication[roundId]?.isLocked) return;
      setTripState((prev) => ({
        ...prev,
        courseDataDraft: {
          ...prev.courseDataDraft,
          [roundId]: seededCourseDataByRound[roundId].map((hole) => ({ ...hole })),
        },
      }));
      markRoundDirty(roundId);
    },
    publishCourseData: (roundId: number) => {
      setTripState((prev) => ({
        ...prev,
        courseDataPublished: {
          ...prev.courseDataPublished,
          [roundId]: prev.courseDataDraft[roundId].map((hole) => ({ ...hole })),
        },
        coursePublication: {
          ...prev.coursePublication,
          [roundId]: {
            ...prev.coursePublication[roundId],
            lastPublishedAt: new Date().toISOString(),
          },
        },
      }));
      markRoundDirty(roundId);
    },
    startRoundLive: (roundId: number) => {
      if (tripState.roundLive[roundId]?.isFinalized && session.role !== "admin") return;
      setTripState((prev) => ({
        ...prev,
        roundLive: {
          ...prev.roundLive,
          [roundId]: {
            ...prev.roundLive[roundId],
            isStarted: true,
            startedAt: new Date().toISOString(),
            startedBy: session.player,
          },
        },
      }));
      trackEvent("round_start", { roundId, by: session.player ?? "unknown" });
      markRoundDirty(roundId);
    },
    stopRoundLive: (roundId: number) => {
      if (tripState.roundLive[roundId]?.isFinalized && session.role !== "admin") return;
      setTripState((prev) => ({
        ...prev,
        roundLive: {
          ...prev.roundLive,
          [roundId]: {
            ...prev.roundLive[roundId],
            isStarted: false,
          },
        },
      }));
      markRoundDirty(roundId);
    },
    finalizeRound: (roundId: number) => {
      setTripState((prev) => ({
        ...prev,
        roundLive: {
          ...prev.roundLive,
          [roundId]: {
            ...prev.roundLive[roundId],
            isFinalized: true,
            isStarted: false,
            finalizedAt: new Date().toISOString(),
            finalizedBy: session.player,
          },
        },
      }));
      markRoundDirty(roundId);
      trackEvent("round_completed", { roundId, by: session.player ?? "unknown" });
    },
    reopenRound: (roundId: number) => {
      if (session.role !== "admin") return;
      setTripState((prev) => ({
        ...prev,
        roundLive: {
          ...prev.roundLive,
          [roundId]: {
            ...prev.roundLive[roundId],
            isFinalized: false,
            finalizedAt: null,
            finalizedBy: null,
          },
        },
      }));
      markRoundDirty(roundId);
    },
    undoLastScoreEdit,
    loadDemoScores,
    clearDemoScores,
    startDemoMode,
    endDemoMode,
    nextDemoStep,
    previousDemoStep,
    setDemoStep,
    resolveTeamScoreDiscrepancy,
    setTeamDelegateForRound,
    updatePlayerName,
    updateRoundGrouping,
    updateFlightMembers,
    updatePayoutSetting,
    scoreTotals,
    teamResults,
    flightResults,
    payoutSummary,
  };

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const context = useContext(TripContext);
  if (!context) throw new Error("useTrip must be used within TripProvider.");
  return context;
}

export function getRound(roundId: number) {
  return roundTemplates.find((r) => r.id === roundId) ?? roundTemplates[0];
}
