import { describe, expect, it } from "vitest";
import {
  getClubDashboardRoute,
  getClubEventRoute,
  getClubInviteRoute,
  getClubJoinRoute,
  getClubsNewRoute,
  isClubRoutePath
} from "./routes";

describe("club routes", () => {
  it("builds club routes", () => {
    expect(getClubsNewRoute()).toBe("/clubs/new");
    expect(getClubJoinRoute("invite-42")).toBe("/clubs/join/invite-42");
    expect(getClubDashboardRoute("club-1")).toBe("/clubs/club-1");
    expect(getClubInviteRoute("club-1")).toBe("/clubs/club-1/invite");
    expect(getClubEventRoute("club-1", "event-1")).toBe("/clubs/club-1/events/event-1");
  });

  it("matches all club sections for bottom nav and headers", () => {
    expect(isClubRoutePath("/club")).toBe(true);
    expect(isClubRoutePath("/clubs")).toBe(true);
    expect(isClubRoutePath("/clubs/new")).toBe(true);
    expect(isClubRoutePath("/clubs/club-1")).toBe(true);
    expect(isClubRoutePath("/poker")).toBe(false);
  });
});
