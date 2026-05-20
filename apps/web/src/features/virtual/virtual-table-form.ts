import type {
  CreateVirtualTableRequestDto,
  VirtualTimeoutAutoActionRule
} from "@pokertable/shared";

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
};

export type JoinVirtualTableFormValues = {
  inviteCode: string;
};

export function buildCreateVirtualTablePayload(
  values: CreateVirtualTableFormValues
): CreateVirtualTableRequestDto | null {
  if (getCreateVirtualTableValidationMessage(values)) {
    return null;
  }

  const title = values.title.trim();
  const chipsPerCurrencyUnit = normalizePositiveIntegerString(values.chipsPerCurrencyUnit)!;

  return {
    title,
    maxSeats: Number.parseInt(values.maxSeats.trim(), 10),
    startingStackChips: normalizePositiveIntegerString(values.startingStackChips)!,
    chipValueMinor: convertChipsPerCurrencyUnitToChipValueMinor(chipsPerCurrencyUnit),
    chipValueCurrency: "RUB",
    smallBlindChips: normalizePositiveIntegerString(values.smallBlindChips)!,
    bigBlindChips: normalizePositiveIntegerString(values.bigBlindChips)!,
    turnDurationSeconds: Number.parseInt(values.turnDurationSeconds.trim(), 10),
    reminderDelaySeconds: Number.parseInt(values.reminderDelaySeconds.trim(), 10),
    timeoutAutoActionRule: values.timeoutAutoActionRule as VirtualTimeoutAutoActionRule,
    winProbabilityEnabled: values.winProbabilityEnabled
  };
}

export function getCreateVirtualTableValidationMessage(
  values: CreateVirtualTableFormValues
): string | null {
  const title = values.title.trim();
  const maxSeats = parsePositiveInteger(values.maxSeats);
  const startingStackChips = parsePositiveInteger(values.startingStackChips);
  const smallBlindChips = parsePositiveInteger(values.smallBlindChips);
  const bigBlindChips = parsePositiveInteger(values.bigBlindChips);
  const turnDurationSeconds = parsePositiveInteger(values.turnDurationSeconds);
  const reminderDelaySeconds = parsePositiveInteger(values.reminderDelaySeconds);
  const chipsPerCurrencyUnit = parsePositiveInteger(values.chipsPerCurrencyUnit);

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

  if (smallBlindChips === null) {
    return "Малый блайнд должен быть больше нуля";
  }

  if (bigBlindChips === null) {
    return "Большой блайнд должен быть больше нуля";
  }

  if (
    smallBlindChips > VIRTUAL_TABLE_MAX_CHIPS ||
    bigBlindChips > VIRTUAL_TABLE_MAX_CHIPS
  ) {
    return "Блайнды слишком большие";
  }

  if (bigBlindChips < smallBlindChips) {
    return "Большой блайнд не меньше малого";
  }

  if (smallBlindChips === bigBlindChips) {
    return "Блайнды не должны совпадать";
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
