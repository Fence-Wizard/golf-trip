"use client";

import Link from "next/link";
import { AppShell } from "@/components/trip/AppShell";
import { useTrip } from "@/components/trip/TripProvider";

const DEMO_CHECKLIST = [
  "Open Dashboard and review active round status + quick scorecard access.",
  "Enter scores in Round 1 scorecard using quick presets and sequential lock.",
  "Open Round 1 leaderboard to monitor live standings updates.",
  "Open Results to review round winners, flights, and payout summary.",
  "As Sam admin, verify delegate assignment and discrepancy override workflow.",
  "Return to Login page to understand role access and sign-in flow.",
];

export default function DemoPage() {
  const { demoMode, startDemoMode, endDemoMode } = useTrip();

  return (
    <AppShell>
      <section className="card">
          <h2>Guided Demo Mode</h2>
          <p className="muted">
            Demo mode safely snapshots your current app state, loads seeded test scores, and walks users through each
            major workflow. Exiting demo restores your previous state.
          </p>
          <div className="row-wrap">
            {!demoMode ? (
              <button
                type="button"
                className="button"
                onClick={() => {
                  startDemoMode();
                }}
              >
                Start Guided Demo
              </button>
            ) : (
              <>
                <Link className="button" href="/">
                  Continue Demo
                </Link>
                <button type="button" className="button ghost" onClick={endDemoMode}>
                  End Demo and Restore Data
                </button>
              </>
            )}
          </div>
      </section>

      <section className="card">
        <h3>Demo Walkthrough</h3>
        <div className="stack-sm">
          {DEMO_CHECKLIST.map((item, idx) => (
            <p key={`demo-item-${idx}`} className="muted">
              {idx + 1}. {item}
            </p>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Access Summary</h3>
        <p className="muted">Players can score and view results. Sam has admin access for operational controls.</p>
        <div className="row-wrap">
          <Link href="/login" className="button ghost">
            Open Login
          </Link>
          <Link href="/" className="button ghost">
            Dashboard
          </Link>
          <Link href="/results" className="button ghost">
            Results
          </Link>
        </div>
      </section>
    </AppShell>
  );
}

