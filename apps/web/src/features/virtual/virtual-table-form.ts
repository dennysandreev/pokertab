import type {
  CreateVirtualTableRequestDto,
  VirtualTimeoutAutoActionRule
} from "@pokertable/shared";
import { buildOffsetDateTimeString } from "../clubs/club-view";

export const VIRTUAL_TABLE_TITLE_MAX_LENGTH = 80;
export const VIRTUAL_TABLE_MIN_SEATS = 2;
export const VIRTUAL_TABLE_MAX_SEATS = 9;
export const VIRTUAL_TABLE_MAX_CHIPS = 1_000_000_000;
export const VIRTUAL_TABLE_MAX_CHIPS_PER_CURRENCY_UNIT = 1_000_000;

export type CreateVirtualTableFormValues = {
  title: string;
  maxSeats: string;
  startingStackChips: string;
  chipsPerCurrencyUnit: string;
  smallBlindChips: string;
  bigBlindChips: string;
  turnDurationSeconds: string;
  reminderDelaySeconds: string;
  timeoutAutoActionRule: VirtualTimeoutAutoActionRule | "";
  winProbabilityEnabled: boolean;
  clubId?: string;
  scheduledStartAt?: string;
  sendNotifications?: boolean;
};

export type CreateVirtualTablePayload = CreateVirtualTableRequestDto & {
  clubId?: string;
  scheduledStartAt?: string;
  sendNotifications?: boolean;
};

export type JoinVirtualTableFormValues = {
  inviteCode: string;
};

export function buildCreateVirtualTablePayload(
  values: CreateVirtualTableFormValues
): CreateVirtualTablePayload | null {
  if (getCreateVirtualTableValidationMessage(values)) {
    return null;
  }

  const title = values.title.trim();
  const chipsPerCurrencyUnit = normalizePositiveIntegerString(values.chipsPerCurrencyUnit)!;
  const bigBlindChips = normalizePositiveIntegerString(values.bigBlindChips)!;
  const payload: CreateVirtualTablePayload = {
    title,
    maxSeats: Number.parseInt(values.maxSeats.trim(), 10),
    startingStackChips: normalizePositiveIntegerString(values.startingStackChips)!,
    chipValueMinor: convertChipsPerCurrencyUnitToChipValueMinor(chipsPerCurrencyUnit),
    chipValueCurrency: "RUB",
    smallBlindChips: deriveSmallBlindChips(bigBlindChips),
    bigBlindChips,
    turnDurationSeconds: Number.parseInt(values.turnDurationSeconds.trim(), 10),
    reminderDelaySeconds: Number.parseInt(values.reminderDelaySeconds.trim(), 10),
    timeoutAutoActionRule: values.timeoutAutoActionRule as VirtualTimeoutAutoActionRule,
    winProbabilityEnabled: values.winProbabilityEnabled
  };

  const clubId = (values.clubId ?? "").trim();
  const scheduledStartAt = buildOffsetDateTimeString(values.scheduledStartAt ?? "");

  if (clubId.length > 0) {
    return {
      ...payload,
      clubId,
      scheduledStartAt: scheduledStartAt!,
      sendNotifications: values.sendNotifications ?? false
    };
  }
  return payload;
}

