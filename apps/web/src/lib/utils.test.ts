import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins truthy classes", () => {
    expect(cn("base", undefined, "active", false, null)).toBe("base active");
  });
});

