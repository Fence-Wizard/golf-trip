import { describe, expect, it } from "vitest";
import { canAccessAdmin, isAdmin } from "@/lib/auth/session";

describe("session permissions", () => {
  it("identifies admin user correctly", () => {
    expect(isAdmin({ player: "Sam", role: "admin" })).toBe(true);
    expect(isAdmin({ player: "Todd", role: "admin" })).toBe(false);
    expect(isAdmin({ player: "Sam", role: "player" })).toBe(false);
    expect(isAdmin({ player: null, role: null })).toBe(false);
  });

  it("players are read-only and cannot be admin", () => {
    expect(isAdmin({ player: "Todd", role: "player" })).toBe(false);
    expect(isAdmin({ player: "Lee", role: "player" })).toBe(false);
  });

  it("only allows admin access to admin area", () => {
    expect(canAccessAdmin({ player: "Sam", role: "admin" })).toBe(true);
    expect(canAccessAdmin({ player: "Jamie", role: "player" })).toBe(false);
  });
});
