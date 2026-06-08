import { HttpStatus } from "@nestjs/common";
import { VIRTUAL_ERROR_CODES } from "./virtual.constants";
import { encodeVirtualLeaderboardCursor } from "./virtual-leaderboard-cursor";
import {
  normalizeCreateVirtualTableRequest,
  normalizeGetVirtualHandHistoriesQuery,
  normalizeGetVirtualLeaderboardQuery,
  normalizeSubmitVirtualReactionRequest
} from "./virtual.request";

describe("virtual.request", () => {
  describe("normalizeCreateVirtualTableRequest", () => {
    const basePayload = {
      title: "Финальный стол",
      maxSeats: 6,
      startingStackChips: "1000",
      chipValueMinor: "10",
      chipValueCurrency: "rub",
      smallBlindChips: "5",
      bigBlindChips: "10",
      timeoutAutoActionRule: "CHECK_OR_FOLD",
      winProbabilityEnabled: true
    };

    it("defaults win probability flag to false when omitted", () => {
      const { winProbabilityEnabled, ...payloadWithoutFlag } = basePayload;

      expect(
        normalizeCreateVirtualTableRequest({
          ...payloadWithoutFlag,
          turnDurationSeconds: 30,
          reminderDelaySeconds: 15
        }).winProbabilityEnabled
      ).toBe(false);
      expect(winProbabilityEnabled).toBe(true);
    });

    it("defaults private match flag to false when omitted", () => {
      expect(
        normalizeCreateVirtualTableRequest({
          ...basePayload,
          turnDurationSeconds: 30,
          reminderDelaySeconds: 15
        }).isPrivate
      ).toBe(false);
    });

    it("accepts private match flag", () => {
      expect(
        normalizeCreateVirtualTableRequest({
          ...basePayload,
          isPrivate: true,
          turnDurationSeconds: 30,
          reminderDelaySeconds: 15
        }).isPrivate
      ).toBe(true);
    });

    it("accepts short and large positive timer values", () => {
      expect(
        normalizeCreateVirtualTableRequest({
          ...basePayload,
          turnDurationSeconds: 2,
          reminderDelaySeconds: 1
        })
      ).toMatchObject({
        turnDurationSeconds: 2,
        reminderDelaySeconds: 1
      });

      expect(
        normalizeCreateVirtualTableRequest({
          ...basePayload,
          turnDurationSeconds: 3600,
          reminderDelaySeconds: 3599
        })
      ).toMatchObject({
        turnDurationSeconds: 3600,
        reminderDelaySeconds: 3599
      });
    });

    it.each([
      ["turnDurationSeconds", 0],
      ["reminderDelaySeconds", 0],
      ["turnDurationSeconds", -1],
      ["reminderDelaySeconds", -1]
    ])("rejects non-positive %s=%s", (field, value) => {
      expectCreateTableError(
        {
          ...basePayload,
          turnDurationSeconds: 2,
          reminderDelaySeconds: 1,
          [field]: value
        },
        "Время должно быть больше нуля"
      );
    });

    it.each([
      [1, 1],
      [2, 2],
      [2, 3]
    ])("rejects reminder >= turn for turn=%s reminder=%s", (turn, reminder) => {
      expectCreateTableError(
        {
          ...basePayload,
          turnDurationSeconds: turn,
          reminderDelaySeconds: reminder
        },
        "Напоминание должно прийти раньше тайм-аута"
      );
    });
  });

  describe("normalizeGetVirtualLeaderboardQuery", () => {
    it("keeps default limit and treats empty cursor as null", () => {
      expect(normalizeGetVirtualLeaderboardQuery({ cursor: "   " })).toEqual({
        scope: "all",
        period: "all-time",
        limit: 50,
        cursor: null
      });
    });

    it("trims and accepts a valid encoded cursor", () => {
      const cursor = encodeVirtualLeaderboardCursor({
        onlinePokerScore: 120,
        handsPlayed: 15,
        netChips: 345n,
        userId: "user-1"
      });

      expect(normalizeGetVirtualLeaderboardQuery({ limit: "25", cursor: ` ${cursor} ` })).toEqual({
        scope: "all",
        period: "all-time",
        limit: 25,
        cursor
      });
    });

    it("normalizes scope and period", () => {
      expect(
        normalizeGetVirtualLeaderboardQuery({
          scope: "played-with-me",
          period: "last-10",
          limit: "5"
        })
      ).toEqual({
        scope: "played-with-me",
        period: "last-10",
        limit: 5,
        cursor: null
      });
    });

    it.each([
      [{ scope: "friends" }, "Не удалось определить область лидерборда"],
      [{ period: "week" }, "Не удалось определить период"]
    ])("rejects invalid leaderboard query %j", (query, message) => {
      expectLeaderboardQueryError(query, message);
    });

    it.each(["not-base64", "e30", Buffer.from('{"userId":"x"}', "utf8").toString("base64url")])(
      "rejects invalid cursor %s",
      (cursor) => {
        try {
          normalizeGetVirtualLeaderboardQuery({ cursor });
          fail(`Expected cursor ${cursor} to be rejected`);
        } catch (error) {
          expect(error).toMatchObject({
            code: VIRTUAL_ERROR_CODES.invalidInput,
            status: HttpStatus.BAD_REQUEST
          });
          expect((error as { getResponse: () => { error: { message: string } } }).getResponse()).toEqual({
            error: {
              code: VIRTUAL_ERROR_CODES.invalidInput,
              message: "Не удалось прочитать курсор лидерборда"
            }
          });
        }
      }
    );
  });

  describe("normalizeGetVirtualHandHistoriesQuery", () => {
    it("keeps default limit and treats empty cursor as null", () => {
      expect(normalizeGetVirtualHandHistoriesQuery({ cursor: "   " })).toEqual({
        limit: 20,
        cursor: null
      });
    });

    it("trims and normalizes a valid cursor", () => {
      expect(normalizeGetVirtualHandHistoriesQuery({ limit: "25", cursor: " 0012 " })).toEqual({
        limit: 25,
        cursor: "12"
      });
    });

    it("keeps the maximum limit at 100", () => {
      expect(normalizeGetVirtualHandHistoriesQuery({ limit: "100" })).toEqual({
        limit: 100,
        cursor: null
      });
    });

    it.each(["0", "-1", "abc", "12.5"])(
      "rejects invalid cursor %s",
      (cursor) => {
        try {
          normalizeGetVirtualHandHistoriesQuery({ cursor });
          fail(`Expected cursor ${cursor} to be rejected`);
        } catch (error) {
          expect(error).toMatchObject({
            code: VIRTUAL_ERROR_CODES.invalidInput,
            status: HttpStatus.BAD_REQUEST
          });
          expect((error as { getResponse: () => { error: { message: string } } }).getResponse()).toEqual({
            error: {
              code: VIRTUAL_ERROR_CODES.invalidInput,
              message: "Курсор истории раздач должен быть положительным числом"
            }
          });
        }
      }
    );
  });

  describe("normalizeSubmitVirtualReactionRequest", () => {
    it("trims emoji and returns request dto", () => {
      expect(normalizeSubmitVirtualReactionRequest({ emoji: " 😂 " })).toEqual({
        emoji: "😂"
      });
    });

    it("rejects empty emoji", () => {
      try {
        normalizeSubmitVirtualReactionRequest({ emoji: "   " });
        fail("Expected reaction payload to be rejected");
      } catch (error) {
        expect(error).toMatchObject({
          code: VIRTUAL_ERROR_CODES.invalidInput,
          status: HttpStatus.BAD_REQUEST
        });
        expect((error as { getResponse: () => { error: { message: string } } }).getResponse()).toEqual({
          error: {
            code: VIRTUAL_ERROR_CODES.invalidInput,
            message: "Не удалось прочитать реакцию"
          }
        });
      }
    });
  });
});

function expectCreateTableError(payload: Record<string, unknown>, message: string): void {
  try {
    normalizeCreateVirtualTableRequest(payload);
    fail(`Expected create table payload to be rejected with message: ${message}`);
  } catch (error) {
    expect(error).toMatchObject({
      code: VIRTUAL_ERROR_CODES.invalidInput,
      status: HttpStatus.BAD_REQUEST
    });
    expect((error as { getResponse: () => { error: { message: string } } }).getResponse()).toEqual({
      error: {
        code: VIRTUAL_ERROR_CODES.invalidInput,
        message
      }
    });
  }
}

function expectLeaderboardQueryError(query: Record<string, unknown>, message: string): void {
  try {
    normalizeGetVirtualLeaderboardQuery(query);
    fail(`Expected leaderboard query to be rejected with message: ${message}`);
  } catch (error) {
    expect(error).toMatchObject({
      code: VIRTUAL_ERROR_CODES.invalidInput,
      status: HttpStatus.BAD_REQUEST
    });
    expect((error as { getResponse: () => { error: { message: string } } }).getResponse()).toEqual({
      error: {
        code: VIRTUAL_ERROR_CODES.invalidInput,
        message
      }
    });
  }
}
