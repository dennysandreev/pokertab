import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEADERBOARD_QUERY,
  formatPercentFromBps,
  formatSignedMinorStat,
  getLeaderboardEmptyCopy,
  getResultTone
} from "./leaderboard-view";

describe("leaderboard view helpers", () => {
  it("returns default leaderboard filters", () => {
    expect(DEFAULT_LEADERBOARD_QUERY).toEqual({
      scope: "all",
      period: "all-time",
      limit: 20
    });
  });

  it("formats basis points as readable percents", () => {
    expect(formatPercentFromBps(1200)).toBe("12%");
    expect(formatPercentFromBps(1250)).toBe("12,5%");
    expect(formatPercentFromBps(-375)).toBe("-3,8%");
  });

  it("formats signed minor values without a currency symbol", () => {
    expect(formatSignedMinorStat("0")).toBe("0,00");
    expect(formatSignedMinorStat("123456")).toBe("+1 234,56");
    expect(formatSignedMinorStat("-4500")).toBe("-45,00");
  });

  it("returns a specific empty state for shared games scope", () => {
    expect(getLeaderboardEmptyCopy("played-with-me")).toEqual({
      title: "Пока не с кем сравнивать",
      description: "Рейтинг появится после ваших общих завершённых игр."
    });
  });

  it("derives result tone from the signed value", () => {
    expect(getResultTone("100")).toBe("positive");
    expect(getResultTone("-100")).toBe("negative");
    expect(getResultTone("0")).toBe("neutral");
  });
});
