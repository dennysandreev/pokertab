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

const cardClassName =
  "glass-card rounded-[1.25rem] border border-white/10 bg-[#1a1a1a]/80 p-4 backdrop-blur-xl";
const mutedCardClassName =
  "rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4";
const secondaryButtonClassName =
  "border border-white/10 bg-[#252525] text-white hover:bg-[#2d2d2d]";
const iconButtonClassName =
  "h-12 w-12 rounded-2xl border border-white/10 bg-[#252525] p-0 text-[#e5e2e1] hover:bg-[#2d2d2d]";
const inputClassName =
  "mt-3 min-h-12 w-full rounded-xl border border-white/10 bg-[#252525] px-4 py-3 text-right text-lg font-semibold text-white outline-none transition placeholder:text-[#8e9192] focus:border-[#4edea3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4edea3]";
const metricCardClassName =
  "rounded-xl border border-white/5 bg-white/[0.03] px-3 py-3";
const rowCardClassName =
  "rounded-[1rem] border border-white/10 bg-[#1c1b1b]/90 px-3 py-3";

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
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a0a7ab]">
              <span className="h-2 w-2 rounded-full bg-[#4edea3]" />
              {canStart ? "Все на месте" : "Ожидание игроков"}
            </div>
            <h2 className="mt-3 text-[2rem] font-bold leading-none text-white">{room.title}</h2>
            <p className="mt-3 max-w-[28rem] text-sm leading-6 text-[#c4c7c8]">
              {canStart
                ? "Лобби собрано. Можно запускать игру и сразу открыть закупы."
                : "Как только админ начнет игру, здесь появится активный стол и история ребаев."}
            </p>
          </div>
          <RoleChip role={room.myRole} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Metric label="Ребай" value={formatMinorMoney(room.rebuyAmountMinor, room.currency)} />
          <Metric
            label="Стартовый стек"
            value={
              room.startingStack
                ? `${room.startingStack.toLocaleString("ru-RU")} фишек`
                : "Не указан"
            }
          />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <article className={`${cardClassName} aspect-square`}>
          <div className="flex h-full flex-col justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8e9192]">
                Игроков
              </p>
              <p className="mt-2 text-4xl font-bold leading-none text-white">{room.playersCount}</p>
              <p className="mt-2 text-sm text-[#c4c7c8]">Состав лобби виден всем участникам.</p>
            </div>
            <Button className={iconButtonClassName} onClick={onCopyInvite}>
              <span className="material-symbols-outlined text-[20px]">content_copy</span>
            </Button>
          </div>
        </article>

        <article className={`${cardClassName} aspect-square`}>
          <div className="flex h-full flex-col justify-between">
            <div>
              <span className="material-symbols-outlined text-[#4edea3]">share</span>
              <p className="mt-3 text-lg font-semibold text-white">Пригласить игроков</p>
              <p className="mt-2 text-sm leading-6 text-[#c4c7c8]">
                Ссылка ведет прямо в эту комнату.
              </p>
            </div>
            <Button className={secondaryButtonClassName} onClick={onShareInvite}>
              <span className="material-symbols-outlined text-[18px]">send</span>
              Поделиться
            </Button>
          </div>
        </article>
      </section>

      <section className={cardClassName}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xl font-semibold text-white">Игроки в лобби</p>
            <p className="mt-1 text-sm text-[#c4c7c8]">Старт доступен только админу.</p>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#4edea3]">
            {room.playersCount} за столом
          </span>
        </div>
        <div className="mt-4 space-y-2">
          {players.map((player) => (
            <PlayerRow key={player.id} player={player} />
          ))}
        </div>
      </section>

      <section className={mutedCardClassName}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8e9192]">
          Ссылка комнаты
        </p>
        <p className="mt-2 break-all text-sm leading-6 text-[#e5e2e1]">{room.inviteUrl}</p>
      </section>

      {canStart ? (
        <div className="space-y-3">
          <Button className="w-full" disabled={isStarting} onClick={onStart}>
            <span className="material-symbols-outlined text-[20px]">play_circle</span>
            {isStarting ? "Запускаем игру" : "Начать игру"}
          </Button>
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8e9192]">
            Минимум два игрока для старта
          </p>
        </div>
      ) : (
        <InfoText text="Ждем, пока админ откроет игру." />
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
        title="Игра идет"
        description="Следите за составом стола и своими закупами в реальном времени."
      />

      <section className={`${cardClassName} relative overflow-hidden`}>
        <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-[#4edea3]/10 blur-3xl" />
        <div className="relative space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8e9192]">
                Ваши закупы
              </p>
              <p className="mt-2 text-[2.5rem] font-bold leading-none text-white">
                {formatMinorMoney(myPlayer?.totalBuyinMinor ?? "0", room.currency)}
              </p>
              <p className="mt-2 text-sm text-[#c4c7c8]">
                {myPlayer?.rebuyCount ?? 0} ребаев
              </p>
            </div>
            <RoleChip role={room.myRole} />
          </div>

          <Button
            className="w-full"
            disabled={!canSelfRebuy || isCreatingSelfRebuy}
            onClick={onSelfRebuy}
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            {isCreatingSelfRebuy
              ? "Добавляем ребай"
              : `Добавить ребай — ${formatMinorMoney(room.rebuyAmountMinor, room.currency)}`}
          </Button>
          <p className="text-sm leading-6 text-[#c4c7c8]">{selfRebuyHint}</p>
        </div>
      </section>

      <section className={cardClassName}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8e9192]">
            Игроки за столом
          </p>
          <span className="material-symbols-outlined text-[#8e9192]">group</span>
        </div>
        <div className="mt-4 space-y-2">
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
        title="Режим администратора"
        description="Добавляйте ребаи игрокам, сверяйте историю и готовьте финальный расчет."
        badge="LIVE"
      />

      <section className={cardClassName}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-lg font-semibold text-white">Управление игроками</p>
          <RoleChip role={room.myRole} />
        </div>
        <div className="mt-4 space-y-3">
          {activePlayers.map((player) => (
            <article
              key={player.id}
              className={cn(
                rowCardClassName,
                player.id === room.myPlayerId && "border-l-4 border-l-[#4edea3]"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {player.displayName}
                    {player.id === room.myPlayerId ? " (вы)" : ""}
                  </p>
                  <p className="mt-1 text-xs text-[#8e9192]">
                    {player.rebuyCount} ребаев · {formatMinorMoney(player.totalBuyinMinor, room.currency)}
                  </p>
                </div>
                <Button
                  className="h-9 rounded-xl px-3 text-sm"
                  disabled={addingRebuyForPlayerId === player.id}
                  onClick={() => onAddRebuy(player)}
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  {addingRebuyForPlayerId === player.id ? "Добавляем" : "Ребай"}
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

      <section className={cardClassName}>
        <div className="grid grid-cols-2 gap-3">
          <Button className={secondaryButtonClassName} onClick={onToggleHistory}>
            <span className="material-symbols-outlined text-[18px]">history</span>
            {isHistoryOpen ? "Скрыть историю" : "Открыть историю"}
          </Button>
          <Button className="w-full" onClick={onOpenSettlement}>
            <span className="material-symbols-outlined text-[18px]">calculate</span>
            К расчету
          </Button>
        </div>
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
  const progressPercent = Math.round((getSettlementProgress(draftPlayers) / Math.max(draftPlayers.length, 1)) * 100);

  return (
    <div className="space-y-4">
      <section className={cardClassName}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8e9192]">
              Расчет результатов
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">{room.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#c4c7c8]">
              Введите финальную сумму каждого активного игрока. Это только итоговая инструкция после игры.
            </p>
          </div>
          <Button className={secondaryButtonClassName} onClick={onBack}>
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            К столу
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Metric
            label="Всего закупов"
            value={formatMinorMoney(summary.totalBuyinsMinor, room.currency)}
          />
          <Metric
            label="Введено"
            value={formatMinorMoney(summary.totalFinalAmountMinor, room.currency)}
          />
          <Metric
            label="Разница"
            value={formatMinorMoney(summary.differenceMinor, room.currency)}
            tone={!summary.isBalanced ? "error" : "default"}
          />
        </div>
      </section>

      {summary.isBalanced ? (
        <InfoText text="Баланс сошелся. Можно проверить итог и закрыть игру." tone="success" />
      ) : differenceMessage ? (
        <InfoText text={differenceMessage} tone="error" />
      ) : null}

      {summary.hasMissingValues ? (
        <InfoText text="Не у всех игроков заполнена финальная сумма." tone="error" />
      ) : null}

      {summary.hasInvalidValues ? (
        <InfoText
          text="Одна из сумм выглядит неверно. Подойдет формат вроде 7500 или 7500,50."
          tone="error"
        />
      ) : null}

      <section className={cardClassName}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-white">Финальные суммы</p>
            <p className="mt-1 text-sm text-[#c4c7c8]">Введите, сколько осталось у каждого игрока.</p>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#4edea3]">
            {progressPercent}%
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {draftPlayers.map((player) => (
            <article
              key={player.roomPlayerId}
              className={cn(
                rowCardClassName,
                player.roomPlayerId === room.myPlayerId && "border-[#4edea3]/40 bg-[#4edea3]/[0.06]"
              )}
            >
              <div className="flex items-start gap-3">
                <PlayerAvatar name={player.displayName} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-white">{player.displayName}</p>
                    {player.roomPlayerId === room.myPlayerId ? (
                      <span className="rounded-full border border-[#4edea3]/20 bg-[#4edea3]/10 px-2 py-0.5 text-[11px] text-[#4edea3]">
                        Вы
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[#8e9192]">
                    Закупы: {formatMinorMoney(player.totalBuyinMinor, room.currency)}
                  </p>
                  <p className={cn("mt-1 text-xs font-semibold", getNetResultClass(player.netResultMinor))}>
                    {player.netResultMinor === null
                      ? "Результат появится после ввода"
                      : formatMinorMoney(player.netResultMinor, room.currency)}
                  </p>
                </div>
              </div>

              <label className="mt-3 block">
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-[#8e9192]">
                  Финальная сумма
                </span>
                <input
                  className={inputClassName}
                  inputMode="decimal"
                  placeholder="Например, 7 500"
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

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8e9192]">
            <span>Прогресс</span>
            <span className="text-[#4edea3]">{progressPercent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#4edea3] transition-[width]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </section>

      <section className={cardClassName}>
        <div className="space-y-3">
          <Button className="w-full" disabled={!canPreview} onClick={onPreview}>
            <span className="material-symbols-outlined text-[18px]">calculate</span>
            {isPreviewLoading ? "Проверяем расчет" : "Проверить расчет"}
          </Button>
          <Button className={secondaryButtonClassName} onClick={onBack}>
            Вернуться к столу
          </Button>
          <Button className="w-full" disabled={!canClose} onClick={onCloseSettlement}>
            <span className="material-symbols-outlined text-[18px]">done_all</span>
            {isClosing ? "Закрываем игру" : "Закрыть игру"}
          </Button>
        </div>

        {previewErrorMessage ? <div className="mt-3"><InfoText text={previewErrorMessage} tone="error" /></div> : null}
        {isPreviewStale ? (
          <div className="mt-3">
            <InfoText text="Суммы изменились. Еще раз проверьте расчет перед закрытием." />
          </div>
        ) : null}
      </section>

      {previewResults.length > 0 ? (
        <ResultsSection
          currency={room.currency}
          currentPlayerId={room.myPlayerId}
          description="Показываем плюс и минус по каждому игроку перед закрытием стола."
          players={previewResults}
          title="Предварительный итог"
        />
      ) : null}

      {isPreviewCurrent && preview?.differenceMinor === "0" ? (
        <TransferInstructionsSection
          currency={room.currency}
          description="Это ручная подсказка после игры. Переводы в приложении не выполняются."
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
  const myNetResult = getMyNetResult(resultPlayers, room.myPlayerId);
  const myTransfer = settlement
    ? getTransferForPlayer(settlement.transfers, room.myPlayerId)
    : null;

  return (
    <div className="space-y-4">
      <section className={cardClassName}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8e9192]">
          Игра завершена
        </p>
        <h2 className="mt-3 text-[2rem] font-bold leading-none text-white">Итоги сохранены</h2>
        <p className="mt-2 text-sm leading-6 text-[#c4c7c8]">
          {room.title} · {resultPlayers.length} игроков · Общий стол{" "}
          {formatMinorMoney(totalBuyinsMinor, room.currency)}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Metric label="Ваш итог" value={formatMinorMoney(myNetResult, room.currency)} />
          <Metric
            label="Финальные суммы"
            value={formatMinorMoney(totalFinalAmountMinor, room.currency)}
          />
        </div>
      </section>

      {myTransfer ? (
        <section className="rounded-[1.25rem] border border-[#4edea3]/30 bg-[#4edea3]/[0.08] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#4edea3]/15 text-[#4edea3]">
              <span className="material-symbols-outlined">
                {myTransfer.direction === "outgoing" ? "north_east" : "south_west"}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Что делать после игры</p>
              <p className="mt-1 text-sm text-[#c4c7c8]">
                {myTransfer.direction === "outgoing"
                  ? `Вам нужно передать ${formatMinorMoney(myTransfer.amountMinor, room.currency)} игроку ${myTransfer.counterpartyName}.`
                  : `Игрок ${myTransfer.counterpartyName} передает вам ${formatMinorMoney(myTransfer.amountMinor, room.currency)}.`}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {settlement ? null : (
        <InfoText text="Подробной инструкции по переводам нет, но финальные суммы игроков сохранены." />
      )}

      <ResultsSection
        currency={room.currency}
        currentPlayerId={room.myPlayerId}
        description="Список отсортирован от лучшего результата к худшему."
        players={resultPlayers}
        title="Итоги игры"
      />

      {settlement ? (
        <TransferInstructionsSection
          currency={room.currency}
          description="Здесь видно, кому и сколько передать вручную после игры."
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
    <section className={`${cardClassName} relative overflow-hidden`}>
      <div className="absolute right-[-2rem] top-[-2rem] h-32 w-32 rounded-full bg-[#4edea3]/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-white">{room.title}</h2>
            <div className="mt-2 flex items-center gap-2 text-sm text-[#c4c7c8]">
              <span className="h-2 w-2 rounded-full bg-[#4edea3]" />
              <span>{title}</span>
              {room.startedAt ? (
                <>
                  <span className="text-white/20">•</span>
                  <span>{formatStartedAt(room.startedAt)}</span>
                </>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-6 text-[#c4c7c8]">{description}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {badge ? (
              <span className="rounded-full border border-[#4edea3]/20 bg-[#4edea3]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4edea3]">
                {badge}
              </span>
            ) : null}
            <RoleChip role={room.myRole} />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-white/5 bg-white/[0.03] p-3">
          <CompactMetric label="Ребай" value={formatMinorMoney(room.rebuyAmountMinor, room.currency)} />
          <CompactMetric label="Общий стол" value={formatMinorMoney(room.totalPotMinor, room.currency)} />
          <CompactMetric label="Игроков" value={String(room.playersCount)} />
        </div>
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
  const activeHistoryItems = historyState.items.filter((item) => item.status === "ACTIVE");
  const averageAmountMinor =
    activeHistoryItems.length > 0
      ? (
          activeHistoryItems.reduce((total, item) => total + BigInt(item.amountMinor), 0n) /
          BigInt(activeHistoryItems.length)
        ).toString()
      : "0";

  return (
    <section className={cardClassName}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">История ребаев</h3>
          <p className="mt-1 text-sm text-[#c4c7c8]">Здесь остаются действующие и отмененные записи.</p>
        </div>
        <Button className={secondaryButtonClassName} onClick={onToggle}>
          <span className="material-symbols-outlined text-[18px]">history</span>
          {isOpen ? "Скрыть" : "Открыть"}
        </Button>
      </div>

      {isOpen ? (
        <>
          {historyState.status === "ready" && historyState.items.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label="Всего ребаев" value={String(activeHistoryItems.length)} />
              <Metric label="Средний чек" value={formatMinorMoney(averageAmountMinor, currency)} />
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
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
                className={cn(
                  rowCardClassName,
                  rebuy.status === "CANCELLED" && "border-dashed border-rose-400/30 opacity-70"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                        rebuy.status === "ACTIVE" ? "bg-[#4edea3]/10 text-[#4edea3]" : "bg-white/5 text-rose-200"
                      )}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {rebuy.status === "ACTIVE"
                          ? rebuy.source === "ADMIN_FOR_PLAYER"
                            ? "admin_panel_settings"
                            : "add_circle"
                          : "cancel"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white">
                          {getRebuyHeadline(rebuy)}
                        </p>
                        <StatusChip status={rebuy.status} />
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[#8e9192]">
                        {formatEventTime(rebuy.createdAt)}
                      </p>
                    </div>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 text-sm font-semibold",
                      rebuy.status === "ACTIVE" ? "text-[#4edea3]" : "text-[#c4c7c8] line-through"
                    )}
                  >
                    {formatMinorMoney(rebuy.amountMinor, currency)}
                  </p>
                </div>

                {rebuy.status === "CANCELLED" ? (
                  <p className="mt-3 text-xs leading-5 text-[#8e9192]">
                    Отменил {rebuy.cancelledByName ?? "админ"}
                    {rebuy.cancelledAt ? ` · ${formatEventTime(rebuy.cancelledAt)}` : ""}
                    {rebuy.cancellationReason ? ` · ${rebuy.cancellationReason}` : ""}
                  </p>
                ) : null}

                {isAdmin && rebuy.status === "ACTIVE" && onCancelRebuy ? (
                  <div className="mt-3">
                    <Button
                      className="w-full border border-rose-300/20 bg-rose-300/10 text-rose-100 hover:bg-rose-300/15"
                      disabled={cancellingRebuyId === rebuy.id}
                      onClick={() => onCancelRebuy(rebuy)}
                    >
                      <span className="material-symbols-outlined text-[18px]">remove_circle</span>
                      {cancellingRebuyId === rebuy.id ? "Отменяем ребай" : "Отменить ребай"}
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function PlayerRow({ player }: { player: RoomPlayerDto }): JSX.Element {
  return (
    <article className={`${rowCardClassName} flex items-center justify-between gap-3`}>
      <div className="flex min-w-0 items-center gap-3">
        <PlayerAvatar name={player.displayName} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{player.displayName}</p>
          <p className="mt-1 text-xs text-[#8e9192]">{getRoleText(player.role)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#8e9192]">{getPlayerStatusText(player.status)}</span>
        <span className="material-symbols-outlined text-[#4edea3]" style={{ fontVariationSettings: "'FILL' 1" }}>
          check_circle
        </span>
      </div>
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
    <article className={`${rowCardClassName} flex items-center justify-between gap-3`}>
      <div className="flex min-w-0 items-center gap-3">
        <PlayerAvatar name={player.displayName} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{player.displayName}</p>
          <p className="mt-1 text-xs text-[#8e9192]">{player.rebuyCount} ребаев</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-white">
          {formatMinorMoney(player.totalBuyinMinor, currency)}
        </p>
        <p className="mt-1 text-xs text-[#8e9192]">{getRoleText(player.role)}</p>
      </div>
    </article>
  );
}

function PlayerAvatar({ name }: { name: string }): JSX.Element {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#353434] text-xs font-semibold text-[#c4c7c8]">
      {initials || "?"}
    </div>
  );
}

function RoleChip({ role }: { role: GetRoomResponseDto["room"]["myRole"] }): JSX.Element {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        role === "OWNER" || role === "ADMIN"
          ? "border border-[#4edea3]/20 bg-[#4edea3]/10 text-[#4edea3]"
          : "border border-white/10 bg-white/[0.03] text-[#c4c7c8]"
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
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "ACTIVE"
          ? "bg-[#4edea3]/10 text-[#4edea3]"
          : "bg-rose-300/10 text-rose-200"
      )}
    >
      {status === "ACTIVE" ? "Действует" : "Отменен"}
    </span>
  );
}

function CompactMetric({
  label,
  value
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8e9192]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: "default" | "error";
}): JSX.Element {
  return (
    <div className={metricCardClassName}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8e9192]">
        {label}
      </p>
      <p className={cn("mt-2 text-sm font-semibold", tone === "error" ? "text-rose-200" : "text-white")}>
        {value}
      </p>
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
    <section className={cardClassName}>
      <div>
        <p className="text-lg font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm text-[#c4c7c8]">{description}</p>
      </div>

      <div className="mt-4 space-y-3">
        {sortedPlayers.map((player, index) => (
          <article
            key={player.roomPlayerId}
            className={cn(
              rowCardClassName,
              player.roomPlayerId === currentPlayerId && "border-[#4edea3]/30 bg-[#4edea3]/[0.05]"
            )}
          >
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold",
                  index === 0
                    ? "border-[#4edea3]/50 text-[#4edea3]"
                    : "border-white/10 text-[#c4c7c8]"
                )}
              >
                {index + 1}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-white">{player.displayName}</p>
                  {player.roomPlayerId === currentPlayerId ? (
                    <span className="text-[11px] font-medium text-[#4edea3]">Вы</span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#8e9192]">
                  {formatMinorMoney(player.totalBuyinMinor, currency)} →{" "}
                  {formatMinorMoney(player.finalAmountMinor, currency)}
                </p>
              </div>
              <p className={cn("text-right text-lg font-semibold", getNetResultClass(player.netResultMinor))}>
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
    <section className={cardClassName}>
      <div>
        <p className="text-lg font-semibold text-white">Кто кому переводит</p>
        <p className="mt-1 text-sm text-[#c4c7c8]">{description}</p>
      </div>

      {transfers.length === 0 ? (
        <div className="mt-4">
          <InfoText text="Расчет сошелся без ручных переводов." tone="success" />
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {transfers.map((transfer) => (
            <article
              key={`${transfer.fromRoomPlayerId}-${transfer.toRoomPlayerId}-${transfer.amountMinor}`}
              className={`${rowCardClassName} flex items-center justify-between gap-3`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-[#8e9192]">От</p>
                  <p className="truncate text-sm font-semibold text-white">{transfer.fromName}</p>
                </div>
                <span className="material-symbols-outlined text-[#4edea3]">arrow_forward</span>
                <div className="min-w-0">
                  <p className="text-xs text-[#8e9192]">Кому</p>
                  <p className="truncate text-sm font-semibold text-white">{transfer.toName}</p>
                </div>
              </div>
              <p className="shrink-0 text-lg font-semibold text-white">
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
  tone?: "muted" | "error" | "success";
}): JSX.Element {
  return (
    <p
      className={cn(
        "rounded-[1rem] border px-3 py-3 text-sm leading-6",
        tone === "error"
          ? "border-rose-300/30 bg-rose-300/10 text-rose-100"
          : tone === "success"
            ? "border-[#4edea3]/20 bg-[#4edea3]/10 text-[#d7ffee]"
            : "border-white/10 bg-white/[0.03] text-[#c4c7c8]"
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
      return "Здесь еще нет финальной суммы.";
    case "invalid":
      return "Не получилось распознать сумму. Подойдет формат вроде 7500 или 7500,50.";
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
      return "Убран";
    default:
      return "В игре";
  }
}

function getRebuyHeadline(rebuy: RebuyHistoryItemDto): string {
  if (rebuy.status === "CANCELLED") {
    return "Ребай отменен";
  }

  if (rebuy.source === "ADMIN_FOR_PLAYER") {
    return `Админ добавил ребай для ${rebuy.playerName}`;
  }

  return `${rebuy.playerName} добавил ребай`;
}

function formatEventTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}

function formatStartedAt(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getSettlementProgress(players: SettlementDraftPlayer[]): number {
  return players.filter((player) => player.finalAmountInput.trim() !== "" && player.issue !== "invalid").length;
}

function getNetResultClass(value: string | null): string {
  if (value === null) {
    return "text-[#c4c7c8]";
  }

  const amount = BigInt(value);

  if (amount > 0n) {
    return "text-[#4edea3]";
  }

  if (amount < 0n) {
    return "text-rose-200";
  }

  return "text-white";
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

function getTransferForPlayer(
  transfers: SettlementTransferDto[],
  myPlayerId: string
):
  | {
      amountMinor: string;
      counterpartyName: string;
      direction: "incoming" | "outgoing";
    }
  | null {
  const outgoing = transfers.find((transfer) => transfer.fromRoomPlayerId === myPlayerId);

  if (outgoing) {
    return {
      amountMinor: outgoing.amountMinor,
      counterpartyName: outgoing.toName,
      direction: "outgoing"
    };
  }

  const incoming = transfers.find((transfer) => transfer.toRoomPlayerId === myPlayerId);

  if (incoming) {
    return {
      amountMinor: incoming.amountMinor,
      counterpartyName: incoming.fromName,
      direction: "incoming"
    };
  }

  return null;
}
