import type { JSX } from "react";
import type {
  GetVirtualHandHistoriesResponseDto,
  GetVirtualHandHistoryResponseDto,
  VirtualHandHistoryActionDto,
  VirtualHandHistoryListItemDto,
  VirtualHandHistoryPotDto
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
  formatBlindPair,
  formatVirtualChips,
  getSeatStatusLabel,
  getStreetLabel,
  virtualScreenClassName,
  virtualSectionTitleClassName
} from "./virtual-ui";

type HandHistoryListScreenProps = {
  data: GetVirtualHandHistoriesResponseDto;
  isLoadingMore?: boolean;
  onOpenHand?: (handId: string) => void;
  onLoadMore?: () => void;
};

type HandHistoryDetailScreenProps = {
  data: GetVirtualHandHistoryResponseDto;
  onBack?: () => void;
};

export function VirtualHandHistoryListScreen({
  data,
  isLoadingMore = false,
  onOpenHand,
  onLoadMore
}: HandHistoryListScreenProps): JSX.Element {
  return (
    <div className={virtualScreenClassName}>
      <div className="mx-auto max-w-3xl space-y-6 pb-8">
        <ScreenHeader
          eyebrow="История раздач"
          title="История раздач"
          description="Быстрый список по банку, статусу, доске и победителям. Детали открываются без лишнего контекста."
          trailing={<RolePill>{data.items.length}</RolePill>}
        />

        {data.items.length === 0 ? (
          <EmptyState
            description="Когда в столе завершатся первые раздачи, здесь появится полный лог действий и результатов."
            icon="history"
            title="Раздач пока нет"
          />
        ) : (
          <SectionStack>
            {data.items.map((item) => (
              <HandHistoryListCard key={item.id} item={item} {...(onOpenHand ? { onOpenHand } : {})} />
            ))}
          </SectionStack>
        )}

        {data.nextCursor && onLoadMore ? (
          <Button className="w-full" disabled={isLoadingMore} onClick={onLoadMore}>
            {isLoadingMore ? "Подгружаем еще раздачи" : "Показать еще"}
            <span className="material-symbols-outlined text-[18px]">expand_more</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function VirtualHandHistoryDetailScreen({
  data,
  onBack
}: HandHistoryDetailScreenProps): JSX.Element {
  const { table, hand, board, players, actions, pots } = data;
  const groupedActions = groupActionsByStreet(actions);

  return (
    <div className={virtualScreenClassName}>
      <div className="mx-auto max-w-3xl space-y-6 pb-8">
        <ScreenHeader
          eyebrow={`Раздача #${hand.handNumber}`}
          title={table.title}
          description="Полная последовательность действий, состав участников, банк и шоудаун."
          trailing={
            onBack ? (
              <Button
                className="min-h-11 border border-white/10 bg-[#1d1c1c] px-4 text-white shadow-none hover:bg-[#262525]"
                onClick={onBack}
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Назад
              </Button>
            ) : undefined
          }
        />

        <GlassPanel className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={virtualSectionTitleClassName}>{getStreetLabel(hand.street)}</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{formatVirtualChips(hand.potTotalChips)}</h2>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <InlineMetric label="Стол" value={table.inviteCode} />
              <InlineMetric label="Блайнды" value={formatBlindPair(table.smallBlindChips, table.bigBlindChips)} />
              <InlineMetric label="Игроки" value={players.length} />
            </div>
          </div>

          <div>
            <p className={virtualSectionTitleClassName}>Борд</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {board.length === 0 ? (
                <RolePill>Без открытых карт</RolePill>
              ) : (
                board.map((card, index) => <PlayingCardChip key={`${card}-${index}`} card={card} />)
              )}
            </div>
          </div>
        </GlassPanel>

        <GlassPanel>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xl font-semibold text-white">Игроки</p>
              <p className="mt-1 text-sm text-[#8e9192]">Показываем итог по вложению, стеку и картам на шоудауне.</p>
            </div>
            <RolePill>{players.length}</RolePill>
          </div>
          <div className="mt-4 space-y-3">
            {players.map((player) => (
              <div
                key={player.seatId}
                className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-[#1d1c1c]/90 px-3 py-3"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <AvatarInitials className="h-10 w-10" name={player.displayName} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{player.displayName}</p>
                    <p className="mt-1 text-sm text-[#8e9192]">
                      Вложил {formatVirtualChips(player.committedTotalChips)} · Остаток{" "}
                      {formatVirtualChips(player.stackAfterChips)}
                    </p>
                  </div>
                </div>
                {player.showdownCards.length > 0 ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    {player.showdownCards.map((card, index) => (
                      <PlayingCardChip key={`${player.seatId}-${card}-${index}`} card={card} />
                    ))}
                  </div>
                ) : (
                  <RolePill>{getSeatStatusLabel(player.status)}</RolePill>
                )}
              </div>
            ))}
          </div>
        </GlassPanel>

        <SectionStack>
          <div>
            <h2 className="text-xl font-semibold text-white">Ход раздачи</h2>
            <p className="mt-1 text-sm text-[#8e9192]">Лента сгруппирована по улицам, чтобы легче читать экшен.</p>
          </div>
          {groupedActions.map(([street, streetActions]) => (
            <GlassPanel key={street} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/5" />
                <span className={virtualSectionTitleClassName}>{getStreetLabel(street)}</span>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              <div className="space-y-3">
                {streetActions.map((action) => (
                  <ActionTimelineRow key={action.id} action={action} />
                ))}
              </div>
            </GlassPanel>
          ))}
        </SectionStack>

        <SectionStack>
          <div>
            <h2 className="text-xl font-semibold text-white">Банк и победители</h2>
            <p className="mt-1 text-sm text-[#8e9192]">Сайд-поты и распределение показываются отдельно для прозрачности.</p>
          </div>
          <div className="space-y-3">
            {pots.map((pot) => (
              <PotCard key={pot.id} pot={pot} />
            ))}
          </div>
        </SectionStack>
      </div>
    </div>
  );
}

function HandHistoryListCard({
  item,
  onOpenHand
}: {
  item: VirtualHandHistoryListItemDto;
  onOpenHand?: (handId: string) => void;
}): JSX.Element {
  return (
    <GlassPanel className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <RolePill tone="positive">#{item.handNumber}</RolePill>
            <RolePill>{getStreetLabel(item.street)}</RolePill>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-white">{formatVirtualChips(item.potTotalChips)}</h3>
        </div>
        {onOpenHand ? (
          <Button className="min-h-11 px-4" onClick={() => onOpenHand(item.id)}>
            Детали
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Button>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <InlineMetric label="Экшен" value={`${item.actionsCount} действий`} />
        <InlineMetric label="Борд" value={item.board.length === 0 ? "Префлоп" : item.board.join(" ")} />
        <InlineMetric
          label="Победители"
          value={
            item.winners.length === 0
              ? "Без итогов"
              : item.winners.map((winner) => `${winner.displayName} ${formatVirtualChips(winner.amountChips)}`).join(" · ")
          }
        />
      </div>
    </GlassPanel>
  );
}

function ActionTimelineRow({ action }: { action: VirtualHandHistoryActionDto }): JSX.Element {
  return (
    <div className="relative pl-6">
      <div className="absolute left-[2px] top-2 h-full w-px bg-white/10" />
      <div className="absolute left-0 top-2 h-2.5 w-2.5 rounded-full bg-[#4edea3]" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-6 text-[#e5e2e1]">
          <span className="font-semibold text-white">{action.displayName}</span> {getActionLabel(action)}
        </p>
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#727779]">{formatHistoryTime(action.createdAt)}</span>
      </div>
    </div>
  );
}

function PotCard({ pot }: { pot: VirtualHandHistoryPotDto }): JSX.Element {
  return (
    <GlassPanel className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={virtualSectionTitleClassName}>Пот</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatVirtualChips(pot.amountChips)}</p>
        </div>
        <RolePill>{pot.eligibleSeatIds.length} претендентов</RolePill>
      </div>
      <div className="space-y-2">
        {pot.awards.map((award) => (
          <div
            key={`${pot.id}-${award.winnerSeatId}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3"
          >
            <div className="flex items-center gap-3">
              <AvatarInitials className="h-9 w-9" name={award.displayName} />
              <span className="text-sm font-semibold text-white">{award.displayName}</span>
            </div>
            <span className="text-sm font-semibold text-[#4edea3]">{formatVirtualChips(award.amountChips)}</span>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

function PlayingCardChip({ card }: { card: string }): JSX.Element {
  return (
    <div className="inline-flex min-w-12 items-center justify-center rounded-xl border border-white/10 bg-[#f6f6f5] px-3 py-3 text-sm font-bold text-[#141313]">
      {card}
    </div>
  );
}

function groupActionsByStreet(
  actions: VirtualHandHistoryActionDto[]
): Array<[VirtualHandHistoryActionDto["street"], VirtualHandHistoryActionDto[]]> {
  const grouped = new Map<VirtualHandHistoryActionDto["street"], VirtualHandHistoryActionDto[]>();

  for (const action of actions) {
    const items = grouped.get(action.street) ?? [];
    items.push(action);
    grouped.set(action.street, items);
  }

  return Array.from(grouped.entries());
}

export function getActionLabel(action: VirtualHandHistoryActionDto): string {
  const amount = action.amountChips ? ` ${formatVirtualChips(action.amountChips)}` : "";

  switch (action.actionType) {
    case "FOLD":
      return "сбросил карты";
    case "CHECK":
      return "прочекал";
    case "CALL":
      return `заколлировал${amount}`;
    case "BET":
      return `поставил${amount}`;
    case "RAISE":
      return `повысил до${amount}`;
    case "ALL_IN":
      return `пошел олл-ин${amount}`;
    default:
      return action.amountChips ? `${action.actionType} ${formatVirtualChips(action.amountChips)}` : action.actionType;
  }
}

export function formatHistoryTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
