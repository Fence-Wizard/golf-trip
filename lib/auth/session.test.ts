import { describe, expect, it } from "vitest";
import { canAccessAdmin, canUseTeamEntry, canViewPlayerCard } from "@/lib/auth/session";

describe("session permissions", () => {
  it("allows player to view own card only", () => {
    const session = { player: "Todd", role: "player" as const };
    expect(canViewPlayerCard(session, "Todd")).toBe(true);
    expect(canViewPlayerCard(session, "Sam")).toBe(false);
  });

  it("allows assigned team scorers to use team entry", () => {
    expect(canUseTeamEntry({ player: "Lee", role: "player" }, 2, 0)).toBe(true);
    expect(canUseTeamEntry({ player: "Terry", role: "player" }, 2, 0)).toBe(true);
    expect(canUseTeamEntry({ player: "Jay", role: "player" }, 2, 0)).toBe(false);
  });

  it("only allows admin access to admin area", () => {
    expect(canAccessAdmin({ player: "Jamie", role: "admin" })).toBe(true);
    expect(canAccessAdmin({ player: "Jamie", role: "player" })).toBe(false);
  });
});
