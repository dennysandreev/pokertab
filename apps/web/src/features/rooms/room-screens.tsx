import type { JSX } from "react";
import {
  formatMinorMoney,
  type GetRoomResponseDto,
  type RebuyHistoryItemDto,
  type RoomPlayerDto,
  type SettlementPlayerResultDto,
  type SettlementPreviewResponseDto,
  type SettlementTransferDto
} from "@pokertable/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getActivePlayers, getMyPlayer } from "./room-view";
import type {
  SettlementDraftPlayer,
  SettlementDraftSummary
} from "./settlement-view";
import { getSettlementDifferenceMessage } from "./settlement-view";

export type RebuyHistoryState = {
  status: "idle" | "loading" | "ready" | "error";
  items: RebuyHistoryItemDto[];
  errorMessage: string | null;
};

type RoomScreenProps = {
  data: GetRoomResponseDto;
};

type WaitingRoomProps = RoomScreenProps & {
  isStarting: boolean;
  canStart: boolean;
  onStart: () => void;
  onCopyInvite: () => void;
  onShareInvite: () => void;
};

type ActiveRoomPlayerProps = RoomScreenProps & {
  canSelfRebuy: boolean;
  selfRebuyHint: string;
  isCreatingSelfRebuy: boolean;
  isHistoryOpen: boolean;
  historyState: RebuyHistoryState;
  onSelfRebuy: () => void;
  onToggleHistory: () => void;
};

type ActiveRoomAdminProps = RoomScreenProps & {
  historyState: RebuyHistoryState;
  isHistoryOpen: boolean;
  addingRebuyForPlayerId: string | null;
  cancellingRebuyId: string | null;
  onAddRebuy: (player: RoomPlayerDto) => void;
  onCancelRebuy: (rebuy: RebuyHistoryItemDto) => void;
  onOpenSettlement: () => void;
  onToggleHistory: () => void;
};

type SettlementInputScreenProps = RoomScreenProps & {
  draftPlayers: SettlementDraftPlayer[];
  summary: SettlementDraftSummary;
  preview: SettlementPreviewResponseDto | null;
  previewErrorMessage: string | null;
  isPreviewCurrent: boolean;
  isPreviewLoading: boolean;
  isPreviewStale: boolean;
  isClosing: boolean;
  canPreview: boolean;
  canClose: boolean;
  onBack: () => void;
  onChangeFinalAmount: (roomPlayerId: string, value: string) => void;
  onPreview: () => void;
  onCloseSettlement: () => void;
};

const cardClassName = "rounded-lg border border-border bg-card p-4";
const mutedCardClassName = "rounded-lg border border-border bg-background/50 p-4";
const secondaryButtonClassName = "border border-border bg-background/60 text-foreground";
const inputClassName =
  "mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-accent";

