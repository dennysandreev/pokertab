import type { GetLeaderboardQueryDto, LeaderboardPeriod, LeaderboardScope } from "@pokertable/shared";

export const DEFAULT_LEADERBOARD_QUERY: Pick<
  GetLeaderboardQueryDto,
  "scope" | "period" | "limit"
> = {
  scope: "all",
  period: "all-time",
  limit: 20
};

export const LEADERBOARD_SCOPE_OPTIONS: Array<{
  value: LeaderboardScope;
  label: string;
}> = [
  {
    value: "all",
    label: "Все игроки"
  },
  {
    value: "played-with-me",
    label: "Играли со мной"
  }
];

export const LEADERBOARD_PERIOD_OPTIONS: Array<{
  value: LeaderboardPeriod;
  label: string;
}> = [
  {
    value: "all-time",
    label: "За всё время"
  },
  {
    value: "month",
    label: "Этот месяц"
  },
  {
    value: "last-10",
    label: "Последние 10 игр"
  }
];

export function formatPercentFromBps(value: number): string {
  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: Number.isInteger(value / 100) ? 0 : 1,
    maximumFractionDigits: 1
  }).format(value / 100)}%`;
}

export function formatSignedMinorStat(value: string): string {
  const amount = BigInt(value);
  const sign = amount > 0n ? "+" : amount < 0n ? "-" : "";
  const absolute = amount < 0n ? amount * -1n : amount;
  const whole = absolute / 100n;
  const fraction = absolute % 100n;
  const wholeText = new Intl.NumberFormat("ru-RU").format(Number(whole)).replace(/\u00A0/g, " ");

  return `${sign}${wholeText},${fraction.toString().padStart(2, "0")}`;
}

export function getLeaderboardEmptyCopy(scope: LeaderboardScope): {
  title: string;
  description: string;
} {
  if (scope === "played-with-me") {
    return {
      title: "Пока не с кем сравнивать",
      description: "Рейтинг появится после ваших общих завершённых игр."
    };
  }

  return {
    title: "Рейтинг пока пустой",
    description: "Как только появятся завершённые игры, здесь будут результаты игроков."
  };
}

export function getResultTone(value: string): "positive" | "negative" | "neutral" {
  const amount = BigInt(value);

  if (amount > 0n) {
    return "positive";
  }

  if (amount < 0n) {
    return "negative";
  }

  return "neutral";
}
