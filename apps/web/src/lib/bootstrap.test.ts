import { describe, expect, it } from "vitest";
import { createInitialSessionState } from "./bootstrap";

describe("createInitialSessionState", () => {
  it("starts in unsupported mode without initData", () => {
    expect(
      createInitialSessionState({
        initData: null,
        startParam: null,
        inviteCode: null
      })
    ).toMatchObject({
      status: "unsupported",
      accessToken: null,
      session: null
    });
  });

  it("starts in idle mode when initData exists", () => {
    expect(
      createInitialSessionState({
        initData: "auth_date=1",
        startParam: "room_abc123",
        inviteCode: "abc123"
      })
    ).toMatchObject({
      status: "idle",
      initData: "auth_date=1",
      inviteCode: "abc123"
    });
  });
});