export function WaitingRoom({
  data,
  isStarting,
  canStart,
  onStart,
  onCopyInvite,
  onShareInvite
}: WaitingRoomProps): JSX.Element {
  const { room, players } = data;

  return (
    <div className="space-y-4">
      <section className={cardClassName}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-emerald-300">
              {canStart ? "Все почти готовы" : "Ожидаем старт"}
            </p>
            <h2 className="mt-2 text-xl font-semibold">{room.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {canStart
                ? "Когда все на месте, можно запускать игру."
                : "Как только админ нажмёт «Начать игру», стол переключится в активный режим."}
            </p>
          </div>
          <RoleChip role={room.myRole} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-muted">
          <Metric label="Статус" value="Ожидание игроков" />
          <Metric label="Игроков" value={String(room.playersCount)} />
          <Metric label="Ребай" value={formatMinorMoney(room.rebuyAmountMinor, room.currency)} />
          <Metric
            label="Стартовый стек"
            value={
              room.startingStack
                ? `${room.startingStack.toLocaleString("ru-RU")} фишек`
                : "Не задан"
            }
          />
        </div>
      </section>

      <section className={`${cardClassName} space-y-3`}>
        <div>
          <p className="text-base font-semibold">Участники</p>
          <p className="mt-1 text-sm text-muted">
            Список виден всем, а старт доступен только админу.
          </p>
        </div>
        <div className="space-y-2">
          {players.map((player) => (
            <PlayerRow key={player.id} player={player} />
          ))}
        </div>
      </section>

      <section className={`${cardClassName} space-y-3`}>
        <p className="text-base font-semibold">Приглашение</p>
        <p className="text-sm leading-6 text-muted">
          Поделитесь ссылкой, чтобы друзья сразу попали в этот стол.
        </p>
        <div className="rounded-md border border-border bg-background/60 px-3 py-3 text-sm text-muted break-all">
          {room.inviteUrl}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button className="w-full" onClick={onCopyInvite}>
            Скопировать ссылку
          </Button>
          <Button className="w-full bg-slate-200 text-slate-950" onClick={onShareInvite}>
            Поделиться
          </Button>
        </div>
      </section>

      {canStart ? (
        <Button className="w-full" disabled={isStarting} onClick={onStart}>
          {isStarting ? "Запускаем игру" : "Начать игру"}
        </Button>
      ) : (
        <section className={mutedCardClassName}>
          <p className="text-sm font-medium">Ждём сигнал от админа</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Как только игра начнётся, здесь появятся закупы и состав активного стола.
          </p>
        </section>
      )}
    </div>
  );
}

export function ActiveRoomPlayer({
  data,
  canSelfRebuy,
  selfRebuyHint,
  isCreatingSelfRebuy,
  isHistoryOpen,
  historyState,
  onSelfRebuy,
  onToggleHistory
}: ActiveRoomPlayerProps): JSX.Element {
  const { room, players } = data;
  const activePlayers = getActivePlayers(players);
  const myPlayer = getMyPlayer(players, room.myPlayerId);

  return (
    <div className="space-y-4">
      <ActiveRoomHeader
        room={room}
        title="Игра идёт"
        description="Сейчас можно следить за составом стола и своими закупами."
      />

      <section className={`${cardClassName} space-y-3`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold">Твои закупы</p>
            <p className="mt-1 text-sm text-muted">
              Здесь видны ваши текущие суммы по игре.
            </p>
          </div>
          <RoleChip role={room.myRole} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm text-muted">
          <Metric label="Ребаев" value={String(myPlayer?.rebuyCount ?? 0)} />
          <Metric
            label="Всего"
            value={formatMinorMoney(myPlayer?.totalBuyinMinor ?? "0", room.currency)}
          />
        </div>
        <Button className="w-full" disabled={!canSelfRebuy || isCreatingSelfRebuy} onClick={onSelfRebuy}>
          {isCreatingSelfRebuy
            ? "Добавляем ребай"
            : `+ Ребай — ${formatMinorMoney(room.rebuyAmountMinor, room.currency)}`}
        </Button>
        <p className="text-sm text-muted">{selfRebuyHint}</p>
      </section>

      <section className={`${cardClassName} space-y-3`}>
        <div>
          <p className="text-base font-semibold">Игроки за столом</p>
          <p className="mt-1 text-sm text-muted">
            По каждому игроку видно текущее количество ребаев и общую сумму.
          </p>
        </div>
        <div className="space-y-2">
          {activePlayers.map((player) => (
            <PlayerTotalsRow key={player.id} player={player} currency={room.currency} />
          ))}
        </div>
      </section>

      <HistorySection
        currency={room.currency}
        historyState={historyState}
        isOpen={isHistoryOpen}
        onToggle={onToggleHistory}
      />
    </div>
  );
}

export function ActiveRoomAdmin({
  data,
  historyState,
  isHistoryOpen,
  addingRebuyForPlayerId,
  cancellingRebuyId,
  onAddRebuy,
  onCancelRebuy,
  onOpenSettlement,
  onToggleHistory
}: ActiveRoomAdminProps): JSX.Element {
  const { room, players } = data;
  const activePlayers = getActivePlayers(players);

  return (
    <div className="space-y-4">
      <ActiveRoomHeader
        room={room}
        title="Режим админа"
        description="Здесь можно быстро добавлять ребаи и проверять историю стола."
        badge="Админ"
      />

      <section className={`${cardClassName} space-y-3`}>
        <div>
          <p className="text-base font-semibold">Игроки</p>
          <p className="mt-1 text-sm text-muted">
            Добавляйте ребай только тем, кто сейчас играет за этим столом.
          </p>
        </div>
        <div className="space-y-3">
          {activePlayers.map((player) => (
            <article
              key={player.id}
              className="rounded-md border border-border bg-background/50 px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{player.displayName}</p>
                  <p className="mt-1 text-xs text-muted">
                    {getRoleText(player.role)} · {player.rebuyCount} ребаев
                  </p>
                </div>
                <p className="text-sm font-medium text-foreground">
                  {formatMinorMoney(player.totalBuyinMinor, room.currency)}
                </p>
              </div>
              <div className="mt-3">
                <Button
                  className="w-full"
                  disabled={addingRebuyForPlayerId === player.id}
                  onClick={() => onAddRebuy(player)}
                >
                  {addingRebuyForPlayerId === player.id
                    ? "Добавляем ребай"
                    : `+ Ребай — ${formatMinorMoney(room.rebuyAmountMinor, room.currency)}`}
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <HistorySection
        cancellingRebuyId={cancellingRebuyId}
        currency={room.currency}
        historyState={historyState}
        isAdmin
        isOpen={isHistoryOpen}
        onCancelRebuy={onCancelRebuy}
        onToggle={onToggleHistory}
      />

      <section className={`${cardClassName} space-y-3`}>
        <div>
          <p className="text-base font-semibold">Следующий этап</p>
          <p className="mt-1 text-sm text-muted">
            Когда все ребаи внесены, можно переходить к финальным суммам.
          </p>
        </div>
        <Button className={`${secondaryButtonClassName} w-full`} onClick={onOpenSettlement}>
          Перейти к расчёту
        </Button>
      </section>
    </div>
  );
}

export function SettlementInputScreen({
  data,
  draftPlayers,
  summary,
  preview,
  previewErrorMessage,
  isPreviewCurrent,
  isPreviewLoading,
  isPreviewStale,
  isClosing,
  canPreview,
  canClose,
  onBack,
  onChangeFinalAmount,
  onPreview,
  onCloseSettlement
}: SettlementInputScreenProps): JSX.Element {
  const { room } = data;
  const differenceMessage = getSettlementDifferenceMessage(summary.differenceMinor, room.currency);
  const previewResults = isPreviewCurrent ? preview?.players ?? [] : [];
  const previewTransfers = isPreviewCurrent ? preview?.transfers ?? [] : [];

  return (
    <div className="space-y-4">
      <section className={cardClassName}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-emerald-300">Расчёт игры</p>
            <h2 className="mt-2 text-xl font-semibold">{room.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Введите итог по каждому активному игроку и проверьте, кому и сколько передать
              после игры.
            </p>
          </div>
          <Button className={secondaryButtonClassName} onClick={onBack}>
            К столу
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-muted">
          <Metric
            label="Всего закупов"
            value={formatMinorMoney(summary.totalBuyinsMinor, room.currency)}
          />
          <Metric
            label="Финальные суммы"
            value={formatMinorMoney(summary.totalFinalAmountMinor, room.currency)}
          />
          <Metric
            label="Разница"
            value={formatMinorMoney(summary.differenceMinor, room.currency)}
          />
          <Metric label="Игроков" value={String(draftPlayers.length)} />
        </div>
      </section>

      {summary.isBalanced ? (
        <InfoText text="Баланс сошёлся. Теперь можно проверить итог и закрыть игру." />
      ) : differenceMessage ? (
        <InfoText text={differenceMessage} tone="error" />
      ) : null}

      {summary.hasMissingValues ? (
        <InfoText text="Ещё не для всех игроков указана финальная сумма." tone="error" />
      ) : null}

      {summary.hasInvalidValues ? (
        <InfoText
          text="Некоторые суммы не удалось распознать. Используйте формат вроде 7500 или 7500,50."
          tone="error"
        />
      ) : null}

      <section className={`${cardClassName} space-y-3`}>
        <div>
          <p className="text-base font-semibold">Финальные суммы</p>
          <p className="mt-1 text-sm text-muted">
            Это не перевод денег в приложении, а только итоговая инструкция по игре.
          </p>
        </div>
        <div className="space-y-3">
          {draftPlayers.map((player) => (
            <article
              key={player.roomPlayerId}
              className={cn(
                "rounded-md border bg-background/50 px-3 py-3",
                player.roomPlayerId === room.myPlayerId
                  ? "border-accent/50 bg-accent/5"
                  : "border-border"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{player.displayName}</p>
                    {player.roomPlayerId === room.myPlayerId ? (
                      <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[11px] text-accent">
                        Вы
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Закупы: {formatMinorMoney(player.totalBuyinMinor, room.currency)}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className={cn("text-sm font-medium", getNetResultClass(player.netResultMinor))}>
                    {player.netResultMinor === null
                      ? "Результат появится после ввода"
                      : formatMinorMoney(player.netResultMinor, room.currency)}
                  </p>
                  <p className="mt-1 text-xs text-muted">Предварительный итог</p>
                </div>
              </div>
              <label className="mt-3 block">
                <span className="text-sm font-medium text-foreground">Сколько осталось у игрока</span>
                <input
                  className={inputClassName}
                  inputMode="decimal"
                  placeholder="Например, 7500"
                  value={player.finalAmountInput}
                  onChange={(event) => onChangeFinalAmount(player.roomPlayerId, event.target.value)}
                />
              </label>
              {player.issue ? (
                <p className="mt-2 text-sm text-rose-200">{getSettlementIssueText(player.issue)}</p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className={`${cardClassName} space-y-3`}>
        <div>
          <p className="text-base font-semibold">Проверка расчёта</p>
          <p className="mt-1 text-sm text-muted">
            Сначала сверим итог с сервером, а потом уже закроем игру.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button className={`${secondaryButtonClassName} w-full`} onClick={onBack}>
            Вернуться к столу
          </Button>
          <Button className="w-full" disabled={!canPreview} onClick={onPreview}>
            {isPreviewLoading ? "Проверяем расчёт" : "Проверить расчёт"}
          </Button>
        </div>
        <Button className="w-full" disabled={!canClose} onClick={onCloseSettlement}>
          {isClosing ? "Закрываем игру" : "Закрыть игру и сохранить итог"}
        </Button>
        {previewErrorMessage ? <InfoText text={previewErrorMessage} tone="error" /> : null}
        {isPreviewStale ? (
          <InfoText text="Суммы изменились. Ещё раз проверьте расчёт перед закрытием." />
        ) : null}
      </section>

      {previewResults.length > 0 ? (
        <ResultsSection
          currency={room.currency}
          currentPlayerId={room.myPlayerId}
          description="Показываем, кто вышел в плюс, а кто заканчивает игру в минус."
          players={previewResults}
          title="Предварительный итог"
        />
      ) : null}

      {isPreviewCurrent && preview?.differenceMinor === "0" ? (
        <TransferInstructionsSection
          currency={room.currency}
          description="Это подсказка после игры: приложение только показывает, кому и сколько передать вручную."
          transfers={previewTransfers}
        />
      ) : null}
    </div>
  );
}

export function ClosedRoomResults({ data }: RoomScreenProps): JSX.Element {
  const { room, players, settlement } = data;
  const fallbackPlayers = buildFallbackResults(players);
  const resultPlayers = settlement?.players ?? fallbackPlayers;
  const totalBuyinsMinor = settlement?.totalBuyinsMinor ?? room.totalPotMinor;
  const totalFinalAmountMinor = settlement?.totalFinalAmountMinor ?? sumFinalAmounts(fallbackPlayers);

  return (
    <div className="space-y-4">
      <section className={cardClassName}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-emerald-300">Игра завершена</p>
            <h2 className="mt-2 text-xl font-semibold">{room.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Финальные суммы сохранены. Ниже итог по игрокам и инструкция по ручным
              переводам, если они нужны.
            </p>
          </div>
          <RoleChip role={room.myRole} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-muted">
          <Metric label="Игроков" value={String(resultPlayers.length)} />
          <Metric label="Общий стол" value={formatMinorMoney(totalBuyinsMinor, room.currency)} />
          <Metric
            label="Финальные суммы"
            value={formatMinorMoney(totalFinalAmountMinor, room.currency)}
          />
          <Metric
            label="Твой итог"
            value={formatMinorMoney(getMyNetResult(resultPlayers, room.myPlayerId), room.currency)}
          />
        </div>
      </section>

      {settlement ? null : (
        <InfoText
          text="Подробная инструкция по переводам здесь не сохранилась, но финальные суммы игроков доступны."
        />
      )}

      <ResultsSection
        currency={room.currency}
        currentPlayerId={room.myPlayerId}
        description="Список отсортирован по итоговому результату от большего плюса к большему минусу."
        players={resultPlayers}
        title="Итоги игры"
      />

      {settlement ? (
        <TransferInstructionsSection
          currency={room.currency}
          description="Если переводы нужны, здесь видно, кому и сколько передать вручную."
          transfers={settlement.transfers}
        />
      ) : null}
    </div>
  );
}

function ActiveRoomHeader({
  room,
  title,
  description,
  badge
}: {
  room: GetRoomResponseDto["room"];
  title: string;
  description: string;
  badge?: string;
}): JSX.Element {
  return (
    <section className={cardClassName}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-emerald-300">{title}</p>
          <h2 className="mt-2 text-xl font-semibold">{room.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {badge ? (
            <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-accent">
              {badge}
            </span>
          ) : null}
          <RoleChip role={room.myRole} />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-muted">
        <Metric label="Ребай" value={formatMinorMoney(room.rebuyAmountMinor, room.currency)} />
        <Metric label="Игроков" value={String(room.playersCount)} />
        <Metric label="Общий стол" value={formatMinorMoney(room.totalPotMinor, room.currency)} />
        <Metric
          label="Старт"
          value={
            room.startedAt
              ? new Intl.DateTimeFormat("ru-RU", {
                  hour: "2-digit",
                  minute: "2-digit"
                }).format(new Date(room.startedAt))
              : "Только что"
          }
        />
      </div>
    </section>
  );
}

function HistorySection({
  currency,
  historyState,
  isOpen,
  isAdmin = false,
  cancellingRebuyId = null,
  onCancelRebuy,
  onToggle
}: {
  currency: string;
  historyState: RebuyHistoryState;
  isOpen: boolean;
  isAdmin?: boolean;
  cancellingRebuyId?: string | null;
  onCancelRebuy?: (rebuy: RebuyHistoryItemDto) => void;
  onToggle: () => void;
}): JSX.Element {
  return (
    <section className={`${cardClassName} space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold">История ребаев</p>
          <p className="mt-1 text-sm text-muted">
            Здесь остаются и действующие ребаи, и отменённые записи.
          </p>
        </div>
        <Button className={secondaryButtonClassName} onClick={onToggle}>
          {isOpen ? "Скрыть" : "Открыть"}
        </Button>
      </div>

      {!isOpen ? null : (
        <div className="space-y-3">
          {historyState.status === "loading" || historyState.status === "idle" ? (
            <InfoText text="Подтягиваем последние записи..." />
          ) : null}

          {historyState.status === "error" && historyState.errorMessage ? (
            <InfoText text={historyState.errorMessage} tone="error" />
          ) : null}

          {historyState.status === "ready" && historyState.items.length === 0 ? (
            <InfoText text="История пока пустая." />
          ) : null}

          {historyState.items.map((rebuy) => (
            <article
              key={rebuy.id}
              className="rounded-md border border-border bg-background/50 px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{rebuy.playerName}</p>
                    <StatusChip status={rebuy.status} />
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {getRebuySourceText(rebuy)} · {formatEventTime(rebuy.createdAt)}
                  </p>
                </div>
                <p className="text-sm font-medium text-foreground">
                  {formatMinorMoney(rebuy.amountMinor, currency)}
                </p>
              </div>

              {rebuy.status === "CANCELLED" ? (
                <p className="mt-3 text-xs leading-5 text-muted">
                  Отменил {rebuy.cancelledByName ?? "админ"} {rebuy.cancelledAt ? `· ${formatEventTime(rebuy.cancelledAt)}` : ""}
                  {rebuy.cancellationReason ? ` · ${rebuy.cancellationReason}` : ""}
                </p>
              ) : null}

              {isAdmin && rebuy.status === "ACTIVE" && onCancelRebuy ? (
                <div className="mt-3">
                  <Button
                    className={`${secondaryButtonClassName} w-full`}
                    disabled={cancellingRebuyId === rebuy.id}
                    onClick={() => onCancelRebuy(rebuy)}
                  >
                    {cancellingRebuyId === rebuy.id ? "Отменяем ребай" : "Отменить ребай"}
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PlayerRow({ player }: { player: RoomPlayerDto }): JSX.Element {
  return (
    <article className="flex items-center justify-between rounded-md border border-border bg-background/50 px-3 py-3">
      <div>
        <p className="text-sm font-medium">{player.displayName}</p>
        <p className="mt-1 text-xs text-muted">{getRoleText(player.role)}</p>
      </div>
      <span className="text-xs text-muted">{getPlayerStatusText(player.status)}</span>
    </article>
  );
}

function PlayerTotalsRow({
  player,
  currency
}: {
  player: RoomPlayerDto;
  currency: string;
}): JSX.Element {
  return (
    <article className="flex items-center justify-between rounded-md border border-border bg-background/50 px-3 py-3">
      <div>
        <p className="text-sm font-medium">{player.displayName}</p>
        <p className="mt-1 text-xs text-muted">{getRoleText(player.role)}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-foreground">
          {formatMinorMoney(player.totalBuyinMinor, currency)}
        </p>
        <p className="mt-1 text-xs text-muted">{player.rebuyCount} ребаев</p>
      </div>
    </article>
  );
}

function RoleChip({ role }: { role: GetRoomResponseDto["room"]["myRole"] }): JSX.Element {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs",
        role === "OWNER" || role === "ADMIN"
          ? "bg-accent/20 text-accent"
          : "bg-background text-muted"
      )}
    >
      {getRoleText(role)}
    </span>
  );
}

function StatusChip({
  status
}: {
  status: RebuyHistoryItemDto["status"];
}): JSX.Element {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px]",
        status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-200"
      )}
    >
      {status === "ACTIVE" ? "Действует" : "Отменён"}
    </span>
  );
}

function Metric({
  label,
  value
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function ResultsSection({
  title,
  description,
  players,
  currency,
  currentPlayerId
}: {
  title: string;
  description: string;
  players: SettlementPlayerResultDto[];
  currency: string;
  currentPlayerId: string;
}): JSX.Element {
  const sortedPlayers = [...players].sort((left, right) => {
    const difference = BigInt(right.netResultMinor) - BigInt(left.netResultMinor);

    if (difference !== 0n) {
      return difference > 0n ? 1 : -1;
    }

    return left.displayName.localeCompare(right.displayName, "ru");
  });

  return (
    <section className={`${cardClassName} space-y-3`}>
      <div>
        <p className="text-base font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <div className="space-y-3">
        {sortedPlayers.map((player, index) => (
          <article
            key={player.roomPlayerId}
            className={cn(
              "rounded-md border bg-background/50 px-3 py-3",
              player.roomPlayerId === currentPlayerId
                ? "border-accent/50 bg-accent/5"
                : "border-border"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {index + 1}. {player.displayName}
                  </p>
                  {player.roomPlayerId === currentPlayerId ? (
                    <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[11px] text-accent">
                      Вы
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-muted">
                  Закупы: {formatMinorMoney(player.totalBuyinMinor, currency)} · Финал:{" "}
                  {formatMinorMoney(player.finalAmountMinor, currency)}
                </p>
              </div>
              <p className={cn("text-base font-semibold", getNetResultClass(player.netResultMinor))}>
                {formatMinorMoney(player.netResultMinor, currency)}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TransferInstructionsSection({
  transfers,
  currency,
  description
}: {
  transfers: SettlementTransferDto[];
  currency: string;
  description: string;
}): JSX.Element {
  return (
    <section className={`${cardClassName} space-y-3`}>
      <div>
        <p className="text-base font-semibold">Кому и сколько передать вручную</p>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      {transfers.length === 0 ? (
        <InfoText text="Расчёт сошёлся без ручных переводов." />
      ) : (
        <div className="space-y-3">
          {transfers.map((transfer) => (
            <article
              key={`${transfer.fromRoomPlayerId}-${transfer.toRoomPlayerId}-${transfer.amountMinor}`}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/50 px-3 py-3"
            >
              <div>
                <p className="text-sm font-medium text-foreground">
                  {transfer.fromName} передаёт {transfer.toName}
                </p>
                <p className="mt-1 text-xs text-muted">Инструкция после игры</p>
              </div>
              <p className="text-sm font-medium text-foreground">
                {formatMinorMoney(transfer.amountMinor, currency)}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function InfoText({
  text,
  tone = "muted"
}: {
  text: string;
  tone?: "muted" | "error";
}): JSX.Element {
  return (
    <p
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        tone === "error"
          ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
          : "border-border bg-background/40 text-muted"
      )}
    >
      {text}
    </p>
  );
}

function getRoleText(role: RoomPlayerDto["role"]): string {
  switch (role) {
    case "OWNER":
      return "Админ";
    case "ADMIN":
      return "Помогает вести";
    default:
      return "Игрок";
  }
}

function getSettlementIssueText(issue: SettlementDraftPlayer["issue"]): string {
  switch (issue) {
    case "missing":
      return "Здесь ещё не указана финальная сумма.";
    case "invalid":
      return "Не получилось распознать сумму. Подойдёт формат вроде 7500 или 7500,50.";
    case "negative":
      return "Финальная сумма не может быть меньше нуля.";
    default:
      return "";
  }
}

function getPlayerStatusText(status: RoomPlayerDto["status"]): string {
  switch (status) {
    case "LEFT":
      return "Вышел";
    case "REMOVED":
      return "Убран из игры";
    default:
      return "В игре";
  }
}

function getRebuySourceText(rebuy: RebuyHistoryItemDto): string {
  if (rebuy.source === "ADMIN_FOR_PLAYER") {
    return `Добавил ${rebuy.createdByName}`;
  }

  return `Добавил ${rebuy.playerName}`;
}

function formatEventTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}

function getNetResultClass(value: string | null): string {
  if (value === null) {
    return "text-muted";
  }

  const amount = BigInt(value);

  if (amount > 0n) {
    return "text-emerald-300";
  }

  if (amount < 0n) {
    return "text-rose-300";
  }

  return "text-foreground";
}

function buildFallbackResults(players: RoomPlayerDto[]): SettlementPlayerResultDto[] {
  return players
    .filter((player) => player.finalAmountMinor !== null)
    .map((player) => ({
      roomPlayerId: player.id,
      displayName: player.displayName,
      totalBuyinMinor: player.totalBuyinMinor,
      finalAmountMinor: player.finalAmountMinor ?? "0",
      netResultMinor:
        player.netResultMinor ??
        (BigInt(player.finalAmountMinor ?? "0") - BigInt(player.totalBuyinMinor)).toString()
    }));
}

function sumFinalAmounts(players: SettlementPlayerResultDto[]): string {
  return players
    .reduce((total, player) => total + BigInt(player.finalAmountMinor), 0n)
    .toString();
}

function getMyNetResult(players: SettlementPlayerResultDto[], myPlayerId: string): string {
  return players.find((player) => player.roomPlayerId === myPlayerId)?.netResultMinor ?? "0";
}
