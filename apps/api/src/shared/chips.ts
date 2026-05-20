export function chipsToMoneyMinor(
  chips: string | number | bigint,
  chipsPerCurrencyUnit: string | number | bigint
): string {
  const chipsValue = typeof chips === "bigint" ? chips : BigInt(chips);
  const rateValue =
    typeof chipsPerCurrencyUnit === "bigint"
      ? chipsPerCurrencyUnit
      : BigInt(chipsPerCurrencyUnit);

  if (rateValue <= 0n) {
    throw new RangeError("chipsPerCurrencyUnit must be positive");
  }

  return ((chipsValue * 100n) / rateValue).toString();
}

export function chipsToMinorAmount(
  chips: string | number | bigint,
  chipsPerCurrencyUnit: string | number | bigint
): bigint {
  return BigInt(chipsToMoneyMinor(chips, chipsPerCurrencyUnit));
}
