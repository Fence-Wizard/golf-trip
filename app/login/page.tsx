"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ADMIN_PLAYER, buildInitialRoster } from "@/lib/trip/config";
import { useTrip } from "@/components/trip/TripProvider";

const roles = [
  { id: "player", label: "Player" },
  { id: "admin", label: "Admin" },
];

function LoginForm() {
  const fallbackRoster = buildInitialRoster();
  const { login, tripState } = useTrip();
  const roster = tripState.roster.length > 0 ? tripState.roster : fallbackRoster;
  const [player, setPlayer] = useState(roster[0]);
  const [role, setRole] = useState("player");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const params = useSearchParams();
  const next = useMemo(() => params.get("next") || "/", [params]);

  useEffect(() => {
    if (!roster.includes(player)) {
      setPlayer(roster[0]);
    }
  }, [player, roster]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const ok = await login(player, role, pin);
    if (!ok) {
      setError(
        role === "admin"
          ? "Admin access is only for Sam and requires the correct server-side admin PIN when configured."
          : "Unable to start your session. Please try again.",
      );
      return;
    }
    router.push(next);
  };

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>Player Access</h1>
        <p className="muted">Choose your player access. Admin is restricted to Sam.</p>

        <label className="label" htmlFor="player-login">
          Player
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
        {player === ADMIN_PLAYER ? <p className="muted">Admin access is available for Sam.</p> : null}

        <label className="label" htmlFor="role-login">
          Access role
        </label>
        <select id="role-login" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
          {roles.map((option) => (
            <option key={option.id} value={option.id} disabled={option.id === "admin" && player !== ADMIN_PLAYER}>
              {option.label}
            </option>
          ))}
        </select>

        <label className="label" htmlFor="pin-login">
          Role PIN (optional unless configured)
        </label>
        <input
          id="pin-login"
          className="input"
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Enter admin PIN"
        />
        {error ? <p className="warning">{error}</p> : null}

        <button type="submit" className="button">
          Continue
        </button>
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
            <p className="muted">Loading login…</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
