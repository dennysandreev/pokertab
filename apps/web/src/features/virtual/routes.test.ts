import { describe, expect, it } from "vitest";
import {
  getCreateVirtualTableRoute,
  getJoinVirtualTableInviteRoute,
  getJoinVirtualTableRoute,
  getVirtualHandRoute,
  getVirtualLeaderboardRoute,
  getVirtualLobbyRoute,
  getVirtualStatsRoute,
  getVirtualTableHistoryRoute,
  getVirtualTableRoute
} from "./routes";

describe("virtual routes", () => {
  it("builds poker routes", () => {
    expect(getVirtualLobbyRoute()).toBe("/poker");
    expect(getCreateVirtualTableRoute()).toBe("/poker/new");
    expect(getJoinVirtualTableRoute()).toBe("/poker/join");
    expect(getJoinVirtualTableInviteRoute("AB12CD34")).toBe("/poker/join/AB12CD34");
    expect(getVirtualTableRoute("table-1")).toBe("/poker/tables/table-1");
    expect(getVirtualTableHistoryRoute("table-1")).toBe("/poker/tables/table-1/history");
    expect(getVirtualHandRoute("table-1", "hand-9")).toBe("/poker/tables/table-1/hands/hand-9");
    expect(getVirtualLeaderboardRoute()).toBe("/poker/leaderboard");
    expect(getVirtualStatsRoute()).toBe("/poker/stats");
  });
});
