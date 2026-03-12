"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ADMIN_PLAYER, players } from "@/lib/trip/config";
import { useTrip } from "@/components/trip/TripProvider";

const roles = [
  { id: "player", label: "Player" },
  { id: "admin", label: "Admin" },
];

export default function LoginPage() {
  const [player, setPlayer] = useState(players[0]);
  const [role, setRole] = useState("player");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const { login } = useTrip();
  const router = useRouter();
  const params = useSearchParams();
  const next = useMemo(() => params.get("next") || "/", [params]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ok = login(player, role, pin);
    if (!ok) {
      setError("Admin access is only for Sam (valid admin PIN required if configured).");
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
          {players.map((name) => (
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
