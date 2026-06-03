import type { RebuyPermission } from "@pokertable/shared";
import { buildOffsetDateTimeString } from "../clubs/club-view";

export const ROOM_TITLE_MAX_LENGTH = 80;
export const ROOM_SUPPORTED_CURRENCIES = ["RUB", "USD", "EUR"] as const;
export const ROOM_MAX_BUY_IN_CHIPS = 1_000_000;
export const ROOM_MAX_REBUY_CHIPS = 1_000_000;
export const ROOM_MAX_CHIPS_PER_CURRENCY_UNIT = 1_000_000;

export type CreateRoomPayload = {
  title: string;
  currency: string;
  buyInChips: string;
  rebuyChips: string;
  chipsPerCurrencyUnit: string;
  gameType: "SIMPLE_TRACKING";
  rebuyPermission: RebuyPermission;
  clubId?: string;
  scheduledStartAt?: string;
  sendNotifications?: boolean;
  maxPlayers?: number;
  location?: string;
};

export type CreateRoomFormValues = {
  title: string;
  currency: string;
  buyInChips: string;
  rebuyChips: string;
  chipsPerCurrencyUnit: string;
  rebuyPermission: RebuyPermission;
  clubId?: string;
  scheduledStartAt?: string;
  sendNotifications?: boolean;
  maxPlayers?: string;
  location?: string;
};

export function buildCreateRoomPayload(
  values: CreateRoomFormValues
): CreateRoomPayload | null {
  const title = values.title.trim();
  const currency = values.currency.trim().toUpperCase();
  const buyInChips = parsePositiveInteger(values.buyInChips);
  const rebuyChips = parsePositiveInteger(values.rebuyChips);
  const chipsPerCurrencyUnit = parsePositiveInteger(values.chipsPerCurrencyUnit);
  const clubId = (values.clubId ?? "").trim();
  const scheduledStartAt = buildOffsetDateTimeString(values.scheduledStartAt ?? "");
  const maxPlayersInput = values.maxPlayers ?? "";
  const maxPlayers = maxPlayersInput.trim().length > 0 ? parsePositiveInteger(maxPlayersInput) : null;
  const location = (values.location ?? "").trim();

  if (
    title.length === 0 ||
    title.length > ROOM_TITLE_MAX_LENGTH ||
    currency.length === 0 ||
    !ROOM_SUPPORTED_CURRENCIES.includes(currency as (typeof ROOM_SUPPORTED_CURRENCIES)[number]) ||
    buyInChips === null ||
    rebuyChips === null ||
    chipsPerCurrencyUnit === null
  ) {
    return null;
  }

  if (clubId.length > 0 && !scheduledStartAt) {
    return null;
  }

  if (maxPlayersInput.trim().length > 0 && maxPlayers === null) {
    return null;
  }

  if (
    buyInChips > ROOM_MAX_BUY_IN_CHIPS ||
    rebuyChips > ROOM_MAX_REBUY_CHIPS ||
    chipsPerCurrencyUnit > ROOM_MAX_CHIPS_PER_CURRENCY_UNIT
  ) {
    return null;
  }

  const payload: CreateRoomPayload = {
    title,
    currency,
    buyInChips: String(buyInChips),
    rebuyChips: String(rebuyChips),
    chipsPerCurrencyUnit: String(chipsPerCurrencyUnit),
    gameType: "SIMPLE_TRACKING",
    rebuyPermission: values.rebuyPermission
  };

  if (clubId.length > 0) {
    payload.clubId = clubId;
    payload.scheduledStartAt = scheduledStartAt!;
    payload.sendNotifications = values.sendNotifications ?? false;

    if (maxPlayers !== null) {
      payload.maxPlayers = maxPlayers;
    }

    if (location.length > 0) {
      payload.location = location;
    }
  }
  return payload;
}

export function getCreateRoomValidationMessage(values: CreateRoomFormValues): string | null {
  const title = values.title.trim();
  const currency = values.currency.trim().toUpperCase();
  const buyInChips = parsePositiveInteger(values.buyInChips);
  const rebuyChips = parsePositiveInteger(values.rebuyChips);
  const chipsPerCurrencyUnit = parsePositiveInteger(values.chipsPerCurrencyUnit);
  const clubId = (values.clubId ?? "").trim();
  const scheduledStartAt = values.scheduledStartAt ?? "";
  const maxPlayersInput = values.maxPlayers ?? "";
  const hasSelectedClub = clubId.length > 0;

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

  if (buyInChips === null) {
    return "Укажите сумму входа в фишках";
  }

  if (buyInChips > ROOM_MAX_BUY_IN_CHIPS) {
    return "Сумма входа слишком большая";
  }

  if (chipsPerCurrencyUnit === null) {
    return "Укажите курс в фишках";
  }

  if (chipsPerCurrencyUnit > ROOM_MAX_CHIPS_PER_CURRENCY_UNIT) {
    return "Курс слишком большой";
  }

  if (rebuyChips === null) {
    return "Укажите ребай в фишках";
  }

  if (rebuyChips > ROOM_MAX_REBUY_CHIPS) {
    return "Ребай слишком большой";
  }

  if (hasSelectedClub && !buildOffsetDateTimeString(scheduledStartAt)) {
    return "Выберите дату и время";
  }

  if (maxPlayersInput.trim().length > 0 && parsePositiveInteger(maxPlayersInput) === null) {
    return "Лимит игроков должен быть больше нуля";
  }

  return null;
}

function parsePositiveInteger(value: string): number | null {
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
