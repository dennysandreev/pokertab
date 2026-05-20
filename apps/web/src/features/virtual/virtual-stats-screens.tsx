import type { JSX } from "react";
import type {
  GetMyVirtualStatsResponseDto,
  GetVirtualLeaderboardResponseDto,
  VirtualLeaderboardItemDto,
  VirtualOnlineStatsDto
} from "@pokertable/shared";
import { Button } from "@/components/ui/button";
import {
  AvatarInitials,
  EmptyState,
  GlassPanel,
  InlineMetric,
  RolePill,
  ScreenHeader,
  SectionStack,
  StatBlock,
  formatVirtualChips,
  formatVirtualSignedChips,
  getVirtualResultTone,
  virtualScreenClassName,
  virtualSectionTitleClassName
} from "./virtual-ui";

type VirtualLeaderboardScreenProps = {
  data: GetVirtualLeaderboardResponseDto;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onOpenPlayer?: (userId: string) => void;
};

type VirtualStatsScreenProps = {
  data: GetMyVirtualStatsResponseDto;
  recentTables?: Array<{
    id: string;
    title: string;
    finishedAt?: string | null;
    netChips: string;
  }>;
};

export function VirtualLeaderboardScreen({
  data,
  isLoadingMore = false,
  onLoadMore,
  onOpenPlayer
}: VirtualLeaderboardScreenProps): JSX.Element {
  return (
    <div className={virtualScreenClassName}>
      <div className="mx-auto max-w-3xl space-y-6 pb-8">
        <ScreenHeader
          eyebrow="Онлайн-рейтинг"
          title="Лидерборд"
          description="Сравниваем игроков по чистому результату, проценту побед, ББ/100 и очкам за онлайн-игру."
        />

        {data.items.length === 0 ? (
          <EmptyState
            description="Как только накопятся завершенные онлайн-сессии, рейтинг заполнится автоматически."
            icon="social_leaderboard"
            title="Рейтинг пока пустой"
          />
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-3">
              <StatBlock
                hint="Сумма лидеров списка"
                label="Чистый результат"
                tone="positive"
                value={formatVirtualChips(sumNetChips(data.items))}
              />
              <StatBlock label="Средний процент побед" value={formatPercent(data.items[0]?.winRateBps ?? 0)} />
              <StatBlock label="Лучшие очки" value={data.items[0]?.onlinePokerScore ?? 0} />
            </section>

            <SectionStack>
              {data.items.map((item) => (
                <LeaderboardRow key={item.userId} item={item} {...(onOpenPlayer ? { onOpenPlayer } : {})} />
              ))}
            </SectionStack>
          </>
        )}

        {data.nextCursor && onLoadMore ? (
          <Button className="w-full" disabled={isLoadingMore} onClick={onLoadMore}>
            {isLoadingMore ? "Подгружаем еще игроков" : "Показать еще"}
            <span className="material-symbols-outlined text-[18px]">expand_more</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function VirtualStatsScreen({
  data,
  recentTables = []
}: VirtualStatsScreenProps): JSX.Element {
  const { stats } = data;

  return (
    <div className={virtualScreenClassName}>
      <div className="mx-auto max-w-3xl space-y-6 pb-8">
        <ScreenHeader
          eyebrow="Профиль игрока"
          title={stats.displayName}
          description="Онлайн-метрики по виртуальным столам: результат, дистанция, стабильность и темп набора BB."
          trailing={<RolePill tone="positive">Очки {stats.onlinePokerScore}</RolePill>}
        />

        <GlassPanel className="overflow-hidden">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className={virtualSectionTitleClassName}>Чистый результат</p>
              <h2 className="mt-2 font-['Hanken_Grotesk',Inter,sans-serif] text-[2.5rem] font-bold leading-none text-[#4edea3]">
                {formatVirtualSignedChips(stats.netChips)}
              </h2>
              <p className="mt-3 text-sm text-[#8e9192]">
                Процент побед {formatPercent(stats.winRateBps)} · ББ/100 {formatBpsValue(stats.bbPer100Bps)}
              </p>
            </div>
            <div className="grid w-full gap-2 sm:grid-cols-3 md:w-auto">
              <InlineMetric label="Рук" value={stats.handsPlayed} />
              <InlineMetric label="Побед" value={stats.handsWon} />
              <InlineMetric label="Очки" value={stats.onlinePokerScore} tone="positive" />
            </div>
          </div>
          <div className="mt-5 flex h-20 items-end gap-2">
            {getSparkBars(stats).map((height, index) => (
              <div
                key={index}
                className="flex-1 rounded-t-sm bg-[#4edea3]/80 shadow-[0_0_18px_rgba(78,222,163,0.16)]"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </GlassPanel>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatBlock label="Процент побед" value={formatPercent(stats.winRateBps)} />
          <StatBlock label="ББ/100" value={formatBpsValue(stats.bbPer100Bps)} />
          <StatBlock label="Большие блайнды" value={formatVirtualSignedChips(stats.bigBlindsWon)} tone={getVirtualResultTone(stats.bigBlindsWon)} />
          <StatBlock label="Средний итог за руку" value={formatVirtualSignedChips(stats.avgChipsPerHand)} tone={getVirtualResultTone(stats.avgChipsPerHand)} />
        </section>

        <GlassPanel>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xl font-semibold text-white">Основные метрики</p>
              <p className="mt-1 text-sm text-[#8e9192]">Короткий взгляд на дистанцию и текущую форму игрока.</p>
            </div>
            {stats.username ? <RolePill>@{stats.username}</RolePill> : null}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <InlineMetric label="Чистый результат" tone={getVirtualResultTone(stats.netChips)} value={formatVirtualChips(stats.netChips)} />
            <InlineMetric label="Выиграно рук" value={`${stats.handsWon} из ${stats.handsPlayed}`} />
            <InlineMetric label="Онлайн-рейтинг" tone="positive" value={stats.onlinePokerScore} />
            <InlineMetric label="Процент побед" value={formatPercent(stats.winRateBps)} />
          </div>
        </GlassPanel>

        {recentTables.length > 0 ? (
          <SectionStack>
            <div>
              <h2 className="text-xl font-semibold text-white">Недавние столы</h2>
              <p className="mt-1 text-sm text-[#8e9192]">Последние завершенные сессии, чтобы быстро проверить динамику.</p>
            </div>
            <div className="space-y-3">
              {recentTables.map((table) => (
                <GlassPanel key={table.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{table.title}</p>
                    <p className="mt-1 text-sm text-[#8e9192]">{table.finishedAt ? formatDate(table.finishedAt) : "Еще в игре"}</p>
                  </div>
                  <span className={getVirtualResultTone(table.netChips) === "negative" ? "text-[#ffb4ab]" : "text-[#4edea3]"}>
                    {formatVirtualSignedChips(table.netChips)}
                  </span>
                </GlassPanel>
              ))}
            </div>
          </SectionStack>
        ) : null}
      </div>
    </div>
  );
}

function LeaderboardRow({
  item,
  onOpenPlayer
}: {
  item: VirtualLeaderboardItemDto;
  onOpenPlayer?: (userId: string) => void;
}): JSX.Element {
  return (
    <GlassPanel className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative">
          <AvatarInitials className="h-12 w-12 rounded-xl" name={item.displayName} />
          <div className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#141313] bg-[#4edea3] text-[10px] font-bold text-[#032517]">
            {item.rank}
          </div>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{item.displayName}</p>
          <p className="mt-1 truncate text-sm text-[#8e9192]">
            {item.handsPlayed} рук · процент побед {formatPercent(item.winRateBps)} · ББ/100 {formatBpsValue(item.bbPer100Bps)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className={getVirtualResultTone(item.netChips) === "negative" ? "text-sm font-semibold text-[#ffb4ab]" : "text-sm font-semibold text-[#4edea3]"}>
            {formatVirtualSignedChips(item.netChips)}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#727779]">очки {item.onlinePokerScore}</p>
        </div>
        {onOpenPlayer ? (
          <Button className="min-h-11 px-4" onClick={() => onOpenPlayer(item.userId)}>
            Профиль
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Button>
        ) : null}
      </div>
    </GlassPanel>
  );
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(value / 100) ? 0 : 1
  }).format(value / 100)}%`;
}

function formatBpsValue(value: number): string {
  const amount = value / 100;
  const sign = amount > 0 ? "+" : amount < 0 ? "-" : "";
  return `${sign}${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: Number.isInteger(Math.abs(amount)) ? 0 : 1,
    maximumFractionDigits: 1
  }).format(Math.abs(amount))}`;
}

function sumNetChips(items: VirtualOnlineStatsDto[]): string {
  return items.reduce((sum, item) => sum + BigInt(item.netChips), 0n).toString();
}

function getSparkBars(stats: VirtualOnlineStatsDto): number[] {
  const baseline = Math.max(12, Math.min(88, stats.winRateBps / 20));
  const bbFactor = Math.max(14, Math.min(96, Math.abs(stats.bbPer100Bps) / 12));

  return [42, 36, baseline - 8, baseline, bbFactor - 10, bbFactor, Math.min(100, baseline + 6)];
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long"
  }).format(new Date(value));
}
