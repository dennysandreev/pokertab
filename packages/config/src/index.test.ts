import { describe, expect, it } from "vitest";
import { getRequiredEnv } from "./index";

describe("getRequiredEnv", () => {
  it("returns existing values", () => {
    process.env.TEST_VALUE = "ready";

    expect(getRequiredEnv("TEST_VALUE")).toBe("ready");
  });

  it("throws when value is missing", () => {
    delete process.env.MISSING_VALUE;

    expect(() => getRequiredEnv("MISSING_VALUE")).toThrow(
      "Missing required environment variable: MISSING_VALUE"
    );
  });
});
