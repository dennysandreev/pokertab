import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRoom,
  createVirtualTable,
  getMyVirtualStats,
  getRooms,
  getVirtualHandHistories,
  getVirtualHandHistory,
  getVirtualLeaderboard,
  getVirtualPlayerProfile,
  getVirtualTable,
  getVirtualTables,
  joinVirtualTable,
  pauseVirtualTable,
  raiseVirtualBlinds,
  requestVirtualSitOut,
  resumeVirtualTable,
  returnToVirtualTable,
  startNextVirtualHand,
  startVirtualTable,
  submitVirtualReaction,
  submitVirtualAction,
  finishVirtualTable,
  cancelVirtualTable
} from "./api";

function createJsonResponse(body: unknown, init: { ok: boolean; status: number }): Response {
  return {
    ok: init.ok,
    status: init.status,
    json: vi.fn().mockResolvedValue(body)
  } as unknown as Response;
}

describe("apiRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("calls virtual API endpoints with expected paths and methods", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(createJsonResponse({}, { ok: true, status: 200 })));

    vi.stubGlobal("fetch", fetchMock);

    await getVirtualTables("token");
    await createVirtualTable("token", {
      title: "Ночной стол",
      maxSeats: 6,
      startingStackChips: "2000",
      chipValueMinor: "100",
      chipValueCurrency: "RUB",
      smallBlindChips: "10",
      bigBlindChips: "20",
      turnDurationSeconds: 30,
      reminderDelaySeconds: 15,
      timeoutAutoActionRule: "CHECK_OR_FOLD",
      winProbabilityEnabled: false
    });
    await joinVirtualTable("token", { inviteCode: "AB12CD34" });
    await getVirtualTable("token", "table-1");
    await startVirtualTable("token", "table-1");
    await startNextVirtualHand("token", "table-1");
    await pauseVirtualTable("token", "table-1");
    await resumeVirtualTable("token", "table-1");
    await finishVirtualTable("token", "table-1");
    await cancelVirtualTable("token", "table-1");
    await raiseVirtualBlinds("token", "table-1", {
      smallBlindChips: "15",
      bigBlindChips: "30"
    });
    await submitVirtualAction("token", "table-1", {
      handId: "hand-1",
      actionType: "CALL",
      amountChips: "20",
      idempotencyKey: "idem-1"
    });
    await submitVirtualReaction("token", "table-1", {
      emoji: "🔥"
    });
    await requestVirtualSitOut("token", "table-1", {
      autoCheck: true,
      autoFold: false
    });
    await returnToVirtualTable("token", "table-1");
    await getVirtualHandHistories("token", "table-1", {
      limit: 20,
      cursor: "12"
    });
    await getVirtualHandHistory("token", "table-1", "hand-1");
    await getVirtualLeaderboard("token", {
      scope: "played-with-me",
      period: "month",
      limit: 25,
      cursor: "abc"
    });
    await getVirtualPlayerProfile("token", "user-2", {
      period: "last-10"
    });
    await getMyVirtualStats("token");

    expect(
      fetchMock.mock.calls.map((call) => {
        const [url, init] = call;

        return [url, init?.method ?? "GET"];
      })
    ).toEqual([
      ["http://localhost:3000/api/virtual/tables", "GET"],
      ["http://localhost:3000/api/virtual/tables", "POST"],
      ["http://localhost:3000/api/virtual/tables/join", "POST"],
      ["http://localhost:3000/api/virtual/tables/table-1", "GET"],
      ["http://localhost:3000/api/virtual/tables/table-1/start", "POST"],
      ["http://localhost:3000/api/virtual/tables/table-1/hands/next", "POST"],
      ["http://localhost:3000/api/virtual/tables/table-1/pause", "POST"],
      ["http://localhost:3000/api/virtual/tables/table-1/resume", "POST"],
      ["http://localhost:3000/api/virtual/tables/table-1/finish", "POST"],
      ["http://localhost:3000/api/virtual/tables/table-1/cancel", "POST"],
      ["http://localhost:3000/api/virtual/tables/table-1/raise-blinds", "POST"],
      ["http://localhost:3000/api/virtual/tables/table-1/actions", "POST"],
      ["http://localhost:3000/api/virtual/tables/table-1/reactions", "POST"],
      ["http://localhost:3000/api/virtual/tables/table-1/sit-out/request", "POST"],
      ["http://localhost:3000/api/virtual/tables/table-1/return", "POST"],
      ["http://localhost:3000/api/virtual/tables/table-1/hands?limit=20&cursor=12", "GET"],
      ["http://localhost:3000/api/virtual/tables/table-1/hands/hand-1/history", "GET"],
      ["http://localhost:3000/api/virtual/leaderboard?scope=played-with-me&period=month&limit=25&cursor=abc", "GET"],
      ["http://localhost:3000/api/virtual/players/user-2/profile?period=last-10", "GET"],
      ["http://localhost:3000/api/virtual/stats/me", "GET"]
    ]);
  });

  it("bypasses browser cache for API requests", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(createJsonResponse({}, { ok: true, status: 200 })));

    vi.stubGlobal("fetch", fetchMock);

    await getRooms("token");

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const headers = init?.headers as Record<string, string>;

    expect(url).toBe("http://localhost:3000/api/rooms");
    expect(init?.cache).toBe("no-store");
    expect(headers.Accept).toBe("application/json");
    expect(headers["Cache-Control"]).toBe("no-cache");
    expect(headers.Pragma).toBe("no-cache");
  });

  it("uses top-level message string from a non-envelope error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          message: "Комната уже закрыта"
        })
      } satisfies Pick<Response, "ok" | "status" | "json">)
    );

    await expect(getRooms("token")).rejects.toMatchObject({
        message: "Комната уже закрыта",
        status: 400
      });
  });

  it("uses the first Nest-style validation message from a message array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        {
          ok: false,
          status: 422,
          json: vi.fn().mockResolvedValue({
            message: ["Название уже занято", "Попробуйте другое название"],
            error: "Unprocessable Entity",
            statusCode: 422
          })
        } satisfies Pick<Response, "ok" | "status" | "json">
      )
    );

    await expect(createRoom("token", {} as never)).rejects.toMatchObject({
        message: "Название уже занято",
        status: 422
      });
  });
});
