import type { CreateRoomRequestDto, RebuyPermission } from "@pokertable/shared";
import { parseMajorMoneyToMinor } from "@pokertable/shared";

export const ROOM_TITLE_MAX_LENGTH = 80;
export const ROOM_SUPPORTED_CURRENCIES = ["RUB", "USD", "EUR"] as const;
export const ROOM_MAX_REBUY_AMOUNT_MINOR = 1_000_000_000n;
export const ROOM_MAX_STARTING_STACK = 1_000_000;

export type CreateRoomFormValues = {
  title: string;
  currency: string;
  rebuyAmount: string;
  startingStack: string;
  rebuyPermission: RebuyPermission;
};

export function buildCreateRoomPayload(
  values: CreateRoomFormValues
): CreateRoomRequestDto | null {
  const title = values.title.trim();
  const currency = values.currency.trim().toUpperCase();
  const rebuyAmountMinor = parseMajorMoneyToMinor(values.rebuyAmount);
  const startingStack = parseOptionalPositiveInteger(values.startingStack);

  if (
    title.length === 0 ||
    title.length > ROOM_TITLE_MAX_LENGTH ||
    currency.length === 0 ||
    !ROOM_SUPPORTED_CURRENCIES.includes(currency as (typeof ROOM_SUPPORTED_CURRENCIES)[number]) ||
    !isPositiveMinorAmount(rebuyAmountMinor)
  ) {
    return null;
  }

  if (BigInt(rebuyAmountMinor) > ROOM_MAX_REBUY_AMOUNT_MINOR) {
    return null;
  }

  if (values.startingStack.trim().length > 0 && startingStack === null) {
    return null;
  }

  if (startingStack !== null && startingStack > ROOM_MAX_STARTING_STACK) {
    return null;
  }

  return {
    title,
    currency,
    rebuyAmountMinor,
    startingStack,
    gameType: "SIMPLE_TRACKING",
    rebuyPermission: values.rebuyPermission
  };
}

export function getCreateRoomValidationMessage(values: CreateRoomFormValues): string | null {
  const title = values.title.trim();
  const currency = values.currency.trim().toUpperCase();
  const rebuyAmountMinor = parseMajorMoneyToMinor(values.rebuyAmount);
  const startingStack = parseOptionalPositiveInteger(values.startingStack);

  if (title.length === 0) {
    return "Укажите название игры";
  }

  if (title.length > ROOM_TITLE_MAX_LENGTH) {
    return "Название слишком длинное";
  }

  if (!currency) {
    return "Выберите валюту";
  }

  if (!ROOM_SUPPORTED_CURRENCIES.includes(currency as (typeof ROOM_SUPPORTED_CURRENCIES)[number])) {
    return "Выберите рубли, доллары или евро";
  }

  if (!isPositiveMinorAmount(rebuyAmountMinor)) {
    return "Проверьте сумму ребая и стартовый стек";
  }

  if (BigInt(rebuyAmountMinor) > ROOM_MAX_REBUY_AMOUNT_MINOR) {
    return "Сумма ребая слишком большая";
  }

  if (values.startingStack.trim().length > 0 && startingStack === null) {
    return "Проверьте сумму ребая и стартовый стек";
  }

  if (startingStack !== null && startingStack > ROOM_MAX_STARTING_STACK) {
    return "Стартовый стек слишком большой";
  }

  return null;
}

function parseOptionalPositiveInteger(value: string): number | null {
  const normalized = value.trim();

  if (normalized.length === 0) {
    return null;
  }

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);

  return parsed > 0 ? parsed : null;
}

function isPositiveMinorAmount(value: string | null): value is string {
  if (!value || !/^\d+$/.test(value)) {
    return false;
  }

  return BigInt(value) > 0n;
}
