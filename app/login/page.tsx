"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ADMIN_PLAYER, buildInitialRoster } from "@/lib/trip/config";
import { useTrip } from "@/components/trip/TripProvider";

function LoginForm() {
  const fallbackRoster = buildInitialRoster();
  const { login, tripState } = useTrip();
  const roster = tripState.roster.length > 0 ? tripState.roster : fallbackRoster;
  const [player, setPlayer] = useState(roster[0]);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [wantsAdmin, setWantsAdmin] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const next = useMemo(() => params.get("next") || "/", [params]);
  const validPlayer = roster.includes(player) ? player : roster[0];
  if (validPlayer !== player) {
    setPlayer(validPlayer);
  }
  const isAdminPlayer = validPlayer === ADMIN_PLAYER;
  if (!isAdminPlayer && wantsAdmin) {
    setWantsAdmin(false);
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const role = isAdminPlayer && wantsAdmin ? "admin" : "player";
    const ok = await login(player, role, pin);
    if (!ok) {
      setError(
        wantsAdmin
          ? "Admin access requires the correct PIN."
          : "Unable to start your session. Please try again.",
      );
      return;
    }
    router.push(next);
  };

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>Williamsburg Golf Trip</h1>
        <p className="muted">
          {isAdminPlayer
            ? "Sign in as admin to collect scores and manage the trip, or as a viewer to check results."
            : "Sign in to view leaderboards, results, and payouts."}
        </p>

        <label className="label" htmlFor="player-login">
          Who are you?
        </label>
        <select
          id="player-login"
          className="input"
          value={player}
          onChange={(e) => setPlayer(e.target.value)}
        >
          {roster.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        {isAdminPlayer ? (
          <>
            <label className="label" htmlFor="admin-toggle" style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input
                id="admin-toggle"
                type="checkbox"
                checked={wantsAdmin}
                onChange={(e) => setWantsAdmin(e.target.checked)}
              />
              Sign in as admin (score collector)
            </label>

            {wantsAdmin ? (
              <>
                <label className="label" htmlFor="pin-login">
                  Admin PIN
                </label>
                <input
                  id="pin-login"
                  className="input"
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter admin PIN"
                />
              </>
            ) : null}
          </>
        ) : null}

        {error ? <p className="warning">{error}</p> : null}

        <button type="submit" className="button">
          {isAdminPlayer && wantsAdmin ? "Sign in as admin" : "View results"}
        </button>

        {!isAdminPlayer ? (
          <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
            Scores are collected by the trip organizer. You can view leaderboards and payouts after signing in.
          </p>
        ) : null}
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page">
          <div className="card auth-card">
            <p className="muted">Loading login...</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
