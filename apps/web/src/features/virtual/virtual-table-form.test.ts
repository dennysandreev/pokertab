import { describe, expect, it } from "vitest";
import {
  buildCreateVirtualTablePayload,
  buildJoinVirtualTablePayload,
  convertChipsPerCurrencyUnitToChipValueMinor,
  deriveSmallBlindChips,
  getCreateVirtualTableValidationMessage,
  getJoinVirtualTableValidationMessage,
  isVirtualInviteCodeValid,
  normalizeVirtualInviteCode,
  VIRTUAL_TABLE_MAX_CHIPS,
  VIRTUAL_TABLE_MAX_CHIPS_PER_CURRENCY_UNIT,
  VIRTUAL_TABLE_TITLE_MAX_LENGTH
} from "./virtual-table-form";

const validValues = {
  title: "Ночной стол",
  maxSeats: "6",
  startingStackChips: "2000",
  chipsPerCurrencyUnit: "100",
  smallBlindChips: "10",
  bigBlindChips: "20",
  turnDurationSeconds: "30",
  reminderDelaySeconds: "15",
  timeoutAutoActionRule: "CHECK_OR_FOLD" as const,
  winProbabilityEnabled: false,
  clubId: "",
  scheduledStartAt: "",
  sendNotifications: true
};

describe("virtual table form helpers", () => {
  it("builds create payload", () => {
    expect(buildCreateVirtualTablePayload(validValues)).toEqual({
      title: "Ночной стол",
      maxSeats: 6,
      startingStackChips: "2000",
      chipValueMinor: "1",
      chipValueCurrency: "RUB",
      smallBlindChips: "10",
      bigBlindChips: "20",
      turnDurationSeconds: 30,
      reminderDelaySeconds: 15,
      timeoutAutoActionRule: "CHECK_OR_FOLD",
      winProbabilityEnabled: false
    });
  });

  it("includes win probability toggle in create payload", () => {
    expect(
      buildCreateVirtualTablePayload({
        ...validValues,
        winProbabilityEnabled: true
      })
    ).toMatchObject({
      winProbabilityEnabled: true
    });
  });

  it("converts chips-per-ruble rate to minor value", () => {
    expect(convertChipsPerCurrencyUnitToChipValueMinor("1")).toBe("100");
    expect(convertChipsPerCurrencyUnitToChipValueMinor("2")).toBe("50");
    expect(convertChipsPerCurrencyUnitToChipValueMinor("3")).toBe("34");
    expect(convertChipsPerCurrencyUnitToChipValueMinor("100")).toBe("1");
  });

  it("rejects too long title", () => {
    expect(
      getCreateVirtualTableValidationMessage({
        ...validValues,
        title: "а".repeat(VIRTUAL_TABLE_TITLE_MAX_LENGTH + 1)
      })
    ).toBe("Название слишком длинное");
  });

  it("rejects seat count outside supported range", () => {
    expect(
      getCreateVirtualTableValidationMessage({
        ...validValues,
        maxSeats: "10"
      })
    ).toBe("Выберите от 2 до 9 мест");
  });

  it("derives small blind from big blind", () => {
    expect(deriveSmallBlindChips("100")).toBe("50");
    expect(deriveSmallBlindChips("75")).toBe("37");
    expect(deriveSmallBlindChips("")).toBe("");
    expect(
      buildCreateVirtualTablePayload({
        ...validValues,
        smallBlindChips: "999",
        bigBlindChips: "75"
      })
    ).toMatchObject({
      smallBlindChips: "37",
      bigBlindChips: "75"
    });
  });

  it("rejects impossible big blind values", () => {
    expect(
      getCreateVirtualTableValidationMessage({
        ...validValues,
        bigBlindChips: "1"
      })
    ).toBe("Большой блайнд должен быть от 2 фишек");
  });

  it("rejects large stack and invalid timer settings", () => {
    expect(
      getCreateVirtualTableValidationMessage({
        ...validValues,
        startingStackChips: String(VIRTUAL_TABLE_MAX_CHIPS + 1)
      })
    ).toBe("Стек слишком большой");

    expect(
      getCreateVirtualTableValidationMessage({
        ...validValues,
        turnDurationSeconds: "0"
      })
    ).toBe("Время должно быть больше нуля");

    expect(
      getCreateVirtualTableValidationMessage({
        ...validValues,
        turnDurationSeconds: "1",
        reminderDelaySeconds: "1"
      })
    ).toBe("Напоминание должно прийти раньше тайм-аута");

    expect(
      getCreateVirtualTableValidationMessage({
        ...validValues,
        reminderDelaySeconds: "30"
      })
    ).toBe("Напоминание должно прийти раньше тайм-аута");
  });

  it("allows short positive timers without legacy limits", () => {
    expect(
      getCreateVirtualTableValidationMessage({
        ...validValues,
        turnDurationSeconds: "1",
        reminderDelaySeconds: "1"
      })
    ).toBe("Напоминание должно прийти раньше тайм-аута");

    expect(
      getCreateVirtualTableValidationMessage({
        ...validValues,
        turnDurationSeconds: "301",
        reminderDelaySeconds: "300"
      })
    ).toBeNull();
  });

  it("validates chips-per-ruble rate", () => {
    expect(
      getCreateVirtualTableValidationMessage({
        ...validValues,
        chipsPerCurrencyUnit: ""
      })
    ).toBe("Укажите курс в фишках");

    expect(
      getCreateVirtualTableValidationMessage({
        ...validValues,
        chipsPerCurrencyUnit: String(VIRTUAL_TABLE_MAX_CHIPS_PER_CURRENCY_UNIT + 1)
      })
    ).toBe("Курс слишком большой");
  });

  it("keeps old payload without club scheduling", () => {
    expect(buildCreateVirtualTablePayload(validValues)).not.toHaveProperty("clubId");
    expect(buildCreateVirtualTablePayload(validValues)).not.toHaveProperty("scheduledStartAt");
  });

  it("adds club scheduling fields when club is selected", () => {
    const payload = buildCreateVirtualTablePayload({
      ...validValues,
      clubId: "club-1",
      scheduledStartAt: "2026-05-26T20:00"
    });

    expect(payload).toMatchObject({
      clubId: "club-1",
      sendNotifications: true
    });
    expect(payload?.scheduledStartAt?.startsWith("2026-05-26T20:00:00")).toBe(true);
  });

  it("requires scheduled start when club is selected", () => {
    expect(
      getCreateVirtualTableValidationMessage({
        ...validValues,
        clubId: "club-1"
      })
    ).toBe("Выберите дату и время старта");
  });

  it("normalizes and validates invite codes", () => {
    expect(normalizeVirtualInviteCode(" ab12cd34 ")).toBe("AB12CD34");
    expect(isVirtualInviteCodeValid("ab12cd34")).toBe(true);
    expect(isVirtualInviteCodeValid("ab12")).toBe(false);
    expect(getJoinVirtualTableValidationMessage({ inviteCode: "   " })).toBe(
      "Нужен код приглашения"
    );
    expect(getJoinVirtualTableValidationMessage({ inviteCode: "abc-123" })).toBe(
      "Проверьте код приглашения"
    );
    expect(buildJoinVirtualTablePayload({ inviteCode: " ab12cd34 " })).toEqual({
      inviteCode: "AB12CD34"
    });
  });
});