export function getCreateVirtualTableValidationMessage(
  values: CreateVirtualTableFormValues
): string | null {
  const title = values.title.trim();
  const maxSeats = parsePositiveInteger(values.maxSeats);
  const startingStackChips = parsePositiveInteger(values.startingStackChips);
  const bigBlindChips = parsePositiveInteger(values.bigBlindChips);
  const turnDurationSeconds = parsePositiveInteger(values.turnDurationSeconds);
  const reminderDelaySeconds = parsePositiveInteger(values.reminderDelaySeconds);
  const chipsPerCurrencyUnit = parsePositiveInteger(values.chipsPerCurrencyUnit);
  const hasSelectedClub = (values.clubId ?? "").trim().length > 0;

  if (title.length === 0) {
    return "Как назвать стол?";
  }

  if (title.length > VIRTUAL_TABLE_TITLE_MAX_LENGTH) {
    return "Название слишком длинное";
  }

  if (maxSeats === null) {
    return "Выберите от 2 до 9 мест";
  }

  if (maxSeats < VIRTUAL_TABLE_MIN_SEATS || maxSeats > VIRTUAL_TABLE_MAX_SEATS) {
    return "Выберите от 2 до 9 мест";
  }

  if (startingStackChips === null) {
    return "Стартовый стек должен быть больше нуля";
  }

  if (startingStackChips > VIRTUAL_TABLE_MAX_CHIPS) {
    return "Стек слишком большой";
  }

  if (bigBlindChips === null) {
    return "Большой блайнд должен быть больше нуля";
  }

  if (bigBlindChips < 2) {
    return "Большой блайнд должен быть от 2 фишек";
  }

  if (bigBlindChips > VIRTUAL_TABLE_MAX_CHIPS) {
    return "Блайнды слишком большие";
  }

  if (turnDurationSeconds === null) {
    return "Время должно быть больше нуля";
  }

  if (reminderDelaySeconds === null) {
    return "Время должно быть больше нуля";
  }

  if (reminderDelaySeconds >= turnDurationSeconds) {
    return "Напоминание должно прийти раньше тайм-аута";
  }

  if (chipsPerCurrencyUnit === null) {
    return "Укажите курс в фишках";
  }

  if (chipsPerCurrencyUnit > VIRTUAL_TABLE_MAX_CHIPS_PER_CURRENCY_UNIT) {
    return "Курс слишком большой";
  }

  if (!values.timeoutAutoActionRule) {
    return "Выберите действие по тайм-ауту";
  }

  if (hasSelectedClub && !buildOffsetDateTimeString(values.scheduledStartAt ?? "")) {
    return "Выберите дату и время старта";
  }

  return null;
}

export function normalizeVirtualInviteCode(inviteCode: string): string {
  return inviteCode.trim().toUpperCase();
}

export function isVirtualInviteCodeValid(inviteCode: string): boolean {
  return /^[A-Z0-9]{8}$/.test(normalizeVirtualInviteCode(inviteCode));
}

export function getJoinVirtualTableValidationMessage(
  values: JoinVirtualTableFormValues
): string | null {
  const inviteCode = normalizeVirtualInviteCode(values.inviteCode);

  if (inviteCode.length === 0) {
    return "Нужен код приглашения";
  }

  if (!isVirtualInviteCodeValid(inviteCode)) {
    return "Проверьте код приглашения";
  }

  return null;
}

export function buildJoinVirtualTablePayload(
  values: JoinVirtualTableFormValues
): { inviteCode: string } | null {
  const inviteCode = normalizeVirtualInviteCode(values.inviteCode);

  if (!isVirtualInviteCodeValid(inviteCode)) {
    return null;
  }

  return { inviteCode };
}

export function convertChipsPerCurrencyUnitToChipValueMinor(
  chipsPerCurrencyUnit: string
): string {
  const normalized = normalizePositiveIntegerString(chipsPerCurrencyUnit);

  if (!normalized) {
    throw new Error("chipsPerCurrencyUnit must be a positive integer");
  }

  const rate = BigInt(normalized);
  return ((100n + rate - 1n) / rate).toString();
}

export function deriveSmallBlindChips(bigBlindChips: string): string {
  const normalized = normalizePositiveIntegerString(bigBlindChips);

  if (!normalized) {
    return "";
  }

  const bigBlind = Number.parseInt(normalized, 10);
  return String(Math.max(1, Math.floor(bigBlind / 2)));
}

function normalizePositiveIntegerString(value: string): string | null {
  const parsed = parsePositiveInteger(value);

  return parsed === null ? null : String(parsed);
}

function parsePositiveInteger(value: string): number | null {
  const normalized = value.trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);

  return parsed > 0 ? parsed : null;
}
