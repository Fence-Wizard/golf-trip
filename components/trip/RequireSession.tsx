"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTrip } from "@/components/trip/TripProvider";
import { canAccessAdmin } from "@/lib/auth/session";

export function RequireSession({ children }: { children: React.ReactNode }) {
  const { session, isHydrated } = useTrip();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isHydrated) return;
    if (!session.player || !session.role) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
    }
  }, [isHydrated, session, router, pathname]);

  if (!isHydrated) return <p className="muted">Loading session...</p>;
  if (!session.player || !session.role) return null;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { session, isHydrated } = useTrip();
  const router = useRouter();

  useEffect(() => {
    if (!isHydrated) return;
    if (!canAccessAdmin(session)) {
      router.replace("/");
    }
  }, [isHydrated, session, router]);

  if (!isHydrated) return <p className="muted">Loading session...</p>;
  if (!canAccessAdmin(session)) return null;
  return <>{children}</>;
}
